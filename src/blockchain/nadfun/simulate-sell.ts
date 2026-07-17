import type { PublicClient } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";
import { nadfunRouterV2Abi } from "./abis/nadfun-router-v2.js";
import { isV2Router } from "./config.js";

export async function simulateSellTransaction(input: {
  publicClient: PublicClient;
  account: `0x${string}`;
  routerAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amountIn: bigint;
  amountOutMin: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
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
