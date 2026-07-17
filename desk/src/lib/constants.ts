import { createHash } from "crypto";
import { randomBytes } from "crypto";

export const CLAIM_DURATION_MS = 24 * 60 * 60 * 1000;
export const X_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function computeAssetFingerprint(data: {
  sourceAssetCardId?: string | null;
  name: string;
  imageHash?: string;
  metadata?: unknown;
}): string {
  const payload = JSON.stringify({
    id: data.sourceAssetCardId ?? null,
    name: data.name,
    imageHash: data.imageHash ?? null,
    metadata: data.metadata ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

export function buildWalletVerificationMessage(params: {
  nonce: string;
  walletAddress: string;
  xUsername: string;
}): string {
  return [
    "MonEx Trade Assistant — Wallet Verification",
    "",
    `Verify wallet ownership for @${params.xUsername}`,
    `Wallet: ${params.walletAddress}`,
    `Nonce: ${params.nonce}`,
    "",
    "This signature does not initiate a transaction.",
  ].join("\n");
}

import { Prisma } from "@prisma/client";

export function trackEvent(eventType: string, payload?: Record<string, unknown>) {
  import("@/lib/db").then(({ prisma }) =>
    prisma.productEvent
      .create({
        data: {
          eventType,
          payload: (payload ?? {}) as Prisma.InputJsonValue,
        },
      })
      .catch(() => {}),
  );
}
