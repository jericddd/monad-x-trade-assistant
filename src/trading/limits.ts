import type { TradeRecord } from "./trade-record.js";

export type LimitCheckResult =
  | { ok: true }
  | { ok: false; code: "HOURLY_LIMIT_EXCEEDED" | "DAILY_LIMIT_EXCEEDED" | "AMOUNT_TOO_LARGE" };

export type LimitState = {
  hourlyTradeTimestamps: number[];
  dailySpentWei: bigint;
  dailyDateUtc: string;
  reservedWei: bigint;
};

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function createInitialLimitState(): LimitState {
  return {
    hourlyTradeTimestamps: [],
    dailySpentWei: 0n,
    dailyDateUtc: utcDateKey(),
    reservedWei: 0n,
  };
}

export function pruneHourlyTimestamps(
  timestamps: number[],
  nowMs: number,
  windowMs = 60 * 60 * 1000,
): number[] {
  return timestamps.filter((timestamp) => nowMs - timestamp < windowMs);
}

export function checkTradeLimits(input: {
  state: LimitState;
  requestedAmountWei: bigint;
  maxMonPerTradeWei: bigint;
  maxMonPerDayWei: bigint;
  maxTradesPerHour: number;
  nowMs?: number;
}): LimitCheckResult {
  const nowMs = input.nowMs ?? Date.now();
  const today = utcDateKey(new Date(nowMs));

  let state = input.state;
  if (state.dailyDateUtc !== today) {
    state = {
      ...state,
      dailyDateUtc: today,
      dailySpentWei: 0n,
    };
  }

  if (input.requestedAmountWei > input.maxMonPerTradeWei) {
    return { ok: false, code: "AMOUNT_TOO_LARGE" };
  }

  const hourlyCount = pruneHourlyTimestamps(state.hourlyTradeTimestamps, nowMs).length;
  if (hourlyCount >= input.maxTradesPerHour) {
    return { ok: false, code: "HOURLY_LIMIT_EXCEEDED" };
  }

  const projectedDaily = state.dailySpentWei + state.reservedWei + input.requestedAmountWei;
  if (projectedDaily > input.maxMonPerDayWei) {
    return { ok: false, code: "DAILY_LIMIT_EXCEEDED" };
  }

  return { ok: true };
}

export function reserveTradeAmount(
  state: LimitState,
  amountWei: bigint,
  nowMs: number,
): LimitState {
  const hourlyTradeTimestamps = [
    ...pruneHourlyTimestamps(state.hourlyTradeTimestamps, nowMs),
    nowMs,
  ];

  return {
    ...state,
    hourlyTradeTimestamps,
    reservedWei: state.reservedWei + amountWei,
  };
}

export function releaseReservation(state: LimitState, amountWei: bigint): LimitState {
  return {
    ...state,
    reservedWei: state.reservedWei > amountWei ? state.reservedWei - amountWei : 0n,
  };
}

export function commitReservation(state: LimitState, amountWei: bigint): LimitState {
  return {
    ...state,
    dailySpentWei: state.dailySpentWei + amountWei,
    reservedWei: state.reservedWei > amountWei ? state.reservedWei - amountWei : 0n,
  };
}

export function isDuplicateTrade(existing: TradeRecord | null): boolean {
  if (!existing) {
    return false;
  }

  return ["SUBMITTING", "SUBMITTED", "CONFIRMED", "UNKNOWN", "DRY_RUN_SUCCESS"].includes(
    existing.status,
  );
}
