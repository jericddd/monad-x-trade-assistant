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

/**
 * Build X reply text. Successful live trades only reply once after confirmation
 * ("trade successful") — callers must not post the submitted draft reply.
 */
export function buildTradeReply(
  record: TradeRecord,
  kind: ReplyKind,
  _explorerBaseUrl?: string,
): string {
  void _explorerBaseUrl; // kept for call-site compatibility; links are never included
  const tokenFull = record.tokenAddress;
  const txFull = record.txHash ?? "";

  let text: string;
  switch (kind) {
    case "dry_run":
      text = [
        "dry run successful",
        "",
        `would spend: ${record.requestedAmountMon} MON`,
        `estimated tokens: ${formatTokenAmount(record.expectedAmountOut)}`,
        `minimum tokens: ${formatTokenAmount(record.minimumAmountOut)}`,
        "no transaction was submitted",
      ].join("\n");
      break;

    case "submitted":
      // Intentionally empty — X gets a single reply after on-chain confirmation.
      text = "";
      break;

    case "confirmed":
      text = [
        "trade successful",
        "",
        `spent: ${record.requestedAmountMon} MON`,
        `received: ${formatTokenAmount(record.expectedAmountOut)} TOKEN`,
        `token: ${tokenFull}`,
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
