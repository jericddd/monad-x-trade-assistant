import {
  DrawMode,
  OpeningSource,
  OpeningStatus,
  Pack,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { CLAIM_DURATION_MS, trackEvent } from "@/lib/constants";
import { PRODUCT_ERRORS, ProductError } from "@/lib/errors";
import {
  buildSelectionAudit,
  loadEligibleCards,
  selectCardWeighted,
} from "./card-selection";
import { expireUserPendingIfNeeded } from "./expiration";
import { getUserPendingOpening, reserveLimitedCard } from "./supply-reservation";

function isPackAvailable(pack: Pack): boolean {
  if (!pack.active) return false;
  const now = new Date();
  if (pack.startsAt && pack.startsAt > now) return false;
  if (pack.endsAt && pack.endsAt < now) return false;
  return true;
}

export async function openPackForUser(params: {
  userId: string;
  packId: string;
  source: OpeningSource;
  sourcePostId?: string;
  idempotencyKey?: string;
}) {
  await expireUserPendingIfNeeded(params.userId);

  if (params.idempotencyKey) {
    const existing = await prisma.packOpening.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      include: { card: true, pack: true },
    });
    if (existing) return existing;
  }

  if (params.sourcePostId) {
    const existingPost = await prisma.packOpening.findUnique({
      where: { sourcePostId: params.sourcePostId },
      include: { card: true, pack: true },
    });
    if (existingPost) return existingPost;
  }

  const pending = await getUserPendingOpening(params.userId);
  if (pending) {
    throw new ProductError(PRODUCT_ERRORS.PENDING_CARD, "PENDING_CARD", 409);
  }

  const pack = await prisma.pack.findUnique({ where: { id: params.packId } });
  if (!pack) throw new ProductError("Pack not found", "NOT_FOUND", 404);
  if (!isPackAvailable(pack)) throw new ProductError("Pack unavailable", "UNAVAILABLE", 400);

  if (params.source === OpeningSource.WEBSITE && !pack.websiteEnabled) {
    throw new ProductError("Pack not enabled for website", "UNAVAILABLE", 400);
  }

  const cards = await loadEligibleCards(pack.id);
  const eligible = cards.filter((c) => c.active);
  if (eligible.length === 0) {
    throw new ProductError(PRODUCT_ERRORS.SOLD_OUT, "SOLD_OUT", 409);
  }

  const selected = selectCardWeighted(eligible, pack.useAssetPullRates, pack.rarityMappingConfirmed);
  const audit = buildSelectionAudit(pack, eligible.length, selected);
  const openedAt = new Date();
  const expiresAt = new Date(openedAt.getTime() + CLAIM_DURATION_MS);

  const opening = await prisma.$transaction(async (tx) => {
    const stillPending = await tx.packOpening.findFirst({
      where: {
        userId: params.userId,
        status: { in: [OpeningStatus.UNCLAIMED, OpeningStatus.CLAIMING] },
      },
    });
    if (stillPending) throw new ProductError(PRODUCT_ERRORS.PENDING_CARD, "PENDING_CARD", 409);

    await reserveLimitedCard(selected.id, tx);

    return tx.packOpening.create({
      data: {
        userId: params.userId,
        packId: pack.id,
        cardId: selected.id,
        source: params.source,
        status: OpeningStatus.UNCLAIMED,
        sourcePostId: params.sourcePostId,
        idempotencyKey: params.idempotencyKey,
        openedAt,
        expiresAt,
        drawMode: audit.drawMode as DrawMode,
        effectiveWeight: audit.effectiveWeight,
        eligibleCount: audit.eligibleCount,
      },
      include: { card: true, pack: true, user: true },
    });
  });

  trackEvent("pack_opened", {
    openingId: opening.id,
    packId: pack.id,
    source: params.source,
  });
  if (params.source === OpeningSource.X) trackEvent("pack_opened_x", { openingId: opening.id });
  else trackEvent("pack_opened_website", { openingId: opening.id });

  return opening;
}

export async function getFeaturedXPack() {
  return prisma.pack.findFirst({
    where: { featuredOnX: true, active: true, xEnabled: true },
  });
}

export async function enforceSingleFeaturedPack(packId: string) {
  await prisma.$transaction([
    prisma.pack.updateMany({
      where: { featuredOnX: true, id: { not: packId } },
      data: { featuredOnX: false },
    }),
    prisma.pack.update({
      where: { id: packId },
      data: { featuredOnX: true },
    }),
  ]);
  trackEvent("featured_pack_changed", { packId });
}
