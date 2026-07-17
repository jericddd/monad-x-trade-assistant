import { formatUnits } from "viem";
import type { TradeRecord } from "./trade-record.js";

function formatTokenAmount(value: string | undefined): string {
  if (!value) {
    return "0";
  }

  try {
    const formatted = formatUnits(BigInt(value), 18);
    const [whole, fraction = ""] = formatted.split(".");
    if (!fraction) {
      return whole ?? "0";
    }
    return `${whole}.${fraction.slice(0, 6).replace(/0+$/, "") || "0"}`;
  } catch {
    return value;
  }
}

/** Strip URLs — X replies with links are expensive; never include them. */
export function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Strip 0x hex payloads. X rejects tweets containing crypto addresses for the
 * first 7 days after app authentication ("Crypto addresses are prohibited…").
 */
export function stripCryptoAddresses(text: string): string {
  return text
    .replace(/\b0x[a-fA-F0-9]{6,}\b/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type ReplyKind = "dry_run" | "submitted" | "confirmed" | "rejected" | "failed" | "unknown";

/** Rotate success openers so replies don’t look copy-pasted. */
export const SUCCESS_HEADLINES = [
  "trade successful",
  "buy filled",
  "order complete",
  "trade landed",
  "filled successfully",
] as const;

/** Rotate site CTAs under received — no URLs (X charges for link replies). */
export const SITE_FOOTERS = [
  "visit the MonEx site to verify your txn",
  "check the MonEx desk to confirm this trade",
  "open MonEx to review your transaction",
  "verify this buy on the MonEx site",
  "see full txn details on MonEx",
] as const;

function pickRotating<T extends readonly string[]>(options: T, seed: string, salt = 0): T[number] {
  let hash = salt >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return options[hash % options.length]!;
}

export function pickSuccessHeadline(seed: string): string {
  return pickRotating(SUCCESS_HEADLINES, seed);
}

export function pickSiteFooter(seed: string): string {
  // Different salt so footer rotation is independent of the headline.
  return pickRotating(SITE_FOOTERS, seed, 0x9e3779b9);
}

function tickerLabel(record: TradeRecord): string {
  const raw = (record.tokenSymbol ?? "").trim();
  if (!raw) return "TOKEN";
  // Strip a leading $ if the symbol already includes it; replies add $TICKER themselves.
  return raw.replace(/^\$+/, "").toUpperCase() || "TOKEN";
}

function sanitizeReply(text: string): string {
  return stripCryptoAddresses(stripUrls(text));
}

/** Confirmed buy reply — headline + spent/received + rotating site verify line. */
function buildConfirmedBody(record: TradeRecord, headlineSeed: string): string {
  const ticker = tickerLabel(record);
  return [
    pickSuccessHeadline(headlineSeed),
    "",
    `spent: ${record.requestedAmountMon} MON`,
    `received: ${formatTokenAmount(record.expectedAmountOut)} $${ticker}`,
    pickSiteFooter(headlineSeed),
  ].join("\n");
}

/**
 * Build X reply text. Successful live trades only reply once after confirmation
 * — callers must not post the submitted draft reply.
 *
 * Never include 0x addresses/hashes: new X app auth blocks crypto addresses
 * for 7 days, and users can see CA/tx on the MonEx desk.
 */
export function buildTradeReply(
  record: TradeRecord,
  kind: ReplyKind,
  _explorerBaseUrl?: string,
): string {
  void _explorerBaseUrl; // kept for call-site compatibility; links are never included
  const ticker = tickerLabel(record);

  let text: string;
  switch (kind) {
    case "dry_run":
      text = [
        "dry run successful",
        "",
        `would spend: ${record.requestedAmountMon} MON`,
        `estimated tokens: ${formatTokenAmount(record.expectedAmountOut)} $${ticker}`,
        `minimum tokens: ${formatTokenAmount(record.minimumAmountOut)} $${ticker}`,
        "no transaction was submitted",
      ].join("\n");
      break;

    case "submitted":
      // Intentionally empty — X gets a single reply after on-chain confirmation.
      text = "";
      break;

    case "confirmed":
      text = buildConfirmedBody(
        record,
        record.tweetId || record.txHash || record.tokenAddress,
      );
      break;

    case "rejected":
      text = [
        "trade rejected",
        "",
        `reason: ${record.failureMessageSafe ?? "trade was rejected"}`,
      ].join("\n");
      break;

    case "failed":
      text = [
        "trade failed",
        "",
        `reason: ${record.failureMessageSafe ?? "execution failed"}`,
        "safe to retry with a new post",
      ].join("\n");
      break;

    case "unknown":
      text = [
        "trade status requires verification",
        "",
        "the network response was unclear after submission",
        "check your trading wallet on the MonEx desk before retrying",
      ].join("\n");
      break;
  }

  return sanitizeReply(text);
}

/**
 * Fallback confirmed reply — same spent/received shape with a different headline seed.
 */
export function buildCompactConfirmedReply(record: TradeRecord): string {
  return sanitizeReply(buildConfirmedBody(record, `${record.tweetId || ""}:compact`));
}

/** True when X rejected a post because an identical reply already exists. */
export function isDuplicateXReplyError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate") ||
    lower.includes("you already said that") ||
    lower.includes("status is a duplicate")
  );
}

/** Permanent reply failures — stop retrying (tweet gone / not visible). */
export function isPermanentXReplyError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("deleted") ||
    lower.includes("not visible to you") ||
    lower.includes("not found")
  );
}
