import { concat, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Deterministic per-user in-site wallet from a master seed + X user id.
 * Private keys are never persisted — derived on demand for buy/withdraw.
 */
export function deriveInSiteWallet(
  masterSeed: Hex,
  xUserId: string,
): { privateKey: Hex; address: `0x${string}` } {
  if (!/^\d+$/.test(xUserId)) {
    throw new Error("xUserId must be numeric");
  }

  const privateKey = keccak256(concat([toBytes(masterSeed), toBytes(`monex-insite:${xUserId}`)]));
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

export function normalizeMasterSeed(raw: string): Hex {
  const trimmed = raw.trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed as Hex;
  }
  // Allow non-hex secrets: hash into a 32-byte seed.
  return keccak256(toBytes(trimmed));
}
