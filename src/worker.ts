import type { AppEnv } from "./env.js";
import { healthResponse } from "./routes/health.js";
import { createXClient } from "./x/client.js";
import { runScheduledPoll } from "./x/polling.js";
import { parseEnvLenient } from "./env.js";
import { logError, logInfo } from "./utils/logging.js";

export interface Env extends AppEnv {
  TRADE_COORDINATOR: DurableObjectNamespace;
}

function toWorkerEnv(env: Env): AppEnv {
  const raw = env as unknown as Record<string, unknown>;
  const parsed = parseEnvLenient(raw);
  return {
    ...parsed,
    TRADE_COORDINATOR: env.TRADE_COORDINATOR,
    X_BOT_USER_ID:
      typeof raw.X_BOT_USER_ID === "string" ? raw.X_BOT_USER_ID : parsed.X_BOT_USER_ID,
    AUTHORIZED_X_USER_ID:
      typeof raw.AUTHORIZED_X_USER_ID === "string"
        ? raw.AUTHORIZED_X_USER_ID
        : parsed.AUTHORIZED_X_USER_ID,
  } as AppEnv;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    const parsed = parseEnvLenient(env as unknown as Record<string, unknown>);
    return healthResponse(parsed);
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
