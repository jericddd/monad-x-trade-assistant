/**
 * Flap.sh (Portal) on Monad mainnet.
 *
 * Sources:
 * - https://docs.flap.sh/flap/developers/deployed-contract-addresses
 * - https://docs.flap.sh/flap/developers/wallet-and-terminal-and-bot-developers/trade-tokens
 * - https://docs.flap.sh/flap/developers/wallet-and-terminal-and-bot-developers/inspect-a-token
 *
 * Portal version on Monad: v5.1.2
 * Use getTokenV7 on Monad (getTokenV8 is BNB-only for now).
 */
export const FLAP_MAINNET = {
  /** Flap Portal v5.1.2 — quote + swap entrypoint */
  PORTAL: "0x30e8ee7b5881bf2E158A0514f2150aabe2c68b23" as const,
  STANDARD_TOKEN_IMPL: "0xB88189aA1162850D75A1c1e16F837b7979994184" as const,
  TAX_TOKEN_V1_IMPL: "0x1C8847736521f5cD725dFB8f33c7c610826e7C42" as const,
  VERSION: "5.1.2",
} as const;

/** Native gas token sentinel used by Flap quote/swap APIs. */
export const FLAP_NATIVE = "0x0000000000000000000000000000000000000000" as const;

/**
 * TokenStatus from Flap Portal.
 * Tradable = bonding curve; DEX = graduated (swapExactInput does not support DEX yet —
 * route graduated Flap tokens through Uniswap / other DEX).
 */
export const FlapTokenStatus = {
  Invalid: 0,
  Tradable: 1,
  InDuel: 2,
  Killed: 3,
  DEX: 4,
  Staged: 5,
} as const;

/** On Monad: DEX0=Uniswap, DEX1=PancakeSwap, DEX2=Monday */
export const FlapDexId = {
  Uniswap: 0,
  PancakeSwap: 1,
  Monday: 2,
} as const;

/** Map Flap V3LPFeeProfile → Uniswap V3 fee tier (bps * 100). */
export function flapLpFeeProfileToUniswapFee(profile: number): number {
  switch (profile) {
    case 1: // LP_FEE_PROFILE_LOW
      return 500;
    case 2: // LP_FEE_PROFILE_HIGH
      return 10_000;
    default: // LP_FEE_PROFILE_STANDARD
      return 3_000;
  }
}

export function isFlapPortal(address: string): boolean {
  return address.toLowerCase() === FLAP_MAINNET.PORTAL.toLowerCase();
}
