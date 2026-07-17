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

const isProd =
  process.env.NODE_ENV === "production" ||
  (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "development-secret-min-32-characters-long!!",
  cookieName: "monad_packs_session",
  cookieOptions: {
    secure: isProd,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Bind session cookies onto a redirect/response (OpenNext/Workers-safe). */
export async function getSessionForResponse(response: NextResponse) {
  const cookieStore = {
    get(name: string) {
      const value = response.cookies.get(name)?.value;
      return value ? { name, value } : undefined;
    },
    set(nameOrOptions: string | { name: string; value: string; [key: string]: unknown }, value?: string, options?: Record<string, unknown>) {
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
  return getIronSession<SessionData>(cookieStore as never, sessionOptions);
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
