import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserCollection, getUserCollectionPackFilters } from "@/services/activity";
import { expireUserPendingIfNeeded } from "@/services/expiration";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const url = new URL(request.url);
  const packId = url.searchParams.get("packId") ?? undefined;
  await expireUserPendingIfNeeded(session.userId);
  const [collection, packFilters] = await Promise.all([
    getUserCollection(session.userId, packId),
    getUserCollectionPackFilters(session.userId),
  ]);
  return NextResponse.json({ ...collection, packFilters });
}
