import { isAddress, zeroAddress } from "viem";
import { parseEther } from "viem";
import type { ParsedBuyCommand } from "./types.js";

export type BuyCommandValidationResult =
  | { ok: true; amountWei: bigint }
  | {
      ok: false;
      code: "INVALID_TOKEN_ADDRESS" | "INVALID_AMOUNT" | "AMOUNT_TOO_SMALL" | "AMOUNT_TOO_LARGE";
    };

export function validateBuyCommand(
  command: ParsedBuyCommand,
  maxMonPerTrade: string,
): BuyCommandValidationResult {
  if (!isAddress(command.tokenAddress) || command.tokenAddress === zeroAddress) {
    return { ok: false, code: "INVALID_TOKEN_ADDRESS" };
  }

  let amountWei: bigint;
  try {
    amountWei = parseEther(command.amountMon);
  } catch {
    return { ok: false, code: "INVALID_AMOUNT" };
  }

  if (amountWei <= 0n) {
    return { ok: false, code: "AMOUNT_TOO_SMALL" };
  }

  const maxWei = parseEther(maxMonPerTrade);
  if (amountWei > maxWei) {
    return { ok: false, code: "AMOUNT_TOO_LARGE" };
  }

  return { ok: true, amountWei };
}
