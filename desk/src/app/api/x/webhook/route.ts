import { NextRequest, NextResponse } from "next/server";
import { handleXPackCommand } from "@/services/x-pack-handler";
import { routeXCommand } from "@/services/x-command-parser";

/**
 * Webhook for existing MonEx bot infrastructure.
 * Catch / game commands must never break here — return { handled: false, route: "MONEX" }
 * so monex-api keeps owning the MonEx game path.
 */
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.X_BOT_WEBHOOK_SECRET?.trim();
    const secret = request.headers.get("x-bot-webhook-secret")?.trim();
    // Fail closed: missing secret must not let callers spoof pack opens as any X user.
    if (!expected || !secret || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      xPostId: string;
      xUserId: string;
      xUsername: string;
      xProfileImage?: string;
      text: string;
    };

    // Fast-path: anything that is clearly MonEx game stays with monex-api.
    const route = routeXCommand(body.text ?? "");
    if (route === "MONEX") {
      return NextResponse.json({ handled: false, route: "MONEX" });
    }

    const result = await handleXPackCommand(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("x_webhook_error", error instanceof Error ? error.message : error);
    // Fail open toward MonEx so catch/game is never blocked by packs errors.
    return NextResponse.json({ handled: false, route: "MONEX" });
  }
}
