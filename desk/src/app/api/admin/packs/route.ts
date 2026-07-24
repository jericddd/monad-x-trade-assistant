import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminPacks } from "@/services/admin-pack";
import { createImportPreview } from "@/services/pack-import";

export async function GET() {
  try {
    await requireAdmin();
    const packs = await getAdminPacks();
    return NextResponse.json({ packs });
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const packId = formData.get("packId") as string | null;
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });

    const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 100);
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }
    if (!file.name.endsWith(".zip")) {
      return NextResponse.json({ error: "Only ZIP assets accepted" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await createImportPreview(buffer, file.name, packId ?? undefined);
    return NextResponse.json({ preview });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
