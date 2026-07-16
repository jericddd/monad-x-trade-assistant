import type { AppEnv } from "../env.js";

export function healthResponse(env: Partial<AppEnv>): Response {
  return Response.json({
    ok: true,
    service: "monad-x-trade-assistant",
    tradingEnabled: env.TRADING_ENABLED === true,
    dryRun: env.TRADE_DRY_RUN !== false,
  });
}
