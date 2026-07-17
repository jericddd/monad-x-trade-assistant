import { defineChain } from "viem";

/** Official Monad Mainnet configuration — https://docs.monad.xyz/developer-essentials/network-information */
export const MONAD_MAINNET_CHAIN_ID = 143;

export const monadMainnet = defineChain({
  id: MONAD_MAINNET_CHAIN_ID,
  name: "Monad Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "MON",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadVision",
      url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL ?? "https://monadvision.com",
    },
  },
});

const MONADSCAN = "https://monadscan.com";

export function getExplorerTxUrl(txHash: string): string {
  return `${MONADSCAN}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${MONADSCAN}/address/${address}`;
}

/** Nad.fun token page for a contract address */
export function getNadFunTokenUrl(tokenAddress: string): string {
  return `https://nad.fun/tokens/${tokenAddress}`;
}
