import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTradeAccount, linkTradeUser } from "@/lib/trade-worker";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId || !session.xUserId) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const wallet = await prisma.walletConnection.findUnique({
      where: { userId: session.userId },
    });

    if (!wallet?.verifiedAt) {
      return NextResponse.json({
        linked: false,
        needsWallet: true,
        account: null,
      });
    }

    let account = await getTradeAccount(session.xUserId);
    if (!account.user) {
      const linked = await linkTradeUser({
        xUserId: session.xUserId,
        xUsername: session.xUsername ?? "user",
        connectedWallet: wallet.walletAddress,
      });
      account = await getTradeAccount(session.xUserId);
      if (!account.user) {
        account = { user: linked, balances: { inSiteMon: "0", connectedMon: null } };
      }
    } else if (
      account.user.connectedWallet.toLowerCase() !== wallet.walletAddress.toLowerCase()
    ) {
      const linked = await linkTradeUser({
        xUserId: session.xUserId,
        xUsername: session.xUsername ?? "user",
        connectedWallet: wallet.walletAddress,
      });
      account = {
        user: linked,
        balances: account.balances,
      };
    }

    return NextResponse.json({
      linked: true,
      needsWallet: false,
      account: account.user,
      balances: account.balances ?? { inSiteMon: "0", connectedMon: null },
      connectedWallet: wallet.walletAddress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
