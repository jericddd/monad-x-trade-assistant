import type { Hex, PublicClient, WalletClient } from "viem";
import { encodeFunctionData, keccak256, maxUint256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isAllowlistedRouter } from "../utils/address.js";
import { createTradeError } from "../trading/errors.js";
import { createSubmissionError } from "../trading/submission-error.js";
import { buildBuyTransaction } from "./nadfun/build-buy.js";
import { buildSellTransaction } from "./nadfun/build-sell.js";
import { erc20Abi } from "./nadfun/abis/erc20.js";
import { waitForReceipt } from "./receipts.js";

/** Require a local private-key account — never eth_signTransaction over RPC. */
function requireLocalSigner(walletClient: WalletClient) {
  const account = walletClient.account;
  if (!account || typeof account === "string" || account.type !== "local") {
    throw createTradeError(
      "CONFIGURATION_ERROR",
      "local signer required — refusing RPC eth_signTransaction",
    );
  }
  if (!account.signTransaction) {
    throw createTradeError("CONFIGURATION_ERROR", "local signer cannot sign transactions");
  }
  return account;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientBroadcastError(message: string): boolean {
  return /timeout|network|fetch|ECONNRESET|ECONNREFUSED|ETIMEDOUT|429|5\d\d|socket|aborted|failed to fetch/i.test(
    message,
  );
}

function isAlreadyKnownError(message: string): boolean {
  return /already known|known transaction|nonce too low/i.test(message);
}

async function isTxVisible(publicClient: PublicClient, hash: Hex): Promise<boolean> {
  try {
    const tx = await publicClient.getTransaction({ hash });
    return Boolean(tx);
  } catch {
    return false;
  }
}

async function waitForTxVisible(
  publicClient: PublicClient,
  hash: Hex,
  timeoutMs: number,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isTxVisible(publicClient, hash)) return true;
    await sleep(500);
  }
  return false;
}

async function signAndBroadcast(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  walletAddress: `0x${string}`;
  to: `0x${string}`;
  data: Hex;
  value?: bigint;
  gas?: bigint;
  gasPrice?: bigint;
}): Promise<`0x${string}`> {
  const account = requireLocalSigner(input.walletClient);
  if (account.address.toLowerCase() !== input.walletAddress.toLowerCase()) {
    throw createTradeError("CONFIGURATION_ERROR", "signer address mismatch");
  }

  let serialized: Hex;
  let hash: Hex;
  let nonce: number | undefined;

  try {
    const request = await input.walletClient.prepareTransactionRequest({
      account,
      to: input.to,
      data: input.data,
      value: input.value ?? 0n,
      gas: input.gas,
      gasPrice: input.gasPrice,
      chain: input.walletClient.chain,
    });
    nonce = typeof request.nonce === "number" ? request.nonce : undefined;
    const { account: _account, ...unsigned } = request as typeof request & {
      account?: unknown;
    };
    serialized = await account.signTransaction(
      unsigned as Parameters<NonNullable<typeof account.signTransaction>>[0],
    );
    hash = keccak256(serialized);
  } catch (error) {
    if (error instanceof Error && "code" in error) throw error;
    const message = error instanceof Error ? error.message : "sign failed";
    throw createTradeError("SUBMISSION_FAILED", message.slice(0, 120));
  }

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const sent = await input.publicClient.sendRawTransaction({
        serializedTransaction: serialized,
      });
      return (sent || hash) as `0x${string}`;
    } catch (error) {
      const lastMessage = error instanceof Error ? error.message : "broadcast failed";

      if (isAlreadyKnownError(lastMessage)) {
        if (await waitForTxVisible(input.publicClient, hash, 4_000)) {
          return hash as `0x${string}`;
        }
      }

      if (await isTxVisible(input.publicClient, hash)) {
        return hash as `0x${string}`;
      }

      const transient = isTransientBroadcastError(lastMessage);
      if (!transient && attempt >= 1) break;

      await sleep(250 * (attempt + 1));

      if (await waitForTxVisible(input.publicClient, hash, 1_200)) {
        return hash as `0x${string}`;
      }
    }
  }

  if (await waitForTxVisible(input.publicClient, hash, 3_000)) {
    return hash as `0x${string}`;
  }

  if (nonce != null) {
    try {
      const pending = await input.publicClient.getTransactionCount({
        address: input.walletAddress,
        blockTag: "pending",
      });
      if (pending > nonce) {
        throw createSubmissionError(
          "SUBMISSION_UNKNOWN",
          "nonce advanced after broadcast — check trading wallet before retrying",
          hash,
        );
      }
    } catch (error) {
      if (error instanceof Error && "code" in error) throw error;
    }
  }

  throw createSubmissionError("SUBMISSION_FAILED", "broadcast did not land — safe to retry", hash);
}

/**
 * Restricted signer — only Nad.fun buy transactions to allowlisted routers.
 *
 * Wallet-style flow: prepare + sign locally (so we always know the hash), then
 * broadcast the raw tx with retries / multi-RPC.
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

  const gasPrice = input.gasPrice != null ? (input.gasPrice * 112n) / 100n : undefined;

  return signAndBroadcast({
    publicClient: input.publicClient,
    walletClient: input.walletClient,
    walletAddress: input.walletAddress,
    to: input.routerAddress,
    data,
    value: input.amountInWei,
    gas: input.gas,
    gasPrice,
  });
}

/**
 * Sell tokens for MON on allowlisted Nad.fun routers.
 * Approves the router when allowance is insufficient, then submits sell.
 * Waits for receipts so callers never treat a reverted sell as success.
 */
export async function executeNadfunSell(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  walletAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amountIn: bigint;
  amountOutMin: bigint;
  routerAddress: `0x${string}`;
  deadline: bigint;
  allowedRouters: readonly `0x${string}`[];
  gas?: bigint;
  gasPrice?: bigint;
}): Promise<`0x${string}`> {
  if (!isAllowlistedRouter(input.routerAddress, input.allowedRouters)) {
    throw createTradeError("ROUTER_NOT_ALLOWED");
  }

  // Modest bump over network gas price — not a high custom fee.
  const gasPrice = input.gasPrice != null ? (input.gasPrice * 112n) / 100n : undefined;

  const allowance = (await input.publicClient.readContract({
    address: input.tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [input.walletAddress, input.routerAddress],
  })) as bigint;

  if (allowance < input.amountIn) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [input.routerAddress, maxUint256],
    });
    const approveHash = await signAndBroadcast({
      publicClient: input.publicClient,
      walletClient: input.walletClient,
      walletAddress: input.walletAddress,
      to: input.tokenAddress,
      data: approveData,
      value: 0n,
      gas: 80_000n,
      gasPrice,
    });
    const approveReceipt = await waitForReceipt(input.publicClient, approveHash, 25_000);
    if (!approveReceipt) {
      throw createSubmissionError(
        "SUBMISSION_UNKNOWN",
        "approve not confirmed yet — check trading wallet before retrying",
        approveHash,
      );
    }
    if (approveReceipt.status !== "success") {
      throw createSubmissionError("SUBMISSION_FAILED", "token approve reverted", approveHash);
    }
    await sleep(400);
  }

  const data = buildSellTransaction({
    tokenAddress: input.tokenAddress,
    amountIn: input.amountIn,
    amountOutMin: input.amountOutMin,
    recipient: input.walletAddress,
    deadline: input.deadline,
    routerAddress: input.routerAddress,
  });

  // V2 sells often need >300k; estimate with buffer, floor at 450k so we don't OOG.
  let gas = input.gas;
  if (gas == null) {
    try {
      const estimated = await input.publicClient.estimateGas({
        account: input.walletAddress,
        to: input.routerAddress,
        data,
        value: 0n,
      });
      const padded = (estimated * 130n) / 100n;
      gas = padded > 450_000n ? padded : 450_000n;
    } catch {
      gas = 550_000n;
    }
  }

  const txHash = await signAndBroadcast({
    publicClient: input.publicClient,
    walletClient: input.walletClient,
    walletAddress: input.walletAddress,
    to: input.routerAddress,
    data,
    value: 0n,
    gas,
    gasPrice,
  });

  const receipt = await waitForReceipt(input.publicClient, txHash, 45_000);
  if (!receipt) {
    throw createSubmissionError(
      "SUBMISSION_UNKNOWN",
      "sell broadcast but not confirmed yet — check trading wallet before retrying",
      txHash,
    );
  }
  if (receipt.status !== "success") {
    throw createSubmissionError(
      "SUBMISSION_FAILED",
      "sell reverted on-chain — no tokens moved",
      txHash,
    );
  }

  return txHash;
}

export function getTradeWalletAddress(privateKey: string): `0x${string}` {
  return privateKeyToAccount(privateKey as Hex).address;
}
