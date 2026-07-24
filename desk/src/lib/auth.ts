import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export interface SessionData {
  userId?: string;
  xUserId?: string;
  xUsername?: string;
  xProfileImage?: string;
  isAdmin?: boolean;
}

const DEV_SESSION_SECRET = "development-secret-min-32-characters-long!!";

const isProd =
  process.env.NODE_ENV === "production" ||
  (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

function resolveSessionPassword(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;

  // next build sets NODE_ENV=production without Worker secrets — allow placeholder then only.
  const phase = process.env.NEXT_PHASE ?? "";
  if (phase.includes("build") || process.env.npm_lifecycle_event === "build") {
    return DEV_SESSION_SECRET;
  }

  if (isProd) {
    throw new Error("SESSION_SECRET must be set (min 32 chars) in production");
  }
  return DEV_SESSION_SECRET;
}

export function getSessionOptions(): SessionOptions {
  return {
    password: resolveSessionPassword(),
    cookieName: "monad_packs_session",
    cookieOptions: {
      secure: isProd,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

/** @deprecated Prefer getSessionOptions() — kept for any external imports. */
export const sessionOptions: SessionOptions = {
  get password() {
    return resolveSessionPassword();
  },
  cookieName: "monad_packs_session",
  cookieOptions: {
    secure: isProd,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  },
} as SessionOptions;

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

/** Bind session cookies onto a redirect/response (OpenNext/Workers-safe). */
export async function getSessionForResponse(response: NextResponse) {
  const cookieStore = {
    get(name: string) {
      const value = response.cookies.get(name)?.value;
      return value ? { name, value } : undefined;
    },
    set(
      nameOrOptions: string | { name: string; value: string; [key: string]: unknown },
      value?: string,
      options?: Record<string, unknown>,
    ) {
      if (typeof nameOrOptions === "string") {
        response.cookies.set({
          name: nameOrOptions,
          value: value ?? "",
          ...(options ?? {}),
        });
        return;
      }
      response.cookies.set(nameOrOptions as { name: string; value: string });
    },
  };

  // iron-session overloads include Node req/res; CookieStore shape is what App Router uses.
  return getIronSession<SessionData>(cookieStore as never, getSessionOptions());
}

export async function requireAuth() {
  const session = await getSession();
  if (!session.userId) {
    throw new Error("AUTH_REQUIRED");
  }
  return session;
}

export function isAdminXUser(xUserId: string): boolean {
  const admins = (process.env.ADMIN_X_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return admins.includes(xUserId);
}

/** Admin gate — always re-check ADMIN_X_USER_IDS (ignore sticky session.isAdmin). */
export async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || !session.xUserId || !isAdminXUser(session.xUserId)) {
    throw new Error("FORBIDDEN");
  }
  session.isAdmin = true;
  return session;
}
