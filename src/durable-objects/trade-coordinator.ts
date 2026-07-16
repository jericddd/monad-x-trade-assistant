import type { ParsedBuyCommand } from "../commands/types.js";
import { isAuthorizedAuthor, parseBuyCommand } from "../commands/parse-buy-command.js";
import type { AppEnv } from "../env.js";
import { sha256Hex } from "../utils/hash.js";
import { SAFE_ERROR_MESSAGES, type TradeErrorCode } from "../trading/errors.js";
import { toFailureCode, toSafePublicReason } from "../trading/sanitize-error.js";
import {
  checkTradeLimits,
  createInitialLimitState,
  isDuplicateTrade,
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
import { createProviders } from "../blockchain/nadfun/quote.js";
import { parseEther } from "viem";

type CoordinatorState = {
  limits: LimitState;
  processingLock: boolean;
};

export type ProcessMentionRequest = {
  tweetId: string;
  authorId: string;
  text: string;
  env: Partial<AppEnv>;
};

export type ProcessMentionResponse = {
  ok: boolean;
  replyText?: string;
  status?: string;
  failureCode?: TradeErrorCode;
};

const CURSOR_KEY = "poll:cursor";
const LIMITS_KEY = "limits:state";

export class TradeCoordinator implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
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

    if (url.pathname === "/process-mention" && request.method === "POST") {
      const body = (await request.json()) as ProcessMentionRequest;
      const result = await this.processMention(body);
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

    return new Response("not found", { status: 404 });
  }

  async getPollCursor(): Promise<string | null> {
    return (await this.state.storage.get<string>(CURSOR_KEY)) ?? null;
  }

  async setPollCursor(cursor: string): Promise<void> {
    await this.state.storage.put(CURSOR_KEY, cursor);
  }

  private async getCoordinatorState(): Promise<CoordinatorState> {
    const stored = await this.state.storage.get<CoordinatorState>(LIMITS_KEY);
    return stored ?? { limits: createInitialLimitState(), processingLock: false };
  }

  private async saveCoordinatorState(state: CoordinatorState): Promise<void> {
    await this.state.storage.put(LIMITS_KEY, state);
  }

  private async getTradeRecord(tweetId: string): Promise<TradeRecord | null> {
    return (await this.state.storage.get<TradeRecord>(tradeRecordKey(tweetId))) ?? null;
  }

  private async saveTradeRecord(record: TradeRecord): Promise<void> {
    await this.state.storage.put(tradeRecordKey(record.tweetId), record);
  }

  async processMention(input: ProcessMentionRequest): Promise<ProcessMentionResponse> {
    const env = input.env;
    const botUsername = env.X_BOT_USERNAME ?? "monexmonad";
    const authorizedUserId = env.AUTHORIZED_X_USER_ID ?? "";

    if (!isAuthorizedAuthor(input.authorId, authorizedUserId)) {
      return {
        ok: false,
        failureCode: "UNAUTHORIZED_AUTHOR",
        replyText: `trade rejected\n\nreason: ${SAFE_ERROR_MESSAGES.UNAUTHORIZED_AUTHOR}`,
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
        replyText: `trade rejected\n\nreason: ${SAFE_ERROR_MESSAGES.DUPLICATE_TWEET}`,
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
        providers.walletAddress,
      );

      const maxMonPerTradeWei = parseEther(env.MAX_MON_PER_TRADE ?? "10");
      const maxMonPerDayWei = parseEther(env.MAX_MON_PER_DAY ?? "30");
      const requestedWei = parseEther(parsed.command.amountMon);

      const limitCheck = checkTradeLimits({
        state: coordinatorState.limits,
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
            walletAddress: providers.walletAddress,
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

      if (isDuplicateTrade(existing)) {
        return {
          ok: false,
          failureCode: "DUPLICATE_TWEET",
          replyText: `trade rejected\n\nreason: ${SAFE_ERROR_MESSAGES.DUPLICATE_TWEET}`,
        };
      }

      const result = await tradeService.executeDryRun({
        tweetId: input.tweetId,
        authorId: input.authorId,
        commandText: input.text,
        commandTextHash,
        command: parsed.command as ParsedBuyCommand,
        existingRecord: existing,
      });

      await this.saveTradeRecord(result.record);

      return {
        ok: true,
        replyText: result.replyText,
        status: result.record.status,
      };
    } catch (error) {
      const failureCode = toFailureCode(error);
      const reason = toSafePublicReason(error);

      const record = createTradeRecord({
        tweetId: input.tweetId,
        authorId: input.authorId,
        commandTextHash: await sha256Hex(input.text),
        requestedAmountMon: parsed.command.amountMon,
        requestedAmountWei: parseEther(parsed.command.amountMon).toString(),
        tokenAddress: parsed.command.tokenAddress,
        walletAddress: createProviders(env).walletAddress,
      });

      const failed = new TradeService(
        env,
        createProviders(env).quoteProvider,
        createProviders(env).simulationProvider,
        createProviders(env).walletAddress,
      ).buildFailedResult(record, reason, failureCode);

      await this.saveTradeRecord(failed.record);

      return {
        ok: false,
        failureCode,
        replyText: failed.replyText,
        status: failed.record.status,
      };
    } finally {
      const latest = await this.getCoordinatorState();
      await this.saveCoordinatorState({ ...latest, processingLock: false });
    }
  }
}

export default TradeCoordinator;
