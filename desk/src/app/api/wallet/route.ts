import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ProductError } from "@/lib/errors";
import { issueWalletNonce, verifyWalletSignature } from "@/services/wallet-verification";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

    const body = (await request.json()) as {
      walletAddress: string;
      signature?: `0x${string}`;
    };

    if (body.signature) {
      const result = await verifyWalletSignature(
        session.userId,
        body.walletAddress,
        body.signature,
      );
      return NextResponse.json(result);
    }

    const nonce = await issueWalletNonce(session.userId, body.walletAddress);
    return NextResponse.json(nonce);
  } catch (err) {
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
