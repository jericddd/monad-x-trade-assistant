import { describe, expect, it } from "vitest";
import { deriveInSiteWallet, normalizeMasterSeed } from "../src/custodial/derive-wallet.js";
import { resolveSignerForAuthor } from "../src/custodial/resolve-signer.js";
import type { LinkedUserRecord } from "../src/custodial/types.js";

const MASTER = "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("deriveInSiteWallet", () => {
  it("derives a stable address per X user id", () => {
    const a = deriveInSiteWallet(MASTER, "1618468570450776071");
    const b = deriveInSiteWallet(MASTER, "1618468570450776071");
    const c = deriveInSiteWallet(MASTER, "999");

    expect(a.address).toBe(b.address);
    expect(a.privateKey).toBe(b.privateKey);
    expect(a.address).not.toBe(c.address);
    expect(a.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("changes address when wallet version renews", () => {
    const v0 = deriveInSiteWallet(MASTER, "123", 0);
    const v1 = deriveInSiteWallet(MASTER, "123", 1);
    expect(v0.address).not.toBe(v1.address);
    expect(deriveInSiteWallet(MASTER, "123", 1).address).toBe(v1.address);
  });

  it("normalizes non-hex master seeds", () => {
    const seed = normalizeMasterSeed("some-long-secret-phrase!!");
    expect(seed).toMatch(/^0x[a-fA-F0-9]{64}$/);
    const wallet = deriveInSiteWallet(seed, "1");
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

describe("resolveSignerForAuthor", () => {
  it("uses in-site wallet when user is linked", () => {
    const user: LinkedUserRecord = {
      xUserId: "123",
      xUsername: "alice",
      connectedWallet: "0x2222222222222222222222222222222222222222",
      inSiteWallet: deriveInSiteWallet(MASTER, "123").address,
      walletVersion: 0,
      privateKeyExportedAt: null,
      linkedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const signer = resolveSignerForAuthor({
      env: { CUSTODIAL_MASTER_SEED: MASTER },
      authorId: "123",
      user,
    });

    expect(signer?.source).toBe("in_site");
    expect(signer?.walletAddress).toBe(user.inSiteWallet);
  });

  it("falls back to bootstrap hot wallet", () => {
    const hot = "0x3333333333333333333333333333333333333333333333333333333333333333";
    const signer = resolveSignerForAuthor({
      env: {
        AUTHORIZED_X_USER_ID: "1618468570450776071",
        TRADE_WALLET_PRIVATE_KEY: hot,
      },
      authorId: "1618468570450776071",
      user: null,
    });

    expect(signer?.source).toBe("bootstrap_hot_wallet");
    expect(signer?.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("rejects unknown authors", () => {
    const signer = resolveSignerForAuthor({
      env: { AUTHORIZED_X_USER_ID: "1", TRADE_WALLET_PRIVATE_KEY: MASTER },
      authorId: "2",
      user: null,
    });
    expect(signer).toBeNull();
  });
});
