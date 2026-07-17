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

export function buildTradeReply(
  record: TradeRecord,
  kind: ReplyKind,
  _explorerBaseUrl?: string,
): string {
  void _explorerBaseUrl; // kept for call-site compatibility; links are never included
  const tokenShort = shortenAddress(record.tokenAddress);

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
      text = [
        "trade submitted",
        "",
        `spent: ${record.requestedAmountMon} MON`,
        `token: ${tokenShort}`,
        `minimum tokens: ${formatTokenAmount(record.minimumAmountOut)}`,
        record.txHash ? `tx: ${shortenAddress(record.txHash)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      break;

    case "confirmed":
      text = [
        "trade confirmed",
        "",
        `spent: ${record.requestedAmountMon} MON`,
        `received: ${formatTokenAmount(record.expectedAmountOut)} TOKEN`,
        `token: ${tokenShort}`,
        record.txHash ? `tx: ${shortenAddress(record.txHash)}` : "",
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
        "trade failed before confirmation",
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
        "check your trading wallet before retrying",
        record.txHash ? `tx: ${shortenAddress(record.txHash)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      break;
  }

  return stripUrls(text);
}
