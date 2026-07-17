import type { Hex } from "viem";
import { createTradeError, TradeError, type TradeErrorCode } from "./errors.js";

/** TradeError that may carry a known tx hash after local signing. */
export class SubmissionTradeError extends TradeError {
  readonly txHash?: Hex;

  constructor(code: TradeErrorCode, safeMessage: string, txHash?: Hex) {
    super(code, safeMessage);
    this.name = "SubmissionTradeError";
    this.txHash = txHash;
  }
}

export function createSubmissionError(
  code: "SUBMISSION_FAILED" | "SUBMISSION_UNKNOWN",
  detail?: string,
  txHash?: Hex,
): SubmissionTradeError {
  const base =
    code === "SUBMISSION_FAILED"
      ? "transaction submission failed"
      : "transaction submission result is unknown";
  const safeMessage = detail ? `${base}: ${detail}` : base;
  return new SubmissionTradeError(code, safeMessage, txHash);
}

export function isSubmissionTradeError(error: unknown): error is SubmissionTradeError {
  return error instanceof SubmissionTradeError;
}

/** Keep createTradeError available for non-submission paths in this module's re-exports. */
void createTradeError;
