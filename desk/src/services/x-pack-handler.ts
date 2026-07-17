import { OpeningStatus, XProduct } from "@prisma/client";
import { prisma } from "@/lib/db";
import { X_COOLDOWN_MS } from "@/lib/constants";
import { PRODUCT_ERRORS, ProductError } from "@/lib/errors";
import { expireUserPendingIfNeeded } from "./expiration";
import { getFeaturedXPack, openPackForUser } from "./pack-opening";
import { routeXCommand } from "./x-command-parser";
import { formatCardLabel } from "@/lib/utils";

export type XPackCommandInput = {
  xPostId: string;
  xUserId: string;
  xUsername: string;
  xProfileImage?: string;
  text: string;
};

export type XPackCommandResult =
  | { handled: false; route: "MONEX" | null }
  | { handled: true; success: false; reply: string }
  | { handled: true; success: true; reply: string; openingId: string };

export async function handleXPackCommand(input: XPackCommandInput): Promise<XPackCommandResult> {
  const route = routeXCommand(input.text);
  if (route === "MONEX") return { handled: false, route: "MONEX" };
  if (route !== "MONAD_PACKS") return { handled: false, route: null };

  const existingPost = await prisma.processedXPost.findUnique({
    where: { xPostId_product: { xPostId: input.xPostId, product: XProduct.MONAD_PACKS } },
  });
  if (existingPost?.resultOpeningId) {
    const opening = await prisma.packOpening.findUnique({
      where: { id: existingPost.resultOpeningId },
      include: { card: true, pack: true },
    });
    if (opening) {
      return {
        handled: true,
        success: true,
        reply: buildRevealReply(opening.card.name, opening.card.displayNumber, opening.pack.name),
        openingId: opening.id,
      };
    }
  }

  const user = await upsertXUser(input);

  await expireUserPendingIfNeeded(user.id);

  const cooldown = await prisma.xCooldown.findUnique({ where: { userId: user.id } });
  if (cooldown && cooldown.nextAvailableAt > new Date()) {
    return {
      handled: true,
      success: false,
      reply: PRODUCT_ERRORS.X_COOLDOWN,
    };
  }

  const pending = await prisma.packOpening.findFirst({
    where: {
      userId: user.id,
      status: { in: [OpeningStatus.UNCLAIMED, OpeningStatus.CLAIMING] },
    },
  });
  if (pending) {
    return {
      handled: true,
      success: false,
      reply: PRODUCT_ERRORS.PENDING_CARD,
    };
  }

  const featuredPack = await getFeaturedXPack();
  if (!featuredPack) {
    return {
      handled: true,
      success: false,
      reply: PRODUCT_ERRORS.NO_FEATURED_PACK,
    };
  }

  try {
    const opening = await openPackForUser({
      userId: user.id,
      packId: featuredPack.id,
      source: "X",
      sourcePostId: input.xPostId,
    });

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.xCooldown.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          lastSuccessfulOpenAt: now,
          nextAvailableAt: new Date(now.getTime() + X_COOLDOWN_MS),
        },
        update: {
          lastSuccessfulOpenAt: now,
          nextAvailableAt: new Date(now.getTime() + X_COOLDOWN_MS),
        },
      });

      await tx.processedXPost.upsert({
        where: { xPostId_product: { xPostId: input.xPostId, product: XProduct.MONAD_PACKS } },
        create: {
          xPostId: input.xPostId,
          product: XProduct.MONAD_PACKS,
          command: "open pack",
          userId: user.id,
          resultOpeningId: opening.id,
        },
        update: { resultOpeningId: opening.id },
      });
    });

    const websiteUrl = process.env.MONAD_PACKS_WEBSITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    const reply = [
      buildRevealReply(opening.card.name, opening.card.displayNumber, opening.pack.name),
      "",
      `Claim your card on Monad Packs within 24 hours: ${websiteUrl}`,
    ].join("\n");

    return { handled: true, success: true, reply, openingId: opening.id };
  } catch (err) {
    if (err instanceof ProductError) {
      return { handled: true, success: false, reply: err.message };
    }
    throw err;
  }
}

function buildRevealReply(cardName: string, displayNumber: number, packName: string): string {
  return `You pulled ${formatCardLabel(cardName, displayNumber)} from ${packName}!`;
}

async function upsertXUser(input: XPackCommandInput) {
  return prisma.user.upsert({
    where: { xUserId: input.xUserId },
    create: {
      xUserId: input.xUserId,
      xUsername: input.xUsername,
      xProfileImage: input.xProfileImage,
    },
    update: {
      xUsername: input.xUsername,
      xProfileImage: input.xProfileImage,
    },
  });
}
