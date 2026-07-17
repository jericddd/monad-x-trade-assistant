export type TradeErrorCode =
  | "TRADING_DISABLED"
  | "DRY_RUN_ENABLED"
  | "UNAUTHORIZED_AUTHOR"
  | "INVALID_COMMAND"
  | "INVALID_AMOUNT"
  | "AMOUNT_TOO_SMALL"
  | "AMOUNT_TOO_LARGE"
  | "INVALID_TOKEN_ADDRESS"
  | "TOKEN_NOT_CONTRACT"
  | "TOKEN_NOT_SUPPORTED"
  | "TOKEN_LOCKED"
  | "QUOTE_FAILED"
  | "ZERO_OUTPUT"
  | "ROUTER_NOT_ALLOWED"
  | "SLIPPAGE_INVALID"
  | "PRICE_IMPACT_TOO_HIGH"
  | "INSUFFICIENT_WALLET_BALANCE"
  | "MINIMUM_RESERVE_VIOLATION"
  | "HOURLY_LIMIT_EXCEEDED"
  | "DAILY_LIMIT_EXCEEDED"
  | "DUPLICATE_TWEET"
  | "TRADE_ALREADY_IN_PROGRESS"
  | "SIMULATION_FAILED"
  | "GAS_ESTIMATION_FAILED"
  | "CHAIN_ID_MISMATCH"
  | "TRANSACTION_REVERTED"
  | "SUBMISSION_FAILED"
  | "SUBMISSION_UNKNOWN"
  | "CONFIRMATION_TIMEOUT"
  | "CONFIGURATION_ERROR"
  | "TOKEN_NOT_IN_PORTFOLIO"
  | "INTERNAL_AUTH_FAILED"
  | "X_API_ERROR"
  | "X_REPLY_FAILED";

export class TradeError extends Error {
  readonly code: TradeErrorCode;
  readonly safeMessage: string;

  constructor(code: TradeErrorCode, safeMessage: string) {
    super(safeMessage);
    this.name = "TradeError";
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

export const SAFE_ERROR_MESSAGES: Record<TradeErrorCode, string> = {
  TRADING_DISABLED: "trading is currently disabled",
  DRY_RUN_ENABLED: "dry-run mode is enabled",
  UNAUTHORIZED_AUTHOR: "this account is not authorized to trade",
  INVALID_COMMAND: "command format is invalid",
  INVALID_AMOUNT: "amount is invalid",
  AMOUNT_TOO_SMALL: "amount is too small",
  AMOUNT_TOO_LARGE: "amount exceeds the per-trade limit",
  INVALID_TOKEN_ADDRESS: "token address is invalid",
  TOKEN_NOT_CONTRACT: "address is not a contract",
  TOKEN_NOT_SUPPORTED: "token is not supported on Nad.fun",
  TOKEN_LOCKED: "token is temporarily untradeable (graduating to DEX)",
  QUOTE_FAILED: "quote could not be retrieved",
  ZERO_OUTPUT: "expected output is zero",
  ROUTER_NOT_ALLOWED: "router is not allowlisted",
  SLIPPAGE_INVALID: "slippage configuration is invalid",
  PRICE_IMPACT_TOO_HIGH: "price impact exceeds the configured limit",
  INSUFFICIENT_WALLET_BALANCE: "wallet balance is insufficient",
  MINIMUM_RESERVE_VIOLATION: "trade would violate the minimum wallet reserve",
  HOURLY_LIMIT_EXCEEDED: "hourly trade limit exceeded",
  DAILY_LIMIT_EXCEEDED: "daily spending limit exceeded",
  DUPLICATE_TWEET: "this post was already processed",
  TRADE_ALREADY_IN_PROGRESS: "a trade is already in progress for this post",
  SIMULATION_FAILED: "transaction simulation failed",
  GAS_ESTIMATION_FAILED: "gas estimation failed",
  CHAIN_ID_MISMATCH: "chain id mismatch detected",
  TRANSACTION_REVERTED: "transaction reverted on chain",
  SUBMISSION_FAILED: "transaction submission failed",
  SUBMISSION_UNKNOWN: "transaction submission result is unknown",
  CONFIRMATION_TIMEOUT: "transaction confirmation timed out",
  CONFIGURATION_ERROR: "service configuration is invalid",
  TOKEN_NOT_IN_PORTFOLIO: "token is not in your portfolio — buy on X first",
  INTERNAL_AUTH_FAILED: "internal authorization failed",
  X_API_ERROR: "X API request failed",
  X_REPLY_FAILED: "failed to reply on X",
};

export function createTradeError(code: TradeErrorCode, detail?: string): TradeError {
  const base = SAFE_ERROR_MESSAGES[code];
  const safeMessage = detail ? `${base}: ${detail}` : base;
  return new TradeError(code, safeMessage);
}
