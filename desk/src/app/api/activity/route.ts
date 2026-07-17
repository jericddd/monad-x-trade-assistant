import { NextRequest, NextResponse } from "next/server";
import { getActivityFeed } from "@/services/activity";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const activity = await getActivityFeed(limit, offset);
  return NextResponse.json({ activity });
}
