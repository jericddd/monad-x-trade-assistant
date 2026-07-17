import { OpeningStatus, Prisma, SupplyType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ProductError } from "@/lib/errors";

type Tx = Prisma.TransactionClient;

export async function releaseLimitedReservation(cardId: string, tx: Tx) {
  const card = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
  if (card.supplyType !== SupplyType.LIMITED) return;
  await tx.card.update({
    where: { id: cardId },
    data: { reservedCount: { decrement: 1 } },
  });
}

export async function reserveLimitedCard(cardId: string, tx: Tx) {
  const card = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
  if (card.supplyType !== SupplyType.LIMITED) return;

  const available = (card.maxSupply ?? 0) - card.claimedCount - card.reservedCount;
  if (available <= 0) throw new ProductError("Sold out", "SOLD_OUT", 409);

  const updated = await tx.card.updateMany({
    where: {
      id: cardId,
      supplyType: SupplyType.LIMITED,
      reservedCount: card.reservedCount,
      claimedCount: card.claimedCount,
    },
    data: { reservedCount: { increment: 1 } },
  });

  if (updated.count === 0) {
    throw new ProductError("Sold out", "SOLD_OUT", 409);
  }
}

export async function confirmLimitedClaim(cardId: string, tx: Tx) {
  const card = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
  if (card.supplyType !== SupplyType.LIMITED) return;

  await tx.card.update({
    where: { id: cardId },
    data: {
      reservedCount: { decrement: 1 },
      claimedCount: { increment: 1 },
    },
  });
}

export async function getUserPendingOpening(userId: string) {
  return prisma.packOpening.findFirst({
    where: {
      userId,
      status: { in: [OpeningStatus.UNCLAIMED, OpeningStatus.CLAIMING] },
    },
    include: { card: true, pack: true },
  });
}
