import { parseEther, type PublicClient } from "viem";
import { buildBuyTransaction } from "./build-buy.js";

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
  fee?: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const data = buildBuyTransaction({
      tokenAddress: input.tokenAddress,
      amountOutMin: input.amountOutMin,
      recipient: input.recipient,
      deadline: input.deadline,
      routerAddress: input.routerAddress,
      amountInWei: input.amountInWei,
      fee: input.fee,
    });
    await input.publicClient.call({
      account: input.account,
      to: input.routerAddress,
      data,
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
