import { describe, expect, it } from "vitest";
import { isIdempotentDuplicate, shouldProcessTweet } from "../src/trading/idempotency.js";
import type { TradeRecord } from "../src/trading/trade-record.js";

function record(status: TradeRecord["status"]): TradeRecord {
  return {
    version: 1,
    tweetId: "1",
    authorId: "123",
    commandTextHash: "abc",
    action: "buy",
    requestedAmountMon: "1",
    requestedAmountWei: "1",
    tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
    walletAddress: "0x0000000000000000000000000000000000000001",
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("idempotency", () => {
  it("treats submitted trades as duplicates", () => {
    expect(isIdempotentDuplicate(record("SUBMITTED"))).toBe(true);
    expect(shouldProcessTweet(record("SUBMITTED"))).toBe(false);
  });

  it("treats dry run success as duplicate", () => {
    expect(isIdempotentDuplicate(record("DRY_RUN_SUCCESS"))).toBe(true);
  });

  it("allows retry for rejected trades", () => {
    expect(isIdempotentDuplicate(record("REJECTED"))).toBe(false);
    expect(shouldProcessTweet(record("REJECTED"))).toBe(true);
  });
});
