export function utcNowIso(): string {
  return new Date().toISOString();
}

export function deadlineTimestamp(nowSeconds: number, deadlineSeconds: number): bigint {
  return BigInt(nowSeconds + deadlineSeconds);
}
