import type { Hex } from "viem";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AppEnv } from "../env.js";
import type { LinkedUserRecord } from "./types.js";
import { normalizeLinkedUser } from "./types.js";
import { deriveInSiteWallet, normalizeMasterSeed } from "./derive-wallet.js";

export type ResolvedSigner = {
  privateKey: Hex;
  walletAddress: `0x${string}`;
  source: "in_site" | "bootstrap_hot_wallet";
  user: LinkedUserRecord | null;
};

/**
 * Prefer the user's in-site custodial wallet. Fall back to the bootstrap hot wallet
 * for the legacy AUTHORIZED_X_USER_ID until they link on the site.
 */
export function resolveSignerForAuthor(input: {
  env: Partial<AppEnv> & { CUSTODIAL_MASTER_SEED?: string };
  authorId: string;
  user: LinkedUserRecord | null;
}): ResolvedSigner | null {
  const masterRaw = input.env.CUSTODIAL_MASTER_SEED ?? input.env.TRADE_WALLET_PRIVATE_KEY;

  if (input.user && masterRaw) {
    const user = normalizeLinkedUser(input.user);
    const derived = deriveInSiteWallet(
      normalizeMasterSeed(masterRaw),
      input.authorId,
      user.walletVersion,
    );
    if (getAddress(derived.address) !== getAddress(user.inSiteWallet)) {
      return null;
    }
    return {
      privateKey: derived.privateKey,
      walletAddress: derived.address,
      source: "in_site",
      user,
    };
  }

  const bootstrapId = input.env.AUTHORIZED_X_USER_ID;
  if (bootstrapId && input.authorId === bootstrapId && input.env.TRADE_WALLET_PRIVATE_KEY) {
    const account = privateKeyToAccount(input.env.TRADE_WALLET_PRIVATE_KEY as Hex);
    return {
      privateKey: input.env.TRADE_WALLET_PRIVATE_KEY as Hex,
      walletAddress: account.address,
      source: "bootstrap_hot_wallet",
      user: null,
    };
  }

  return null;
}
