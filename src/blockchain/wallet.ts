import type { Hex, PublicClient, WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isAllowlistedRouter } from "../utils/address.js";
import { createTradeError } from "../trading/errors.js";
import { buildBuyTransaction } from "./nadfun/build-buy.js";

/**
 * Restricted signer — only Nad.fun buy transactions to allowlisted routers.
 * Never expose a generic sendTransaction(to, data, value).
 */
export async function executeNadfunBuy(input: {
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
  void input.publicClient;

  if (!isAllowlistedRouter(input.routerAddress, input.allowedRouters)) {
    throw createTradeError("ROUTER_NOT_ALLOWED");
  }

  const data = buildBuyTransaction({
    tokenAddress: input.tokenAddress,
    amountOutMin: input.amountOutMin,
    recipient: input.walletAddress,
    deadline: input.deadline,
    routerAddress: input.routerAddress,
  });

  try {
    const hash = await input.walletClient.sendTransaction({
      account: input.walletAddress,
      to: input.routerAddress,
      data,
      value: input.amountInWei,
      gas: input.gas,
      gasPrice: input.gasPrice,
      chain: input.walletClient.chain,
    });
    return hash;
  } catch (error) {
    const message = error instanceof Error ? error.message : "submission failed";
    if (/timeout|network|fetch|ECONNRESET|5\d\d/i.test(message)) {
      throw createTradeError("SUBMISSION_UNKNOWN");
    }
    throw createTradeError("SUBMISSION_FAILED");
  }
}

export function getTradeWalletAddress(privateKey: string): `0x${string}` {
  return privateKeyToAccount(privateKey as Hex).address;
}
