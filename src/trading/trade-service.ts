import { parseEther } from "viem";
import type { ParsedBuyCommand } from "../commands/types.js";
import { validateBuyCommand } from "../commands/validate-buy-command.js";
import type { AppEnv } from "../env.js";
import { calculateMinimumAmountOut } from "../utils/bigint.js";
import { isAllowlistedRouter } from "../utils/address.js";
import { createTradeError, TradeError } from "./errors.js";
import { isSubmissionTradeError } from "./submission-error.js";
import type { QuoteProvider, SimulationProvider } from "../blockchain/nadfun/quote.js";
import { createLiveExecutionContext } from "../blockchain/nadfun/quote.js";
import { createTradeRecord, updateTradeRecord, type TradeRecord } from "./trade-record.js";
import { buildTradeReply, type ReplyKind } from "./replies.js";
import { getNativeBalance, hasSufficientReserve } from "../blockchain/balances.js";
import { estimateBuyGas } from "../blockchain/gas.js";
import { buildBuyTransaction } from "../blockchain/nadfun/build-buy.js";
import { executeNadfunBuy } from "../blockchain/wallet.js";
import { createPublicBlockchainClient } from "../blockchain/client.js";
import { waitForReceipt } from "../blockchain/receipts.js";
import { fetchTokenSymbol } from "./token-meta.js";

export type TradeExecutionResult = {
  record: TradeRecord;
  replyKind: ReplyKind;
  replyText: string;
  reservedAmountWei?: bigint;
  committedAmountWei?: bigint;
  releaseReservation?: boolean;
};

export class TradeService {
  constructor(
    private readonly env: Partial<AppEnv>,
    private readonly quoteProvider: QuoteProvider,
    private readonly simulationProvider: SimulationProvider,
    private readonly walletAddress: `0x${string}`,
    /** When set, live buys/withdraw sign with this key (per-user in-site wallet). */
    private readonly signerPrivateKey?: string,
  ) {}

  async executeTrade(input: {
    tweetId: string;
    authorId: string;
    commandText: string;
    commandTextHash: string;
    command: ParsedBuyCommand;
    existingRecord?: TradeRecord | null;
  }): Promise<TradeExecutionResult> {
    const dryRun = this.env.TRADE_DRY_RUN !== false;
    const tradingEnabled = this.env.TRADING_ENABLED === true;

    // Dry-run overrides live trading.
    if (!dryRun && !tradingEnabled) {
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

    if (!record.tokenSymbol) {
      try {
        const publicClient = createPublicBlockchainClient(this.env);
        const symbol = await fetchTokenSymbol(publicClient, input.command.tokenAddress);
        if (symbol) {
          record = updateTradeRecord(record, { tokenSymbol: symbol });
        }
      } catch {
        // Symbol is best-effort for reply formatting.
      }
    }

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
    if (slippageBps < 0 || slippageBps > 1000) {
      throw createTradeError("SLIPPAGE_INVALID");
    }

    const minimumAmountOut = calculateMinimumAmountOut(quote.expectedAmountOut, slippageBps);
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + (this.env.TRADE_DEADLINE_SECONDS ?? 120),
    );

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
      deadline,
    });

    if (!simulation.ok) {
      throw createTradeError("SIMULATION_FAILED", simulation.reason);
    }

    if (dryRun) {
      record = updateTradeRecord(record, { status: "DRY_RUN_SUCCESS" });
      return {
        record,
        replyKind: "dry_run",
        replyText: buildTradeReply(record, "dry_run", this.env.MONAD_EXPLORER_TX_URL),
      };
    }

    return this.executeLiveBuy({
      record,
      tokenAddress: input.command.tokenAddress,
      amountInWei: validation.amountWei,
      amountOutMin: minimumAmountOut,
      routerAddress: quote.routerAddress,
      deadline,
      allowedRouters,
    });
  }

  private async executeLiveBuy(input: {
    record: TradeRecord;
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    deadline: bigint;
    allowedRouters: `0x${string}`[];
  }): Promise<TradeExecutionResult> {
    // Re-check emergency stop immediately before signing.
    if (this.env.TRADING_ENABLED !== true || this.env.TRADE_DRY_RUN !== false) {
      throw createTradeError("TRADING_DISABLED");
    }

    const signerKey = this.signerPrivateKey ?? this.env.TRADE_WALLET_PRIVATE_KEY;
    if (!signerKey) {
      throw createTradeError("CONFIGURATION_ERROR", "trade wallet private key is required");
    }

    const live = await createLiveExecutionContext(this.env, signerKey);
    if (!live.walletClient) {
      throw createTradeError("CONFIGURATION_ERROR", "wallet client unavailable");
    }

    const data = buildBuyTransaction({
      tokenAddress: input.tokenAddress,
      amountOutMin: input.amountOutMin,
      recipient: live.walletAddress,
      deadline: input.deadline,
      routerAddress: input.routerAddress,
    });

    let gasEstimate: { gas: bigint; gasPrice: bigint; estimatedCost: bigint };
    try {
      gasEstimate = await estimateBuyGas({
        publicClient: live.publicClient,
        account: live.walletAddress,
        to: input.routerAddress,
        data,
        value: input.amountInWei,
      });
    } catch {
      throw createTradeError("GAS_ESTIMATION_FAILED");
    }

    const balance = await getNativeBalance(live.publicClient, live.walletAddress);
    if (
      !hasSufficientReserve({
        walletBalance: balance,
        tradeAmount: input.amountInWei,
        estimatedGasCost: gasEstimate.estimatedCost,
        minimumReserve: live.minReserveWei,
      })
    ) {
      if (balance < input.amountInWei + gasEstimate.estimatedCost) {
        throw createTradeError("INSUFFICIENT_WALLET_BALANCE");
      }
      throw createTradeError("MINIMUM_RESERVE_VIOLATION");
    }

    // Final emergency-stop check before broadcast.
    if (this.env.TRADING_ENABLED !== true || this.env.TRADE_DRY_RUN !== false) {
      throw createTradeError("TRADING_DISABLED");
    }

    let record = updateTradeRecord(input.record, {
      status: "SUBMITTING",
      reservedAmountWei: input.amountInWei.toString(),
      walletAddress: live.walletAddress,
    });

    try {
      const txHash = await executeNadfunBuy({
        publicClient: live.publicClient,
        walletClient: live.walletClient,
        walletAddress: live.walletAddress,
        tokenAddress: input.tokenAddress,
        amountInWei: input.amountInWei,
        amountOutMin: input.amountOutMin,
        routerAddress: input.routerAddress,
        deadline: input.deadline,
        allowedRouters: input.allowedRouters,
        gas: gasEstimate.gas,
        gasPrice: gasEstimate.gasPrice,
      });

      record = updateTradeRecord(record, {
        status: "SUBMITTED",
        txHash,
      });

      // Wait for inclusion so X gets a single "trade successful" reply right away.
      const receipt = await waitForReceipt(live.publicClient, txHash, 25_000);
      if (receipt?.status === "success") {
        if (!record.tokenSymbol) {
          const symbol = await fetchTokenSymbol(live.publicClient, input.tokenAddress);
          if (symbol) {
            record = updateTradeRecord(record, { tokenSymbol: symbol });
          }
        }
        record = updateTradeRecord(record, {
          status: "CONFIRMED",
          blockNumber: receipt.blockNumber.toString(),
        });
        return {
          record,
          replyKind: "confirmed",
          replyText: buildTradeReply(record, "confirmed", this.env.MONAD_EXPLORER_TX_URL),
          reservedAmountWei: input.amountInWei,
          committedAmountWei: input.amountInWei,
        };
      }

      // Receipt not ready yet — confirm cron will post "trade successful" later.
      return {
        record,
        replyKind: "submitted",
        replyText: buildTradeReply(record, "submitted", this.env.MONAD_EXPLORER_TX_URL),
        reservedAmountWei: input.amountInWei,
        committedAmountWei: input.amountInWei,
      };
    } catch (error) {
      if (
        (isSubmissionTradeError(error) || error instanceof TradeError) &&
        error.code === "SUBMISSION_UNKNOWN"
      ) {
        const txHash = isSubmissionTradeError(error) ? error.txHash : undefined;
        record = updateTradeRecord(record, {
          status: "UNKNOWN",
          failureCode: "SUBMISSION_UNKNOWN",
          failureMessageSafe: error.safeMessage,
          txHash,
        });
        return {
          record,
          replyKind: "unknown",
          replyText: buildTradeReply(record, "unknown", this.env.MONAD_EXPLORER_TX_URL),
          reservedAmountWei: input.amountInWei,
          committedAmountWei: input.amountInWei,
        };
      }

      const reason =
        error instanceof TradeError ? error.safeMessage : "transaction submission failed";
      const code = error instanceof TradeError ? error.code : "SUBMISSION_FAILED";
      const txHash = isSubmissionTradeError(error) ? error.txHash : undefined;
      record = updateTradeRecord(record, {
        status: "FAILED",
        failureCode: code,
        failureMessageSafe: reason,
        txHash,
      });

      return {
        record,
        replyKind: "failed",
        replyText: buildTradeReply(record, "failed", this.env.MONAD_EXPLORER_TX_URL),
        reservedAmountWei: input.amountInWei,
        releaseReservation: true,
      };
    }
  }

  /** @deprecated Use executeTrade — kept for existing dry-run tests */
  async executeDryRun(input: {
    tweetId: string;
    authorId: string;
    commandText: string;
    commandTextHash: string;
    command: ParsedBuyCommand;
    existingRecord?: TradeRecord | null;
  }): Promise<TradeExecutionResult> {
    return this.executeTrade(input);
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

export function parseAmountWei(amountMon: string): bigint {
  return parseEther(amountMon);
}
