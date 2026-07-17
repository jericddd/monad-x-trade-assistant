import { ClaimAttemptStatus, OpeningStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { trackEvent } from "@/lib/constants";
import { PRODUCT_ERRORS, ProductError } from "@/lib/errors";
import { expireOpeningIfDue } from "./expiration";
import { checkMintWalletBalance, isMintConfigured, mintCardNft } from "./monad-mint";
import { confirmLimitedClaim } from "./supply-reservation";
import { getVerifiedWallet } from "./wallet-verification";

export async function claimOpening(userId: string, openingId: string, walletAddress: string) {
  let opening = await prisma.packOpening.findUnique({
    where: { id: openingId },
    include: { card: true, pack: true },
  });
  if (!opening) throw new ProductError("Opening not found", "NOT_FOUND", 404);
  if (opening.userId !== userId) throw new ProductError("Forbidden", "FORBIDDEN", 403);

  const expiredCheck = await expireOpeningIfDue(openingId);
  if (expiredCheck) opening = { ...opening, status: expiredCheck.status };
  if (opening.status === OpeningStatus.EXPIRED) {
    throw new ProductError(PRODUCT_ERRORS.EXPIRED, "EXPIRED", 400);
  }
  if (opening.status === OpeningStatus.CLAIMED) {
    throw new ProductError("Already claimed", "ALREADY_CLAIMED", 400);
  }
  if (opening.status === OpeningStatus.CLAIMING) {
    throw new ProductError("Claim in progress", "CLAIMING", 409);
  }

  const wallet = await getVerifiedWallet(userId);
  if (!wallet || wallet.walletAddress !== walletAddress.toLowerCase()) {
    throw new ProductError(PRODUCT_ERRORS.WALLET_REQUIRED, "WALLET_REQUIRED", 400);
  }

  if (!(await isMintConfigured())) {
    throw new ProductError("Minting is not configured", "MINT_NOT_CONFIGURED", 503);
  }

  const balanceCheck = await checkMintWalletBalance();
  if (!balanceCheck.ok) {
    throw new ProductError(PRODUCT_ERRORS.CLAIM_FAILURE, "INSUFFICIENT_MINT_BALANCE", 503);
  }

  const claimAttempt = await prisma.claimAttempt.create({
    data: {
      openingId,
      userId,
      walletAddress: wallet.walletAddress,
      status: ClaimAttemptStatus.PENDING,
    },
  });

  try {
    const updated = await prisma.packOpening.updateMany({
      where: { id: openingId, status: OpeningStatus.UNCLAIMED },
      data: { status: OpeningStatus.CLAIMING, claimingAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ProductError("Claim in progress", "CLAIMING", 409);
    }

    await prisma.claimAttempt.update({
      where: { id: claimAttempt.id },
      data: { status: ClaimAttemptStatus.SUBMITTED },
    });

    const mintResult = await mintCardNft({
      recipient: wallet.walletAddress as `0x${string}`,
      openingId,
      packId: opening.packId,
      cardId: opening.cardId,
    });

    await prisma.$transaction(async (tx) => {
      await confirmLimitedClaim(opening!.cardId, tx);
      await tx.packOpening.update({
        where: { id: openingId },
        data: {
          status: OpeningStatus.CLAIMED,
          claimedAt: new Date(),
          walletAddress: wallet.walletAddress,
          tokenId: mintResult.tokenId,
          transactionHash: mintResult.transactionHash,
          contractAddress: mintResult.contractAddress,
        },
      });
      await tx.claimAttempt.update({
        where: { id: claimAttempt.id },
        data: {
          status: ClaimAttemptStatus.CONFIRMED,
          transactionHash: mintResult.transactionHash,
        },
      });
    });

    trackEvent("card_claimed", { openingId, tokenId: mintResult.tokenId });
    return prisma.packOpening.findUniqueOrThrow({
      where: { id: openingId },
      include: { card: true, pack: true },
    });
  } catch (err) {
    await prisma.packOpening.updateMany({
      where: { id: openingId, status: OpeningStatus.CLAIMING },
      data: { status: OpeningStatus.UNCLAIMED, claimingAt: null },
    });
    await prisma.claimAttempt.update({
      where: { id: claimAttempt.id },
      data: {
        status: ClaimAttemptStatus.FAILED,
        errorCode: err instanceof Error ? err.message : "UNKNOWN",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });
    trackEvent("claim_failed", { openingId });
    throw new ProductError(PRODUCT_ERRORS.CLAIM_FAILURE, "CLAIM_FAILURE", 500);
  }
}
