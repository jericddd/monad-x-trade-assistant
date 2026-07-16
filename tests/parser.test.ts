import { describe, expect, it } from "vitest";
import { parseBuyCommand } from "../src/commands/parse-buy-command.js";

const BOT = "monexmonad";
const TOKEN = "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777";

describe("parseBuyCommand", () => {
  it("accepts standard buy command", () => {
    const result = parseBuyCommand(`@monexmonad buy 100 mon ${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command.amountMon).toBe("100");
      expect(result.command.tokenAddress).toBe(TOKEN);
    }
  });

  it("accepts no space between amount and mon", () => {
    const result = parseBuyCommand(`@monexmonad buy 100mon ${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
  });

  it("accepts case-insensitive keywords", () => {
    const result = parseBuyCommand(`@monexmonad BUY 0.5 MON ${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command.amountMon).toBe("0.5");
    }
  });

  it("accepts newline between mon and token address", () => {
    const result = parseBuyCommand(`@monexmonad buy 1 mon\n${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
  });

  it("accepts leading symbol before buy after mention", () => {
    const result = parseBuyCommand(`@monexmonad Ξ buy 1 mon ${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
  });

  it("accepts newline and symbol like a real X post", () => {
    const result = parseBuyCommand(`@monexmonad Ξ buy 1 mon\n${TOKEN}`, BOT);
    expect(result.ok).toBe(true);
  });

  it("rejects old format with of", () => {
    const result = parseBuyCommand(`@monexmonad buy 100 mon of ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects buy all mon", () => {
    const result = parseBuyCommand(`@monexmonad buy all mon ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = parseBuyCommand(`@monexmonad buy -10 mon ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = parseBuyCommand(`@monexmonad buy 0 mon ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects usd denomination", () => {
    const result = parseBuyCommand(`@monexmonad buy 10 usd ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid token address", () => {
    const result = parseBuyCommand("@monexmonad buy 10 mon invalid", BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects zero address", () => {
    const result = parseBuyCommand(
      "@monexmonad buy 10 mon 0x0000000000000000000000000000000000000000",
      BOT,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects extra instructions after contract", () => {
    const result = parseBuyCommand(`@monexmonad buy 10 mon ${TOKEN} then sell`, BOT);
    expect(result.ok).toBe(false);
  });

  it("rejects sell commands", () => {
    const result = parseBuyCommand(`@monexmonad sell 10 mon ${TOKEN}`, BOT);
    expect(result.ok).toBe(false);
  });
});
