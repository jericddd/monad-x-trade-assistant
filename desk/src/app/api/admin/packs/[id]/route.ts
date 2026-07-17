import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPackPreview, updatePackSettings, deletePack } from "@/services/admin-pack";
import { publishImport, rejectImport } from "@/services/pack-import";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) throw new Error("FORBIDDEN");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const preview = await getPackPreview(id);
    return NextResponse.json(preview);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const pack = await updatePackSettings(id, {
      active: body.active,
      websiteEnabled: body.websiteEnabled,
      xEnabled: body.xEnabled,
      featuredOnX: body.featuredOnX,
      useAssetPullRates: body.useAssetPullRates,
      visibility: body.visibility,
      startsAt: body.startsAt ? new Date(body.startsAt) : body.startsAt,
      endsAt: body.endsAt ? new Date(body.endsAt) : body.endsAt,
      rarityMappingConfirmed: body.rarityMappingConfirmed,
    });
    return NextResponse.json({ pack });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await deletePack(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    if (body.action === "publish-import") {
      const pack = await publishImport(body.importId, {
        packId: id !== "new" ? id : undefined,
        packName: body.packName,
        confirmRarityMapping: body.confirmRarityMapping,
      });
      return NextResponse.json({ pack });
    }
    if (body.action === "reject-import") {
      await rejectImport(body.importId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 },
    );
  }
}
