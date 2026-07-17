import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withdrawFromInSite } from "@/lib/trade-worker";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId || !session.xUserId) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const wallet = await prisma.walletConnection.findUnique({
      where: { userId: session.userId },
    });
    if (!wallet?.verifiedAt) {
      return NextResponse.json({ error: "WALLET_REQUIRED" }, { status: 400 });
    }

    const body = (await request.json()) as { amountMon?: string };
    if (!body.amountMon || !/^\d+(?:\.\d+)?$/.test(body.amountMon)) {
      return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400 });
    }

    const result = await withdrawFromInSite({
      xUserId: session.xUserId,
      amountMon: body.amountMon,
      toAddress: wallet.walletAddress,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "WITHDRAW_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
