export function calculateMinimumAmountOut(expectedAmountOut: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 1000) {
    throw new Error("SLIPPAGE_INVALID");
  }

  return (expectedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function parseRouterAllowlist(raw: string): `0x${string}`[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry as `0x${string}`);
}
