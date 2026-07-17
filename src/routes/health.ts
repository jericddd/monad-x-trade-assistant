import { normalizeOptionalNumericUserId } from "../x/user-id.js";

function hasSecret(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Strip accidental surrounding quotes from secret pastes.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.length > 2;
  }
  return true;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

/**
 * Health must read secrets from the raw Worker env — parseEnvLenient omits X_* keys.
 */
export function healthResponse(env: Record<string, unknown>): Response {
  const authorizedUserId = normalizeOptionalNumericUserId(
    typeof env.AUTHORIZED_X_USER_ID === "string" ? env.AUTHORIZED_X_USER_ID : undefined,
  );

  const xOAuthConfigured =
    hasSecret(env.X_API_KEY) &&
    hasSecret(env.X_API_SECRET) &&
    hasSecret(env.X_ACCESS_TOKEN) &&
    hasSecret(env.X_ACCESS_TOKEN_SECRET);

  const tradingEnabled = asBool(env.TRADING_ENABLED, false);
  const dryRun = asBool(env.TRADE_DRY_RUN, true);

  return Response.json({
    ok: true,
    service: "monad-x-trade-assistant",
    tradingEnabled,
    dryRun,
    live: tradingEnabled && !dryRun,
    site: "https://trade.monexmonad.xyz",
    config: {
      authorizedUserIdConfigured: Boolean(authorizedUserId),
      botUserResolvedViaUsersMe: xOAuthConfigured,
      xOAuthConfigured,
      rpcConfigured: hasSecret(env.MONAD_RPC_URL),
      siteApiConfigured: hasSecret(env.SITE_API_SECRET),
    },
  });
}
