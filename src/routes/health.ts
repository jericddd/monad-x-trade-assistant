import type { AppEnv } from "../env.js";
import { normalizeOptionalNumericUserId } from "../x/user-id.js";

function hasSecret(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function healthResponse(env: Partial<AppEnv> & Record<string, unknown>): Response {
  const botUserId = normalizeOptionalNumericUserId(
    typeof env.X_BOT_USER_ID === "string" ? env.X_BOT_USER_ID : undefined,
  );
  const authorizedUserId = normalizeOptionalNumericUserId(
    typeof env.AUTHORIZED_X_USER_ID === "string" ? env.AUTHORIZED_X_USER_ID : undefined,
  );

  const xOAuthConfigured =
    hasSecret(env.X_API_KEY) &&
    hasSecret(env.X_API_SECRET) &&
    hasSecret(env.X_ACCESS_TOKEN) &&
    hasSecret(env.X_ACCESS_TOKEN_SECRET);

  return Response.json({
    ok: true,
    service: "monad-x-trade-assistant",
    tradingEnabled: env.TRADING_ENABLED === true,
    dryRun: env.TRADE_DRY_RUN !== false,
    config: {
      botUserIdConfigured: Boolean(botUserId),
      botUserIdResolvable: Boolean(botUserId) || xOAuthConfigured,
      authorizedUserIdConfigured: Boolean(authorizedUserId),
      xBearerTokenConfigured: hasSecret(env.X_BEARER_TOKEN),
      xOAuthConfigured,
    },
  });
}
