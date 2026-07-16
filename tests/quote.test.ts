import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { MockQuoteProvider } from "../src/blockchain/nadfun/quote.js";
import { NADFUN_MAINNET } from "../src/blockchain/nadfun/config.js";

describe("quote provider", () => {
  const provider = new MockQuoteProvider();

  it("returns a positive quote for valid token", async () => {
    const quote = await provider.getBuyQuote({
      tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
      amountInWei: parseEther("5"),
    });

    expect(quote.expectedAmountOut).toBeGreaterThan(0n);
    expect(quote.routerAddress).toBe(NADFUN_MAINNET.BONDING_CURVE_ROUTER);
  });

  it("returns zero output for test token", async () => {
    const quote = await provider.getBuyQuote({
      tokenAddress: "0x978ae7298d48cf0f8d1fdb26abc12bfacfcc0000",
      amountInWei: parseEther("1"),
    });

    expect(quote.expectedAmountOut).toBe(0n);
  });

  it("returns locked token for test address", async () => {
    const quote = await provider.getBuyQuote({
      tokenAddress: "0x978ae7298d48cf0f8d1fdb26abc12bfacfccdead",
      amountInWei: parseEther("1"),
    });

    expect(quote.isLocked).toBe(true);
  });

  it("returns disallowed router for test address", async () => {
    const quote = await provider.getBuyQuote({
      tokenAddress: "0x978ae7298d48cf0f8d1fdb26abc12bfacfccbad1",
      amountInWei: parseEther("1"),
    });

    expect(quote.routerAddress).toBe("0x1111111111111111111111111111111111111111");
  });
});
