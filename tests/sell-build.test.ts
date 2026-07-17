import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { buildSellTransaction } from "../src/blockchain/nadfun/build-sell.js";
import { bondingCurveRouterAbi } from "../src/blockchain/nadfun/abis/bonding-curve-router.js";
import { dexRouterAbi } from "../src/blockchain/nadfun/abis/dex-router.js";
import { nadfunRouterV2Abi } from "../src/blockchain/nadfun/abis/nadfun-router-v2.js";
import { NADFUN_MAINNET } from "../src/blockchain/nadfun/config.js";

const TOKEN = "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777";
const TO = "0x0000000000000000000000000000000000000001";

describe("buildSellTransaction", () => {
  it("encodes V1 bonding-curve sell", () => {
    const data = buildSellTransaction({
      tokenAddress: TOKEN,
      amountIn: 1000n,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
    });
    const decoded = decodeFunctionData({ abi: bondingCurveRouterAbi, data });
    expect(decoded.functionName).toBe("sell");
  });

  it("encodes DEX router sell", () => {
    const data = buildSellTransaction({
      tokenAddress: TOKEN,
      amountIn: 1000n,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: NADFUN_MAINNET.DEX_ROUTER,
    });
    const decoded = decodeFunctionData({ abi: dexRouterAbi, data });
    expect(decoded.functionName).toBe("sell");
  });

  it("encodes V2 sellToNative", () => {
    const data = buildSellTransaction({
      tokenAddress: TOKEN,
      amountIn: 1000n,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: NADFUN_MAINNET.V2_ROUTER,
    });
    const decoded = decodeFunctionData({ abi: nadfunRouterV2Abi, data });
    expect(decoded.functionName).toBe("sellToNative");
  });
});
