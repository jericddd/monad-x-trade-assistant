import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeAppTrade } from "@/lib/trade-worker";

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

    const body = (await request.json()) as {
      action?: "buy" | "sell";
      tokenAddress?: string;
      amountMon?: string;
      percent?: number;
      amountToken?: string;
    };

    if (body.action !== "buy" && body.action !== "sell") {
      return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    }
    if (!body.tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(body.tokenAddress)) {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
    }

    if (body.action === "buy") {
      if (!body.amountMon || !/^\d+(?:\.\d+)?$/.test(body.amountMon)) {
        return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400 });
      }
    } else {
      const hasPercent =
        typeof body.percent === "number" && body.percent >= 1 && body.percent <= 100;
      const hasAmount = Boolean(body.amountToken && /^\d+(?:\.\d+)?$/.test(body.amountToken));
      if (!hasPercent && !hasAmount) {
        return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400 });
      }
    }

    const result = await executeAppTrade({
      xUserId: session.xUserId,
      action: body.action,
      tokenAddress: body.tokenAddress,
      amountMon: body.amountMon,
      percent: body.percent,
      amountToken: body.amountToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRADE_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
