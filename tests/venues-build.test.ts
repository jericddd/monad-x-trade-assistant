import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { buildBuyTransaction } from "../src/blockchain/nadfun/build-buy.js";
import { buildSellTransaction } from "../src/blockchain/nadfun/build-sell.js";
import { DEFAULT_ALLOWED_ROUTERS } from "../src/blockchain/nadfun/config.js";
import { FLAP_MAINNET, isFlapPortal } from "../src/blockchain/flap/config.js";
import { flapPortalAbi } from "../src/blockchain/flap/abis/portal.js";
import {
  UNISWAP_MAINNET,
  isUniswapV2Router,
  isUniswapV3Router,
} from "../src/blockchain/uniswap/config.js";
import { uniswapSwapRouter02Abi, uniswapV2RouterAbi } from "../src/blockchain/uniswap/abis.js";
import { flapLpFeeProfileToUniswapFee } from "../src/blockchain/flap/config.js";

const TOKEN = "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777";
const TO = "0x0000000000000000000000000000000000000001";

describe("multi-venue allowlist + calldata", () => {
  it("includes Flap Portal and Uniswap routers in default allowlist", () => {
    expect(DEFAULT_ALLOWED_ROUTERS).toContain(FLAP_MAINNET.PORTAL);
    expect(DEFAULT_ALLOWED_ROUTERS).toContain(UNISWAP_MAINNET.V2_ROUTER02);
    expect(DEFAULT_ALLOWED_ROUTERS).toContain(UNISWAP_MAINNET.SWAP_ROUTER_02);
    expect(isFlapPortal(FLAP_MAINNET.PORTAL)).toBe(true);
    expect(isUniswapV2Router(UNISWAP_MAINNET.V2_ROUTER02)).toBe(true);
    expect(isUniswapV3Router(UNISWAP_MAINNET.SWAP_ROUTER_02)).toBe(true);
  });

  it("maps Flap LP fee profiles to Uniswap V3 fees", () => {
    expect(flapLpFeeProfileToUniswapFee(0)).toBe(3_000);
    expect(flapLpFeeProfileToUniswapFee(1)).toBe(500);
    expect(flapLpFeeProfileToUniswapFee(2)).toBe(10_000);
  });

  it("builds Flap Portal swapExactInput buy (bonding curve)", () => {
    const data = buildBuyTransaction({
      tokenAddress: TOKEN,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: FLAP_MAINNET.PORTAL,
      amountInWei: 1_000_000_000_000_000_000n,
    });
    const decoded = decodeFunctionData({ abi: flapPortalAbi, data });
    expect(decoded.functionName).toBe("swapExactInput");
  });

  it("builds Flap Portal swapExactInput sell", () => {
    const data = buildSellTransaction({
      tokenAddress: TOKEN,
      amountIn: 1000n,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: FLAP_MAINNET.PORTAL,
    });
    const decoded = decodeFunctionData({ abi: flapPortalAbi, data });
    expect(decoded.functionName).toBe("swapExactInput");
  });

  it("builds Uniswap V2 buy calldata", () => {
    const data = buildBuyTransaction({
      tokenAddress: TOKEN,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: UNISWAP_MAINNET.V2_ROUTER02,
      amountInWei: 1n,
    });
    const decoded = decodeFunctionData({ abi: uniswapV2RouterAbi, data });
    expect(decoded.functionName).toBe("swapExactETHForTokensSupportingFeeOnTransferTokens");
  });

  it("builds Uniswap V2 sell calldata", () => {
    const data = buildSellTransaction({
      tokenAddress: TOKEN,
      amountIn: 1000n,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: UNISWAP_MAINNET.V2_ROUTER02,
    });
    const decoded = decodeFunctionData({ abi: uniswapV2RouterAbi, data });
    expect(decoded.functionName).toBe("swapExactTokensForETHSupportingFeeOnTransferTokens");
  });

  it("builds Uniswap V3 buy exactInputSingle", () => {
    const data = buildBuyTransaction({
      tokenAddress: TOKEN,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: UNISWAP_MAINNET.SWAP_ROUTER_02,
      amountInWei: 1_000_000_000_000_000_000n,
      fee: 3000,
    });
    const decoded = decodeFunctionData({ abi: uniswapSwapRouter02Abi, data });
    expect(decoded.functionName).toBe("exactInputSingle");
  });

  it("builds Uniswap V3 sell as multicall (swap + unwrap)", () => {
    const data = buildSellTransaction({
      tokenAddress: TOKEN,
      amountIn: 1000n,
      amountOutMin: 10n,
      recipient: TO,
      deadline: 99n,
      routerAddress: UNISWAP_MAINNET.SWAP_ROUTER_02,
      fee: 500,
    });
    const decoded = decodeFunctionData({ abi: uniswapSwapRouter02Abi, data });
    expect(decoded.functionName).toBe("multicall");
  });

  it("requires amountInWei for Flap buys", () => {
    expect(() =>
      buildBuyTransaction({
        tokenAddress: TOKEN,
        amountOutMin: 10n,
        recipient: TO,
        deadline: 99n,
        routerAddress: FLAP_MAINNET.PORTAL,
      }),
    ).toThrow(/amountInWei/);
  });
});
