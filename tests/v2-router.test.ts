import { describe, expect, it } from "vitest";
import {
  isV2Router,
  NADFUN_MAINNET,
  DEFAULT_ALLOWED_ROUTERS,
} from "../src/blockchain/nadfun/config.js";
import { buildBuyTransaction } from "../src/blockchain/nadfun/build-buy.js";

describe("nadfun v2 router support", () => {
  it("includes v2 router in default allowlist", () => {
    expect(DEFAULT_ALLOWED_ROUTERS).toContain(NADFUN_MAINNET.V2_ROUTER);
    expect(isV2Router(NADFUN_MAINNET.V2_ROUTER)).toBe(true);
    expect(isV2Router(NADFUN_MAINNET.BONDING_CURVE_ROUTER)).toBe(false);
  });

  it("builds buyWithNative calldata for v2 router", () => {
    const data = buildBuyTransaction({
      tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
      amountOutMin: 1n,
      recipient: "0x0000000000000000000000000000000000000001",
      deadline: 1n,
      routerAddress: NADFUN_MAINNET.V2_ROUTER,
    });
    // buyWithNative selector
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });

  it("builds classic buy calldata for v1 bonding curve router", () => {
    const data = buildBuyTransaction({
      tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
      amountOutMin: 1n,
      recipient: "0x0000000000000000000000000000000000000001",
      deadline: 1n,
      routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
    });
    expect(data.startsWith("0x")).toBe(true);
  });
});
