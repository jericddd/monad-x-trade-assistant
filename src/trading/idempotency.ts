import { NON_RETRYABLE_STATUSES, type TradeRecord } from "./trade-record.js";

export function shouldProcessTweet(existing: TradeRecord | null): boolean {
  if (!existing) {
    return true;
  }

  if (NON_RETRYABLE_STATUSES.has(existing.status)) {
    return false;
  }

  if (existing.status === "DRY_RUN_SUCCESS") {
    return false;
  }

  return ["FAILED", "REJECTED", "DRY_RUN_FAILED"].includes(existing.status);
}

export function isIdempotentDuplicate(existing: TradeRecord | null): boolean {
  if (!existing) {
    return false;
  }

  return NON_RETRYABLE_STATUSES.has(existing.status) || existing.status === "DRY_RUN_SUCCESS";
}
