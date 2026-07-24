import { OpeningStatus, PackVisibility, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ActivityRow = {
  id: string;
  xUsername: string;
  cardName: string;
  displayNumber: number;
  packName: string;
  source: "X" | "WEBSITE";
  openedAt: Date;
  expiresAt: Date;
  status: OpeningStatus;
  cardImage: string;
  rarityLabel: string | null;
  tokenId: string | null;
  contractAddress: string | null;
  transactionHash: string | null;
  claimedAt: Date | null;
};

export async function getActivityFeed(limit = 50, offset = 0): Promise<ActivityRow[]> {
  const openings = await prisma.packOpening.findMany({
    orderBy: { openedAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      user: true,
      card: true,
      pack: true,
    },
  });

  return openings.map((o) => ({
    id: o.id,
    xUsername: o.user.xUsername,
    cardName: o.card.name,
    displayNumber: o.card.displayNumber,
    packName: o.pack.name,
    source: o.source,
    openedAt: o.openedAt,
    expiresAt: o.expiresAt,
    status: o.status,
    cardImage: o.card.imageUrl,
    rarityLabel: o.card.rarityLabel,
    tokenId: o.tokenId,
    contractAddress: o.contractAddress,
    transactionHash: o.transactionHash,
    claimedAt: o.claimedAt,
  }));
}

export async function getHomeMetrics() {
  const [totalOpened, claimed, pending, expired, collectors, xOpens, webOpens] =
    await Promise.all([
      prisma.packOpening.count(),
      prisma.packOpening.count({ where: { status: OpeningStatus.CLAIMED } }),
      prisma.packOpening.count({ where: { status: OpeningStatus.UNCLAIMED } }),
      prisma.packOpening.count({ where: { status: OpeningStatus.EXPIRED } }),
      prisma.user.count({ where: { packOpenings: { some: {} } } }),
      prisma.packOpening.count({ where: { source: "X" } }),
      prisma.packOpening.count({ where: { source: "WEBSITE" } }),
    ]);

  return { totalOpened, claimed, pending, expired, collectors, xOpens, webOpens };
}

export async function getPublicPacks() {
  const now = new Date();

  // Do not auto-unhide HIDDEN packs — admin visibility must stick.
  return prisma.pack.findMany({
    where: {
      active: true,
      websiteEnabled: true,
      visibility: PackVisibility.PUBLIC,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFeaturedPackForHome() {
  const featured = await prisma.pack.findFirst({
    where: { featuredOnX: true, active: true, websiteEnabled: true },
  });
  if (featured) return featured;
  const packs = await getPublicPacks();
  return packs[0] ?? null;
}

export async function getUserCollection(userId: string, packId?: string) {
  const where: Prisma.PackOpeningWhereInput = {
    userId,
    ...(packId ? { packId } : {}),
  };

  const [pending, claimed, expired] = await Promise.all([
    prisma.packOpening.findMany({
      where: { ...where, status: { in: [OpeningStatus.UNCLAIMED, OpeningStatus.CLAIMING] } },
      include: { card: true, pack: true },
      orderBy: { openedAt: "desc" },
    }),
    prisma.packOpening.findMany({
      where: { ...where, status: OpeningStatus.CLAIMED },
      include: { card: true, pack: true },
      orderBy: { claimedAt: "desc" },
    }),
    prisma.packOpening.findMany({
      where: { ...where, status: OpeningStatus.EXPIRED },
      include: { card: true, pack: true },
      orderBy: { expiredAt: "desc" },
    }),
  ]);

  return { pending: pending[0] ?? null, claimed, expired };
}

export async function getUserCollectionPackFilters(userId: string) {
  return prisma.pack.findMany({
    where: { packOpenings: { some: { userId } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
