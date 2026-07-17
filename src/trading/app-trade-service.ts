import { formatEther, getAddress, isAddress, parseUnits } from "viem";
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
import { executeNadfunBuy, executeNadfunSell } from "../blockchain/wallet.js";
import { erc20Abi } from "../blockchain/nadfun/abis/erc20.js";
import { validateBuyCommand } from "../commands/validate-buy-command.js";
import { fetchTokenSymbol } from "./token-meta.js";

export type AppTradeResult = {
  record: TradeRecord;
  replyKind: ReplyKind;
  replyText: string;
};

function newAppTradeId(): string {
  return `app-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Site/app buy & sell for tokens already in the user's portfolio.
 * X remains buy-only — this path is never used by mention polling.
 */
export class AppTradeService {
  constructor(
    private readonly env: Partial<AppEnv>,
    private readonly quoteProvider: QuoteProvider,
    private readonly simulationProvider: SimulationProvider,
    private readonly walletAddress: `0x${string}`,
    private readonly signerPrivateKey: string,
  ) {}

  async executeBuy(input: {
    authorId: string;
    tokenAddress: string;
    amountMon: string;
  }): Promise<AppTradeResult> {
    if (!isAddress(input.tokenAddress)) {
      throw createTradeError("INVALID_TOKEN_ADDRESS");
    }
    const tokenAddress = getAddress(input.tokenAddress) as `0x${string}`;
    const validation = validateBuyCommand(
      { action: "buy", amountMon: input.amountMon, tokenAddress },
      this.env.MAX_MON_PER_TRADE ?? "10",
    );
    if (!validation.ok) {
      throw createTradeError(validation.code);
    }

    return this.runBuy({
      authorId: input.authorId,
      tokenAddress,
      amountMon: input.amountMon,
      amountWei: validation.amountWei,
    });
  }

  async executeSell(input: {
    authorId: string;
    tokenAddress: string;
    /** 1–100 */
    percent?: number;
    /** Exact token amount as decimal string (alternative to percent). */
    amountToken?: string;
  }): Promise<AppTradeResult> {
    if (!isAddress(input.tokenAddress)) {
      throw createTradeError("INVALID_TOKEN_ADDRESS");
    }
    const tokenAddress = getAddress(input.tokenAddress) as `0x${string}`;

    const dryRun = this.env.TRADE_DRY_RUN !== false;
    const tradingEnabled = this.env.TRADING_ENABLED === true;
    if (!dryRun && !tradingEnabled) {
      throw createTradeError("TRADING_DISABLED");
    }

    const live = await createLiveExecutionContext(this.env, this.signerPrivateKey);
    if (!live.walletClient) {
      throw createTradeError("CONFIGURATION_ERROR", "wallet client unavailable");
    }

    const [balance, decimals, symbol] = await Promise.all([
      live.publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [live.walletAddress],
      }) as Promise<bigint>,
      live.publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "decimals",
      }) as Promise<number>,
      fetchTokenSymbol(live.publicClient, tokenAddress),
    ]);

    if (balance <= 0n) {
      throw createTradeError("INSUFFICIENT_WALLET_BALANCE", "no token balance to sell");
    }

    let amountIn: bigint;
    if (input.amountToken != null && input.amountToken !== "") {
      if (!/^\d+(?:\.\d+)?$/.test(input.amountToken)) {
        throw createTradeError("INVALID_AMOUNT");
      }
      amountIn = parseUnits(input.amountToken, Number(decimals));
    } else {
      const percent = input.percent ?? 100;
      if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
        throw createTradeError("INVALID_AMOUNT", "sell percent must be 1–100");
      }
      amountIn = (balance * BigInt(Math.floor(percent))) / 100n;
    }

    if (amountIn <= 0n || amountIn > balance) {
      throw createTradeError("INVALID_AMOUNT", "sell amount exceeds balance");
    }

    const getSellQuote = this.quoteProvider.getSellQuote?.bind(this.quoteProvider);
    if (!getSellQuote) {
      throw createTradeError("CONFIGURATION_ERROR", "sell quotes unavailable");
    }

    const quote = await getSellQuote({ tokenAddress, amountInWei: amountIn });
    if (!quote.hasBytecode) throw createTradeError("TOKEN_NOT_CONTRACT");
    if (quote.isLocked) throw createTradeError("TOKEN_LOCKED");
    if (quote.expectedAmountOut <= 0n) throw createTradeError("ZERO_OUTPUT");

    const allowedRouters = (this.env.NADFUN_ALLOWED_ROUTER_ADDRESSES ?? []) as `0x${string}`[];
    if (!isAllowlistedRouter(quote.routerAddress, allowedRouters)) {
      throw createTradeError("ROUTER_NOT_ALLOWED");
    }

    const slippageBps = this.env.DEFAULT_SLIPPAGE_BPS ?? 300;
    const minimumAmountOut = calculateMinimumAmountOut(quote.expectedAmountOut, slippageBps);
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + (this.env.TRADE_DEADLINE_SECONDS ?? 120),
    );

    const tradeId = newAppTradeId();
    let record = createTradeRecord({
      tweetId: tradeId,
      authorId: input.authorId,
      commandTextHash: `app-sell:${tokenAddress}:${amountIn.toString()}`,
      requestedAmountMon: formatEther(quote.expectedAmountOut),
      requestedAmountWei: amountIn.toString(),
      tokenAddress,
      tokenSymbol: symbol,
      walletAddress: live.walletAddress,
      action: "sell",
      source: "app",
    });
    record = updateTradeRecord(record, {
      status: "QUOTED",
      routerAddress: quote.routerAddress,
      expectedAmountOut: quote.expectedAmountOut.toString(),
      minimumAmountOut: minimumAmountOut.toString(),
      slippageBps,
    });

    const simulateSell = this.simulationProvider.simulateSell?.bind(this.simulationProvider);
    if (simulateSell) {
      record = updateTradeRecord(record, { status: "SIMULATING" });
      const simulation = await simulateSell({
        tokenAddress,
        amountInWei: amountIn,
        amountOutMin: minimumAmountOut,
        routerAddress: quote.routerAddress,
        recipient: live.walletAddress,
        deadline,
      });
      if (!simulation.ok) {
        throw createTradeError("SIMULATION_FAILED", simulation.reason);
      }
    }

    if (dryRun) {
      record = updateTradeRecord(record, { status: "DRY_RUN_SUCCESS" });
      return {
        record,
        replyKind: "dry_run",
        replyText: buildTradeReply(record, "dry_run", this.env.MONAD_EXPLORER_TX_URL),
      };
    }

    if (this.env.TRADING_ENABLED !== true || this.env.TRADE_DRY_RUN !== false) {
      throw createTradeError("TRADING_DISABLED");
    }

    // Gas cushion for approve + sell.
    const nativeBal = await getNativeBalance(live.publicClient, live.walletAddress);
    const gasPrice = await live.publicClient.getGasPrice();
    const estimatedGasCost = gasPrice * 350_000n;
    if (nativeBal < estimatedGasCost + live.minReserveWei) {
      throw createTradeError("MINIMUM_RESERVE_VIOLATION", "need MON for gas");
    }

    record = updateTradeRecord(record, { status: "SUBMITTING" });

    try {
      const txHash = await executeNadfunSell({
        publicClient: live.publicClient,
        walletClient: live.walletClient,
        walletAddress: live.walletAddress,
        tokenAddress,
        amountIn,
        amountOutMin: minimumAmountOut,
        routerAddress: quote.routerAddress,
        deadline,
        allowedRouters,
        gas: 300_000n,
        gasPrice,
      });

      record = updateTradeRecord(record, { status: "SUBMITTED", txHash });
      return {
        record,
        replyKind: "submitted",
        replyText: buildTradeReply(record, "submitted", this.env.MONAD_EXPLORER_TX_URL),
      };
    } catch (error) {
      return this.mapLiveFailure(record, error);
    }
  }

  private async runBuy(input: {
    authorId: string;
    tokenAddress: `0x${string}`;
    amountMon: string;
    amountWei: bigint;
  }): Promise<AppTradeResult> {
    const dryRun = this.env.TRADE_DRY_RUN !== false;
    const tradingEnabled = this.env.TRADING_ENABLED === true;
    if (!dryRun && !tradingEnabled) {
      throw createTradeError("TRADING_DISABLED");
    }

    const quote = await this.quoteProvider.getBuyQuote({
      tokenAddress: input.tokenAddress,
      amountInWei: input.amountWei,
    });
    if (!quote.hasBytecode) throw createTradeError("TOKEN_NOT_CONTRACT");
    if (quote.isLocked) throw createTradeError("TOKEN_LOCKED");
    if (quote.expectedAmountOut <= 0n) throw createTradeError("ZERO_OUTPUT");

    const allowedRouters = (this.env.NADFUN_ALLOWED_ROUTER_ADDRESSES ?? []) as `0x${string}`[];
    if (!isAllowlistedRouter(quote.routerAddress, allowedRouters)) {
      throw createTradeError("ROUTER_NOT_ALLOWED");
    }

    const slippageBps = this.env.DEFAULT_SLIPPAGE_BPS ?? 300;
    const minimumAmountOut = calculateMinimumAmountOut(quote.expectedAmountOut, slippageBps);
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + (this.env.TRADE_DEADLINE_SECONDS ?? 120),
    );

    const tradeId = newAppTradeId();
    let tokenSymbol: string | undefined;
    try {
      const liveForMeta = await createLiveExecutionContext(this.env, this.signerPrivateKey);
      tokenSymbol = await fetchTokenSymbol(liveForMeta.publicClient, input.tokenAddress);
    } catch {
      // best-effort
    }

    let record = createTradeRecord({
      tweetId: tradeId,
      authorId: input.authorId,
      commandTextHash: `app-buy:${input.tokenAddress}:${input.amountWei.toString()}`,
      requestedAmountMon: input.amountMon,
      requestedAmountWei: input.amountWei.toString(),
      tokenAddress: input.tokenAddress,
      tokenSymbol,
      walletAddress: this.walletAddress,
      action: "buy",
      source: "app",
    });
    record = updateTradeRecord(record, {
      status: "QUOTED",
      routerAddress: quote.routerAddress,
      expectedAmountOut: quote.expectedAmountOut.toString(),
      minimumAmountOut: minimumAmountOut.toString(),
      slippageBps,
    });

    record = updateTradeRecord(record, { status: "SIMULATING" });
    const simulation = await this.simulationProvider.simulateBuy({
      tokenAddress: input.tokenAddress,
      amountInWei: input.amountWei,
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

    const live = await createLiveExecutionContext(this.env, this.signerPrivateKey);
    if (!live.walletClient) {
      throw createTradeError("CONFIGURATION_ERROR", "wallet client unavailable");
    }

    const data = (await import("../blockchain/nadfun/build-buy.js")).buildBuyTransaction({
      tokenAddress: input.tokenAddress,
      amountOutMin: minimumAmountOut,
      recipient: live.walletAddress,
      deadline,
      routerAddress: quote.routerAddress,
    });

    let gasEstimate: { gas: bigint; gasPrice: bigint; estimatedCost: bigint };
    try {
      gasEstimate = await estimateBuyGas({
        publicClient: live.publicClient,
        account: live.walletAddress,
        to: quote.routerAddress,
        data,
        value: input.amountWei,
      });
    } catch {
      throw createTradeError("GAS_ESTIMATION_FAILED");
    }

    const balance = await getNativeBalance(live.publicClient, live.walletAddress);
    if (
      !hasSufficientReserve({
        walletBalance: balance,
        tradeAmount: input.amountWei,
        estimatedGasCost: gasEstimate.estimatedCost,
        minimumReserve: live.minReserveWei,
      })
    ) {
      if (balance < input.amountWei + gasEstimate.estimatedCost) {
        throw createTradeError("INSUFFICIENT_WALLET_BALANCE");
      }
      throw createTradeError("MINIMUM_RESERVE_VIOLATION");
    }

    record = updateTradeRecord(record, {
      status: "SUBMITTING",
      walletAddress: live.walletAddress,
      reservedAmountWei: input.amountWei.toString(),
    });

    try {
      const txHash = await executeNadfunBuy({
        publicClient: live.publicClient,
        walletClient: live.walletClient,
        walletAddress: live.walletAddress,
        tokenAddress: input.tokenAddress,
        amountInWei: input.amountWei,
        amountOutMin: minimumAmountOut,
        routerAddress: quote.routerAddress,
        deadline,
        allowedRouters,
        gas: gasEstimate.gas,
        gasPrice: gasEstimate.gasPrice,
      });
      record = updateTradeRecord(record, { status: "SUBMITTED", txHash });
      return {
        record,
        replyKind: "submitted",
        replyText: buildTradeReply(record, "submitted", this.env.MONAD_EXPLORER_TX_URL),
      };
    } catch (error) {
      return this.mapLiveFailure(record, error);
    }
  }

  private mapLiveFailure(record: TradeRecord, error: unknown): AppTradeResult {
    if (
      (isSubmissionTradeError(error) || error instanceof TradeError) &&
      error.code === "SUBMISSION_UNKNOWN"
    ) {
      const txHash = isSubmissionTradeError(error) ? error.txHash : undefined;
      const updated = updateTradeRecord(record, {
        status: "UNKNOWN",
        failureCode: "SUBMISSION_UNKNOWN",
        failureMessageSafe: error.safeMessage,
        txHash,
      });
      return {
        record: updated,
        replyKind: "unknown",
        replyText: buildTradeReply(updated, "unknown", this.env.MONAD_EXPLORER_TX_URL),
      };
    }

    const reason =
      error instanceof TradeError ? error.safeMessage : "transaction submission failed";
    const code = error instanceof TradeError ? error.code : "SUBMISSION_FAILED";
    const txHash = isSubmissionTradeError(error) ? error.txHash : undefined;
    const updated = updateTradeRecord(record, {
      status: "FAILED",
      failureCode: code,
      failureMessageSafe: reason,
      txHash,
    });
    return {
      record: updated,
      replyKind: "failed",
      replyText: buildTradeReply(updated, "failed", this.env.MONAD_EXPLORER_TX_URL),
    };
  }
}
