import { getAddress, isAddress } from "viem";
import { parseEnvLenient, type AppEnv } from "../env.js";
import { deriveInSiteWallet, normalizeMasterSeed } from "../custodial/derive-wallet.js";
import {
  normalizeLinkedUser,
  toPublicLinkedUser,
  type ExportKeyRequest,
  type LinkUserRequest,
  type LinkedUserRecord,
  type RecordTransferRequest,
  type RenewWalletRequest,
  type TransferRecord,
} from "../custodial/types.js";

const USER_KEY_PREFIX = "user:x:";
const TRANSFER_KEY_PREFIX = "transfers:x:";

function userKey(xUserId: string): string {
  return `${USER_KEY_PREFIX}${xUserId}`;
}

function transferKey(xUserId: string): string {
  return `${TRANSFER_KEY_PREFIX}${xUserId}`;
}

export class UserRegistry implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Partial<AppEnv> & {
    CUSTODIAL_MASTER_SEED?: string;
  };

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state;
    const parsed = parseEnvLenient(env);
    this.env = {
      ...parsed,
      CUSTODIAL_MASTER_SEED:
        typeof env.CUSTODIAL_MASTER_SEED === "string" ? env.CUSTODIAL_MASTER_SEED : undefined,
      TRADE_WALLET_PRIVATE_KEY:
        typeof env.TRADE_WALLET_PRIVATE_KEY === "string" ? env.TRADE_WALLET_PRIVATE_KEY : undefined,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/get" && request.method === "GET") {
      const xUserId = url.searchParams.get("xUserId");
      if (!xUserId || !/^\d+$/.test(xUserId)) {
        return Response.json({ error: "invalid_x_user_id" }, { status: 400 });
      }
      const user = await this.getUser(xUserId);
      return Response.json({ user: user ? toPublicLinkedUser(user) : null });
    }

    if (url.pathname === "/link" && request.method === "POST") {
      const body = (await request.json()) as LinkUserRequest;
      try {
        const user = await this.linkUser(body);
        return Response.json({ user: toPublicLinkedUser(user) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "link_failed";
        return Response.json({ error: message }, { status: 400 });
      }
    }

    if (url.pathname === "/export-key" && request.method === "POST") {
      const body = (await request.json()) as ExportKeyRequest;
      try {
        const result = await this.exportPrivateKey(body.xUserId);
        return Response.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "export_failed";
        const status =
          message === "already_exported" || message === "user_not_linked"
            ? message === "user_not_linked"
              ? 404
              : 409
            : 400;
        return Response.json({ error: message }, { status });
      }
    }

    if (url.pathname === "/renew-wallet" && request.method === "POST") {
      const body = (await request.json()) as RenewWalletRequest;
      try {
        const result = await this.renewWallet(body);
        return Response.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "renew_failed";
        const status = message === "user_not_linked" ? 404 : 400;
        return Response.json({ error: message }, { status });
      }
    }

    if (url.pathname === "/authorized" && request.method === "GET") {
      const xUserId = url.searchParams.get("xUserId");
      if (!xUserId || !/^\d+$/.test(xUserId)) {
        return Response.json({ authorized: false }, { status: 400 });
      }
      const user = await this.getUser(xUserId);
      const bootstrapId = this.env.AUTHORIZED_X_USER_ID;
      const authorized = Boolean(user) || (Boolean(bootstrapId) && xUserId === bootstrapId);
      return Response.json({
        authorized,
        user: user ? toPublicLinkedUser(user) : null,
        bootstrap: Boolean(bootstrapId) && xUserId === bootstrapId && !user,
      });
    }

    if (url.pathname === "/record-transfer" && request.method === "POST") {
      const body = (await request.json()) as RecordTransferRequest;
      try {
        const transfer = await this.recordTransfer(body);
        return Response.json({ transfer });
      } catch (error) {
        const message = error instanceof Error ? error.message : "record_transfer_failed";
        const status = message === "user_not_linked" ? 404 : 400;
        return Response.json({ error: message }, { status });
      }
    }

    if (url.pathname === "/list-transfers" && request.method === "GET") {
      const xUserId = url.searchParams.get("xUserId");
      if (!xUserId || !/^\d+$/.test(xUserId)) {
        return Response.json({ error: "invalid_x_user_id" }, { status: 400 });
      }
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
      const transfers = await this.listTransfers(xUserId, limit);
      return Response.json({ transfers });
    }

    return new Response("not found", { status: 404 });
  }

  async getUser(xUserId: string): Promise<LinkedUserRecord | null> {
    const raw = await this.state.storage.get<LinkedUserRecord>(userKey(xUserId));
    return raw ? normalizeLinkedUser(raw) : null;
  }

  private masterSeedRaw(): string {
    const masterRaw = this.env.CUSTODIAL_MASTER_SEED ?? this.env.TRADE_WALLET_PRIVATE_KEY;
    if (!masterRaw) {
      throw new Error("custodial_master_seed_missing");
    }
    return masterRaw;
  }

  async linkUser(input: LinkUserRequest): Promise<LinkedUserRecord> {
    if (!input.xUserId || !/^\d+$/.test(input.xUserId)) {
      throw new Error("invalid_x_user_id");
    }
    if (!input.xUsername?.trim()) {
      throw new Error("invalid_x_username");
    }
    if (!isAddress(input.connectedWallet)) {
      throw new Error("invalid_connected_wallet");
    }

    const existing = await this.getUser(input.xUserId);
    const walletVersion = existing?.walletVersion ?? 0;
    const { address: derivedAddress } = deriveInSiteWallet(
      normalizeMasterSeed(this.masterSeedRaw()),
      input.xUserId,
      walletVersion,
    );
    const now = new Date().toISOString();
    const record: LinkedUserRecord = {
      xUserId: input.xUserId,
      xUsername: input.xUsername.trim().replace(/^@/, ""),
      connectedWallet: getAddress(input.connectedWallet) as `0x${string}`,
      // Preserve renewed wallets; only assign on first link.
      inSiteWallet: existing?.inSiteWallet ?? derivedAddress,
      walletVersion,
      privateKeyExportedAt: existing?.privateKeyExportedAt ?? null,
      linkedAt: existing?.linkedAt ?? now,
      updatedAt: now,
    };

    await this.state.storage.put(userKey(input.xUserId), record);
    return record;
  }

  /**
   * One-time private key reveal for the current in-site wallet version.
   * After this, the key is never returned again for this version (export burned).
   * Signing for buys still derives on demand — only display/export is burned.
   */
  async exportPrivateKey(xUserId: string): Promise<{
    privateKey: `0x${string}`;
    address: `0x${string}`;
    walletVersion: number;
    exportedAt: string;
    user: ReturnType<typeof toPublicLinkedUser>;
  }> {
    if (!xUserId || !/^\d+$/.test(xUserId)) {
      throw new Error("invalid_x_user_id");
    }
    const user = await this.getUser(xUserId);
    if (!user) throw new Error("user_not_linked");
    if (user.privateKeyExportedAt) throw new Error("already_exported");

    const derived = deriveInSiteWallet(
      normalizeMasterSeed(this.masterSeedRaw()),
      xUserId,
      user.walletVersion,
    );
    if (getAddress(derived.address) !== getAddress(user.inSiteWallet)) {
      throw new Error("wallet_mismatch");
    }

    const exportedAt = new Date().toISOString();
    const updated: LinkedUserRecord = {
      ...user,
      privateKeyExportedAt: exportedAt,
      updatedAt: exportedAt,
    };
    await this.state.storage.put(userKey(xUserId), updated);

    return {
      privateKey: derived.privateKey,
      address: derived.address,
      walletVersion: user.walletVersion,
      exportedAt,
      user: toPublicLinkedUser(updated),
    };
  }

  async renewWallet(input: RenewWalletRequest): Promise<{
    user: ReturnType<typeof toPublicLinkedUser>;
    previousInSiteWallet: `0x${string}`;
    warning: string;
  }> {
    if (!input.xUserId || !/^\d+$/.test(input.xUserId)) {
      throw new Error("invalid_x_user_id");
    }
    if (input.confirmRenew !== true) {
      throw new Error("confirm_renew_required");
    }

    const user = await this.getUser(input.xUserId);
    if (!user) throw new Error("user_not_linked");

    const previousInSiteWallet = user.inSiteWallet;
    const nextVersion = user.walletVersion + 1;
    const { address: inSiteWallet } = deriveInSiteWallet(
      normalizeMasterSeed(this.masterSeedRaw()),
      input.xUserId,
      nextVersion,
    );
    const now = new Date().toISOString();
    const updated: LinkedUserRecord = {
      ...user,
      inSiteWallet,
      walletVersion: nextVersion,
      privateKeyExportedAt: null,
      updatedAt: now,
    };
    await this.state.storage.put(userKey(input.xUserId), updated);

    return {
      user: toPublicLinkedUser(updated),
      previousInSiteWallet,
      warning:
        "Move all funds out of the previous trading wallet before renewing. Funds left behind stay on the old address.",
    };
  }

  async listTransfers(xUserId: string, limit: number): Promise<TransferRecord[]> {
    const current = (await this.state.storage.get<TransferRecord[]>(transferKey(xUserId))) ?? [];
    return current.slice(0, limit);
  }

  async recordTransfer(input: RecordTransferRequest): Promise<TransferRecord> {
    if (!input.xUserId || !/^\d+$/.test(input.xUserId)) {
      throw new Error("invalid_x_user_id");
    }
    if (input.type !== "deposit" && input.type !== "withdraw") {
      throw new Error("invalid_transfer_type");
    }
    if (!input.amountMon || !/^\d+(?:\.\d+)?$/.test(input.amountMon)) {
      throw new Error("invalid_amount");
    }
    if (!input.txHash || !/^0x[a-fA-F0-9]{64}$/.test(input.txHash)) {
      throw new Error("invalid_tx_hash");
    }

    const user = await this.getUser(input.xUserId);
    if (!user) throw new Error("user_not_linked");

    const txHash = input.txHash.toLowerCase() as `0x${string}`;
    const existing = await this.listTransfers(input.xUserId, 200);
    const already = existing.find((t) => t.txHash.toLowerCase() === txHash);
    if (already) return already;

    const hotWallet = user.connectedWallet;
    const inSiteWallet = user.inSiteWallet;
    const fromAddress = isAddress(input.fromAddress ?? "")
      ? (getAddress(input.fromAddress!) as `0x${string}`)
      : input.type === "deposit"
        ? hotWallet
        : inSiteWallet;
    const toAddress = isAddress(input.toAddress ?? "")
      ? (getAddress(input.toAddress!) as `0x${string}`)
      : input.type === "deposit"
        ? inSiteWallet
        : hotWallet;

    const transfer: TransferRecord = {
      id: txHash,
      xUserId: input.xUserId,
      type: input.type,
      amountMon: input.amountMon,
      txHash,
      fromAddress,
      toAddress,
      hotWallet,
      inSiteWallet,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
    };

    await this.state.storage.put(transferKey(input.xUserId), [transfer, ...existing].slice(0, 200));
    return transfer;
  }
}

export default UserRegistry;
