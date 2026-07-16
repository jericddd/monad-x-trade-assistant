import type { PublicClient } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";

export async function simulateBuyTransaction(input: {
  publicClient: PublicClient;
  account: `0x${string}`;
  routerAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
  amountOutMin: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await input.publicClient.simulateContract({
      account: input.account,
      address: input.routerAddress,
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
      value: input.amountInWei,
    });
    return { ok: true };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 120) : "transaction simulation failed";
    return { ok: false, reason };
  }
}
