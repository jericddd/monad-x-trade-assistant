export function shortenAddress(value: string, visible = 4): string {
  if (!value.startsWith("0x") || value.length < 10) {
    return value;
  }

  return `${value.slice(0, 2 + visible)}...${value.slice(-visible)}`;
}

export function normalizeAddress(value: string): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

export function isAllowlistedRouter(
  router: `0x${string}`,
  allowlist: readonly `0x${string}`[],
): boolean {
  const normalized = normalizeAddress(router);
  return allowlist.some((entry) => normalizeAddress(entry) === normalized);
}
