import { PrismaClient, PackVisibility, SupplyType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const pack = await prisma.pack.upsert({
    where: { slug: "monad-cards-demo" },
    create: {
      name: "Monad Cards",
      slug: "monad-cards-demo",
      description: "Demo pack for Monad Packs MVP",
      active: true,
      websiteEnabled: true,
      xEnabled: true,
      featuredOnX: true,
      visibility: PackVisibility.PUBLIC,
      totalCards: 3,
      highestAssignedDisplayNumber: 3,
      coverImage: "https://placehold.co/600x400/1e1b4b/8b5cf6?text=Monad+Cards",
    },
    update: {
      active: true,
      websiteEnabled: true,
      xEnabled: true,
      featuredOnX: true,
    },
  });

  const cards = [
    { displayNumber: 1, name: "Monad Card #1", rarityLabel: "Common", assetWeight: 70 },
    { displayNumber: 2, name: "Monad Card #2", rarityLabel: "Rare", assetWeight: 25 },
    { displayNumber: 3, name: "Monad Card #3", rarityLabel: "Legendary", assetWeight: 5, supplyType: SupplyType.LIMITED, maxSupply: 100 },
  ];

  for (const c of cards) {
    await prisma.card.upsert({
      where: {
        packId_assetFingerprint: {
          packId: pack.id,
          assetFingerprint: `demo-${c.displayNumber}`,
        },
      },
      create: {
        packId: pack.id,
        assetFingerprint: `demo-${c.displayNumber}`,
        displayNumber: c.displayNumber,
        name: c.name,
        imageUrl: `https://placehold.co/300x400/312e81/a78bfa?text=Card+${c.displayNumber}`,
        rarityLabel: c.rarityLabel,
        assetWeight: c.assetWeight,
        supplyType: c.supplyType ?? SupplyType.UNLIMITED,
        maxSupply: c.maxSupply,
      },
      update: {},
    });
  }

  console.log("Seeded demo pack:", pack.slug);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
