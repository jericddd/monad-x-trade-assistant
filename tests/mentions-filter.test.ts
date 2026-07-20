import { describe, expect, it } from "vitest";
import {
  isGameCommand,
  isPotentialCommand,
  shouldReplyToInvalidCommand,
} from "../src/x/mentions.js";

const BOT = "monexmonad";

describe("mention filters (shared @monexmonad with game)", () => {
  it("treats catch variants as game commands", () => {
    expect(isGameCommand("@monexmonad catch")).toBe(true);
    expect(isGameCommand("@monexmonad catch 3")).toBe(true);
    expect(isGameCommand("@monexmonad @alice catch")).toBe(true);
    expect(isGameCommand("CATCH")).toBe(true);
    expect(isGameCommand("@monexmonad open pack")).toBe(true);
  });

  it("does not treat buy as a game command", () => {
    expect(isGameCommand("@monexmonad buy 1 mon 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777")).toBe(
      false,
    );
  });

  it("only treats mentions starting with buy as potential trade commands", () => {
    expect(isPotentialCommand("@monexmonad buy 1 mon 0xabc", BOT)).toBe(true);
    expect(isPotentialCommand("@monexmonad buy", BOT)).toBe(true);
    expect(isPotentialCommand("@monexmonad catch", BOT)).toBe(false);
    expect(isPotentialCommand("@monexmonad catch 3", BOT)).toBe(false);
    expect(isPotentialCommand("@monexmonad hello", BOT)).toBe(false);
    expect(isPotentialCommand("buy 1 mon 0xabc", BOT)).toBe(false);
  });

  it("does not publicly reject catch / non-buy chatter", () => {
    expect(shouldReplyToInvalidCommand("@monexmonad catch", BOT)).toBe(false);
    expect(shouldReplyToInvalidCommand("@monexmonad catch 3", BOT)).toBe(false);
    expect(shouldReplyToInvalidCommand("@monexmonad open pack", BOT)).toBe(false);
    expect(shouldReplyToInvalidCommand("@monexmonad gm", BOT)).toBe(false);
  });

  it("still rejects malformed buy attempts publicly", () => {
    expect(shouldReplyToInvalidCommand("@monexmonad buy all mon 0xabc", BOT)).toBe(true);
    expect(shouldReplyToInvalidCommand("@monexmonad buy", BOT)).toBe(true);
  });
});
