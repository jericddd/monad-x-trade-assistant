import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTradePortfolio } from "@/lib/trade-worker";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId || !session.xUserId) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50),
    );

    const portfolio = await getTradePortfolio(session.xUserId, { page, limit });
    return NextResponse.json(portfolio);
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
