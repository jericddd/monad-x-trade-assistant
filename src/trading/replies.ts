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

export type ReplyKind = "dry_run" | "submitted" | "confirmed" | "rejected" | "failed" | "unknown";

export function buildTradeReply(
  record: TradeRecord,
  kind: ReplyKind,
  explorerBaseUrl?: string,
): string {
  const tokenShort = shortenAddress(record.tokenAddress);
  const explorerLine =
    record.txHash && explorerBaseUrl
      ? `explorer: ${explorerBaseUrl.replace(/\/?$/, "/")}${record.txHash}`
      : "";

  switch (kind) {
    case "dry_run":
      return [
        "dry run successful",
        "",
        `would spend: ${record.requestedAmountMon} MON`,
        `estimated tokens: ${formatTokenAmount(record.expectedAmountOut)}`,
        `minimum tokens: ${formatTokenAmount(record.minimumAmountOut)}`,
        "no transaction was submitted",
      ].join("\n");

    case "submitted":
      return [
        "trade submitted",
        "",
        `spent: ${record.requestedAmountMon} MON`,
        `token: ${tokenShort}`,
        `minimum tokens: ${formatTokenAmount(record.minimumAmountOut)}`,
        record.txHash ? `tx: ${shortenAddress(record.txHash)}` : "",
        explorerLine,
      ]
        .filter(Boolean)
        .join("\n");

    case "confirmed":
      return [
        "trade confirmed",
        "",
        `spent: ${record.requestedAmountMon} MON`,
        `received: ${formatTokenAmount(record.expectedAmountOut)} TOKEN`,
        `token: ${tokenShort}`,
        record.txHash ? `tx: ${shortenAddress(record.txHash)}` : "",
        explorerLine,
      ]
        .filter(Boolean)
        .join("\n");

    case "rejected":
      return [
        "trade rejected",
        "",
        `reason: ${record.failureMessageSafe ?? "trade was rejected"}`,
      ].join("\n");

    case "failed":
      return [
        "trade failed before confirmation",
        "",
        `reason: ${record.failureMessageSafe ?? "execution failed"}`,
        "safe to retry with a new post",
      ].join("\n");

    case "unknown":
      return [
        "trade status requires verification",
        "",
        "the network response was unclear after submission",
        "check your trading wallet before retrying",
        record.txHash ? `tx: ${shortenAddress(record.txHash)}` : "",
        explorerLine,
      ]
        .filter(Boolean)
        .join("\n");
  }
}
