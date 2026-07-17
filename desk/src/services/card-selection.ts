import { Card, DrawMode, Pack, SupplyType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type EligibleCard = Card & { effectiveWeight: number; estimatedProbability: number };

export function getAvailableCount(card: Card): number | null {
  if (card.supplyType === SupplyType.UNLIMITED) return null;
  const max = card.maxSupply ?? 0;
  return Math.max(0, max - card.claimedCount - card.reservedCount);
}

export function isCardEligible(card: Card): boolean {
  if (!card.active) return false;
  if (card.supplyType === SupplyType.UNLIMITED) return true;
  return (getAvailableCount(card) ?? 0) > 0;
}

export function selectCardEqual(cards: Card[]): EligibleCard {
  const eligible = cards.filter(isCardEligible);
  if (eligible.length === 0) throw new Error("SOLD_OUT");
  const idx = Math.floor(Math.random() * eligible.length);
  const selected = eligible[idx];
  const prob = 1 / eligible.length;
  return { ...selected, effectiveWeight: 1, estimatedProbability: prob };
}

export function selectCardWeighted(
  cards: Card[],
  useAssetPullRates: boolean,
  confirmedMapping: boolean,
): EligibleCard {
  const eligible = cards.filter(isCardEligible);
  if (eligible.length === 0) throw new Error("SOLD_OUT");

  if (!useAssetPullRates) {
    return selectCardEqual(eligible);
  }

  const withWeights = eligible.map((card) => {
    const weight = card.assetWeight && card.assetWeight > 0 ? card.assetWeight : 1;
    return { card, weight };
  });

  if (useAssetPullRates && !confirmedMapping && withWeights.some((w) => !w.card.assetWeight)) {
    throw new Error("RARITY_MAPPING_UNCONFIRMED");
  }

  const totalWeight = withWeights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const { card, weight } of withWeights) {
    roll -= weight;
    if (roll <= 0) {
      return {
        ...card,
        effectiveWeight: weight,
        estimatedProbability: weight / totalWeight,
      };
    }
  }
  const last = withWeights[withWeights.length - 1];
  return {
    ...last.card,
    effectiveWeight: last.weight,
    estimatedProbability: last.weight / totalWeight,
  };
}

export async function loadEligibleCards(packId: string): Promise<Card[]> {
  return prisma.card.findMany({ where: { packId, active: true } });
}

export function getDrawMode(pack: Pack): DrawMode {
  return pack.useAssetPullRates ? DrawMode.ASSET_WEIGHTS : DrawMode.EQUAL;
}

export type SelectionAudit = {
  packId: string;
  eligibleCount: number;
  selectedCardId: string;
  drawMode: DrawMode;
  effectiveWeight: number;
  estimatedProbability: number;
};

export function buildSelectionAudit(
  pack: Pack,
  eligibleCount: number,
  selected: EligibleCard,
): SelectionAudit {
  return {
    packId: pack.id,
    eligibleCount,
    selectedCardId: selected.id,
    drawMode: getDrawMode(pack),
    effectiveWeight: selected.effectiveWeight,
    estimatedProbability: selected.estimatedProbability,
  };
}
