import { describe, expect, it } from "vitest";
import { buildOAuth1AuthorizationHeader } from "../src/x/oauth1.js";

describe("oauth1", () => {
  it("builds an OAuth authorization header", async () => {
    const header = await buildOAuth1AuthorizationHeader({
      method: "POST",
      url: "https://api.x.com/2/tweets",
      consumerKey: "key",
      consumerSecret: "secret",
      accessToken: "token",
      accessTokenSecret: "token-secret",
    });

    expect(header.startsWith("OAuth ")).toBe(true);
    expect(header).toContain("oauth_consumer_key=");
    expect(header).toContain("oauth_signature=");
    expect(header).toContain("oauth_token=");
  });
});
