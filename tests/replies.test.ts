import { describe, expect, it } from "vitest";
import {
  SUCCESS_HEADLINES,
  buildCompactConfirmedReply,
  buildTradeReply,
  isDuplicateXReplyError,
  pickSuccessHeadline,
} from "../src/trading/replies.js";
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
  tokenSymbol: "MONEX",
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

  it("formats token as full CA and ticker without cashtag on received", () => {
    const text = buildTradeReply({ ...base, status: "CONFIRMED" }, "confirmed");
    expect(text).toContain("token: 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777");
    expect(text).not.toContain("/ $MONEX");
    expect(text).toContain("received: 3935.98324 MONEX");
    expect(text).not.toContain("$MONEX");
    expect(text).toContain(`tx: ${base.txHash}`);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it("builds a compact confirmed fallback without long hex strings", () => {
    const text = buildCompactConfirmedReply({ ...base, status: "CONFIRMED" });
    expect(text).toContain("spent: 1 MON");
    expect(text).toContain("MONEX");
    expect(text).not.toContain(base.tokenAddress);
    expect(text).not.toContain(base.txHash);
    expect(text).toMatch(/token: 0x978A\.\.\.7777/);
    expect(
      isDuplicateXReplyError(
        "failed to reply on X: tweets request failed (403): Duplicate content.",
      ),
    ).toBe(true);
  });

  it("rotates across 5 success headlines", () => {
    expect(SUCCESS_HEADLINES).toHaveLength(5);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(pickSuccessHeadline(String(i)));
    }
    expect(seen.size).toBe(5);
    for (const h of SUCCESS_HEADLINES) {
      expect(seen.has(h)).toBe(true);
    }
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
