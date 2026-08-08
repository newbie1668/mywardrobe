import { describe, expect, it } from "vitest";
import {
  completeSavedOutfitCopy,
  createSavedOutfit,
  generateSavedOutfitCopy,
  renameSavedOutfit,
  readOutfitCollection,
  readSavedOutfits,
  retrySavedOutfitCopy,
  writeSavedOutfits,
} from "./saved-outfits.js";
import { createGroundedOutfitCopy, groundedOutfitCopyInput } from "./outfit-copy.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

const completeLook = {
  anchorPieceId: "anchor-shirt",
  anchorRole: "top",
  referenceCombinationNumber: 176,
  selectedByRole: {
    top: {
      pieceId: "anchor-shirt",
      pieceName: "Hermosa shirt",
      wardrobeRole: "top",
      roleLabel: "Top",
      isAnchor: true,
      referenceCombinationNumber: 176,
    },
    bottom: {
      pieceId: "seashell-trousers",
      pieceName: "Seashell trousers",
      wardrobeRole: "bottom",
      roleLabel: "Bottom",
      referenceCombinationNumber: 176,
      mapping: {
        kind: "dictionary",
        garmentHex: "#fdd4bd",
        dictionaryColourName: "Seashell Pink",
        dictionaryHex: "#fdd4bd",
        relationship: "closest to",
      },
    },
    footwear: {
      pieceId: "black-loafers",
      pieceName: "Black loafers",
      wardrobeRole: "footwear",
      roleLabel: "Footwear",
      referenceCombinationNumber: 176,
      mapping: {
        kind: "supporting-neutral",
        garmentHex: "#111111",
        neutralName: "Black",
        label: "Supporting Neutral",
      },
    },
  },
};

const referenceCombination = {
  combinationNumber: 176,
  label: "Combination 176",
  source: "A Dictionary of Color Combinations Vol. 1",
  combinationGuide: {
    swatches: [
      { name: "Hermosa Pink", hex: "#f9c1ce" },
      { name: "Seashell Pink", hex: "#fdd4bd" },
    ],
    anchorColour: {
      garmentHex: "#f9c1ce",
      dictionaryColourName: "Hermosa Pink",
      dictionaryHex: "#f9c1ce",
      relationship: "closest to",
    },
  },
};

describe("Saved Outfits", () => {
  it("creates grounded copy inputs from the immutable Saved Outfit snapshot", () => {
    const saved = createSavedOutfit(completeLook, referenceCombination, {
      id: "saved-copy",
      now: "2026-08-08T15:00:00.000Z",
    });

    expect(groundedOutfitCopyInput(saved)).toEqual({
      combinationNumber: 176,
      garments: [
        { name: "Hermosa shirt", mapping: "Hermosa Pink", role: "Top" },
        { name: "Seashell trousers", mapping: "Seashell Pink", role: "Bottom" },
        { name: "Black loafers", mapping: "Supporting Neutral", role: "Footwear" },
      ],
    });
    expect(createGroundedOutfitCopy(saved)).toEqual({
      name: "Hermosa shirt · closest to Hermosa Pink",
      description: "Hermosa shirt and Seashell trousers map closest to Hermosa Pink and Seashell Pink in Dictionary Vol. 1 · Combination 176. Black loafers is a Supporting Neutral.",
    });
  });

  it("persists an immutable Complete Look snapshot before generation starts", () => {
    const storage = memoryStorage();
    const saved = createSavedOutfit(completeLook, referenceCombination, {
      id: "saved-first",
      now: "2026-08-08T15:00:00.000Z",
    });

    writeSavedOutfits([saved], storage);
    completeLook.selectedByRole.bottom.pieceId = "replacement-trousers";
    referenceCombination.combinationGuide.swatches[0].name = "Changed later";

    expect(readSavedOutfits(storage)).toEqual([expect.objectContaining({
      id: "saved-first",
      sourceType: "saved",
      createdAt: "2026-08-08T15:00:00.000Z",
      anchorPieceId: "anchor-shirt",
      anchorPiece: expect.objectContaining({ pieceId: "anchor-shirt", isAnchor: true }),
      garmentIds: ["anchor-shirt", "seashell-trousers", "black-loafers"],
      generation: expect.objectContaining({ status: "generating", startedAt: "2026-08-08T15:00:00.000Z" }),
      referenceCombination: expect.objectContaining({ combinationNumber: 176 }),
      colourMappings: expect.objectContaining({
        top: expect.objectContaining({ dictionaryColourName: "Hermosa Pink" }),
        bottom: expect.objectContaining({ dictionaryColourName: "Seashell Pink" }),
        footwear: expect.objectContaining({ kind: "supporting-neutral" }),
      }),
    })]);
    expect(readSavedOutfits(storage)[0].selectedGarmentsByRole.bottom.pieceId).toBe("seashell-trousers");
    expect(readSavedOutfits(storage)[0].referenceCombination.guide.swatches[0].name).toBe("Hermosa Pink");
  });

  it("recovers generating and failed Saved Outfits after an application restart", () => {
    const storage = memoryStorage();
    const generating = createSavedOutfit(completeLook, referenceCombination, {
      id: "saved-generating",
      now: "2026-08-08T15:00:00.000Z",
    });
    const failed = {
      ...createSavedOutfit(completeLook, referenceCombination, {
        id: "saved-failed",
        now: "2026-08-08T16:00:00.000Z",
      }),
      generation: {
        status: "failed",
        startedAt: "2026-08-08T16:00:00.000Z",
        failedAt: "2026-08-08T16:01:00.000Z",
        error: "Preview could not be generated.",
      },
    };

    writeSavedOutfits([generating, failed], storage);

    expect(readSavedOutfits(storage).map((outfit) => [outfit.id, outfit.generation.status])).toEqual([
      ["saved-failed", "failed"],
      ["saved-generating", "generating"],
    ]);
  });

  it("persists generated copy, a user rename, and a retryable text-generation failure", async () => {
    const storage = memoryStorage();
    const saved = createSavedOutfit(completeLook, referenceCombination, {
      id: "saved-copy-lifecycle",
      now: "2026-08-08T15:00:00.000Z",
    });
    const generated = completeSavedOutfitCopy(saved, createGroundedOutfitCopy(saved), "2026-08-08T15:00:01.000Z");
    const renamed = renameSavedOutfit(generated, "Pink shirt and loafers", "2026-08-08T15:00:02.000Z");
    const failed = await generateSavedOutfitCopy(renamed, async () => {
      throw new Error("Text service unavailable.");
    }, "2026-08-08T15:00:03.000Z");
    const retried = retrySavedOutfitCopy(failed, "2026-08-08T15:00:04.000Z");
    const regenerated = await generateSavedOutfitCopy(retried, async () => createGroundedOutfitCopy(retried), "2026-08-08T15:00:05.000Z");

    writeSavedOutfits([regenerated], storage);

    expect(readSavedOutfits(storage)).toEqual([expect.objectContaining({
      id: "saved-copy-lifecycle",
      name: "Pink shirt and loafers",
      nameSource: "user",
      description: "Hermosa shirt and Seashell trousers map closest to Hermosa Pink and Seashell Pink in Dictionary Vol. 1 · Combination 176. Black loafers is a Supporting Neutral.",
      copyGeneration: expect.objectContaining({
        status: "ready",
        startedAt: "2026-08-08T15:00:04.000Z",
        completedAt: "2026-08-08T15:00:05.000Z",
        error: null,
      }),
    })]);
  });

  it("returns Saved Outfits and Curated Looks through one gallery contract", () => {
    const storage = memoryStorage();
    const saved = createSavedOutfit(completeLook, referenceCombination, {
      id: "saved-first",
      now: "2026-08-08T15:00:00.000Z",
    });
    writeSavedOutfits([saved], storage);

    const collection = readOutfitCollection([{
      id: "curated-first",
      name: "Existing curated look",
      image: "/api/import/outfits/curated-first.png",
      reason: "An existing look remains unchanged.",
      garmentIds: ["anchor-shirt"],
    }], storage);

    expect(collection.saved[0]).toEqual(expect.objectContaining({
      id: "saved-first",
      sourceType: "saved",
      garmentIds: expect.any(Array),
      generation: expect.any(Object),
    }));
    expect(collection.curated[0]).toEqual(expect.objectContaining({
      id: "curated-first",
      sourceType: "curated",
      garmentIds: ["anchor-shirt"],
      generation: { status: "ready" },
    }));
  });
});
