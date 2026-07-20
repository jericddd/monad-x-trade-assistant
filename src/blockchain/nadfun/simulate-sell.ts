import type { PublicClient } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";
import { dexRouterAbi } from "./abis/dex-router.js";
import { nadfunRouterV2Abi } from "./abis/nadfun-router-v2.js";
import { isDexRouter, isV2Router } from "./config.js";
import { isFlapPortal } from "../flap/config.js";
import { isUniswapRouter } from "../uniswap/config.js";
import { buildSellTransaction } from "./build-sell.js";

export async function simulateSellTransaction(input: {
  publicClient: PublicClient;
  account: `0x${string}`;
  routerAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amountIn: bigint;
  amountOutMin: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
  fee?: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    if (isFlapPortal(input.routerAddress) || isUniswapRouter(input.routerAddress)) {
      const data = buildSellTransaction({
        tokenAddress: input.tokenAddress,
        amountIn: input.amountIn,
        amountOutMin: input.amountOutMin,
        recipient: input.recipient,
        deadline: input.deadline,
        routerAddress: input.routerAddress,
        fee: input.fee,
      });
      await input.publicClient.call({
        account: input.account,
        to: input.routerAddress,
        data,
        value: 0n,
      });
      return { ok: true };
    }

    const params = {
      amountIn: input.amountIn,
      amountOutMin: input.amountOutMin,
      token: input.tokenAddress,
      to: input.recipient,
      deadline: input.deadline,
    };

    if (isV2Router(input.routerAddress)) {
      await input.publicClient.simulateContract({
        account: input.account,
        address: input.routerAddress,
        abi: nadfunRouterV2Abi,
        functionName: "sellToNative",
        args: [params],
      });
      return { ok: true };
    }

    if (isDexRouter(input.routerAddress)) {
      await input.publicClient.simulateContract({
        account: input.account,
        address: input.routerAddress,
        abi: dexRouterAbi,
        functionName: "sell",
        args: [params],
      });
      return { ok: true };
    }

    await input.publicClient.simulateContract({
      account: input.account,
      address: input.routerAddress,
      abi: bondingCurveRouterAbi,
      functionName: "sell",
      args: [params],
    });
    return { ok: true };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 120) : "transaction simulation failed";
    return { ok: false, reason };
  }
}
