import { OpeningStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { trackEvent } from "@/lib/constants";
import { releaseLimitedReservation } from "./supply-reservation";

export async function expireOpening(openingId: string) {
  return prisma.$transaction(async (tx) => {
    const opening = await tx.packOpening.findUnique({ where: { id: openingId } });
    if (!opening || opening.status !== OpeningStatus.UNCLAIMED) return opening;
    if (opening.expiresAt > new Date()) return opening;

    await releaseLimitedReservation(opening.cardId, tx);
    const expired = await tx.packOpening.update({
      where: { id: openingId },
      data: { status: OpeningStatus.EXPIRED, expiredAt: new Date() },
    });
    trackEvent("card_expired", { openingId });
    return expired;
  });
}

export async function expireUserPendingIfNeeded(userId: string) {
  const pending = await prisma.packOpening.findFirst({
    where: {
      userId,
      status: OpeningStatus.UNCLAIMED,
      expiresAt: { lte: new Date() },
    },
  });
  if (pending) await expireOpening(pending.id);
}

export async function expireAllDue() {
  const due = await prisma.packOpening.findMany({
    where: {
      status: OpeningStatus.UNCLAIMED,
      expiresAt: { lte: new Date() },
    },
    select: { id: true },
  });
  for (const { id } of due) {
    await expireOpening(id);
  }
  return due.length;
}

export async function expireOpeningIfDue(openingId: string) {
  const opening = await prisma.packOpening.findUnique({ where: { id: openingId } });
  if (!opening) return null;
  if (opening.status === OpeningStatus.UNCLAIMED && opening.expiresAt <= new Date()) {
    return expireOpening(openingId);
  }
  return opening;
}
