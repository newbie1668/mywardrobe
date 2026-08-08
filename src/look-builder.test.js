import { describe, expect, it } from "vitest";
import { getLookBuilder } from "./pairing-data.js";

const garment = (id, name, part, color, secondaryColor = null, tags = []) => ({
  id,
  name,
  part,
  color,
  secondaryColor,
  tags,
  image: `/${id}.png`,
});

const hermosaAnchor = (secondaryColor = null) => garment(
  "anchor",
  "Hermosa pink shirt",
  "upperbody",
  "#f9c1ce",
  secondaryColor,
  ["casual"],
);

const combination176Wardrobe = () => [
  garment("seashell-bottom", "Seashell trousers", "lowerbody", "#fdd4bd"),
  garment("calamine-shoes", "Calamine shoes", "shoes", "#78cdd0"),
];

describe("Look Builder candidate combinations", () => {
  it("returns at most three combinations sourced only from Dictionary Vol. 1", () => {
    const anchor = hermosaAnchor();
    const result = getLookBuilder(anchor, [anchor, ...combination176Wardrobe()]);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates).toHaveLength(Math.min(result.candidates.length, 3));
    expect(result.candidates.every((candidate) => (
      candidate.source === "A Dictionary of Color Combinations Vol. 1"
    ))).toBe(true);
    expect(JSON.stringify(result.candidates)).not.toMatch(/Vol\. 2|seasonal/i);
  });

  it("lets the primary colour choose while the secondary colour only validates or rejects", () => {
    const validatedAnchor = hermosaAnchor("#0093a5");
    const validatingWardrobe = [
      validatedAnchor,
      garment("glaucous-bottom", "Light glaucous trousers", "lowerbody", "#a5c8d1"),
      garment("english-red-shoes", "English red shoes", "shoes", "#d96629"),
    ];
    const validated = getLookBuilder(validatedAnchor, validatingWardrobe);

    expect(validated.candidates.map(({ combinationNumber }) => combinationNumber)).toContain(227);
    expect(validated.candidates.map(({ combinationNumber }) => combinationNumber)).not.toContain(1);
    expect(validated.candidates.every(({ combinationGuide }) => (
      combinationGuide.anchorColour.dictionaryColourName === "Hermosa Pink"
    ))).toBe(true);

    const rejectedAnchor = hermosaAnchor("#d96629");
    const rejected = getLookBuilder(rejectedAnchor, [rejectedAnchor, ...combination176Wardrobe()]);
    expect(rejected.candidates.map(({ combinationNumber }) => combinationNumber)).not.toContain(176);

    const distantPrimary = garment("distant", "Electric blue shirt", "upperbody", "#0000ff", "#f9c1ce");
    const secondaryCannotChoose = getLookBuilder(distantPrimary, [distantPrimary, ...combination176Wardrobe()]);
    expect(secondaryCannotChoose.candidates).toEqual([]);
  });

  it("ranks combinations by wearable wardrobe coverage", () => {
    const anchor = hermosaAnchor();
    const wardrobe = [
      anchor,
      ...combination176Wardrobe(),
      garment("glaucous-bottom", "Light glaucous trousers", "lowerbody", "#a5c8d1"),
    ];
    const result = getLookBuilder(anchor, wardrobe);

    expect(result.candidates[0].combinationNumber).toBe(176);
    expect(result.candidates[0].coverage.mappedColourNames).toEqual([
      "Seashell Pink",
      "Calamine BLue",
    ]);
    expect(result.candidates[0].coverage.swatchCount).toBe(2);
    expect(result.candidates[0].coverage.pieceIds).toEqual(expect.arrayContaining([
      "seashell-bottom",
      "calamine-shoes",
    ]));
  });

  it("returns an honest empty state when nothing is covered or the anchor mapping is implausible", () => {
    const uncoveredAnchor = hermosaAnchor();
    expect(getLookBuilder(uncoveredAnchor, [uncoveredAnchor]).candidates).toEqual([]);

    const distantAnchor = garment("distant", "Electric blue shirt", "upperbody", "#0000ff");
    const result = getLookBuilder(distantAnchor, [distantAnchor, ...combination176Wardrobe()]);
    expect(result.candidates).toEqual([]);
    expect(result.defaultCombinationGuide).toBeNull();
  });

  it("builds the default guide from every exact source swatch and the primary mapping", () => {
    const anchor = hermosaAnchor();
    const result = getLookBuilder(anchor, [anchor, ...combination176Wardrobe()]);

    expect(result.defaultCombinationGuide).toEqual({
      combinationNumber: 176,
      label: "Combination 176",
      swatches: [
        { name: "Hermosa Pink", hex: "#f9c1ce" },
        { name: "Seashell Pink", hex: "#fdd4bd" },
        { name: "Calamine BLue", hex: "#78cdd0" },
      ],
      anchorColour: {
        garmentHex: "#f9c1ce",
        dictionaryColourName: "Hermosa Pink",
        dictionaryHex: "#f9c1ce",
        relationship: "closest to",
      },
      attribution: "Sanzo Wada, A Dictionary of Color Combinations Vol. 1.",
    });
    expect(result.defaultCombinationGuide.label).not.toMatch(/plate/i);
  });
});
