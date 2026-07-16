import { describe, expect, it } from "vitest";
import { redactObject, redactValue } from "../src/utils/redaction.js";
import { sanitizeErrorMessage } from "../src/trading/sanitize-error.js";

describe("redaction", () => {
  it("redacts private key patterns", () => {
    const value = "failed with private_key=0xabc123";
    expect(sanitizeErrorMessage(value)).not.toContain("0xabc123");
  });

  it("redacts secret env keys", () => {
    expect(redactValue("trade_wallet_private_key", "0xsecret")).toBe("[REDACTED]");
  });

  it("redacts nested objects", () => {
    const sanitized = redactObject({
      authorization: "Bearer abc.def.ghi",
      tweetId: "1",
    });

    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(sanitized.tweetId).toBe("1");
  });
});
