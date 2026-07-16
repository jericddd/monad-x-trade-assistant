import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  checkTradeLimits,
  createInitialLimitState,
  pruneHourlyTimestamps,
  reserveTradeAmount,
} from "../src/trading/limits.js";

describe("limits", () => {
  it("rejects amount above per-trade limit", () => {
    const result = checkTradeLimits({
      state: createInitialLimitState(),
      requestedAmountWei: parseEther("11"),
      maxMonPerTradeWei: parseEther("10"),
      maxMonPerDayWei: parseEther("30"),
      maxTradesPerHour: 3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AMOUNT_TOO_LARGE");
    }
  });

  it("rejects hourly limit", () => {
    const now = Date.now();
    const state = createInitialLimitState();
    state.hourlyTradeTimestamps = [now - 1000, now - 2000, now - 3000];

    const result = checkTradeLimits({
      state,
      requestedAmountWei: parseEther("1"),
      maxMonPerTradeWei: parseEther("10"),
      maxMonPerDayWei: parseEther("30"),
      maxTradesPerHour: 3,
      nowMs: now,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HOURLY_LIMIT_EXCEEDED");
    }
  });

  it("rejects daily limit", () => {
    const state = createInitialLimitState();
    state.dailySpentWei = parseEther("29");

    const result = checkTradeLimits({
      state,
      requestedAmountWei: parseEther("2"),
      maxMonPerTradeWei: parseEther("10"),
      maxMonPerDayWei: parseEther("30"),
      maxTradesPerHour: 3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DAILY_LIMIT_EXCEEDED");
    }
  });

  it("prunes hourly timestamps outside the rolling window", () => {
    const now = Date.now();
    const timestamps = [now - 3_700_000, now - 500_000];
    expect(pruneHourlyTimestamps(timestamps, now)).toEqual([now - 500_000]);
  });

  it("reserves trade amount in limit state", () => {
    const now = Date.now();
    const updated = reserveTradeAmount(createInitialLimitState(), parseEther("5"), now);
    expect(updated.reservedWei).toBe(parseEther("5"));
    expect(updated.hourlyTradeTimestamps).toHaveLength(1);
  });
});
