import { describe, expect, it } from "vitest";
import { healthResponse } from "../src/routes/health.js";

describe("healthResponse", () => {
  it("reports xOAuthConfigured from raw Worker secrets", async () => {
    const res = healthResponse({
      TRADING_ENABLED: "true",
      TRADE_DRY_RUN: "false",
      X_API_KEY: "key",
      X_API_SECRET: "secret",
      X_ACCESS_TOKEN: "token",
      X_ACCESS_TOKEN_SECRET: "token-secret",
      AUTHORIZED_X_USER_ID: "123",
      MONAD_RPC_URL: "https://rpc.monad.xyz",
      SITE_API_SECRET: "site-secret-at-least-16",
    });
    const body = (await res.json()) as {
      tradingEnabled: boolean;
      dryRun: boolean;
      live: boolean;
      config: { xOAuthConfigured: boolean; rpcConfigured: boolean };
    };
    expect(body.tradingEnabled).toBe(true);
    expect(body.dryRun).toBe(false);
    expect(body.live).toBe(true);
    expect(body.config.xOAuthConfigured).toBe(true);
    expect(body.config.rpcConfigured).toBe(true);
  });

  it("reports xOAuthConfigured false when secrets missing", async () => {
    const res = healthResponse({
      TRADING_ENABLED: true,
      TRADE_DRY_RUN: false,
    });
    const body = (await res.json()) as { config: { xOAuthConfigured: boolean }; live: boolean };
    expect(body.config.xOAuthConfigured).toBe(false);
    expect(body.live).toBe(true);
  });
});
