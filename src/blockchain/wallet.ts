import type { Hex, PublicClient, WalletClient } from "viem";
import { keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isAllowlistedRouter } from "../utils/address.js";
import { createTradeError } from "../trading/errors.js";
import { createSubmissionError } from "../trading/submission-error.js";
import { buildBuyTransaction } from "./nadfun/build-buy.js";

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

async function isTxVisible(
  publicClient: PublicClient,
  hash: Hex,
): Promise<boolean> {
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

/**
 * Restricted signer — only Nad.fun buy transactions to allowlisted routers.
 *
 * Wallet-style flow: prepare + sign locally (so we always know the hash), then
 * broadcast the raw tx with retries / multi-RPC. Re-broadcasting the same raw
 * payload is safe. This avoids the old "sendTransaction timed out with no hash"
 * UNKNOWN path that browser wallets rarely hit.
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

  // Slight tip over estimate to improve inclusion under load.
  const gasPrice =
    input.gasPrice != null ? (input.gasPrice * 112n) / 100n : undefined;

  let serialized: Hex;
  let hash: Hex;
  let nonce: number | undefined;

  try {
    const request = await input.walletClient.prepareTransactionRequest({
      account: input.walletAddress,
      to: input.routerAddress,
      data,
      value: input.amountInWei,
      gas: input.gas,
      gasPrice,
      chain: input.walletClient.chain,
    });
    nonce = typeof request.nonce === "number" ? request.nonce : undefined;
    serialized = await input.walletClient.signTransaction(request);
    hash = keccak256(serialized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "sign failed";
    throw createTradeError("SUBMISSION_FAILED", message.slice(0, 120));
  }

  const maxAttempts = 5;
  let lastMessage = "broadcast failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const sent = await input.publicClient.sendRawTransaction({
        serializedTransaction: serialized,
      });
      return (sent || hash) as `0x${string}`;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "broadcast failed";

      // Node already has this exact payload — treat as success if visible.
      if (isAlreadyKnownError(lastMessage)) {
        if (await waitForTxVisible(input.publicClient, hash, 4_000)) {
          return hash as `0x${string}`;
        }
      }

      if (await isTxVisible(input.publicClient, hash)) {
        return hash as `0x${string}`;
      }

      const transient = isTransientBroadcastError(lastMessage);
      if (!transient && attempt >= 1) {
        break;
      }

      await sleep(250 * (attempt + 1));

      // Same signed payload can be re-broadcast safely.
      if (await waitForTxVisible(input.publicClient, hash, 1_200)) {
        return hash as `0x${string}`;
      }
    }
  }

  if (await waitForTxVisible(input.publicClient, hash, 3_000)) {
    return hash as `0x${string}`;
  }

  // If the nonce moved, something may have landed — ask user to verify.
  if (nonce != null) {
    try {
      const pending = await input.publicClient.getTransactionCount({
        address: input.walletAddress,
        blockTag: "pending",
      });
      if (pending > nonce) {
        throw createSubmissionError(
          "SUBMISSION_UNKNOWN",
          "nonce advanced after broadcast — check explorer before retrying",
          hash,
        );
      }
    } catch (error) {
      if (error instanceof Error && "code" in error) throw error;
    }
  }

  // Signed but never seen on any RPC — safe to retry with a new command.
  throw createSubmissionError(
    "SUBMISSION_FAILED",
    "broadcast did not land — safe to retry",
    hash,
  );
}

export function getTradeWalletAddress(privateKey: string): `0x${string}` {
  return privateKeyToAccount(privateKey as Hex).address;
}
