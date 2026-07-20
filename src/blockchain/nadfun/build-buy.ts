import { encodeFunctionData } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";
import { nadfunRouterV2Abi } from "./abis/nadfun-router-v2.js";
import { isV2Router } from "./config.js";
import { isFlapPortal, FLAP_NATIVE } from "../flap/config.js";
import { flapPortalAbi } from "../flap/abis/portal.js";
import { isUniswapV2Router, isUniswapV3Router, UNISWAP_MAINNET } from "../uniswap/config.js";
import { uniswapSwapRouter02Abi, uniswapV2RouterAbi } from "../uniswap/abis.js";

export type BuyCalldataInput = {
  tokenAddress: `0x${string}`;
  amountOutMin: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
  routerAddress?: `0x${string}`;
  /** Required for Flap + Uniswap (amount is also sent as tx value). */
  amountInWei?: bigint;
  /** Uniswap V3 fee tier. */
  fee?: number;
};

export function buildBuyTransaction(input: BuyCalldataInput): `0x${string}` {
  if (input.routerAddress && isFlapPortal(input.routerAddress)) {
    if (input.amountInWei == null) {
      throw new Error("amountInWei is required for Flap buys");
    }
    return encodeFunctionData({
      abi: flapPortalAbi,
      functionName: "swapExactInput",
      args: [
        {
          inputToken: FLAP_NATIVE,
          outputToken: input.tokenAddress,
          inputAmount: input.amountInWei,
          minOutputAmount: input.amountOutMin,
          permitData: "0x",
        },
      ],
    });
  }

  if (input.routerAddress && isUniswapV2Router(input.routerAddress)) {
    return encodeFunctionData({
      abi: uniswapV2RouterAbi,
      functionName: "swapExactETHForTokensSupportingFeeOnTransferTokens",
      args: [
        input.amountOutMin,
        [UNISWAP_MAINNET.WMON, input.tokenAddress],
        input.recipient,
        input.deadline,
      ],
    });
  }

  if (input.routerAddress && isUniswapV3Router(input.routerAddress)) {
    if (input.amountInWei == null) {
      throw new Error("amountInWei is required for Uniswap V3 buys");
    }
    const fee = input.fee ?? 3_000;
    return encodeFunctionData({
      abi: uniswapSwapRouter02Abi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: UNISWAP_MAINNET.WMON,
          tokenOut: input.tokenAddress,
          fee,
          recipient: input.recipient,
          amountIn: input.amountInWei,
          amountOutMinimum: input.amountOutMin,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
  }

  if (input.routerAddress && isV2Router(input.routerAddress)) {
    return encodeFunctionData({
      abi: nadfunRouterV2Abi,
      functionName: "buyWithNative",
      args: [
        {
          amountOutMin: input.amountOutMin,
          token: input.tokenAddress,
          to: input.recipient,
          deadline: input.deadline,
        },
      ],
    });
  }

  return encodeFunctionData({
    abi: bondingCurveRouterAbi,
    functionName: "buy",
    args: [
      {
        amountOutMin: input.amountOutMin,
        token: input.tokenAddress,
        to: input.recipient,
        deadline: input.deadline,
      },
    ],
  });
}
