import type { AppEnv } from "./env.js";
import { healthResponse } from "./routes/health.js";
import { createXClient } from "./x/client.js";
import { runScheduledPoll } from "./x/polling.js";
import { parseEnvLenient } from "./env.js";

export interface Env extends AppEnv {
  TRADE_COORDINATOR: DurableObjectNamespace;
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
    const parsed = parseEnvLenient(env as unknown as Record<string, unknown>) as Env;
    const client = createXClient(parsed as unknown as Record<string, unknown>);
    await runScheduledPoll(parsed, client);
  },
};

export default worker;
