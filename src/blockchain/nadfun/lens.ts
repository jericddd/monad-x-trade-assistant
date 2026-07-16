import type { PublicClient } from "viem";
import { lensAbi } from "./abis/lens.js";
import { nadfunRouterV2Abi } from "./abis/nadfun-router-v2.js";
import { NADFUN_MAINNET } from "./config.js";
import { createTradeError, TradeError } from "../../trading/errors.js";

export { lensAbi };

export type LensQuote = {
  routerAddress: `0x${string}`;
  expectedAmountOut: bigint;
};

function errorDetail(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  const enriched = error as Error & { shortMessage?: string; details?: string };
  return enriched.shortMessage ?? enriched.details ?? error.message;
}

function isV1UnsupportedTokenError(detail: string): boolean {
  const lower = detail.toLowerCase();
  return (
    lower.includes("invalid_inputs") ||
    lower.includes("division or modulo by zero") ||
    lower.includes("not a nad") ||
    lower.includes("unknown token")
  );
}

export async function queryV1LensQuote(input: {
  publicClient: PublicClient;
  lensAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
}): Promise<LensQuote> {
  try {
    const [router, amountOut] = await input.publicClient.readContract({
      address: input.lensAddress,
      abi: lensAbi,
      functionName: "getAmountOut",
      args: [input.tokenAddress, input.amountInWei, true],
    });

    return {
      routerAddress: router,
      expectedAmountOut: amountOut,
    };
  } catch (error) {
    const detail = errorDetail(error);
    if (isV1UnsupportedTokenError(detail)) {
      throw createTradeError("TOKEN_NOT_SUPPORTED", "token is not tradeable on Nad.fun V1");
    }
    throw createTradeError("QUOTE_FAILED", detail.slice(0, 160));
  }
}

export async function queryV2RouterQuote(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
}): Promise<LensQuote> {
  try {
    const amountOut = await input.publicClient.readContract({
      address: NADFUN_MAINNET.V2_ROUTER,
      abi: nadfunRouterV2Abi,
      functionName: "getAmountOut",
      args: [input.tokenAddress, input.amountInWei, true],
    });

    if (amountOut <= 0n) {
      throw createTradeError("ZERO_OUTPUT");
    }

    return {
      routerAddress: NADFUN_MAINNET.V2_ROUTER,
      expectedAmountOut: amountOut,
    };
  } catch (error) {
    if (error instanceof TradeError) {
      throw error;
    }
    const detail = errorDetail(error);
    throw createTradeError("QUOTE_FAILED", detail.slice(0, 160));
  }
}

/** Quote via V1 Lens first; fall back to V2 router for V2 tokens like MONEX. */
export async function queryLensQuote(input: {
  publicClient: PublicClient;
  lensAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
}): Promise<LensQuote> {
  try {
    return await queryV1LensQuote(input);
  } catch (error) {
    if (!(error instanceof TradeError) || error.code !== "TOKEN_NOT_SUPPORTED") {
      throw error;
    }
    return queryV2RouterQuote({
      publicClient: input.publicClient,
      tokenAddress: input.tokenAddress,
      amountInWei: input.amountInWei,
    });
  }
}

export async function isTokenLocked(input: {
  publicClient: PublicClient;
  lensAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
}): Promise<boolean> {
  try {
    return await input.publicClient.readContract({
      address: input.lensAddress,
      abi: lensAbi,
      functionName: "isLocked",
      args: [input.tokenAddress],
    });
  } catch {
    return false;
  }
}

export async function hasContractBytecode(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
}): Promise<boolean> {
  const bytecode = await input.publicClient.getBytecode({ address: input.tokenAddress });
  return Boolean(bytecode && bytecode !== "0x");
}
