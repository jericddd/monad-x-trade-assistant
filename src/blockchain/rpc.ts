import { fallback, http, type Transport } from "viem";
import type { AppEnv } from "../env.js";

const DEFAULT_FALLBACK_RPCS = [
  "https://rpc1.monad.xyz",
  "https://rpc2.monad.xyz",
  "https://rpc3.monad.xyz",
  "https://monad-mainnet.drpc.org",
] as const;

export function resolveMonadRpcUrls(env: Partial<AppEnv> & { MONAD_RPC_FALLBACK_URLS?: string }): string[] {
  const primary = typeof env.MONAD_RPC_URL === "string" ? env.MONAD_RPC_URL.trim() : "";
  const fallbackRaw =
    typeof env.MONAD_RPC_FALLBACK_URLS === "string" && env.MONAD_RPC_FALLBACK_URLS.trim()
      ? env.MONAD_RPC_FALLBACK_URLS
      : DEFAULT_FALLBACK_RPCS.join(",");

  const extras = fallbackRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const urls = [primary, ...extras].filter(Boolean);
  return [...new Set(urls)];
}

/** Robust HTTP transport: longer timeout, retries, and multi-RPC fallback. */
export function createMonadTransport(rpcUrls: string[]): Transport {
  const urls = rpcUrls.length > 0 ? rpcUrls : [...DEFAULT_FALLBACK_RPCS];
  const transports = urls.map((url) =>
    http(url, {
      timeout: 30_000,
      retryCount: 2,
      retryDelay: 400,
    }),
  );

  if (transports.length === 1) {
    return transports[0]!;
  }

  return fallback(transports, { rank: false, retryCount: 2 });
}
