import { describe, expect, it } from "vitest";
import {
  createCompleteLook,
  getLookBuilder,
  getWardrobeRole,
  getWearableCoreStatus,
  selectPairingOption,
} from "./pairing-data.js";

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

describe("Pairing Options", () => {
  it("derives required Wardrobe Roles from top, bottom, one-piece, and footwear anchors", () => {
    expect(getWardrobeRole(garment("top", "Top", "upperbody", "#ffffff"))).toBe("top");
    expect(getWardrobeRole(garment("bottom", "Bottom", "lowerbody", "#ffffff"))).toBe("bottom");
    expect(getWardrobeRole(garment("dress", "Dress", "onepiece", "#ffffff"))).toBe("one-piece");
    expect(getWardrobeRole(garment("shoe", "Shoe", "shoes", "#ffffff"))).toBe("footwear");

    const topResult = getLookBuilder(hermosaAnchor(), [hermosaAnchor(), ...combination176Wardrobe()]);
    expect(topResult.candidates[0].pairingOptionGroups.map(({ wardrobeRole, requirement }) => [wardrobeRole, requirement])).toEqual([
      ["bottom", "required"],
      ["footwear", "required"],
    ]);

    const bottomAnchor = garment("bottom-anchor", "Hermosa pink trousers", "lowerbody", "#f9c1ce");
    const bottomResult = getLookBuilder(bottomAnchor, [
      bottomAnchor,
      garment("seashell-top", "Seashell shirt", "upperbody", "#fdd4bd"),
      garment("calamine-shoes", "Calamine shoes", "shoes", "#78cdd0"),
    ]);
    expect(bottomResult.candidates[0].pairingOptionGroups.map(({ wardrobeRole, requirement }) => [wardrobeRole, requirement])).toEqual([
      ["top", "required"],
      ["footwear", "required"],
    ]);

    const onePieceAnchor = garment("dress", "Hermosa pink dress", "onepiece", "#f9c1ce");
    const onePieceResult = getLookBuilder(onePieceAnchor, [onePieceAnchor, ...combination176Wardrobe()]);
    expect(onePieceResult.candidates[0].pairingOptionGroups.map(({ wardrobeRole }) => wardrobeRole)).toEqual([
      "footwear",
    ]);

    const footwearAnchor = garment("anchor-shoe", "Hermosa pink shoes", "shoes", "#f9c1ce");
    const footwearWardrobe = [
      footwearAnchor,
      garment("seashell-top", "Seashell shirt", "upperbody", "#fdd4bd"),
      garment("calamine-bottom", "Calamine trousers", "lowerbody", "#78cdd0"),
      garment("seashell-dress", "Seashell dress", "onepiece", "#fdd4bd"),
    ];
    const footwearResult = getLookBuilder(footwearAnchor, footwearWardrobe);
    expect(footwearResult.candidates[0].pairingOptionGroups.map(({ wardrobeRole, requirement }) => [wardrobeRole, requirement])).toEqual([
      ["top", "alternative"],
      ["bottom", "alternative"],
      ["one-piece", "alternative"],
    ]);
  });

  it("offers at most six ranked garments per role with an explicit Dictionary mapping", () => {
    const anchor = hermosaAnchor();
    const bottoms = Array.from({ length: 8 }, (_, index) => garment(
      `bottom-${index}`,
      `Seashell bottom ${index}`,
      "lowerbody",
      index === 0 ? "#fdd4bd" : `#fdd4b${index}`,
    ));
    const result = getLookBuilder(anchor, [anchor, ...bottoms, combination176Wardrobe()[1]]);
    const bottomGroup = result.candidates[0].pairingOptionGroups.find(({ wardrobeRole }) => wardrobeRole === "bottom");

    expect(bottomGroup.options).toHaveLength(6);
    expect(bottomGroup.options[0]).toMatchObject({
      pieceId: "bottom-0",
      pieceName: "Seashell bottom 0",
      wardrobeRole: "bottom",
      referenceCombinationNumber: 176,
      mapping: {
        kind: "dictionary",
        garmentHex: "#fdd4bd",
        dictionaryColourName: "Seashell Pink",
        dictionaryHex: "#fdd4bd",
        relationship: "closest to",
      },
    });
  });

  it("applies context gates before colour ranking", () => {
    const formalAnchor = garment("formal-anchor", "Formal Hermosa tailored shirt", "upperbody", "#f9c1ce");
    const result = getLookBuilder(formalAnchor, [
      formalAnchor,
      garment("graphic-bottom", "Graphic Seashell sportswear shorts", "lowerbody", "#fdd4bd"),
      garment("formal-bottom", "Formal Seashell dress trousers", "lowerbody", "#fdd4bd"),
      garment("swim-shoes", "Calamine swim shoes", "shoes", "#78cdd0"),
      garment("formal-shoes", "Formal Calamine derby shoes", "shoes", "#78cdd0"),
    ]);
    const optionIds = result.candidates[0].pairingOptionGroups.flatMap(({ options }) => options.map(({ pieceId }) => pieceId));

    expect(optionIds).toContain("formal-bottom");
    expect(optionIds).toContain("formal-shoes");
    expect(optionIds).not.toContain("graphic-bottom");
    expect(optionIds).not.toContain("swim-shoes");
  });

  it("labels black, white, cream, grey, and brown as Supporting Neutrals without a Dictionary claim", () => {
    const anchor = hermosaAnchor();
    const neutralShoes = [
      garment("black", "Black loafers", "shoes", "#111111"),
      garment("white", "White trainers", "shoes", "#f8f8f8"),
      garment("cream", "Cream shoes", "shoes", "#f3ead3"),
      garment("grey", "Grey shoes", "shoes", "#777777"),
      garment("brown", "Brown shoes", "shoes", "#70452d"),
    ];
    const result = getLookBuilder(anchor, [
      anchor,
      garment("mapped-bottom", "Seashell trousers", "lowerbody", "#fdd4bd"),
      ...neutralShoes,
    ]);
    const footwear = result.candidates[0].pairingOptionGroups.find(({ wardrobeRole }) => wardrobeRole === "footwear");

    expect(footwear.options).toHaveLength(5);
    expect(footwear.options.every(({ mapping }) => (
      mapping.kind === "supporting-neutral"
      && mapping.label === "Supporting Neutral"
      && !("dictionaryColourName" in mapping)
    ))).toBe(true);

    const contradictory = getLookBuilder(anchor, [
      anchor,
      garment("mapped-bottom", "Seashell trousers", "lowerbody", "#fdd4bd"),
      garment("not-brown", "Brown shoes", "shoes", "#ff0000"),
    ]);
    const contradictoryFootwear = contradictory.candidates[0].pairingOptionGroups.find(({ wardrobeRole }) => wardrobeRole === "footwear");
    expect(contradictoryFootwear.options).toEqual([]);
  });
});

describe("Wearable Core selection", () => {
  const mappedOption = (pieceId, wardrobeRole) => ({
    pieceId,
    pieceName: pieceId,
    wardrobeRole,
    referenceCombinationNumber: 176,
    mapping: { kind: "dictionary", dictionaryColourName: "Seashell Pink" },
  });
  const neutralOption = (pieceId, wardrobeRole) => ({
    pieceId,
    pieceName: pieceId,
    wardrobeRole,
    referenceCombinationNumber: 176,
    mapping: { kind: "supporting-neutral", label: "Supporting Neutral" },
  });

  it("swaps the previous selection in the same Wardrobe Role", () => {
    const anchor = hermosaAnchor();
    let look = createCompleteLook(anchor, 176);
    look = selectPairingOption(look, mappedOption("first-bottom", "bottom"));
    look = selectPairingOption(look, mappedOption("second-bottom", "bottom"));

    expect(look.selectedByRole.bottom.pieceId).toBe("second-bottom");
    expect(Object.values(look.selectedByRole).filter(({ wardrobeRole }) => wardrobeRole === "bottom")).toHaveLength(1);
  });

  it("accepts either top and bottom or a one-piece garment, plus footwear", () => {
    let separates = createCompleteLook(hermosaAnchor(), 176);
    expect(getWearableCoreStatus(separates)).toMatchObject({
      isWearableCore: false,
      canSave: false,
      missingRequiredRoles: ["Bottom", "Footwear"],
    });
    separates = selectPairingOption(separates, mappedOption("bottom", "bottom"));
    separates = selectPairingOption(separates, neutralOption("shoe", "footwear"));
    expect(getWearableCoreStatus(separates)).toMatchObject({
      isWearableCore: true,
      expressesReferenceCombination: true,
      canSave: true,
      missingRequiredRoles: [],
    });

    const dressAnchor = garment("dress", "Dress", "onepiece", "#f9c1ce");
    let onePiece = createCompleteLook(dressAnchor, 176);
    onePiece = selectPairingOption(onePiece, mappedOption("shoe", "footwear"));
    expect(getWearableCoreStatus(onePiece)).toMatchObject({ isWearableCore: true, canSave: true });

    const bottomAnchor = garment("bottom-anchor", "Hermosa trousers", "lowerbody", "#f9c1ce");
    let fromBottom = createCompleteLook(bottomAnchor, 176);
    fromBottom = selectPairingOption(fromBottom, mappedOption("top", "top"));
    fromBottom = selectPairingOption(fromBottom, neutralOption("shoe", "footwear"));
    expect(getWearableCoreStatus(fromBottom)).toMatchObject({ isWearableCore: true, canSave: true });
  });

  it("keeps Save unavailable when only Supporting Neutrals accompany the Anchor Piece", () => {
    const footwearAnchor = garment("shoe", "Hermosa shoes", "shoes", "#f9c1ce");
    let look = createCompleteLook(footwearAnchor, 176);
    look = selectPairingOption(look, neutralOption("top", "top"));
    look = selectPairingOption(look, neutralOption("bottom", "bottom"));
    const status = getWearableCoreStatus(look);

    expect(status).toMatchObject({
      isWearableCore: true,
      expressesReferenceCombination: false,
      canSave: false,
      missingRequiredRoles: [],
    });
    expect(status.blockers).toContain("Choose at least one Pairing Option mapped to Combination 176.");
  });

  it("switches between separates and one-piece clothing without keeping incompatible roles", () => {
    const footwearAnchor = garment("shoe", "Hermosa shoes", "shoes", "#f9c1ce");
    let look = createCompleteLook(footwearAnchor, 176);
    look = selectPairingOption(look, mappedOption("top", "top"));
    look = selectPairingOption(look, mappedOption("bottom", "bottom"));
    look = selectPairingOption(look, mappedOption("dress", "one-piece"));

    expect(look.selectedByRole.top).toBeUndefined();
    expect(look.selectedByRole.bottom).toBeUndefined();
    expect(look.selectedByRole["one-piece"].pieceId).toBe("dress");
  });
});
