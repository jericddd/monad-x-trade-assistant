import { parseEther, type PublicClient } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";
import { nadfunRouterV2Abi } from "./abis/nadfun-router-v2.js";
import { isV2Router } from "./config.js";

/** Enough native balance for dry-run eth_call simulation without a funded wallet. */
const SIMULATION_BALANCE_OVERRIDE = parseEther("1000");

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
    if (isV2Router(input.routerAddress)) {
      await input.publicClient.simulateContract({
        account: input.account,
        address: input.routerAddress,
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
        value: input.amountInWei,
        stateOverride: [
          {
            address: input.account,
            balance: SIMULATION_BALANCE_OVERRIDE,
          },
        ],
      });
      return { ok: true };
    }

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
      stateOverride: [
        {
          address: input.account,
          balance: SIMULATION_BALANCE_OVERRIDE,
        },
      ],
    });
    return { ok: true };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 120) : "transaction simulation failed";
    return { ok: false, reason };
  }
}
