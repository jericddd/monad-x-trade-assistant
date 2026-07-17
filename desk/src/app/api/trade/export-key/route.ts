import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exportInSitePrivateKey } from "@/lib/trade-worker";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.userId || !session.xUserId) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const result = await exportInSitePrivateKey(session.xUserId);
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL";
    const status = /already_exported/i.test(message)
      ? 409
      : /not_linked/i.test(message)
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
