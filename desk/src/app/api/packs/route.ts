import { NextResponse } from "next/server";
import { getPublicPacks } from "@/services/activity";

export async function GET() {
  const packs = await getPublicPacks();
  return NextResponse.json({ packs });
}

export async function POST() {
  return NextResponse.json({ error: "Use /api/packs/[slug]/open" }, { status: 405 });
}
