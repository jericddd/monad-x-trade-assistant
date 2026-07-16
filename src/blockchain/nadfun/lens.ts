import type { PublicClient } from "viem";
import { lensAbi } from "./abis/lens.js";
import { createTradeError } from "../../trading/errors.js";

export { lensAbi };

export type LensQuote = {
  routerAddress: `0x${string}`;
  expectedAmountOut: bigint;
};

export async function queryLensQuote(input: {
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
  } catch {
    throw createTradeError("QUOTE_FAILED");
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
