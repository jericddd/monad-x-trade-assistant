import type { AppEnv } from "./env.js";
import { healthResponse } from "./routes/health.js";
import { handleUsersApi } from "./routes/api-users.js";
import { createXClient } from "./x/client.js";
import { runScheduledPoll } from "./x/polling.js";
import { parseEnvLenient } from "./env.js";
import { logError, logInfo } from "./utils/logging.js";

export interface Env extends AppEnv {
  TRADE_COORDINATOR: DurableObjectNamespace;
  USER_REGISTRY: DurableObjectNamespace;
  SITE_API_SECRET?: string;
  CUSTODIAL_MASTER_SEED?: string;
}

function toWorkerEnv(env: Env): AppEnv {
  const raw = env as unknown as Record<string, unknown>;
  const parsed = parseEnvLenient(raw);
  return {
    ...parsed,
    TRADE_COORDINATOR: env.TRADE_COORDINATOR,
    USER_REGISTRY: env.USER_REGISTRY,
    AUTHORIZED_X_USER_ID:
      typeof raw.AUTHORIZED_X_USER_ID === "string"
        ? raw.AUTHORIZED_X_USER_ID.trim()
        : parsed.AUTHORIZED_X_USER_ID?.trim(),
    SITE_API_SECRET:
      typeof raw.SITE_API_SECRET === "string" ? raw.SITE_API_SECRET : parsed.SITE_API_SECRET,
    CUSTODIAL_MASTER_SEED:
      typeof raw.CUSTODIAL_MASTER_SEED === "string"
        ? raw.CUSTODIAL_MASTER_SEED
        : parsed.CUSTODIAL_MASTER_SEED,
    TRADE_WALLET_PRIVATE_KEY:
      typeof raw.TRADE_WALLET_PRIVATE_KEY === "string"
        ? raw.TRADE_WALLET_PRIVATE_KEY
        : parsed.TRADE_WALLET_PRIVATE_KEY,
  } as AppEnv;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    const parsed = parseEnvLenient(env as unknown as Record<string, unknown>);
    return healthResponse(parsed);
  }

  if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "https://packs.monexmonad.xyz",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,x-site-secret",
      },
    });
  }

  const apiResponse = await handleUsersApi(request, env);
  if (apiResponse) {
    const headers = new Headers(apiResponse.headers);
    headers.set("access-control-allow-origin", "https://packs.monexmonad.xyz");
    return new Response(apiResponse.body, { status: apiResponse.status, headers });
  }

  return new Response("not found", { status: 404 });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    try {
      const parsed = toWorkerEnv(env);
      const client = createXClient(env as unknown as Record<string, unknown>);
      logInfo("scheduled_tick_started", {
        tradingEnabled: parsed.TRADING_ENABLED === true,
        dryRun: parsed.TRADE_DRY_RUN !== false,
      });
      await runScheduledPoll(parsed, client);
      logInfo("scheduled_tick_completed", {});
    } catch (error) {
      logError("scheduled_tick_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  },
};

export default worker;
