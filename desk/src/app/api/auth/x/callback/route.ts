import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionForResponse, isAdminXUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CANONICAL_CALLBACK = "https://trade.monexmonad.xyz/api/auth/x/callback";
const CANONICAL_HOME = "https://trade.monexmonad.xyz/";

function redirectHome(error?: string, detail?: string) {
  const url = new URL(CANONICAL_HOME);
  if (error) url.searchParams.set("error", error);
  if (detail) url.searchParams.set("detail", detail.slice(0, 80));
  const response = NextResponse.redirect(url);
  for (const name of ["x_oauth_state", "x_code_verifier"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const storedState = request.cookies.get("x_oauth_state")?.value;
    const codeVerifier = request.cookies.get("x_code_verifier")?.value;

    if (!code) return redirectHome("missing_code");
    if (!state || !storedState || state !== storedState) {
      return redirectHome("auth_state_mismatch");
    }
    if (!codeVerifier) return redirectHome("missing_verifier");

    const clientId = process.env.X_CLIENT_ID?.trim();
    const clientSecret = process.env.X_CLIENT_SECRET?.trim();
    // Prefer canonical callback so authorize + token always match the X app setting.
    const callbackUrl = CANONICAL_CALLBACK;
    const configuredCallback = process.env.X_CALLBACK_URL?.trim();
    if (configuredCallback && configuredCallback !== CANONICAL_CALLBACK) {
      console.error("x_oauth_callback_mismatch", configuredCallback);
    }

    if (!clientId || !clientSecret) {
      return redirectHome("oauth_not_configured");
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => "");
      let oauthError = "token_failed";
      try {
        const parsed = JSON.parse(detail) as { error?: string; error_description?: string };
        if (parsed.error) oauthError = parsed.error;
        console.error("x_oauth_token_failed", tokenRes.status, parsed);
        return redirectHome(oauthError, parsed.error_description ?? detail);
      } catch {
        console.error("x_oauth_token_failed", tokenRes.status, detail.slice(0, 300));
        return redirectHome("token_failed", detail);
      }
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const userRes = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      const detail = await userRes.text().catch(() => "");
      console.error("x_oauth_user_failed", userRes.status, detail.slice(0, 300));
      return redirectHome("user_failed", `HTTP ${userRes.status}`);
    }

    const userPayload = (await userRes.json()) as {
      data?: { id: string; username: string; profile_image_url?: string };
    };
    const xUser = userPayload.data;
    if (!xUser?.id || !xUser.username) {
      console.error("x_oauth_user_failed", "missing_user_payload");
      return redirectHome("user_failed", "missing_user_payload");
    }

    const user = await prisma.user.upsert({
      where: { xUserId: xUser.id },
      create: {
        xUserId: xUser.id,
        xUsername: xUser.username,
        xProfileImage: xUser.profile_image_url,
        isAdmin: isAdminXUser(xUser.id),
      },
      update: {
        xUsername: xUser.username,
        xProfileImage: xUser.profile_image_url,
        isAdmin: isAdminXUser(xUser.id),
      },
    });

    const response = redirectHome();
    const session = await getSessionForResponse(response);
    session.userId = user.id;
    session.xUserId = user.xUserId;
    session.xUsername = user.xUsername;
    session.xProfileImage = user.xProfileImage ?? undefined;
    session.isAdmin = user.isAdmin;
    await session.save();
    return response;
  } catch (error) {
    console.error("x_oauth_callback_error", error instanceof Error ? error.message : error);
    return redirectHome("callback_error");
  }
}
