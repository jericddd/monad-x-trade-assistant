import { concat, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/** Version 0 keeps the original derivation path for existing users. */
export function inSiteDerivationLabel(xUserId: string, walletVersion = 0): string {
  if (walletVersion <= 0) return `monex-insite:${xUserId}`;
  return `monex-insite:${xUserId}:v${walletVersion}`;
}

/**
 * Deterministic per-user in-site wallet from a master seed + X user id (+ optional version).
 * Private keys are never persisted — derived on demand for buy/withdraw/one-time export.
 */
export function deriveInSiteWallet(
  masterSeed: Hex,
  xUserId: string,
  walletVersion = 0,
): { privateKey: Hex; address: `0x${string}` } {
  if (!/^\d+$/.test(xUserId)) {
    throw new Error("xUserId must be numeric");
  }
  if (!Number.isInteger(walletVersion) || walletVersion < 0) {
    throw new Error("walletVersion must be a non-negative integer");
  }

  const privateKey = keccak256(
    concat([toBytes(masterSeed), toBytes(inSiteDerivationLabel(xUserId, walletVersion))]),
  );
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
