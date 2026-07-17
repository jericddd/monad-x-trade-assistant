import { getAddress, isAddress } from "viem";
import type { Env } from "../worker.js";
import { createProviders } from "../blockchain/nadfun/quote.js";
import { resolveSignerForAuthor } from "../custodial/resolve-signer.js";
import {
  normalizeLinkedUser,
  type LinkedUserRecord,
  type PublicLinkedUser,
} from "../custodial/types.js";
import { parseEnvLenient } from "../env.js";
import { AppTradeService } from "../trading/app-trade-service.js";
import { TradeError } from "../trading/errors.js";
import type { TradeRecord } from "../trading/trade-record.js";
import { assertSiteSecret } from "./api-users.js";

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

function registryStub(env: Env): DurableObjectStub {
  return env.USER_REGISTRY.get(env.USER_REGISTRY.idFromName("primary"));
}

function coordinatorStub(env: Env): DurableObjectStub {
  return env.TRADE_COORDINATOR.get(env.TRADE_COORDINATOR.idFromName("primary"));
}

async function fetchLinkedUser(env: Env, xUserId: string): Promise<LinkedUserRecord | null> {
  const stub = registryStub(env);
  const res = await stub.fetch(`https://registry/get?xUserId=${encodeURIComponent(xUserId)}`);
  const body = (await res.json()) as { user: PublicLinkedUser | null };
  if (!body.user) return null;
  return normalizeLinkedUser(body.user);
}

async function userHasBoughtToken(
  env: Env,
  xUserId: string,
  tokenAddress: string,
): Promise<boolean> {
  const stub = coordinatorStub(env);
  const res = await stub.fetch(
    `https://coordinator/list-by-author?authorId=${encodeURIComponent(xUserId)}&limit=200`,
  );
  const body = (await res.json()) as { trades?: TradeRecord[] };
  const target = tokenAddress.toLowerCase();
  const success = new Set(["CONFIRMED", "SUBMITTED", "DRY_RUN_SUCCESS"]);
  return (body.trades ?? []).some(
    (t) => t.action !== "sell" && success.has(t.status) && t.tokenAddress.toLowerCase() === target,
  );
}

async function saveAppTrade(env: Env, record: TradeRecord): Promise<void> {
  const stub = coordinatorStub(env);
  await stub.fetch("https://coordinator/record-trade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });
}

export async function handleTradeApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/v1/users/trade" || request.method !== "POST") {
    return null;
  }

  if (!assertSiteSecret(request, env)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    xUserId?: string;
    action?: "buy" | "sell";
    tokenAddress?: string;
    amountMon?: string;
    percent?: number;
    amountToken?: string;
  };

  if (!body.xUserId || !/^\d+$/.test(body.xUserId)) {
    return badRequest("invalid_x_user_id");
  }
  if (body.action !== "buy" && body.action !== "sell") {
    return badRequest("invalid_action");
  }
  if (!body.tokenAddress || !isAddress(body.tokenAddress)) {
    return badRequest("invalid_token_address");
  }

  const tokenAddress = getAddress(body.tokenAddress);
  const user = await fetchLinkedUser(env, body.xUserId);
  if (!user) {
    return badRequest("user_not_linked");
  }

  // Platform trades only for tokens already bought (X or prior app buy).
  const owned = await userHasBoughtToken(env, body.xUserId, tokenAddress);
  if (!owned) {
    return Response.json(
      { error: "token_not_in_portfolio", message: "Buy this token on X first" },
      { status: 400 },
    );
  }

  const parsed = parseEnvLenient(env as unknown as Record<string, unknown>);
  const signer = resolveSignerForAuthor({
    env: parsed,
    authorId: body.xUserId,
    user,
  });
  if (!signer || signer.source !== "in_site") {
    return Response.json({ error: "signer_unavailable" }, { status: 503 });
  }

  const providers = createProviders(parsed);
  const service = new AppTradeService(
    parsed,
    providers.quoteProvider,
    providers.simulationProvider,
    signer.walletAddress,
    signer.privateKey,
  );

  try {
    const result =
      body.action === "buy"
        ? await service.executeBuy({
            authorId: body.xUserId,
            tokenAddress,
            amountMon: body.amountMon ?? "",
          })
        : await service.executeSell({
            authorId: body.xUserId,
            tokenAddress,
            percent: body.percent,
            amountToken: body.amountToken,
          });

    await saveAppTrade(env, result.record);

    return Response.json({
      ok: result.record.status === "SUBMITTED" || result.record.status === "DRY_RUN_SUCCESS",
      status: result.record.status,
      txHash: result.record.txHash ?? null,
      tradeId: result.record.tweetId,
      action: result.record.action,
      source: "app",
      amountMon: result.record.requestedAmountMon,
      tokenAddress: result.record.tokenAddress,
      error: result.record.failureMessageSafe ?? null,
    });
  } catch (error) {
    if (error instanceof TradeError) {
      return Response.json(
        { error: error.code.toLowerCase(), message: error.safeMessage },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "trade_failed";
    return Response.json({ error: "trade_failed", message }, { status: 500 });
  }
}
