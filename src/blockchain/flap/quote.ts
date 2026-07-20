import type { PublicClient } from "viem";
import { flapPortalAbi } from "./abis/portal.js";
import {
  FLAP_MAINNET,
  FLAP_NATIVE,
  FlapDexId,
  FlapTokenStatus,
  flapLpFeeProfileToUniswapFee,
} from "./config.js";
import { quoteUniswapBuy, quoteUniswapSell, type UniswapVenueQuote } from "../uniswap/quote.js";

export type FlapVenueQuote = {
  routerAddress: `0x${string}`;
  expectedAmountOut: bigint;
  isLocked: boolean;
  venue: "flap" | "uniswap-v2" | "uniswap-v3";
  fee?: number;
  /** Bonding-curve (Tradable) vs graduated (DEX → Uniswap). */
  flapStatus: "tradable" | "dex";
};

export type FlapTokenState = {
  status: number;
  quoteTokenAddress: `0x${string}`;
  pool: `0x${string}`;
  lpFeeProfile: number;
  dexId: number;
};

export async function getFlapTokenState(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  portalAddress?: `0x${string}`;
}): Promise<FlapTokenState | null> {
  const portal = input.portalAddress ?? FLAP_MAINNET.PORTAL;
  try {
    const state = await input.publicClient.readContract({
      address: portal,
      abi: flapPortalAbi,
      functionName: "getTokenV7",
      args: [input.tokenAddress],
    });
    return {
      status: Number(state.status),
      quoteTokenAddress: state.quoteTokenAddress,
      pool: state.pool,
      lpFeeProfile: Number(state.lpFeeProfile),
      dexId: Number(state.dexId),
    };
  } catch {
    return null;
  }
}

async function quoteFlapPortal(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
  isBuy: boolean;
  portalAddress: `0x${string}`;
}): Promise<bigint> {
  const params = input.isBuy
    ? {
        inputToken: FLAP_NATIVE,
        outputToken: input.tokenAddress,
        inputAmount: input.amountInWei,
      }
    : {
        inputToken: input.tokenAddress,
        outputToken: FLAP_NATIVE,
        inputAmount: input.amountInWei,
      };

  const { result } = await input.publicClient.simulateContract({
    address: input.portalAddress,
    abi: flapPortalAbi,
    functionName: "quoteExactInput",
    args: [params],
  });
  return result;
}

/**
 * Quote a Flap token.
 * - Tradable (bonding curve): Portal quoteExactInput / swapExactInput
 * - DEX (graduated): Portal swap does not support DEX yet → Uniswap (DEX0 on Monad)
 */
export async function tryFlapQuote(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  amountInWei: bigint;
  isBuy?: boolean;
  portalAddress?: `0x${string}`;
}): Promise<FlapVenueQuote | null> {
  const isBuy = input.isBuy !== false;
  const portal = input.portalAddress ?? FLAP_MAINNET.PORTAL;
  const state = await getFlapTokenState({
    publicClient: input.publicClient,
    tokenAddress: input.tokenAddress,
    portalAddress: portal,
  });
  if (!state) return null;

  if (state.status === FlapTokenStatus.Tradable) {
    // Only native-quoted bonding curves for now (MON).
    if (state.quoteTokenAddress.toLowerCase() !== FLAP_NATIVE.toLowerCase()) {
      // ERC20-quoted Flap tokens need intermediate swaps — skip for v1.
      return null;
    }

    try {
      const amountOut = await quoteFlapPortal({
        publicClient: input.publicClient,
        tokenAddress: input.tokenAddress,
        amountInWei: input.amountInWei,
        isBuy,
        portalAddress: portal,
      });
      if (amountOut <= 0n) return null;
      return {
        routerAddress: portal,
        expectedAmountOut: amountOut,
        isLocked: false,
        venue: "flap",
        flapStatus: "tradable",
      };
    } catch {
      return null;
    }
  }

  if (state.status === FlapTokenStatus.DEX) {
    // Graduated Flap tokens: route via Uniswap when dexId is Uniswap (0).
    // Other DEXes (Pancake/Monday) are not wired yet — try Uniswap discovery anyway.
    const preferredFee =
      state.dexId === FlapDexId.Uniswap
        ? flapLpFeeProfileToUniswapFee(state.lpFeeProfile)
        : undefined;

    const uni: UniswapVenueQuote | null = isBuy
      ? await quoteUniswapBuy({
          publicClient: input.publicClient,
          tokenAddress: input.tokenAddress,
          amountInWei: input.amountInWei,
          preferredFee,
        })
      : await quoteUniswapSell({
          publicClient: input.publicClient,
          tokenAddress: input.tokenAddress,
          amountInWei: input.amountInWei,
          preferredFee,
        });

    if (!uni) return null;
    return {
      ...uni,
      isLocked: false,
      flapStatus: "dex",
    };
  }

  // Invalid / Killed / Staged / InDuel — not tradeable here
  return null;
}
