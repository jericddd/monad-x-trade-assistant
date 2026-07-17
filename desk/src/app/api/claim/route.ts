import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ProductError } from "@/lib/errors";
import { claimOpening } from "@/services/claim";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

    const { openingId, walletAddress } = (await request.json()) as {
      openingId: string;
      walletAddress: string;
    };

    const opening = await claimOpening(session.userId, openingId, walletAddress);
    return NextResponse.json({ opening });
  } catch (err) {
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
