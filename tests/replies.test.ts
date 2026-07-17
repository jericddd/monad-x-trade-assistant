import { describe, expect, it } from "vitest";
import { buildTradeReply } from "../src/trading/replies.js";
import type { TradeRecord } from "../src/trading/trade-record.js";

const base: TradeRecord = {
  version: 1,
  tweetId: "1",
  authorId: "1",
  commandTextHash: "abc",
  action: "buy",
  source: "x",
  requestedAmountMon: "1",
  requestedAmountWei: "1000000000000000000",
  tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
  walletAddress: "0x0000000000000000000000000000000000000001",
  expectedAmountOut: "3935983240000000000000",
  minimumAmountOut: "3817903742000000000000",
  status: "SUBMITTED",
  txHash: "0x73b3aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa47f0",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("buildTradeReply", () => {
  it("does not reply on submitted (single success reply later)", () => {
    expect(buildTradeReply(base, "submitted")).toBe("");
  });

  it("replies once with trade successful and full hashes", () => {
    const text = buildTradeReply({ ...base, status: "CONFIRMED" }, "confirmed");
    expect(text.startsWith("trade successful")).toBe(true);
    expect(text).toContain("spent: 1 MON");
    expect(text).toContain(`token: ${base.tokenAddress}`);
    expect(text).toContain(`tx: ${base.txHash}`);
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toContain("…");
  });

  it("uses trade failed wording for failures", () => {
    const text = buildTradeReply(
      { ...base, failureMessageSafe: "boom", status: "FAILED" },
      "failed",
    );
    expect(text.startsWith("trade failed")).toBe(true);
    expect(text).toContain("reason: boom");
  });
});
