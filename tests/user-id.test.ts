import { describe, expect, it } from "vitest";
import { normalizeNumericUserId, normalizeOptionalNumericUserId } from "../src/x/user-id.js";

describe("normalizeNumericUserId", () => {
  it("trims whitespace from configured user ids", () => {
    expect(normalizeNumericUserId(" 1618468570450776071\n", "AUTHORIZED_X_USER_ID")).toBe(
      "1618468570450776071",
    );
  });

  it("rejects missing user ids", () => {
    expect(() => normalizeNumericUserId(undefined, "AUTHORIZED_X_USER_ID")).toThrow(
      "AUTHORIZED_X_USER_ID is not configured",
    );
  });

  it("rejects non-numeric user ids", () => {
    expect(() => normalizeNumericUserId("monexmonad", "AUTHORIZED_X_USER_ID")).toThrow(
      "AUTHORIZED_X_USER_ID must be a numeric user id",
    );
  });
});

describe("normalizeOptionalNumericUserId", () => {
  it("returns undefined for empty values", () => {
    expect(normalizeOptionalNumericUserId(undefined)).toBeUndefined();
    expect(normalizeOptionalNumericUserId("   ")).toBeUndefined();
  });

  it("returns undefined for invalid since_id values", () => {
    expect(normalizeOptionalNumericUserId("abc")).toBeUndefined();
  });
});
