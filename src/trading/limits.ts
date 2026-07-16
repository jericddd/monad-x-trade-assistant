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

export function normalizeLimitState(state: LimitState, nowMs = Date.now()): LimitState {
  const today = utcDateKey(new Date(nowMs));
  if (state.dailyDateUtc !== today) {
    return {
      ...state,
      dailyDateUtc: today,
      dailySpentWei: 0n,
      hourlyTradeTimestamps: pruneHourlyTimestamps(state.hourlyTradeTimestamps, nowMs),
    };
  }

  return {
    ...state,
    hourlyTradeTimestamps: pruneHourlyTimestamps(state.hourlyTradeTimestamps, nowMs),
  };
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
  const state = normalizeLimitState(input.state, nowMs);

  if (input.requestedAmountWei > input.maxMonPerTradeWei) {
    return { ok: false, code: "AMOUNT_TOO_LARGE" };
  }

  if (state.hourlyTradeTimestamps.length >= input.maxTradesPerHour) {
    return { ok: false, code: "HOURLY_LIMIT_EXCEEDED" };
  }

  const projectedDaily = state.dailySpentWei + state.reservedWei + input.requestedAmountWei;
  if (projectedDaily > input.maxMonPerDayWei) {
    return { ok: false, code: "DAILY_LIMIT_EXCEEDED" };
  }

  return { ok: true };
}

/** Reserve spend while a live trade is submitting (does not count hourly yet). */
export function reserveSpend(state: LimitState, amountWei: bigint, nowMs = Date.now()): LimitState {
  const normalized = normalizeLimitState(state, nowMs);
  return {
    ...normalized,
    reservedWei: normalized.reservedWei + amountWei,
  };
}

export function releaseReservation(state: LimitState, amountWei: bigint): LimitState {
  return {
    ...state,
    reservedWei: state.reservedWei > amountWei ? state.reservedWei - amountWei : 0n,
  };
}

export function commitReservation(
  state: LimitState,
  amountWei: bigint,
  nowMs = Date.now(),
): LimitState {
  const normalized = normalizeLimitState(state, nowMs);
  return {
    ...normalized,
    dailySpentWei: normalized.dailySpentWei + amountWei,
    reservedWei: normalized.reservedWei > amountWei ? normalized.reservedWei - amountWei : 0n,
    hourlyTradeTimestamps: [...normalized.hourlyTradeTimestamps, nowMs],
  };
}

export function recordHourlyTrade(state: LimitState, nowMs = Date.now()): LimitState {
  const normalized = normalizeLimitState(state, nowMs);
  return {
    ...normalized,
    hourlyTradeTimestamps: [...normalized.hourlyTradeTimestamps, nowMs],
  };
}

/** @deprecated Use reserveSpend + commitReservation */
export function reserveTradeAmount(
  state: LimitState,
  amountWei: bigint,
  nowMs: number,
): LimitState {
  return reserveSpend(state, amountWei, nowMs);
}

export function isDuplicateTrade(existing: TradeRecord | null): boolean {
  if (!existing) {
    return false;
  }

  return ["SUBMITTING", "SUBMITTED", "CONFIRMED", "UNKNOWN", "DRY_RUN_SUCCESS"].includes(
    existing.status,
  );
}
