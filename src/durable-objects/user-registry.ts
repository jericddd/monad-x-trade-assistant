import { getAddress, isAddress } from "viem";
import { parseEnvLenient, type AppEnv } from "../env.js";
import { deriveInSiteWallet, normalizeMasterSeed } from "../custodial/derive-wallet.js";
import type { LinkUserRequest, LinkedUserRecord } from "../custodial/types.js";

const USER_KEY_PREFIX = "user:x:";

function userKey(xUserId: string): string {
  return `${USER_KEY_PREFIX}${xUserId}`;
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
      return Response.json({ user });
    }

    if (url.pathname === "/link" && request.method === "POST") {
      const body = (await request.json()) as LinkUserRequest;
      try {
        const user = await this.linkUser(body);
        return Response.json({ user });
      } catch (error) {
        const message = error instanceof Error ? error.message : "link_failed";
        return Response.json({ error: message }, { status: 400 });
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
        user,
        bootstrap: Boolean(bootstrapId) && xUserId === bootstrapId && !user,
      });
    }

    return new Response("not found", { status: 404 });
  }

  async getUser(xUserId: string): Promise<LinkedUserRecord | null> {
    return (await this.state.storage.get<LinkedUserRecord>(userKey(xUserId))) ?? null;
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

    const masterRaw = this.env.CUSTODIAL_MASTER_SEED ?? this.env.TRADE_WALLET_PRIVATE_KEY;
    if (!masterRaw) {
      throw new Error("custodial_master_seed_missing");
    }

    const { address: inSiteWallet } = deriveInSiteWallet(
      normalizeMasterSeed(masterRaw),
      input.xUserId,
    );
    const now = new Date().toISOString();
    const existing = await this.getUser(input.xUserId);
    const record: LinkedUserRecord = {
      xUserId: input.xUserId,
      xUsername: input.xUsername.trim().replace(/^@/, ""),
      connectedWallet: getAddress(input.connectedWallet) as `0x${string}`,
      inSiteWallet,
      linkedAt: existing?.linkedAt ?? now,
      updatedAt: now,
    };

    await this.state.storage.put(userKey(input.xUserId), record);
    return record;
  }
}

export default UserRegistry;
