import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createSimpleImportPreview,
  extractImagesFromZip,
} from "@/services/simple-pack-import";

function parseDuplicateFilenames(raw: string | null): string[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const formData = await request.formData();

    const packName = (formData.get("packName") as string | null)?.trim();
    if (!packName) {
      return NextResponse.json({ error: "Pack name is required" }, { status: 400 });
    }

    const packId = (formData.get("packId") as string | null)?.trim() || undefined;
    const enableDuplicates = formData.get("enableDuplicates") === "true";
    const duplicateFilenames = enableDuplicates
      ? parseDuplicateFilenames(formData.get("duplicateFilenames") as string | null)
      : undefined;
    const duplicateCount = enableDuplicates
      ? Number(formData.get("duplicateCount") ?? 0)
      : undefined;

    if (enableDuplicates && duplicateFilenames?.length && (!duplicateCount || duplicateCount < 1)) {
      return NextResponse.json(
        { error: "Duplicate count must be at least 1 when filenames are provided" },
        { status: 400 },
      );
    }

    const cover = formData.get("cover") as File | null;
    let coverImage: Buffer | undefined;
    let coverFilename: string | undefined;
    if (cover && cover.size > 0) {
      coverImage = Buffer.from(await cover.arrayBuffer());
      coverFilename = cover.name;
    }

    const cardImages: Array<{ filename: string; data: Buffer }> = [];
    const entries = formData.getAll("cards");

    for (const entry of entries) {
      if (!(entry instanceof File) || entry.size === 0) continue;

      if (entry.name.toLowerCase().endsWith(".zip")) {
        const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 100);
        if (entry.size > maxMb * 1024 * 1024) {
          return NextResponse.json({ error: "ZIP file too large" }, { status: 400 });
        }
        const zipImages = extractImagesFromZip(Buffer.from(await entry.arrayBuffer()));
        cardImages.push(...zipImages);
        continue;
      }

      if (!/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${entry.name}. Use PNG, JPG, WebP, or GIF.` },
          { status: 400 },
        );
      }

      cardImages.push({
        filename: entry.name,
        data: Buffer.from(await entry.arrayBuffer()),
      });
    }

    if (cardImages.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one card image, or a ZIP of images." },
        { status: 400 },
      );
    }

    const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 100);
    const totalBytes = cardImages.reduce((sum, image) => sum + image.data.length, 0);
    if (totalBytes > maxMb * 1024 * 1024) {
      return NextResponse.json({ error: "Total upload too large" }, { status: 400 });
    }

    const preview = await createSimpleImportPreview({
      packName,
      coverImage,
      coverFilename,
      cardImages,
      duplicateFilenames,
      duplicateCount,
      packId,
    });

    return NextResponse.json({ preview });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    console.error("simple pack upload failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
