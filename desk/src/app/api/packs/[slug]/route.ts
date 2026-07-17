import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = await prisma.pack.findUnique({
    where: { slug },
    include: { cards: { where: { active: true }, orderBy: { displayNumber: "asc" } } },
  });
  if (!pack || !pack.active || !pack.websiteEnabled) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ pack });
}
