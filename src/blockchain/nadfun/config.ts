/**
 * Official Nad.fun mainnet contract addresses.
 *
 * Sources:
 * - https://nad.fun/trading.md
 * - https://github.com/Naddotfun/contract-v3-abi
 * - https://nad.fun/abi.md
 */
export const NADFUN_MAINNET = {
  LENS: "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea" as const,
  BONDING_CURVE_ROUTER: "0x6F6B8F1a20703309951a5127c45B49b1CD981A22" as const,
  DEX_ROUTER: "0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137" as const,
  BONDING_CURVE: "0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE" as const,
  WMON: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as const,
  DEX_FACTORY: "0x6B5F564339DbAD6b780249827f2198a841FEB7F3" as const,
  /** NadFun V2 user-facing router (MONEX and other V2 tokens). */
  V2_ROUTER: "0x8986C8fD44eb85294A725a7e61AF35E76bA26F91" as const,
} as const;

export const DEFAULT_ALLOWED_ROUTERS = [
  NADFUN_MAINNET.BONDING_CURVE_ROUTER,
  NADFUN_MAINNET.DEX_ROUTER,
  NADFUN_MAINNET.V2_ROUTER,
] as const;

export function isV2Router(address: string): boolean {
  return address.toLowerCase() === NADFUN_MAINNET.V2_ROUTER.toLowerCase();
}

export function isDexRouter(address: string): boolean {
  return address.toLowerCase() === NADFUN_MAINNET.DEX_ROUTER.toLowerCase();
}

export type NadfunConfig = {
  lensAddress: `0x${string}`;
  allowedRouters: readonly `0x${string}`[];
};

export function buildNadfunConfig(input: {
  lensAddress: `0x${string}`;
  allowedRouterAddresses: string[];
}): NadfunConfig {
  return {
    lensAddress: input.lensAddress,
    allowedRouters: input.allowedRouterAddresses as `0x${string}`[],
  };
}
