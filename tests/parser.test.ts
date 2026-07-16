import { describe, expect, it } from "vitest";
import { parseBuyCommand } from "../src/commands/parse-buy-command.js";

const BOT = "monexmonad";
const TOKEN = "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777";

describe("parseBuyCommand", () => {
  it("accepts standard buy command", () => {
    const result = parseBuyCommand(`@monexmonad buy 100 mon of ${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command.amountMon).toBe("100");
      expect(result.command.tokenAddress).toBe(TOKEN);
    }
  });

  it("accepts no space between amount and mon", () => {
    const result = parseBuyCommand(`@monexmonad buy 100mon of ${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
  });

  it("accepts case-insensitive keywords", () => {
    const result = parseBuyCommand(`@monexmonad BUY 0.5 MON OF ${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command.amountMon).toBe("0.5");
    }
  });

  it("rejects buy all mon", () => {
    const result = parseBuyCommand(`@monexmonad buy all mon of ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = parseBuyCommand(`@monexmonad buy -10 mon of ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = parseBuyCommand(`@monexmonad buy 0 mon of ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects usd denomination", () => {
    const result = parseBuyCommand(`@monexmonad buy 10 usd of ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid token address", () => {
    const result = parseBuyCommand("@monexmonad buy 10 mon of invalid", BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects zero address", () => {
    const result = parseBuyCommand(
      "@monexmonad buy 10 mon of 0x0000000000000000000000000000000000000000",
      BOT,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects extra instructions after contract", () => {
    const result = parseBuyCommand(`@monexmonad buy 10 mon of ${TOKEN} then sell`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects sell commands", () => {
    const result = parseBuyCommand(`@monexmonad sell 10 mon of ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });
});
