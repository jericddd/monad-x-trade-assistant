import type { PublicClient } from "viem";
import { erc20Abi } from "../blockchain/nadfun/abis/erc20.js";

/** Best-effort token ticker for reply formatting. */
export async function fetchTokenSymbol(
  publicClient: PublicClient,
  tokenAddress: `0x${string}`,
): Promise<string | undefined> {
  try {
    const symbol = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "symbol",
    });
    const cleaned = String(symbol).trim();
    return cleaned || undefined;
  } catch {
    return undefined;
  }
}
