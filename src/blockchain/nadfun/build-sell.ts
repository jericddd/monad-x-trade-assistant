import { encodeFunctionData } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";
import { dexRouterAbi } from "./abis/dex-router.js";
import { nadfunRouterV2Abi } from "./abis/nadfun-router-v2.js";
import { isDexRouter, isV2Router } from "./config.js";
import { isFlapPortal, FLAP_NATIVE } from "../flap/config.js";
import { flapPortalAbi } from "../flap/abis/portal.js";
import { isUniswapV2Router, isUniswapV3Router, UNISWAP_MAINNET } from "../uniswap/config.js";
import { uniswapSwapRouter02Abi, uniswapV2RouterAbi } from "../uniswap/abis.js";

export type SellCalldataInput = {
  tokenAddress: `0x${string}`;
  amountIn: bigint;
  amountOutMin: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
  routerAddress?: `0x${string}`;
  /** Uniswap V3 fee tier. */
  fee?: number;
};

export function buildSellTransaction(input: SellCalldataInput): `0x${string}` {
  const params = {
    amountIn: input.amountIn,
    amountOutMin: input.amountOutMin,
    token: input.tokenAddress,
    to: input.recipient,
    deadline: input.deadline,
  };

  if (input.routerAddress && isFlapPortal(input.routerAddress)) {
    return encodeFunctionData({
      abi: flapPortalAbi,
      functionName: "swapExactInput",
      args: [
        {
          inputToken: input.tokenAddress,
          outputToken: FLAP_NATIVE,
          inputAmount: input.amountIn,
          minOutputAmount: input.amountOutMin,
          permitData: "0x",
        },
      ],
    });
  }

  if (input.routerAddress && isUniswapV2Router(input.routerAddress)) {
    return encodeFunctionData({
      abi: uniswapV2RouterAbi,
      functionName: "swapExactTokensForETHSupportingFeeOnTransferTokens",
      args: [
        input.amountIn,
        input.amountOutMin,
        [input.tokenAddress, UNISWAP_MAINNET.WMON],
        input.recipient,
        input.deadline,
      ],
    });
  }

  if (input.routerAddress && isUniswapV3Router(input.routerAddress)) {
    const fee = input.fee ?? 3_000;
    // Swap token → WMON to the router, then unwrap to recipient.
    const swapData = encodeFunctionData({
      abi: uniswapSwapRouter02Abi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: input.tokenAddress,
          tokenOut: UNISWAP_MAINNET.WMON,
          fee,
          recipient: input.routerAddress,
          amountIn: input.amountIn,
          amountOutMinimum: input.amountOutMin,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    const unwrapData = encodeFunctionData({
      abi: uniswapSwapRouter02Abi,
      functionName: "unwrapWETH9",
      args: [input.amountOutMin, input.recipient],
    });
    return encodeFunctionData({
      abi: uniswapSwapRouter02Abi,
      functionName: "multicall",
      args: [[swapData, unwrapData]],
    });
  }

  if (input.routerAddress && isV2Router(input.routerAddress)) {
    return encodeFunctionData({
      abi: nadfunRouterV2Abi,
      functionName: "sellToNative",
      args: [params],
    });
  }

  if (input.routerAddress && isDexRouter(input.routerAddress)) {
    return encodeFunctionData({
      abi: dexRouterAbi,
      functionName: "sell",
      args: [params],
    });
  }

  return encodeFunctionData({
    abi: bondingCurveRouterAbi,
    functionName: "sell",
    args: [params],
  });
}
