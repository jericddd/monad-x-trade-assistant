import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: session.userId,
      xUserId: session.xUserId,
      xUsername: session.xUsername,
      xProfileImage: session.xProfileImage,
      isAdmin: session.isAdmin,
    },
  });
}
