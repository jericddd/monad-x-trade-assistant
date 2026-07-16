import { defineChain } from "viem";

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: {
    decimals: 18,
    name: "MON",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.monad.xyz"],
    },
  },
});

export function assertChainId(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error("CHAIN_ID_MISMATCH");
  }
}
