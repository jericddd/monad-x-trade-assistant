import type { PublicClient } from "viem";
import { FlapTokenStatus } from "../flap/config.js";
import { getFlapTokenState } from "../flap/quote.js";
import { lensAbi } from "../nadfun/abis/lens.js";
import { nadfunRouterV2Abi } from "../nadfun/abis/nadfun-router-v2.js";
import { NADFUN_MAINNET } from "../nadfun/config.js";
import { uniswapV2FactoryAbi, uniswapV3FactoryAbi } from "../uniswap/abis.js";
import { UNISWAP_MAINNET, UNISWAP_V3_FEE_TIERS, isUniswapRouter } from "../uniswap/config.js";
import { FLAP_MAINNET, isFlapPortal } from "../flap/config.js";
import { isV2Router, isDexRouter } from "../nadfun/config.js";

/** Deployer / origin platform shown in portfolio (not always the execution router). */
export type TokenVenue = "nadfun" | "flap" | "uniswap";

export const VENUE_LABELS: Record<TokenVenue, string> = {
  nadfun: "Nad.fun",
  flap: "Flap.sh",
  uniswap: "Uniswap",
};

const ZERO = "0x0000000000000000000000000000000000000000";

/** Infer venue from a past trade router when available (fast path). */
export function venueFromRouter(routerAddress?: string | null): TokenVenue | null {
  if (!routerAddress) return null;
  if (isFlapPortal(routerAddress)) return "flap";
  if (isUniswapRouter(routerAddress)) return "uniswap";
  if (
    isV2Router(routerAddress) ||
    isDexRouter(routerAddress) ||
    routerAddress.toLowerCase() === NADFUN_MAINNET.BONDING_CURVE_ROUTER.toLowerCase()
  ) {
    return "nadfun";
  }
  return null;
}

async function isNadfunToken(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  lensAddress: `0x${string}`;
}): Promise<boolean> {
  try {
    const [, amountOut] = await input.publicClient.readContract({
      address: input.lensAddress,
      abi: lensAbi,
      functionName: "getAmountOut",
      args: [input.tokenAddress, 10n ** 15n, true],
    });
    if (amountOut > 0n) return true;
  } catch {
    // try V2
  }
  try {
    const amountOut = await input.publicClient.readContract({
      address: NADFUN_MAINNET.V2_ROUTER,
      abi: nadfunRouterV2Abi,
      functionName: "getAmountOut",
      args: [input.tokenAddress, 10n ** 15n, true],
    });
    return amountOut > 0n;
  } catch {
    return false;
  }
}

async function hasUniswapPool(input: {
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
    if (pair && pair.toLowerCase() !== ZERO) return true;
  } catch {
    // continue to V3
  }
  for (const fee of UNISWAP_V3_FEE_TIERS) {
    try {
      const pool = await input.publicClient.readContract({
        address: UNISWAP_MAINNET.V3_FACTORY,
        abi: uniswapV3FactoryAbi,
        functionName: "getPool",
        args: [UNISWAP_MAINNET.WMON, input.tokenAddress, fee],
      });
      if (pool && pool.toLowerCase() !== ZERO) return true;
    } catch {
      // next fee
    }
  }
  return false;
}

/**
 * Detect which platform deployed / hosts the token for portfolio badges.
 * Flap graduated tokens still report as Flap (deployer), not Uniswap.
 */
export async function detectTokenVenue(input: {
  publicClient: PublicClient;
  tokenAddress: `0x${string}`;
  lensAddress?: `0x${string}`;
  /** Optional hint from last trade router. */
  routerHint?: string | null;
}): Promise<TokenVenue | null> {
  const fromRouter = venueFromRouter(input.routerHint);
  // Router hint is reliable for Nad/Flap bonding curve trades.
  // For Uniswap router, still check Flap first — graduated Flap executes on Uni.
  if (fromRouter === "nadfun" || fromRouter === "flap") {
    return fromRouter;
  }

  const flap = await getFlapTokenState({
    publicClient: input.publicClient,
    tokenAddress: input.tokenAddress,
    portalAddress: FLAP_MAINNET.PORTAL,
  });
  if (flap && (flap.status === FlapTokenStatus.Tradable || flap.status === FlapTokenStatus.DEX)) {
    return "flap";
  }

  const nad = await isNadfunToken({
    publicClient: input.publicClient,
    tokenAddress: input.tokenAddress,
    lensAddress: input.lensAddress ?? NADFUN_MAINNET.LENS,
  });
  if (nad) return "nadfun";

  if (fromRouter === "uniswap") return "uniswap";

  if (await hasUniswapPool(input)) return "uniswap";

  return null;
}
