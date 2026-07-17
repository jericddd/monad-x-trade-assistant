import { PackVisibility, OpeningStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enforceSingleFeaturedPack } from "./pack-opening";

export async function updatePackSettings(
  packId: string,
  settings: {
    active?: boolean;
    websiteEnabled?: boolean;
    xEnabled?: boolean;
    featuredOnX?: boolean;
    useAssetPullRates?: boolean;
    visibility?: PackVisibility;
    startsAt?: Date | null;
    endsAt?: Date | null;
    rarityMappingConfirmed?: boolean;
  },
) {
  const pack = await prisma.pack.findUniqueOrThrow({ where: { id: packId } });

  if (settings.featuredOnX === true) {
    settings.active = true;
    settings.xEnabled = true;
    settings.websiteEnabled = true;
    settings.visibility = PackVisibility.PUBLIC;
    await enforceSingleFeaturedPack(packId);
  }

  if (settings.websiteEnabled === true) {
    settings.visibility = PackVisibility.PUBLIC;
  }

  if (settings.active === true && settings.websiteEnabled !== false && pack.websiteEnabled) {
    settings.visibility = PackVisibility.PUBLIC;
  }

  return prisma.pack.update({
    where: { id: packId },
    data: {
      active: settings.active,
      websiteEnabled: settings.websiteEnabled,
      xEnabled: settings.xEnabled,
      featuredOnX: settings.featuredOnX,
      useAssetPullRates: settings.useAssetPullRates,
      visibility: settings.visibility,
      startsAt: settings.startsAt,
      endsAt: settings.endsAt,
      rarityMappingConfirmed: settings.rarityMappingConfirmed,
    },
    include: { cards: { orderBy: { displayNumber: "asc" } } },
  });
}

export async function getAdminPacks() {
  return prisma.pack.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      websiteEnabled: true,
      xEnabled: true,
      featuredOnX: true,
      useAssetPullRates: true,
      totalCards: true,
      createdAt: true,
      _count: { select: { packOpenings: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deletePack(packId: string) {
  const pack = await prisma.pack.findUniqueOrThrow({
    where: { id: packId },
    include: { _count: { select: { packOpenings: true } } },
  });

  const claimedCount = await prisma.packOpening.count({
    where: { packId, status: OpeningStatus.CLAIMED },
  });
  if (claimedCount > 0) {
    throw new Error(
      `Cannot delete "${pack.name}" — ${claimedCount} card(s) already claimed on-chain. Disable the pack instead.`,
    );
  }

  await prisma.pack.delete({ where: { id: packId } });
  return { name: pack.name };
}

export async function getPackPreview(packId: string) {
  const pack = await prisma.pack.findUniqueOrThrow({
    where: { id: packId },
    include: { cards: { orderBy: { displayNumber: "asc" } } },
  });

  const eligible = pack.cards.filter((c) => c.active);
  const equalOdds = eligible.length > 0 ? `1/${eligible.length}` : "N/A";

  const rarityGroups: Record<string, number> = {};
  for (const card of eligible) {
    const r = card.rarityLabel ?? "Unknown";
    rarityGroups[r] = (rarityGroups[r] ?? 0) + 1;
  }

  const supplyWarnings = pack.cards
    .filter((c) => c.supplyType === "LIMITED" && (c.maxSupply ?? 0) - c.claimedCount - c.reservedCount <= 0)
    .map((c) => `${c.name} sold out`);

  return {
    pack,
    totalCards: pack.cards.length,
    cardNumberRange:
      pack.cards.length > 0
        ? `#${pack.cards[0].displayNumber} – #${pack.cards[pack.cards.length - 1].displayNumber}`
        : "N/A",
    drawMode: pack.useAssetPullRates ? "Asset pull rates" : "Equal odds",
    estimatedOdds: pack.useAssetPullRates ? rarityGroups : equalOdds,
    supplyWarnings,
  };
}
