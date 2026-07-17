import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTradeAccount, recordTradeTransfer } from "@/lib/trade-worker";

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
      type?: string;
      amountMon?: string;
      txHash?: string;
    };

    if (body.type !== "deposit") {
      return NextResponse.json({ error: "only_deposit_via_this_endpoint" }, { status: 400 });
    }
    if (!body.amountMon || !/^\d+(?:\.\d+)?$/.test(body.amountMon)) {
      return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400 });
    }
    if (!body.txHash || !/^0x[a-fA-F0-9]{64}$/i.test(body.txHash)) {
      return NextResponse.json({ error: "INVALID_TX_HASH" }, { status: 400 });
    }

    const account = await getTradeAccount(session.xUserId);
    const inSite = account.user?.inSiteWallet;

    await recordTradeTransfer({
      xUserId: session.xUserId,
      type: "deposit",
      amountMon: body.amountMon,
      txHash: body.txHash,
      fromAddress: wallet.walletAddress,
      toAddress: inSite,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
