/**
 * Uniswap on Monad mainnet (V2 + V3).
 *
 * Sources:
 * - @uniswap/sdk-core addresses (ChainId.MONAD = 143)
 * - Universal Router: https://github.com/Uniswap/universal-router/blob/main/deploy-addresses/monad.json
 */
export const UNISWAP_MAINNET = {
  WMON: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as const,
  /** Uniswap V2 */
  V2_FACTORY: "0x182a927119d56008d921126764bf884221b10f59" as const,
  V2_ROUTER02: "0x4b2ab38dbf28d31d467aa8993f6c2585981d6804" as const,
  /** Uniswap V3 */
  V3_FACTORY: "0x204faca1764b154221e35c0d20abb3c525710498" as const,
  QUOTER_V2: "0x2d01411773c8c24805306e89a41f7855c3c4fe65" as const,
  SWAP_ROUTER_02: "0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900" as const,
  /** Universal Router (V2.0 / V1.2 shared address on Monad) */
  UNIVERSAL_ROUTER: "0x0d97dc33264bfc1c226207428a79b26757fb9dc3" as const,
  /** Universal Router V2.1.1 */
  UNIVERSAL_ROUTER_V2_1_1: "0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7" as const,
} as const;

/** Prefer common meme tiers first; include Flap STANDARD/LOW/HIGH equivalents. */
export const UNISWAP_V3_FEE_TIERS = [3_000, 500, 10_000, 100, 2_500] as const;

export function isUniswapV2Router(address: string): boolean {
  return address.toLowerCase() === UNISWAP_MAINNET.V2_ROUTER02.toLowerCase();
}

export function isUniswapV3Router(address: string): boolean {
  return address.toLowerCase() === UNISWAP_MAINNET.SWAP_ROUTER_02.toLowerCase();
}

export function isUniswapRouter(address: string): boolean {
  return isUniswapV2Router(address) || isUniswapV3Router(address);
}
