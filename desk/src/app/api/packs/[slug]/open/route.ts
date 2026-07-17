import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ProductError } from "@/lib/errors";
import { openPackForUser } from "@/services/pack-opening";
import { expireUserPendingIfNeeded } from "@/services/expiration";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { slug } = await params;
    const body = (await request.json().catch(() => ({}))) as { idempotencyKey?: string };
    const pack = await prisma.pack.findUnique({ where: { slug } });
    if (!pack) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    await expireUserPendingIfNeeded(session.userId);

    const opening = await openPackForUser({
      userId: session.userId,
      packId: pack.id,
      source: "WEBSITE",
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ opening });
  } catch (err) {
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
