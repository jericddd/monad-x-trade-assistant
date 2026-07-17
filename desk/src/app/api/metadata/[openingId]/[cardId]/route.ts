import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatCardLabel } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ openingId: string; cardId: string }> },
) {
  const { openingId, cardId } = await params;
  const opening = await prisma.packOpening.findUnique({
    where: { id: openingId },
    include: { card: true, pack: true },
  });
  if (!opening || opening.cardId !== cardId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: formatCardLabel(opening.card.name, opening.card.displayNumber),
    description: opening.card.description ?? `${opening.pack.name} collectible card`,
    image: opening.card.imageUrl.startsWith("http")
      ? opening.card.imageUrl
      : `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${opening.card.imageUrl}`,
    attributes: [
      { trait_type: "Pack", value: opening.pack.name },
      { trait_type: "Number", value: opening.card.displayNumber },
      ...(opening.card.rarityLabel
        ? [{ trait_type: "Rarity", value: opening.card.rarityLabel }]
        : []),
    ],
  });
}
