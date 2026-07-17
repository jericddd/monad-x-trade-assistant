import { NextResponse } from "next/server";
import { expireAllDue } from "@/services/expiration";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await expireAllDue();
  return NextResponse.json({ expired: count });
}
