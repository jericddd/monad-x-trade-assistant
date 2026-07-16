import { describe, expect, it } from "vitest";
import { isAuthorizedAuthor } from "../src/commands/parse-buy-command.js";

describe("authorization", () => {
  it("allows the configured numeric user id", () => {
    expect(isAuthorizedAuthor("123456789", "123456789")).toBe(true);
  });

  it("rejects a different numeric user id", () => {
    expect(isAuthorizedAuthor("999999999", "123456789")).toBe(false);
  });

  it("does not authorize by username mismatch on id", () => {
    expect(isAuthorizedAuthor("not-a-number", "123456789")).toBe(false);
  });
});
