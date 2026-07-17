import { describe, expect, it } from "vitest";
import {
  SITE_FOOTERS,
  SUCCESS_HEADLINES,
  buildCompactConfirmedReply,
  buildTradeReply,
  isDuplicateXReplyError,
  isPermanentXReplyError,
  pickSiteFooter,
  pickSuccessHeadline,
  stripCryptoAddresses,
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

  it("formats confirmed success with rotating site verify line under received", () => {
    const text = buildTradeReply({ ...base, status: "CONFIRMED" }, "confirmed");
    const headline = pickSuccessHeadline(base.tweetId);
    const footer = pickSiteFooter(base.tweetId);
    expect(text).toBe(
      [
        headline,
        "",
        "spent: 1 MON",
        "received: 3935.98324 $MONEX",
        footer,
      ].join("\n"),
    );
    expect(SITE_FOOTERS).toContain(footer);
    expect(text).not.toMatch(/0x[a-fA-F0-9]{6,}/);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it("builds compact confirmed fallback with same spent/received shape", () => {
    const text = buildCompactConfirmedReply({ ...base, status: "CONFIRMED" });
    expect(text).toContain("spent: 1 MON");
    expect(text).toContain("received: 3935.98324 $MONEX");
    expect(SITE_FOOTERS.some((line) => text.includes(line))).toBe(true);
    expect(text).not.toMatch(/0x[a-fA-F0-9]{6,}/);
    expect(
      isDuplicateXReplyError(
        "failed to reply on X: tweets request failed (403): Duplicate content.",
      ),
    ).toBe(true);
    expect(
      isPermanentXReplyError(
        "failed to reply on X: tweets request failed (403): You attempted to reply to a Tweet that is deleted or not visible to you.",
      ),
    ).toBe(true);
  });

  it("strips crypto addresses from arbitrary text", () => {
    expect(
      stripCryptoAddresses(`token: ${base.tokenAddress}\ntx: ${base.txHash}\nok`),
    ).toBe("token:\ntx:\nok");
  });

  it("rotates across 5 success headlines and 5 site footers", () => {
    expect(SUCCESS_HEADLINES).toHaveLength(5);
    expect(SITE_FOOTERS).toHaveLength(5);
    const headlines = new Set<string>();
    const footers = new Set<string>();
    for (let i = 0; i < 200; i++) {
      headlines.add(pickSuccessHeadline(String(i)));
      footers.add(pickSiteFooter(String(i)));
    }
    expect(headlines.size).toBe(5);
    expect(footers.size).toBe(5);
    for (const h of SUCCESS_HEADLINES) {
      expect(headlines.has(h)).toBe(true);
    }
    for (const f of SITE_FOOTERS) {
      expect(footers.has(f)).toBe(true);
    }
  });

  it("uses trade failed wording for failures", () => {
    const text = buildTradeReply(
      { ...base, failureMessageSafe: "boom", status: "FAILED" },
      "failed",
    );
    expect(text.startsWith("trade failed")).toBe(true);
    expect(text).toContain("reason: boom");
    expect(text).not.toMatch(/0x[a-fA-F0-9]{6,}/);
  });
});
