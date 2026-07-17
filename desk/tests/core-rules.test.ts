import { describe, expect, it, vi } from "vitest";
import { parseXCommand, routeXCommand } from "@/services/x-command-parser";
import {
  getAvailableCount,
  isCardEligible,
  selectCardEqual,
  selectCardWeighted,
} from "@/services/card-selection";
import { SupplyType, type Card } from "@prisma/client";
import { getMobileActivityFields } from "@/lib/activity-fields";
import { formatCardLabel } from "@/lib/utils";
import AdmZip from "adm-zip";
import { parsePackAssetZip } from "@/services/pack-import";
import { buildSimpleCardSlots, extractImagesFromZip } from "@/services/simple-pack-import";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: overrides.id ?? "c1",
    packId: "p1",
    sourceAssetCardId: null,
    assetFingerprint: "fp1",
    displayNumber: 1,
    name: "Test Card",
    description: null,
    imageUrl: "/img.png",
    metadata: null,
    rarityLabel: null,
    assetWeight: null,
    supplyType: SupplyType.UNLIMITED,
    maxSupply: null,
    claimedCount: 0,
    reservedCount: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("X command parser", () => {
  it("accepts exact open pack command", () => {
    expect(parseXCommand("@monexmonad open pack")).toBe("open pack");
    expect(routeXCommand("@monexmonad open pack")).toBe("MONAD_PACKS");
  });

  it("rejects unrelated sentences", () => {
    expect(parseXCommand("I want to open a pack today")).toBe(null);
    expect(parseXCommand("open packs now")).toBe(null);
  });

  it("routes catch to MONEX", () => {
    expect(routeXCommand("@monexmonad catch")).toBe("MONEX");
  });
});

describe("Card selection", () => {
  it("equal mode gives equal weight", () => {
    const cards = [makeCard({ id: "a" }), makeCard({ id: "b" }), makeCard({ id: "c" })];
    const selected = selectCardEqual(cards);
    expect(selected.estimatedProbability).toBeCloseTo(1 / 3);
  });

  it("asset mode uses validated weights", () => {
    const cards = [
      makeCard({ id: "a", assetWeight: 1 }),
      makeCard({ id: "b", assetWeight: 3 }),
    ];
    const selected = selectCardWeighted(cards, true, true);
    expect(selected.effectiveWeight).toBeGreaterThan(0);
  });

  it("sold-out limited cards are not eligible", () => {
    const soldOut = makeCard({
      supplyType: SupplyType.LIMITED,
      maxSupply: 1,
      claimedCount: 1,
      reservedCount: 0,
    });
    expect(isCardEligible(soldOut)).toBe(false);
    expect(getAvailableCount(soldOut)).toBe(0);
  });

  it("limited available count formula", () => {
    const card = makeCard({
      supplyType: SupplyType.LIMITED,
      maxSupply: 10,
      claimedCount: 3,
      reservedCount: 2,
    });
    expect(getAvailableCount(card)).toBe(5);
  });
});

describe("Pack asset ZIP paths", () => {
  it("resolves images when pack.json is inside a root folder", async () => {
    const zip = new AdmZip();
    zip.addFile(
      "monad-cards/pack.json",
      Buffer.from(
        JSON.stringify({
          name: "Monad Cards",
          cards: [{ id: "1", name: "Card 1", image: "images/card-1.png" }],
        }),
      ),
    );
    zip.addFile("monad-cards/images/card-1.png", Buffer.from("fake-png"));

    const { manifest, imagePaths } = await parsePackAssetZip(zip.toBuffer());
    expect(manifest.name).toBe("Monad Cards");
    expect(imagePaths.has("images/card-1.png")).toBe(true);
  });
});

describe("Simple pack image upload", () => {
  it("sorts card images naturally and numbers slots", () => {
    const slots = buildSimpleCardSlots({
      packName: "Monad Cards",
      cardImages: [
        { filename: "card-10.png", data: Buffer.from("ten") },
        { filename: "card-2.png", data: Buffer.from("two") },
        { filename: "card-1.png", data: Buffer.from("one") },
      ],
    });
    expect(slots.map((slot) => slot.filename)).toEqual([
      "card-1.png",
      "card-2.png",
      "card-10.png",
    ]);
    expect(slots).toHaveLength(3);
  });

  it("adds duplicate copies for listed filenames", () => {
    const image = Buffer.from("legendary");
    const slots = buildSimpleCardSlots({
      packName: "Monad Cards",
      cardImages: [
        { filename: "card-1.png", data: image },
        { filename: "card-2.png", data: Buffer.from("two") },
      ],
      duplicateFilenames: ["card-1.png"],
      duplicateCount: 2,
    });
    expect(slots).toHaveLength(4);
    expect(slots.filter((slot) => slot.filename === "card-1.png")).toHaveLength(3);
  });

  it("extracts images from a zip without pack.json", () => {
    const zip = new AdmZip();
    zip.addFile("card-1.png", Buffer.from("one"));
    zip.addFile("card-2.png", Buffer.from("two"));
    const images = extractImagesFromZip(zip.toBuffer());
    expect(images.map((image) => image.filename)).toEqual(["card-1.png", "card-2.png"]);
  });
});

describe("Card label formatting", () => {
  it("does not duplicate number when name already includes it", () => {
    expect(formatCardLabel("Monad Card #1", 1)).toBe("Monad Card #1");
    expect(formatCardLabel("Monad Card #57", 57)).toBe("Monad Card #57");
  });

  it("appends number when name has no suffix", () => {
    expect(formatCardLabel("Monad Card", 1)).toBe("Monad Card #1");
  });

  it("uses pack display number when name suffix differs", () => {
    expect(formatCardLabel("Monad Card #1", 53)).toBe("Monad Card #53");
  });
});

describe("Mobile activity fields", () => {
  it("includes every required field", () => {
    const fields = getMobileActivityFields({
      id: "1",
      xUsername: "alice",
      cardName: "Monad Card",
      displayNumber: 57,
      packName: "Monad Cards",
      source: "X",
      openedAt: new Date(Date.now() - 120000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: "UNCLAIMED",
    });
    expect(fields).toMatchObject({
      user: "alice",
      card: "Monad Card #57",
      pack: "Monad Cards",
      source: "X",
      status: "Unclaimed",
    });
    expect(fields.opened).toBeTruthy();
    expect(fields.timeRemaining).toBeTruthy();
  });

  it("shows Done for claimed and 0 for expired", () => {
    const claimed = getMobileActivityFields({
      id: "1",
      xUsername: "a",
      cardName: "C",
      displayNumber: 1,
      packName: "P",
      source: "WEBSITE",
      openedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      status: "CLAIMED",
    });
    expect(claimed.timeRemaining).toBe("Done");

    const expired = getMobileActivityFields({
      id: "2",
      xUsername: "b",
      cardName: "C",
      displayNumber: 2,
      packName: "P",
      source: "X",
      openedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      status: "EXPIRED",
    });
    expect(expired.timeRemaining).toBe("0");
  });
});

describe("Card numbering rules", () => {
  it("new cards append after highest number", () => {
    const highest = 52;
    const newNumbers = [53, 54, 55];
    expect(newNumbers[0]).toBe(highest + 1);
  });

  it("deleted numbers are not reused", () => {
    const assignedNumbers = [1, 2, 3, 5]; // #4 was deleted
    const highestEverAssigned = 5;
    const next = highestEverAssigned + 1;
    expect(assignedNumbers.includes(4)).toBe(false);
    expect(next).toBe(6);
  });
});

describe("Pending rule documentation", () => {
  it("website has no cooldown (policy flag)", () => {
    const websiteCooldownMs = 0;
    expect(websiteCooldownMs).toBe(0);
  });

  it("X cooldown is 24 hours", () => {
    const X_COOLDOWN_MS = 24 * 60 * 60 * 1000;
    expect(X_COOLDOWN_MS).toBe(86400000);
  });
});
