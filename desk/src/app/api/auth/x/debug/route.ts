import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Temporary credential probe for X OAuth 2.0.
 * Auth: Authorization: Bearer <OAUTH_DEBUG_SECRET>
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.OAUTH_DEBUG_SECRET ?? process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = process.env.X_CLIENT_ID?.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  const callbackUrl =
    process.env.X_CALLBACK_URL?.trim() ?? "https://trade.monexmonad.xyz/api/auth/x/callback";

  const config = {
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    clientIdLength: clientId?.length ?? 0,
    clientSecretLength: clientSecret?.length ?? 0,
    clientIdPrefix: clientId?.slice(0, 6) ?? null,
    secretHasWhitespace: Boolean(clientSecret && /\s/.test(clientSecret)),
    callbackUrl,
  };

  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: false, config, probes: null });
  }

  const verifier = "probe_verifier_abcdefghijklmnopqrstuvwxyz0123456789";
  const baseBody = {
    code: "probe_invalid_code",
    grant_type: "authorization_code",
    redirect_uri: callbackUrl,
    code_verifier: verifier,
  };

  async function probe(
    label: string,
    init: { headers: Record<string, string>; body: URLSearchParams },
  ) {
    const res = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: init.headers,
      body: init.body,
    });
    const text = await res.text();
    let parsed: { error?: string; error_description?: string } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      parsed = { error_description: text.slice(0, 240) };
    }
    return {
      label,
      status: res.status,
      error: parsed.error ?? null,
      errorDescription: parsed.error_description ?? null,
    };
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const basicAuthBtoa = btoa(`${clientId}:${clientSecret}`);

  const probes = [
    await probe("confidential_basic_buffer", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({ ...baseBody, client_id: clientId }),
    }),
    await probe("confidential_basic_btoa", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuthBtoa}`,
      },
      body: new URLSearchParams({ ...baseBody, client_id: clientId }),
    }),
    await probe("confidential_basic_no_client_id_body", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams(baseBody),
    }),
    await probe("public_pkce_no_basic", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ ...baseBody, client_id: clientId }),
    }),
    await probe("confidential_body_secret", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        ...baseBody,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }),
  ];

  // Prefer a probe that gets past client auth (invalid_grant / invalid_request).
  const accepted = probes.find((p) =>
    ["invalid_grant", "invalid_request"].includes(p.error ?? ""),
  );

  return NextResponse.json({
    ok: Boolean(accepted),
    recommended: accepted?.label ?? null,
    config,
    probes,
  });
}
