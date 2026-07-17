import { verifyMessage } from "viem";
import { prisma } from "@/lib/db";
import { buildWalletVerificationMessage } from "@/lib/constants";
import { ProductError } from "@/lib/errors";

export async function issueWalletNonce(userId: string, walletAddress: string) {
  const normalized = walletAddress.toLowerCase();
  const existingOwner = await prisma.walletConnection.findUnique({
    where: { walletAddress: normalized },
    include: { user: true },
  });
  if (existingOwner && existingOwner.userId !== userId) {
    throw new ProductError(
      "This wallet is already linked to another account.",
      "WALLET_TAKEN",
      409,
    );
  }

  const current = await prisma.walletConnection.findUnique({ where: { userId } });
  // Same wallet already verified — never clear verifiedAt or force a re-sign.
  if (current?.verifiedAt && current.walletAddress === normalized) {
    return { alreadyVerified: true as const, walletAddress: normalized };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const message = buildWalletVerificationMessage({
    nonce,
    walletAddress: normalized,
    xUsername: user.xUsername,
  });

  await prisma.walletConnection.upsert({
    where: { userId },
    create: {
      userId,
      walletAddress: normalized,
      verificationNonce: nonce,
      nonceExpiresAt: expiresAt,
    },
    update: {
      walletAddress: normalized,
      verificationNonce: nonce,
      nonceExpiresAt: expiresAt,
      // Only drop verification when switching to a different wallet.
      verifiedAt: current?.walletAddress === normalized ? current.verifiedAt : null,
    },
  });

  return { message, nonce, expiresAt, alreadyVerified: false as const };
}

export async function verifyWalletSignature(
  userId: string,
  walletAddress: string,
  signature: `0x${string}`,
) {
  const normalized = walletAddress.toLowerCase();
  const connection = await prisma.walletConnection.findUnique({ where: { userId } });
  if (!connection || connection.walletAddress !== normalized) {
    throw new ProductError("Wallet not prepared for verification", "INVALID", 400);
  }
  if (!connection.verificationNonce || !connection.nonceExpiresAt) {
    throw new ProductError("No active verification nonce", "INVALID", 400);
  }
  if (connection.nonceExpiresAt < new Date()) {
    throw new ProductError("Verification nonce expired", "EXPIRED", 400);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const message = buildWalletVerificationMessage({
    nonce: connection.verificationNonce,
    walletAddress: normalized,
    xUsername: user.xUsername,
  });

  const valid = await verifyMessage({
    address: normalized as `0x${string}`,
    message,
    signature,
  });
  if (!valid) throw new ProductError("Invalid signature", "INVALID_SIGNATURE", 400);

  const otherLink = await prisma.walletConnection.findFirst({
    where: { walletAddress: normalized, userId: { not: userId } },
  });
  if (otherLink) {
    throw new ProductError("Wallet already linked to another X account", "WALLET_TAKEN", 409);
  }

  await prisma.walletConnection.update({
    where: { userId },
    data: {
      verifiedAt: new Date(),
      verificationNonce: null,
      nonceExpiresAt: null,
    },
  });

  const { trackEvent } = await import("@/lib/constants");
  trackEvent("wallet_connected", { userId, walletAddress: normalized });

  return { walletAddress: normalized, verifiedAt: new Date() };
}

export async function getVerifiedWallet(userId: string) {
  const conn = await prisma.walletConnection.findUnique({ where: { userId } });
  if (!conn?.verifiedAt) return null;
  return conn;
}
