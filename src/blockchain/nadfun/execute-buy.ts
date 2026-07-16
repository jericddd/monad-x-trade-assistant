import type { PublicClient, WalletClient } from "viem";
import { executeNadfunBuy } from "../wallet.js";

export async function executeBuyTransaction(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  walletAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
  amountOutMin: bigint;
  routerAddress: `0x${string}`;
  deadline: bigint;
  allowedRouters: readonly `0x${string}`[];
  gas?: bigint;
  gasPrice?: bigint;
}): Promise<`0x${string}`> {
  return executeNadfunBuy(input);
}
