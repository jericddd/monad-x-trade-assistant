import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { renewInSiteWallet } from "@/lib/trade-worker";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId || !session.xUserId) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { confirmRenew?: boolean };
    if (body.confirmRenew !== true) {
      return NextResponse.json({ error: "confirm_renew_required" }, { status: 400 });
    }

    const result = await renewInSiteWallet(session.xUserId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL";
    const status = /not_linked/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
