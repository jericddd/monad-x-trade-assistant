import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { publishImport } from "@/services/pack-import";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = (await request.json()) as {
      importId?: string;
      packName?: string;
      packId?: string;
      confirmRarityMapping?: boolean;
    };

    if (!body.importId) {
      return NextResponse.json({ error: "importId is required" }, { status: 400 });
    }

    const pack = await publishImport(body.importId, {
      packId: body.packId,
      packName: body.packName,
      confirmRarityMapping: body.confirmRarityMapping === true,
    });

    return NextResponse.json({ pack });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    console.error("publish import failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 400 },
    );
  }
}
