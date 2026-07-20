import type { PublicClient } from "viem";
import {
  uniswapQuoterV2Abi,
  uniswapV2FactoryAbi,
  uniswapV2RouterAbi,
  uniswapV3FactoryAbi,
} from "./abis.js";
import { UNISWAP_MAINNET, UNISWAP_V3_FEE_TIERS } from "./config.js";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export type UniswapVenueQuote = {
  routerAddress: `0x${string}`;
  expectedAmountOut: bigint;
  venue: "uniswap-v2" | "uniswap-v3";
  fee?: number;
};

async function hasV2Pair(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
}): Promise<boolean> {
  try {
    const pair = await input.publicClient.readContract({
      address: UNISWAP_MAINNET.V2_FACTORY,
      abi: uniswapV2FactoryAbi,
      functionName: "getPair",
      args: [UNISWAP_MAINNET.WMON, input.tokenAddress],
    });
    return Boolean(pair && pair.toLowerCase() !== ZERO);
  } catch {
    return false;
  }
}

async function quoteV2(input: {
  publicClient: PublicClient;
  path: readonly [`0x${string}`, `0x${string}`];
  amountInWei: bigint;
}): Promise<bigint | null> {
  try {
    const amounts = await input.publicClient.readContract({
      address: UNISWAP_MAINNET.V2_ROUTER02,
      abi: uniswapV2RouterAbi,
      functionName: "getAmountsOut",
      args: [input.amountInWei, [...input.path]],
    });
    const out = amounts[amounts.length - 1] ?? 0n;
    return out > 0n ? out : null;
  } catch {
    return null;
  }
}

async function findV3PoolFee(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  preferredFee?: number;
}): Promise<number | null> {
  const fees = input.preferredFee
    ? [input.preferredFee, ...UNISWAP_V3_FEE_TIERS.filter((f) => f !== input.preferredFee)]
    : [...UNISWAP_V3_FEE_TIERS];

  for (const fee of fees) {
    try {
      const pool = await input.publicClient.readContract({
        address: UNISWAP_MAINNET.V3_FACTORY,
        abi: uniswapV3FactoryAbi,
        functionName: "getPool",
        args: [UNISWAP_MAINNET.WMON, input.tokenAddress, fee],
      });
      if (pool && pool.toLowerCase() !== ZERO) {
        return fee;
      }
    } catch {
      // try next fee
    }
  }
  return null;
}

async function quoteV3ExactInputSingle(input: {
  publicClient: PublicClient;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountInWei: bigint;
  fee: number;
}): Promise<bigint | null> {
  try {
    const { result } = await input.publicClient.simulateContract({
      address: UNISWAP_MAINNET.QUOTER_V2,
      abi: uniswapQuoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
          amountIn: input.amountInWei,
          fee: input.fee,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    const amountOut = result[0];
    return amountOut > 0n ? amountOut : null;
  } catch {
    return null;
  }
}

export async function quoteUniswapBuy(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
  preferredFee?: number;
}): Promise<UniswapVenueQuote | null> {
  if (await hasV2Pair(input)) {
    const out = await quoteV2({
      publicClient: input.publicClient,
      path: [UNISWAP_MAINNET.WMON, input.tokenAddress],
      amountInWei: input.amountInWei,
    });
    if (out != null) {
      return {
        routerAddress: UNISWAP_MAINNET.V2_ROUTER02,
        expectedAmountOut: out,
        venue: "uniswap-v2",
      };
    }
  }

  const fee = await findV3PoolFee(input);
  if (fee == null) return null;

  const out = await quoteV3ExactInputSingle({
    publicClient: input.publicClient,
    tokenIn: UNISWAP_MAINNET.WMON,
    tokenOut: input.tokenAddress,
    amountInWei: input.amountInWei,
    fee,
  });
  if (out == null) return null;

  return {
    routerAddress: UNISWAP_MAINNET.SWAP_ROUTER_02,
    expectedAmountOut: out,
    venue: "uniswap-v3",
    fee,
  };
}

export async function quoteUniswapSell(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
  preferredFee?: number;
}): Promise<UniswapVenueQuote | null> {
  if (await hasV2Pair(input)) {
    const out = await quoteV2({
      publicClient: input.publicClient,
      path: [input.tokenAddress, UNISWAP_MAINNET.WMON],
      amountInWei: input.amountInWei,
    });
    if (out != null) {
      return {
        routerAddress: UNISWAP_MAINNET.V2_ROUTER02,
        expectedAmountOut: out,
        venue: "uniswap-v2",
      };
    }
  }

  const fee = await findV3PoolFee(input);
  if (fee == null) return null;

  const out = await quoteV3ExactInputSingle({
    publicClient: input.publicClient,
    tokenIn: input.tokenAddress,
    tokenOut: UNISWAP_MAINNET.WMON,
    amountInWei: input.amountInWei,
    fee,
  });
  if (out == null) return null;

  return {
    routerAddress: UNISWAP_MAINNET.SWAP_ROUTER_02,
    expectedAmountOut: out,
    venue: "uniswap-v3",
    fee,
  };
}

/** Standalone Uniswap discovery (any token with a WMON pool). */
export async function tryUniswapQuote(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
  isBuy?: boolean;
  preferredFee?: number;
}): Promise<(UniswapVenueQuote & { isLocked: boolean }) | null> {
  const isBuy = input.isBuy !== false;
  const quote = isBuy ? await quoteUniswapBuy(input) : await quoteUniswapSell(input);
  if (!quote) return null;
  return { ...quote, isLocked: false };
}
