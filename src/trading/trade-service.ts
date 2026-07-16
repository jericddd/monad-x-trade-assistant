import type { ParsedBuyCommand } from "../commands/types.js";
import { validateBuyCommand } from "../commands/validate-buy-command.js";
import type { AppEnv } from "../env.js";
import { calculateMinimumAmountOut } from "../utils/bigint.js";
import { isAllowlistedRouter } from "../utils/address.js";
import { createTradeError } from "./errors.js";
import type { QuoteProvider, SimulationProvider } from "../blockchain/nadfun/quote.js";
import { createTradeRecord, updateTradeRecord, type TradeRecord } from "./trade-record.js";
import { buildTradeReply, type ReplyKind } from "./replies.js";

export type TradeExecutionResult = {
  record: TradeRecord;
  replyKind: ReplyKind;
  replyText: string;
};

export class TradeService {
  constructor(
    private readonly env: Partial<AppEnv>,
    private readonly quoteProvider: QuoteProvider,
    private readonly simulationProvider: SimulationProvider,
    private readonly walletAddress: `0x${string}`,
  ) {}

  async executeDryRun(input: {
    tweetId: string;
    authorId: string;
    commandText: string;
    commandTextHash: string;
    command: ParsedBuyCommand;
    existingRecord?: TradeRecord | null;
  }): Promise<TradeExecutionResult> {
    if (this.env.TRADING_ENABLED === false && this.env.TRADE_DRY_RUN !== true) {
      throw createTradeError("TRADING_DISABLED");
    }

    const validation = validateBuyCommand(input.command, this.env.MAX_MON_PER_TRADE ?? "10");
    if (!validation.ok) {
      throw createTradeError(validation.code);
    }

    let record =
      input.existingRecord ??
      createTradeRecord({
        tweetId: input.tweetId,
        authorId: input.authorId,
        commandTextHash: input.commandTextHash,
        requestedAmountMon: input.command.amountMon,
        requestedAmountWei: validation.amountWei.toString(),
        tokenAddress: input.command.tokenAddress,
        walletAddress: this.walletAddress,
      });

    record = updateTradeRecord(record, { status: "VALIDATING" });

    const quote = await this.quoteProvider.getBuyQuote({
      tokenAddress: input.command.tokenAddress,
      amountInWei: validation.amountWei,
    });

    if (!quote.hasBytecode) {
      throw createTradeError("TOKEN_NOT_CONTRACT");
    }

    if (quote.isLocked) {
      throw createTradeError("TOKEN_LOCKED");
    }

    if (quote.expectedAmountOut <= 0n) {
      throw createTradeError("ZERO_OUTPUT");
    }

    const allowedRouters = (this.env.NADFUN_ALLOWED_ROUTER_ADDRESSES ?? []) as `0x${string}`[];
    if (!isAllowlistedRouter(quote.routerAddress, allowedRouters)) {
      throw createTradeError("ROUTER_NOT_ALLOWED");
    }

    const slippageBps = this.env.DEFAULT_SLIPPAGE_BPS ?? 300;
    const minimumAmountOut = calculateMinimumAmountOut(quote.expectedAmountOut, slippageBps);

    record = updateTradeRecord(record, {
      status: "QUOTED",
      routerAddress: quote.routerAddress,
      expectedAmountOut: quote.expectedAmountOut.toString(),
      minimumAmountOut: minimumAmountOut.toString(),
      slippageBps,
    });

    record = updateTradeRecord(record, { status: "SIMULATING" });

    const simulation = await this.simulationProvider.simulateBuy({
      tokenAddress: input.command.tokenAddress,
      amountInWei: validation.amountWei,
      amountOutMin: minimumAmountOut,
      routerAddress: quote.routerAddress,
      recipient: this.walletAddress,
      deadline: BigInt(Math.floor(Date.now() / 1000) + (this.env.TRADE_DEADLINE_SECONDS ?? 120)),
    });

    if (!simulation.ok) {
      throw createTradeError("SIMULATION_FAILED", simulation.reason);
    }

    const dryRun = this.env.TRADE_DRY_RUN !== false;
    if (dryRun) {
      record = updateTradeRecord(record, { status: "DRY_RUN_SUCCESS" });
      return {
        record,
        replyKind: "dry_run",
        replyText: buildTradeReply(record, "dry_run"),
      };
    }

    if (this.env.TRADING_ENABLED !== true) {
      throw createTradeError("TRADING_DISABLED");
    }

    throw createTradeError("DRY_RUN_ENABLED");
  }

  buildRejectedResult(record: TradeRecord, reason: string): TradeExecutionResult {
    const updated = updateTradeRecord(record, {
      status: "REJECTED",
      failureMessageSafe: reason,
    });

    return {
      record: updated,
      replyKind: "rejected",
      replyText: buildTradeReply(updated, "rejected"),
    };
  }

  buildFailedResult(record: TradeRecord, reason: string, code: string): TradeExecutionResult {
    const updated = updateTradeRecord(record, {
      status: "FAILED",
      failureCode: code,
      failureMessageSafe: reason,
    });

    return {
      record: updated,
      replyKind: "failed",
      replyText: buildTradeReply(updated, "failed"),
    };
  }
}
