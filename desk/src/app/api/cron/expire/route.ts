import { NextResponse } from "next/server";
import { expireAllDue } from "@/services/expiration";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await expireAllDue();
  return NextResponse.json({ expired: count });
}

/** Cloudflare scheduled() historically used GET — keep it, same auth. */
export async function GET(request: Request) {
  return POST(request);
}
