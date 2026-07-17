import { formatUnits } from "viem";
import type { TradeRecord } from "./trade-record.js";
import { shortenAddress } from "../utils/address.js";

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

export type ReplyKind = "dry_run" | "submitted" | "confirmed" | "rejected" | "failed" | "unknown";

/** Rotate success openers so replies don’t look copy-pasted. */
export const SUCCESS_HEADLINES = [
  "trade successful",
  "buy filled",
  "order complete",
  "trade landed",
  "filled successfully",
] as const;

export function pickSuccessHeadline(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return SUCCESS_HEADLINES[hash % SUCCESS_HEADLINES.length]!;
}

function tickerLabel(record: TradeRecord): string {
  const raw = (record.tokenSymbol ?? "").trim();
  if (!raw) return "TOKEN";
  // Strip a leading $ if the symbol already includes it.
  // Avoid cashtag form ($TICKER) — X often rejects automated crypto posts with cashtags.
  return raw.replace(/^\$+/, "").toUpperCase() || "TOKEN";
}

function tokenLine(record: TradeRecord): string {
  // Full CA only — ticker already appears on the received line.
  return `token: ${record.tokenAddress}`;
}

function shortenTx(txHash: string): string {
  if (txHash.length < 14) return txHash;
  return `${txHash.slice(0, 10)}…${txHash.slice(-6)}`;
}

/**
 * Build X reply text. Successful live trades only reply once after confirmation
 * — callers must not post the submitted draft reply.
 */
export function buildTradeReply(
  record: TradeRecord,
  kind: ReplyKind,
  _explorerBaseUrl?: string,
): string {
  void _explorerBaseUrl; // kept for call-site compatibility; links are never included
  const txFull = record.txHash ?? "";
  const ticker = tickerLabel(record);

  let text: string;
  switch (kind) {
    case "dry_run":
      text = [
        "dry run successful",
        "",
        `would spend: ${record.requestedAmountMon} MON`,
        `estimated tokens: ${formatTokenAmount(record.expectedAmountOut)} ${ticker}`,
        `minimum tokens: ${formatTokenAmount(record.minimumAmountOut)} ${ticker}`,
        tokenLine(record),
        "no transaction was submitted",
      ].join("\n");
      break;

    case "submitted":
      // Intentionally empty — X gets a single reply after on-chain confirmation.
      text = "";
      break;

    case "confirmed":
      text = [
        pickSuccessHeadline(record.tweetId || record.txHash || record.tokenAddress),
        "",
        `spent: ${record.requestedAmountMon} MON`,
        `received: ${formatTokenAmount(record.expectedAmountOut)} ${ticker}`,
        tokenLine(record),
        txFull ? `tx: ${txFull}` : "",
      ]
        .filter(Boolean)
        .join("\n");
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
        txFull ? `tx: ${txFull}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      break;

    case "unknown":
      text = [
        "trade status requires verification",
        "",
        "the network response was unclear after submission",
        "check your trading wallet before retrying",
        txFull ? `tx: ${txFull}` : `token: ${shortenAddress(record.tokenAddress)}`,
      ]
        .filter(Boolean)
        .join("\n");
      break;
  }

  return stripUrls(text);
}

/**
 * Compact success reply used when the full confirmed text is rejected by X
 * (spam filters on long hex / financial wording).
 */
export function buildCompactConfirmedReply(record: TradeRecord): string {
  const ticker = tickerLabel(record);
  const tx = record.txHash ? shortenTx(record.txHash) : "";
  return stripUrls(
    [
      pickSuccessHeadline(`${record.tweetId || ""}:compact`),
      "",
      `spent: ${record.requestedAmountMon} MON`,
      `received: ${formatTokenAmount(record.expectedAmountOut)} ${ticker}`,
      `token: ${shortenAddress(record.tokenAddress)}`,
      tx ? `tx: ${tx}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
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
