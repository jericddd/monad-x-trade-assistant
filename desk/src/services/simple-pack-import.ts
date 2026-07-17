import { createHash } from "crypto";
import path from "path";
import AdmZip from "adm-zip";
import { PackImportStatus, SupplyType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeAssetFingerprint } from "@/lib/constants";
import { storePackImage } from "@/lib/asset-storage";
import type { ImportPreview } from "./pack-import";

export type SimplePackUploadInput = {
  packName: string;
  coverImage?: Buffer;
  coverFilename?: string;
  cardImages: Array<{ filename: string; data: Buffer }>;
  duplicateFilenames?: string[];
  duplicateCount?: number;
  packId?: string;
};

type ResolvedImage = { filename: string; data: Buffer; slotKey: string };

const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif)$/i;

function basename(filename: string): string {
  return path.basename(filename.replace(/\\/g, "/"));
}

function naturalCompare(a: string, b: string): number {
  return basename(a).localeCompare(basename(b), undefined, { numeric: true, sensitivity: "base" });
}

export function extractImagesFromZip(zipBuffer: Buffer): Array<{ filename: string; data: Buffer }> {
  const zip = new AdmZip(zipBuffer);
  const images: Array<{ filename: string; data: Buffer }> = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, "/");
    if (!IMAGE_EXT.test(name)) continue;
    images.push({ filename: basename(name), data: entry.getData() });
  }

  if (images.length === 0) {
    throw new Error("No images found in ZIP. Upload PNG/JPG/WebP/GIF files only.");
  }

  images.sort((a, b) => naturalCompare(a.filename, b.filename));
  return images;
}

export function buildSimpleCardSlots(input: SimplePackUploadInput): ResolvedImage[] {
  if (input.cardImages.length === 0) {
    throw new Error("At least one card image is required");
  }

  const sorted = [...input.cardImages].sort((a, b) => naturalCompare(a.filename, b.filename));
  const slots: ResolvedImage[] = sorted.map((image) => ({
    filename: image.filename,
    data: image.data,
    slotKey: basename(image.filename),
  }));

  const duplicateNames = (input.duplicateFilenames ?? [])
    .map((name) => basename(name.trim()))
    .filter(Boolean);
  const extraCopies = Math.max(0, input.duplicateCount ?? 0);

  if (duplicateNames.length > 0 && extraCopies > 0) {
    for (const name of duplicateNames) {
      const source = sorted.find((image) => basename(image.filename) === name);
      if (!source) {
        throw new Error(`Duplicate source not found: ${name}`);
      }
      for (let copy = 1; copy <= extraCopies; copy++) {
        slots.push({
          filename: source.filename,
          data: source.data,
          slotKey: `${basename(source.filename)}-dup-${copy}`,
        });
      }
    }
  }

  return slots;
}

export async function createSimpleImportPreview(
  input: SimplePackUploadInput,
): Promise<ImportPreview> {
  const packName = input.packName.trim();
  if (!packName) throw new Error("Pack name is required");

  const slots = buildSimpleCardSlots(input);
  const sourceFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        packName,
        slots: slots.map((slot) => slot.slotKey),
        duplicateCount: input.duplicateCount ?? 0,
      }),
    )
    .digest("hex");

  const packImport = await prisma.packImport.create({
    data: {
      packId: input.packId,
      sourceFilename: `simple:${packName}`,
      sourceFingerprint,
      status: PackImportStatus.PREVIEW,
    },
  });

  let coverImageUrl: string | undefined;
  if (input.coverImage && input.coverFilename) {
    const coverExt = path.extname(input.coverFilename) || ".png";
    const coverName = `cover${coverExt}`;
    coverImageUrl = await storePackImage(packImport.id, coverName, input.coverImage);
  }

  const existingPack = input.packId
    ? await prisma.pack.findUnique({ where: { id: input.packId }, include: { cards: true } })
    : null;

  let nextNumber = (existingPack?.highestAssignedDisplayNumber ?? 0) + 1;
  const existingFingerprints = new Set(existingPack?.cards.map((c) => c.assetFingerprint) ?? []);

  const cards: ImportPreview["cards"] = [];
  const proposedNumbering: ImportPreview["proposedNumbering"] = [];
  const duplicates: string[] = [];
  let newCardCount = 0;
  let duplicateCount = 0;

  for (const slot of slots) {
    const displayNumber = nextNumber;
    const cardName = `${packName} #${displayNumber}`;
    const imageHash = createHash("sha256").update(slot.data).digest("hex");
    const fingerprint = computeAssetFingerprint({
      sourceAssetCardId: `${packName}-${slot.slotKey}-${displayNumber}`,
      name: cardName,
      imageHash,
    });

    if (existingFingerprints.has(fingerprint)) {
      duplicates.push(cardName);
      duplicateCount++;
      nextNumber++;
      continue;
    }

    const imageFilename = `${fingerprint.slice(0, 16)}${path.extname(slot.filename) || ".png"}`;
    const imageUrl = await storePackImage(packImport.id, imageFilename, slot.data);

    proposedNumbering.push({ name: cardName, displayNumber, fingerprint });
    cards.push({
      name: cardName,
      imageUrl,
      supplyType: SupplyType.LIMITED,
      maxSupply: 1,
      fingerprint,
      isNew: true,
    });

    newCardCount++;
    nextNumber++;
  }

  const report = {
    detectedPackName: packName,
    coverImageUrl,
    rarityInfo: {},
    supplyWarnings: [],
    invalidAssets: [] as string[],
    duplicates,
    proposedNumbering,
    cards,
    simpleImport: true,
    equalOdds: true,
  };

  await prisma.packImport.update({
    where: { id: packImport.id },
    data: {
      detectedCardCount: slots.length,
      newCardCount,
      duplicateCount,
      errorCount: 0,
      report,
    },
  });

  return {
    importId: packImport.id,
    detectedPackName: packName,
    manualNameRequired: false,
    detectedCardCount: slots.length,
    newCardCount,
    duplicateCount,
    errorCount: 0,
    invalidAssets: [],
    duplicates,
    proposedNumbering,
    rarityInfo: {},
    supplyWarnings: [],
    cards,
  };
}
