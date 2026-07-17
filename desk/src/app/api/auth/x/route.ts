import { NextResponse } from "next/server";

const X_AUTH_URL = "https://x.com/i/oauth2/authorize";

const cookieBase = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

const CANONICAL_CALLBACK = "https://trade.monexmonad.xyz/api/auth/x/callback";

export async function GET() {
  const clientId = process.env.X_CLIENT_ID?.trim();
  const callbackUrl = CANONICAL_CALLBACK;
  if (!clientId) {
    return NextResponse.json({ error: "X OAuth not configured" }, { status: 503 });
  }

  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  const codeChallenge = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = NextResponse.redirect(
    `${X_AUTH_URL}?${new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: "users.read offline.access",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    })}`,
  );

  response.cookies.set("x_oauth_state", state, cookieBase);
  response.cookies.set("x_code_verifier", codeVerifier, cookieBase);

  return response;
}
