import { NextResponse } from "next/server";
import { getHomeMetrics } from "@/services/activity";

export const dynamic = "force-dynamic";

export async function GET() {
  const metrics = await getHomeMetrics();
  return NextResponse.json(metrics);
}
