import type { ParsedBuyCommand } from "../commands/types.js";
import { parseBuyCommand } from "../commands/parse-buy-command.js";
import { parseEnvLenient, type AppEnv } from "../env.js";
import { sha256Hex } from "../utils/hash.js";
import { SAFE_ERROR_MESSAGES, type TradeErrorCode } from "../trading/errors.js";
import { toFailureCode, toSafePublicReason } from "../trading/sanitize-error.js";
import {
  checkTradeLimits,
  commitReservation,
  createInitialLimitState,
  recordHourlyTrade,
  releaseReservation,
  reserveSpend,
  type LimitState,
} from "../trading/limits.js";
import { isIdempotentDuplicate } from "../trading/idempotency.js";
import {
  createTradeRecord,
  tradeRecordKey,
  updateTradeRecord,
  type TradeRecord,
} from "../trading/trade-record.js";
import { TradeService } from "../trading/trade-service.js";
import { buildTradeReply } from "../trading/replies.js";
import { createProviders } from "../blockchain/nadfun/quote.js";
import { createPublicBlockchainClient } from "../blockchain/client.js";
import { getTransactionReceipt } from "../blockchain/receipts.js";
import { parseEther } from "viem";
import { logInfo, logWarn } from "../utils/logging.js";
import type { LinkedUserRecord } from "../custodial/types.js";
import { resolveSignerForAuthor } from "../custodial/resolve-signer.js";

type CoordinatorState = {
  limits: LimitState;
  processingLock: boolean;
  pollLock: boolean;
};

export type ProcessMentionRequest = {
  tweetId: string;
  authorId: string;
  text: string;
};

export type ProcessMentionResponse = {
  ok: boolean;
  replyText?: string;
  status?: string;
  failureCode?: TradeErrorCode;
};

const CURSOR_KEY = "poll:cursor";
const LIMITS_KEY = "limits:state";
const PENDING_INDEX_KEY = "pending:submitted";

function userTradesKey(authorId: string): string {
  return `user:trades:${authorId}`;
}

export class TradeCoordinator implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Partial<AppEnv> & {
    CUSTODIAL_MASTER_SEED?: string;
    USER_REGISTRY?: DurableObjectNamespace;
  };
  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state;
    this.env = parseEnvLenient(env);
    // Preserve secret fields that parseEnvLenient may omit.
    this.env = {
      ...this.env,
      X_BEARER_TOKEN: typeof env.X_BEARER_TOKEN === "string" ? env.X_BEARER_TOKEN : undefined,
      X_API_KEY: typeof env.X_API_KEY === "string" ? env.X_API_KEY : undefined,
      X_API_SECRET: typeof env.X_API_SECRET === "string" ? env.X_API_SECRET : undefined,
      X_ACCESS_TOKEN: typeof env.X_ACCESS_TOKEN === "string" ? env.X_ACCESS_TOKEN : undefined,
      X_ACCESS_TOKEN_SECRET:
        typeof env.X_ACCESS_TOKEN_SECRET === "string" ? env.X_ACCESS_TOKEN_SECRET : undefined,
      AUTHORIZED_X_USER_ID:
        typeof env.AUTHORIZED_X_USER_ID === "string" ? env.AUTHORIZED_X_USER_ID : undefined,
      MONAD_RPC_URL:
        typeof env.MONAD_RPC_URL === "string" && env.MONAD_RPC_URL.trim()
          ? env.MONAD_RPC_URL.trim().replace(/^["']|["']$/g, "")
          : this.env.MONAD_RPC_URL,
      MONAD_RPC_FALLBACK_URLS:
        typeof env.MONAD_RPC_FALLBACK_URLS === "string" && env.MONAD_RPC_FALLBACK_URLS.trim()
          ? env.MONAD_RPC_FALLBACK_URLS.trim()
          : this.env.MONAD_RPC_FALLBACK_URLS,
      MONAD_CHAIN_ID:
        env.MONAD_CHAIN_ID !== undefined ? Number(env.MONAD_CHAIN_ID) : this.env.MONAD_CHAIN_ID,
      NADFUN_LENS_ADDRESS:
        typeof env.NADFUN_LENS_ADDRESS === "string"
          ? (env.NADFUN_LENS_ADDRESS as `0x${string}`)
          : this.env.NADFUN_LENS_ADDRESS,
      TRADE_WALLET_PRIVATE_KEY:
        typeof env.TRADE_WALLET_PRIVATE_KEY === "string" ? env.TRADE_WALLET_PRIVATE_KEY : undefined,
      CUSTODIAL_MASTER_SEED:
        typeof env.CUSTODIAL_MASTER_SEED === "string" ? env.CUSTODIAL_MASTER_SEED : undefined,
      USER_REGISTRY: env.USER_REGISTRY as DurableObjectNamespace | undefined,
      USE_MOCK_BLOCKCHAIN: env.USE_MOCK_BLOCKCHAIN === true || env.USE_MOCK_BLOCKCHAIN === "true",
      USE_MOCK_X: env.USE_MOCK_X === true || env.USE_MOCK_X === "true",
    };
  }

  private async lookupLinkedUser(xUserId: string): Promise<LinkedUserRecord | null> {
    const registry = this.env.USER_REGISTRY;
    if (!registry) return null;
    try {
      const stub = registry.get(registry.idFromName("primary"));
      const res = await stub.fetch(`https://registry/get?xUserId=${encodeURIComponent(xUserId)}`);
      if (!res.ok) return null;
      const body = (await res.json()) as { user: LinkedUserRecord | null };
      return body.user;
    } catch {
      return null;
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/cursor") {
      if (request.method === "GET") {
        const cursor = await this.getPollCursor();
        return Response.json({ cursor });
      }

      if (request.method === "PUT") {
        const body = (await request.json()) as { cursor: string };
        await this.setPollCursor(body.cursor);
        return Response.json({ ok: true });
      }
    }

    if (url.pathname === "/poll-lock") {
      if (request.method === "POST") {
        const acquired = await this.acquirePollLock();
        return Response.json({ acquired });
      }
      if (request.method === "DELETE") {
        await this.releasePollLock();
        return Response.json({ ok: true });
      }
    }

    if (url.pathname === "/process-mention" && request.method === "POST") {
      const body = (await request.json()) as ProcessMentionRequest;
      const result = await this.processMention(body);
      return Response.json(result);
    }

    if (url.pathname === "/confirm-pending" && request.method === "POST") {
      const result = await this.confirmPendingTrades();
      return Response.json(result);
    }

    if (url.pathname === "/get-record" && request.method === "GET") {
      const tweetId = url.searchParams.get("tweetId");
      if (!tweetId) {
        return new Response("missing tweetId", { status: 400 });
      }
      const record = await this.getTradeRecord(tweetId);
      return Response.json({ record });
    }

    if (url.pathname === "/mark-replied" && request.method === "POST") {
      const body = (await request.json()) as { tweetId: string; status: TradeRecord["status"] };
      const record = await this.getTradeRecord(body.tweetId);
      if (record) {
        await this.saveTradeRecord(updateTradeRecord(record, { lastReplyStatus: body.status }));
      }
      return Response.json({ ok: true });
    }

    if (url.pathname === "/list-by-author" && request.method === "GET") {
      const authorId = url.searchParams.get("authorId");
      if (!authorId || !/^\d+$/.test(authorId)) {
        return Response.json({ error: "invalid_author_id" }, { status: 400 });
      }
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
      const trades = await this.listTradesByAuthor(authorId, limit);
      return Response.json({ trades });
    }

    if (url.pathname === "/record-trade" && request.method === "POST") {
      const body = (await request.json()) as { record?: TradeRecord };
      if (!body.record?.tweetId || !body.record.authorId) {
        return Response.json({ error: "invalid_record" }, { status: 400 });
      }
      await this.saveTradeRecord(body.record);
      return Response.json({ ok: true });
    }

    return new Response("not found", { status: 404 });
  }

  async getPollCursor(): Promise<string | null> {
    return (await this.state.storage.get<string>(CURSOR_KEY)) ?? null;
  }

  async setPollCursor(cursor: string): Promise<void> {
    await this.state.storage.put(CURSOR_KEY, cursor);
  }

  private async acquirePollLock(): Promise<boolean> {
    const state = await this.getCoordinatorState();
    if (state.pollLock) {
      return false;
    }
    await this.saveCoordinatorState({ ...state, pollLock: true });
    return true;
  }

  private async releasePollLock(): Promise<void> {
    const state = await this.getCoordinatorState();
    await this.saveCoordinatorState({ ...state, pollLock: false });
  }

  private async getCoordinatorState(): Promise<CoordinatorState> {
    const stored = await this.state.storage.get<CoordinatorState>(LIMITS_KEY);
    return stored ?? { limits: createInitialLimitState(), processingLock: false, pollLock: false };
  }

  private async saveCoordinatorState(state: CoordinatorState): Promise<void> {
    await this.state.storage.put(LIMITS_KEY, state);
  }

  private async getTradeRecord(tweetId: string): Promise<TradeRecord | null> {
    return (await this.state.storage.get<TradeRecord>(tradeRecordKey(tweetId))) ?? null;
  }

  private async saveTradeRecord(record: TradeRecord): Promise<void> {
    await this.state.storage.put(tradeRecordKey(record.tweetId), record);
    await this.indexTradeForAuthor(record);
  }

  private async indexTradeForAuthor(record: TradeRecord): Promise<void> {
    const key = userTradesKey(record.authorId);
    const current = (await this.state.storage.get<string[]>(key)) ?? [];
    if (!current.includes(record.tweetId)) {
      // Newest first.
      await this.state.storage.put(key, [record.tweetId, ...current].slice(0, 200));
    }
  }

  private async listTradesByAuthor(authorId: string, limit: number): Promise<TradeRecord[]> {
    const indexed = (await this.state.storage.get<string[]>(userTradesKey(authorId))) ?? [];
    const trades: TradeRecord[] = [];

    if (indexed.length > 0) {
      for (const tweetId of indexed.slice(0, limit)) {
        const record = await this.getTradeRecord(tweetId);
        if (record) trades.push(record);
      }
      return trades;
    }

    // Fallback scan for trades created before the per-user index existed.
    const listed = await this.state.storage.list<TradeRecord>({ prefix: "trade:v1:tweet:" });
    const matched: TradeRecord[] = [];
    for (const record of listed.values()) {
      if (record.authorId === authorId) matched.push(record);
    }
    matched.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const slice = matched.slice(0, limit);
    if (slice.length > 0) {
      await this.state.storage.put(
        userTradesKey(authorId),
        slice.map((t) => t.tweetId),
      );
    }
    return slice;
  }

  private async getPendingSubmitted(): Promise<string[]> {
    return (await this.state.storage.get<string[]>(PENDING_INDEX_KEY)) ?? [];
  }

  private async setPendingSubmitted(tweetIds: string[]): Promise<void> {
    await this.state.storage.put(PENDING_INDEX_KEY, tweetIds);
  }

  private async addPendingSubmitted(tweetId: string): Promise<void> {
    const current = await this.getPendingSubmitted();
    if (!current.includes(tweetId)) {
      await this.setPendingSubmitted([...current, tweetId]);
    }
  }

  private async removePendingSubmitted(tweetId: string): Promise<void> {
    const current = await this.getPendingSubmitted();
    await this.setPendingSubmitted(current.filter((id) => id !== tweetId));
  }

  async processMention(input: ProcessMentionRequest): Promise<ProcessMentionResponse> {
    const env = this.env;
    const botUsername = env.X_BOT_USERNAME ?? "monexmonad";

    const linkedUser = await this.lookupLinkedUser(input.authorId);
    const signer = resolveSignerForAuthor({
      env,
      authorId: input.authorId,
      user: linkedUser,
    });

    if (!signer) {
      return {
        ok: false,
        failureCode: "UNAUTHORIZED_AUTHOR",
      };
    }

    const parsed = parseBuyCommand(input.text, botUsername);
    if (!parsed.ok) {
      return {
        ok: false,
        failureCode: parsed.reason,
        replyText: `trade rejected\n\nreason: ${SAFE_ERROR_MESSAGES[parsed.reason]}`,
      };
    }

    const existing = await this.getTradeRecord(input.tweetId);
    if (isIdempotentDuplicate(existing)) {
      return {
        ok: false,
        failureCode: "DUPLICATE_TWEET",
        replyText:
          existing?.lastReplyStatus === existing?.status
            ? undefined
            : `trade rejected\n\nreason: ${SAFE_ERROR_MESSAGES.DUPLICATE_TWEET}`,
      };
    }

    const coordinatorState = await this.getCoordinatorState();
    if (coordinatorState.processingLock) {
      return {
        ok: false,
        failureCode: "TRADE_ALREADY_IN_PROGRESS",
        replyText: `trade rejected\n\nreason: ${SAFE_ERROR_MESSAGES.TRADE_ALREADY_IN_PROGRESS}`,
      };
    }

    await this.saveCoordinatorState({ ...coordinatorState, processingLock: true });

    try {
      const commandTextHash = await sha256Hex(input.text);
      const providers = createProviders(env);
      const tradeService = new TradeService(
        env,
        providers.quoteProvider,
        providers.simulationProvider,
        signer.walletAddress,
        signer.privateKey,
      );

      const maxMonPerTradeWei = parseEther(env.MAX_MON_PER_TRADE ?? "10");
      const maxMonPerDayWei = parseEther(env.MAX_MON_PER_DAY ?? "30");
      const requestedWei = parseEther(parsed.command.amountMon);

      let limits = coordinatorState.limits;
      const limitCheck = checkTradeLimits({
        state: limits,
        requestedAmountWei: requestedWei,
        maxMonPerTradeWei,
        maxMonPerDayWei,
        maxTradesPerHour: env.MAX_TRADES_PER_HOUR ?? 3,
      });

      if (!limitCheck.ok) {
        const record =
          existing ??
          createTradeRecord({
            tweetId: input.tweetId,
            authorId: input.authorId,
            commandTextHash,
            requestedAmountMon: parsed.command.amountMon,
            requestedAmountWei: requestedWei.toString(),
            tokenAddress: parsed.command.tokenAddress,
            walletAddress: signer.walletAddress,
          });

        const rejected = tradeService.buildRejectedResult(
          updateTradeRecord(record, { status: "REJECTED", failureCode: limitCheck.code }),
          SAFE_ERROR_MESSAGES[limitCheck.code],
        );
        await this.saveTradeRecord(rejected.record);
        return {
          ok: false,
          failureCode: limitCheck.code,
          replyText: rejected.replyText,
          status: rejected.record.status,
        };
      }

      const result = await tradeService.executeTrade({
        tweetId: input.tweetId,
        authorId: input.authorId,
        commandText: input.text,
        commandTextHash,
        command: parsed.command as ParsedBuyCommand,
        existingRecord: existing,
      });

      const nowMs = Date.now();
      if (result.reservedAmountWei) {
        limits = reserveSpend(limits, result.reservedAmountWei, nowMs);
      }

      if (result.committedAmountWei) {
        limits = commitReservation(limits, result.committedAmountWei, nowMs);
      } else if (result.releaseReservation && result.reservedAmountWei) {
        limits = releaseReservation(limits, result.reservedAmountWei);
      } else if (result.record.status === "DRY_RUN_SUCCESS") {
        limits = recordHourlyTrade(limits, nowMs);
      }

      await this.saveCoordinatorState({
        ...(await this.getCoordinatorState()),
        limits,
        processingLock: false,
      });

      await this.saveTradeRecord(result.record);

      if (result.record.status === "SUBMITTED" || result.record.status === "UNKNOWN") {
        await this.addPendingSubmitted(result.record.tweetId);
      }

      logInfo("trade_processed", {
        tweetId: result.record.tweetId,
        status: result.record.status,
        tokenAddress: result.record.tokenAddress,
        requestedAmount: result.record.requestedAmountMon,
        txHash: result.record.txHash,
      });

      return {
        ok: result.record.status === "DRY_RUN_SUCCESS" || result.record.status === "SUBMITTED",
        replyText: result.replyText,
        status: result.record.status,
        failureCode: result.record.failureCode as TradeErrorCode | undefined,
      };
    } catch (error) {
      const failureCode = toFailureCode(error);
      const reason = toSafePublicReason(error);

      const providers = createProviders(env);
      const record = createTradeRecord({
        tweetId: input.tweetId,
        authorId: input.authorId,
        commandTextHash: await sha256Hex(input.text),
        requestedAmountMon: parsed.command.amountMon,
        requestedAmountWei: parseEther(parsed.command.amountMon).toString(),
        tokenAddress: parsed.command.tokenAddress,
        walletAddress: signer.walletAddress,
      });

      const failed = new TradeService(
        env,
        providers.quoteProvider,
        providers.simulationProvider,
        signer.walletAddress,
        signer.privateKey,
      ).buildFailedResult(record, reason, failureCode);

      await this.saveTradeRecord(failed.record);

      logWarn("trade_failed", {
        tweetId: input.tweetId,
        failureCode,
        reason,
        detail: error instanceof Error ? error.message : "unknown",
      });

      return {
        ok: false,
        failureCode,
        replyText: failed.replyText,
        status: failed.record.status,
      };
    } finally {
      const latest = await this.getCoordinatorState();
      if (latest.processingLock) {
        await this.saveCoordinatorState({ ...latest, processingLock: false });
      }
    }
  }

  async confirmPendingTrades(): Promise<{
    checked: number;
    confirmed: number;
    reverted: number;
    replies: Array<{ tweetId: string; replyText: string; status: TradeRecord["status"] }>;
  }> {
    const pending = await this.getPendingSubmitted();
    const replies: Array<{ tweetId: string; replyText: string; status: TradeRecord["status"] }> =
      [];
    let confirmed = 0;
    let reverted = 0;

    if (pending.length === 0 || !this.env.MONAD_RPC_URL) {
      return { checked: 0, confirmed: 0, reverted: 0, replies };
    }

    const publicClient = createPublicBlockchainClient(this.env);

    for (const tweetId of pending) {
      const record = await this.getTradeRecord(tweetId);
      if (!record?.txHash) {
        await this.removePendingSubmitted(tweetId);
        continue;
      }

      if (record.status !== "SUBMITTED" && record.status !== "UNKNOWN") {
        await this.removePendingSubmitted(tweetId);
        continue;
      }

      const receipt = await getTransactionReceipt(publicClient, record.txHash as `0x${string}`);

      if (!receipt) {
        continue;
      }

      if (receipt.status === "success") {
        const updated = updateTradeRecord(record, {
          status: "CONFIRMED",
          blockNumber: receipt.blockNumber.toString(),
        });
        await this.saveTradeRecord(updated);
        await this.removePendingSubmitted(tweetId);
        confirmed += 1;

        if (updated.lastReplyStatus !== "CONFIRMED") {
          replies.push({
            tweetId,
            replyText: buildTradeReply(updated, "confirmed", this.env.MONAD_EXPLORER_TX_URL),
            status: "CONFIRMED",
          });
        }
      } else {
        const updated = updateTradeRecord(record, {
          status: "FAILED",
          failureCode: "TRANSACTION_REVERTED",
          failureMessageSafe: SAFE_ERROR_MESSAGES.TRANSACTION_REVERTED,
          blockNumber: receipt.blockNumber.toString(),
        });
        await this.saveTradeRecord(updated);
        await this.removePendingSubmitted(tweetId);
        reverted += 1;

        if (updated.lastReplyStatus !== "FAILED") {
          replies.push({
            tweetId,
            replyText: buildTradeReply(updated, "failed", this.env.MONAD_EXPLORER_TX_URL),
            status: "FAILED",
          });
        }
      }
    }

    return {
      checked: pending.length,
      confirmed,
      reverted,
      replies,
    };
  }
}

export default TradeCoordinator;
