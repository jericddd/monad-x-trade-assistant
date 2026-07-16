import type { ParsedBuyCommand } from "./types.js";
import { zeroAddress } from "viem";

const BUY_COMMAND_PATTERN = /^buy\s+(\d+(?:\.\d+)?)\s*mon\s+(0x[a-fA-F0-9]{40})$/i;

const MAX_DECIMALS = 18;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function stripBotMention(text: string, botUsername: string): string {
  const mentionPattern = new RegExp(`@${escapeRegex(botUsername)}`, "gi");
  return text.replace(mentionPattern, "").trim();
}

function validateAmount(amount: string): string | null {
  if (amount.includes(",")) {
    return null;
  }

  if (/[eE]/.test(amount)) {
    return null;
  }

  if (/^0x/i.test(amount)) {
    return null;
  }

  if (amount.startsWith("-")) {
    return null;
  }

  if (!/^\d+(?:\.\d+)?$/.test(amount)) {
    return null;
  }

  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > MAX_DECIMALS) {
    return null;
  }

  const numeric = `${whole}${fraction ? `.${fraction}` : ""}`;
  if (Number(whole) === 0 && (!fraction || /^0+$/.test(fraction))) {
    return null;
  }

  return numeric;
}

export type ParseBuyCommandResult =
  | { ok: true; command: ParsedBuyCommand }
  | { ok: false; reason: "INVALID_COMMAND" | "INVALID_AMOUNT" };

export function parseBuyCommand(rawText: string, botUsername: string): ParseBuyCommandResult {
  const normalized = stripBotMention(normalizeWhitespace(rawText), botUsername).trim();
  const match = BUY_COMMAND_PATTERN.exec(normalized);

  if (!match) {
    return { ok: false, reason: "INVALID_COMMAND" };
  }

  const amountMon = validateAmount(match[1] ?? "");
  if (!amountMon) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }

  const tokenAddress = match[2] as `0x${string}`;

  if (tokenAddress.toLowerCase() === zeroAddress) {
    return { ok: false, reason: "INVALID_COMMAND" };
  }

  return {
    ok: true,
    command: {
      action: "buy",
      amountMon,
      tokenAddress,
    },
  };
}

export function isAuthorizedAuthor(authorId: string, authorizedUserId: string): boolean {
  return authorId === authorizedUserId;
}
