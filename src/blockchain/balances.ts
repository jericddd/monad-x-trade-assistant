import type { PublicClient } from "viem";

export async function getNativeBalance(
  publicClient: PublicClient,
  address: `0x${string}`,
): Promise<bigint> {
  return publicClient.getBalance({ address });
}

export function hasSufficientReserve(input: {
  walletBalance: bigint;
  tradeAmount: bigint;
  estimatedGasCost: bigint;
  minimumReserve: bigint;
}): boolean {
  return input.walletBalance >= input.tradeAmount + input.estimatedGasCost + input.minimumReserve;
}
