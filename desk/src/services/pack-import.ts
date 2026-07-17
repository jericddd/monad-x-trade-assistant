import { createHash } from "crypto";
import path from "path";
import AdmZip from "adm-zip";
import { Pack, PackImportStatus, PackVisibility, SupplyType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeAssetFingerprint, trackEvent } from "@/lib/constants";
import { storePackImage } from "@/lib/asset-storage";
import { slugify } from "@/lib/utils";

export type PackAssetManifest = {
  name?: string;
  description?: string;
  coverImage?: string;
  cards: Array<{
    id?: string;
    name: string;
    description?: string;
    image: string;
    rarity?: string;
    weight?: number;
    supplyType?: "UNLIMITED" | "LIMITED";
    maxSupply?: number;
    traits?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }>;
};

export type ImportPreview = {
  importId: string;
  detectedPackName: string | null;
  manualNameRequired: boolean;
  detectedCardCount: number;
  newCardCount: number;
  duplicateCount: number;
  errorCount: number;
  invalidAssets: string[];
  duplicates: string[];
  proposedNumbering: Array<{ name: string; displayNumber: number; fingerprint: string }>;
  rarityInfo: Record<string, number>;
  supplyWarnings: string[];
  cards: Array<{
    name: string;
    imageUrl: string;
    rarityLabel?: string;
    supplyType: SupplyType;
    maxSupply?: number;
    assetWeight?: number;
    fingerprint: string;
    isNew: boolean;
  }>;
};

function parseManifest(buffer: Buffer): PackAssetManifest {
  const json = JSON.parse(buffer.toString("utf-8")) as PackAssetManifest;
  if (!Array.isArray(json.cards) || json.cards.length === 0) {
    throw new Error("Invalid pack asset: cards array required");
  }
  return json;
}

function normalizeZipKey(entryName: string, rootDir: string): string {
  let key = entryName.replace(/^\.\//, "").replace(/\\/g, "/");
  if (rootDir && key.startsWith(`${rootDir}/`)) {
    key = key.slice(rootDir.length + 1);
  }
  return key;
}

function findImageBuffer(imageRef: string, imagePaths: Map<string, Buffer>): Buffer | null {
  const key = imageRef.replace(/^\.\//, "").replace(/\\/g, "/");
  if (imagePaths.has(key)) return imagePaths.get(key)!;

  for (const [entryPath, data] of imagePaths) {
    if (entryPath.endsWith(`/${key}`)) return data;
  }

  const base = path.basename(key);
  for (const [entryPath, data] of imagePaths) {
    if (path.basename(entryPath) === base) return data;
  }

  return null;
}

export async function parsePackAssetZip(
  zipBuffer: Buffer,
): Promise<{ manifest: PackAssetManifest; fingerprint: string; imagePaths: Map<string, Buffer> }> {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const manifestEntry = entries.find((e) => e.entryName.endsWith("pack.json") && !e.isDirectory);
  if (!manifestEntry) throw new Error("pack.json not found in asset");

  const manifestPath = manifestEntry.entryName.replace(/\\/g, "/");
  const rootDir = manifestPath.includes("/")
    ? manifestPath.slice(0, manifestPath.lastIndexOf("/"))
    : "";

  const manifest = parseManifest(manifestEntry.getData());
  const fingerprint = createHash("sha256").update(zipBuffer).digest("hex");

  const imagePaths = new Map<string, Buffer>();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const key = normalizeZipKey(entry.entryName, rootDir);
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(key)) {
      imagePaths.set(key, entry.getData());
    }
  }

  return { manifest, fingerprint, imagePaths };
}

export async function createImportPreview(
  zipBuffer: Buffer,
  filename: string,
  packId?: string,
): Promise<ImportPreview> {
  const { manifest, fingerprint, imagePaths } = await parsePackAssetZip(zipBuffer);

  const packImport = await prisma.packImport.create({
    data: {
      packId,
      sourceFilename: filename,
      sourceFingerprint: fingerprint,
      status: PackImportStatus.PREVIEW,
    },
  });

  const existingPack = packId
    ? await prisma.pack.findUnique({ where: { id: packId }, include: { cards: true } })
    : null;

  const highestNumber = existingPack?.highestAssignedDisplayNumber ?? 0;
  let nextNumber = highestNumber + 1;

  const existingFingerprints = new Set(existingPack?.cards.map((c) => c.assetFingerprint) ?? []);
  const invalidAssets: string[] = [];
  const duplicates: string[] = [];
  const rarityInfo: Record<string, number> = {};
  const supplyWarnings: string[] = [];
  const proposedNumbering: ImportPreview["proposedNumbering"] = [];
  const cards: ImportPreview["cards"] = [];

  let newCardCount = 0;
  let duplicateCount = 0;

  for (const card of manifest.cards) {
    if (!card.name?.trim()) {
      invalidAssets.push("Card missing name");
      continue;
    }
    const imageKey = card.image.replace(/^\.\//, "").replace(/\\/g, "/");
    const imageBuffer = findImageBuffer(imageKey, imagePaths);
    if (!imageBuffer) {
      invalidAssets.push(`Missing image: ${card.image}`);
      continue;
    }

    const imageHash = createHash("sha256").update(imageBuffer).digest("hex");
    const fingerprint = computeAssetFingerprint({
      sourceAssetCardId: card.id,
      name: card.name,
      imageHash,
      metadata: card.metadata,
    });

    if (existingFingerprints.has(fingerprint)) {
      duplicates.push(card.name);
      duplicateCount++;
      continue;
    }

    const imageFilename = `${fingerprint.slice(0, 16)}${path.extname(imageKey) || ".png"}`;
    const imageUrl = await storePackImage(packImport.id, imageFilename, imageBuffer);

    const rarity = card.rarity ?? "Unknown";
    rarityInfo[rarity] = (rarityInfo[rarity] ?? 0) + 1;

    const supplyType =
      card.supplyType === "LIMITED" ? SupplyType.LIMITED : SupplyType.UNLIMITED;
    if (supplyType === SupplyType.LIMITED && (!card.maxSupply || card.maxSupply < 1)) {
      supplyWarnings.push(`${card.name}: limited supply missing maxSupply`);
    }

    proposedNumbering.push({ name: card.name, displayNumber: nextNumber, fingerprint });
    cards.push({
      name: card.name,
      imageUrl,
      rarityLabel: card.rarity,
      supplyType,
      maxSupply: card.maxSupply,
      assetWeight: card.weight,
      fingerprint,
      isNew: true,
    });

    newCardCount++;
    nextNumber++;
  }

  const detectedPackName = manifest.name?.trim() || null;
  const report = {
    detectedPackName,
    rarityInfo,
    supplyWarnings,
    invalidAssets,
    duplicates,
    proposedNumbering,
    cards,
  };

  await prisma.packImport.update({
    where: { id: packImport.id },
    data: {
      detectedCardCount: manifest.cards.length,
      newCardCount,
      duplicateCount,
      errorCount: invalidAssets.length,
      report,
    },
  });

  return {
    importId: packImport.id,
    detectedPackName,
    manualNameRequired: !detectedPackName,
    detectedCardCount: manifest.cards.length,
    newCardCount,
    duplicateCount,
    errorCount: invalidAssets.length,
    invalidAssets,
    duplicates,
    proposedNumbering,
    rarityInfo,
    supplyWarnings,
    cards,
  };
}

export async function publishImport(
  importId: string,
  options: { packName?: string; packId?: string; confirmRarityMapping?: boolean },
) {
  const packImport = await prisma.packImport.findUniqueOrThrow({ where: { id: importId } });
  if (packImport.status === PackImportStatus.PUBLISHED) {
    throw new Error("Import already published");
  }
  if (packImport.newCardCount === 0) {
    throw new Error("Cannot publish import with no new cards");
  }

  const report = packImport.report as {
    detectedPackName?: string | null;
    coverImageUrl?: string;
    proposedNumbering: ImportPreview["proposedNumbering"];
    cards: ImportPreview["cards"];
  } | null;
  if (!report?.cards?.length) throw new Error("Import preview missing");

  const name = options.packName ?? report.detectedPackName;
  if (!name) throw new Error("Pack name required");

  const maxDisplayNumber = report.proposedNumbering.reduce(
    (max, numbering) => Math.max(max, numbering.displayNumber),
    0,
  );

  const cardRows = report.cards.map((card, i) => ({
    sourceAssetCardId: null as string | null,
    assetFingerprint: card.fingerprint,
    displayNumber: report.proposedNumbering[i].displayNumber,
    name: card.name,
    imageUrl: card.imageUrl,
    rarityLabel: card.rarityLabel,
    assetWeight: card.assetWeight,
    supplyType: card.supplyType,
    maxSupply: card.maxSupply,
  }));

  const targetPackId = options.packId ?? packImport.packId ?? null;
  let pack: Pack;

  if (targetPackId) {
    pack = await prisma.pack.findUniqueOrThrow({ where: { id: targetPackId } });
    await prisma.card.createMany({
      data: cardRows.map((row) => ({ ...row, packId: pack.id })),
    });
    pack = await prisma.pack.update({
      where: { id: pack.id },
      data: {
        totalCards: { increment: cardRows.length },
        highestAssignedDisplayNumber: Math.max(
          pack.highestAssignedDisplayNumber,
          maxDisplayNumber,
        ),
        rarityMappingConfirmed: options.confirmRarityMapping ?? false,
        coverImage: report.coverImageUrl ?? pack.coverImage ?? report.cards[0]?.imageUrl,
      },
    });
  } else {
    pack = await prisma.pack.create({
      data: {
        name,
        slug: slugify(name) + "-" + Date.now().toString(36),
        description: null,
        sourceAssetId: packImport.sourceFingerprint,
        visibility: PackVisibility.PUBLIC,
        totalCards: cardRows.length,
        highestAssignedDisplayNumber: maxDisplayNumber,
        rarityMappingConfirmed: options.confirmRarityMapping ?? false,
        coverImage: report.coverImageUrl ?? report.cards[0]?.imageUrl,
      },
    });
    await prisma.card.createMany({
      data: cardRows.map((row) => ({ ...row, packId: pack.id })),
    });
  }

  await prisma.packImport.update({
    where: { id: importId },
    data: {
      status: PackImportStatus.PUBLISHED,
      packId: pack.id,
      completedAt: new Date(),
    },
  });

  trackEvent("pack_import_completed", { importId, packId: pack.id });
  return pack;
}

export async function rejectImport(importId: string) {
  return prisma.packImport.update({
    where: { id: importId },
    data: { status: PackImportStatus.REJECTED, completedAt: new Date() },
  });
}
