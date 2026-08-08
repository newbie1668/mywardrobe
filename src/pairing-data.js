import wadaColors from "dictionary-of-colour-combinations";

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_ANCHOR_DISTANCE = 18;
const MAX_SECONDARY_DISTANCE = 20;
const MAX_WARDROBE_DISTANCE = 22;
const MAX_CANDIDATE_COMBINATIONS = 3;

export const DICTIONARY_SOURCE = "A Dictionary of Color Combinations Vol. 1";
export const PAIRING_ATTRIBUTION = `Sanzo Wada, ${DICTIONARY_SOURCE}.`;

function hexToRgb(hex) {
  if (!HEX.test(hex || "")) return null;
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToLab(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const pivotRgb = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const red = pivotRgb(rgb.red);
  const green = pivotRgb(rgb.green);
  const blue = pivotRgb(rgb.blue);
  const x = ((red * 0.4124) + (green * 0.3576) + (blue * 0.1805)) / 0.95047;
  const y = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
  const z = ((red * 0.0193) + (green * 0.1192) + (blue * 0.9505)) / 1.08883;
  const pivotLab = (value) => value > 0.008856 ? value ** (1 / 3) : (7.787 * value) + (16 / 116);
  const fx = pivotLab(x);
  const fy = pivotLab(y);
  const fz = pivotLab(z);
  return { lightness: (116 * fy) - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function labDistance(first, second) {
  return Math.sqrt(
    ((first.lightness - second.lightness) ** 2)
    + ((first.a - second.a) ** 2)
    + ((first.b - second.b) ** 2),
  );
}

const DICTIONARY_COLOURS = wadaColors
  .map((colour, index) => ({
    index,
    name: colour.name,
    hex: colour.hex.toLowerCase(),
    lab: rgbToLab(colour.hex),
  }))
  .filter((colour) => colour.lab);

const DICTIONARY_COMBINATIONS = [...wadaColors.reduce((combinations, colour, colourIndex) => {
  for (const combinationNumber of colour.combinations || []) {
    const combination = combinations.get(combinationNumber) || {
      combinationNumber,
      source: DICTIONARY_SOURCE,
      colours: [],
    };
    if (!combination.colours.some(({ index }) => index === colourIndex)) {
      combination.colours.push({
        index: colourIndex,
        name: colour.name,
        hex: colour.hex.toLowerCase(),
        lab: rgbToLab(colour.hex),
      });
    }
    combinations.set(combinationNumber, combination);
  }
  return combinations;
}, new Map()).values()]
  .sort((first, second) => first.combinationNumber - second.combinationNumber);

const COMBINATIONS_BY_COLOUR = new Map();
for (const combination of DICTIONARY_COMBINATIONS) {
  for (const colour of combination.colours) {
    const combinations = COMBINATIONS_BY_COLOUR.get(colour.index) || [];
    combinations.push(combination);
    COMBINATIONS_BY_COLOUR.set(colour.index, combinations);
  }
}

function nearestDictionaryColour(hex) {
  const lab = rgbToLab(hex);
  if (!lab) return null;
  return DICTIONARY_COLOURS.reduce((closest, colour) => {
    const distance = labDistance(lab, colour.lab);
    return !closest || distance < closest.distance ? { ...colour, distance } : closest;
  }, null);
}

function garmentColours(item) {
  const colours = [];
  for (const [role, hex] of [["primary", item?.color], ["secondary", item?.secondaryColor]]) {
    const normalizedHex = typeof hex === "string" ? hex.toLowerCase() : "";
    if (!HEX.test(normalizedHex) || colours.some((colour) => colour.hex === normalizedHex)) continue;
    const lab = rgbToLab(normalizedHex);
    if (lab) colours.push({ hex: normalizedHex, lab, role });
  }
  return colours;
}

function closestMapping(sourceColours, dictionaryColours) {
  let closest = null;
  for (const source of sourceColours) {
    for (const target of dictionaryColours) {
      const distance = labDistance(source.lab, target.lab);
      if (!closest || distance < closest.distance) closest = { source, target, distance };
    }
  }
  return closest;
}

const COMPLEMENTARY_PARTS = {
  upperbody: ["lowerbody", "shoes", "wholebody_up", "accessories_up"],
  lowerbody: ["upperbody", "shoes", "wholebody_up", "accessories_up"],
  wholebody_up: ["shoes", "accessories_up", "upperbody", "lowerbody"],
  shoes: ["lowerbody", "upperbody", "wholebody_up", "accessories_up"],
  accessories_up: ["upperbody", "lowerbody", "shoes", "wholebody_up"],
};

function itemContext(item) {
  const text = `${item?.name || ""} ${(item?.tags || []).join(" ")}`.toLowerCase();
  const has = (...terms) => terms.some((term) => text.includes(term));
  return {
    athletic: has("athletic", "sportswear", "running", "football", "basketball", "cycling", "performance"),
    formal: has("formal", "tailored", "suit", "dress trousers", "dress shirt", "derby", "blazer"),
    graphic: has("graphic", "logo", "numbered", "typography"),
    swim: has("swim", "swimwear"),
    summer: has("swim", "swimwear", "beach", "resort", "holiday", "palm", "linen", "summer", "sandals", "tank"),
  };
}

function canPairByContext(anchorPiece, candidate) {
  const anchorContext = itemContext(anchorPiece);
  const candidateContext = itemContext(candidate);

  if (anchorContext.swim !== candidateContext.swim) {
    if (!anchorContext.summer || !candidateContext.summer) return false;
  }
  if ((anchorContext.formal && candidateContext.athletic) || (candidateContext.formal && anchorContext.athletic)) return false;
  if ((anchorContext.formal && candidateContext.graphic) || (candidateContext.formal && anchorContext.graphic)) return false;
  return true;
}

function secondaryValidatesCombination(secondaryColour, combination) {
  if (!secondaryColour) return true;
  const mapping = closestMapping([secondaryColour], combination.colours);
  return Boolean(mapping && mapping.distance <= MAX_SECONDARY_DISTANCE);
}

function wardrobeCoverage(anchorPiece, wardrobe, combination, anchorMapping) {
  const preferredParts = COMPLEMENTARY_PARTS[anchorPiece.part] || Object.keys(COMPLEMENTARY_PARTS);
  const targetColours = combination.colours.filter(({ index }) => index !== anchorMapping.index);
  if (!targetColours.length) return null;

  const pieceMappings = wardrobe
    .filter((candidate) => (
      candidate.id !== anchorPiece.id
      && preferredParts.includes(candidate.part)
      && canPairByContext(anchorPiece, candidate)
    ))
    .map((candidate) => {
      const mapping = closestMapping(garmentColours(candidate), targetColours);
      if (!mapping || mapping.distance > MAX_WARDROBE_DISTANCE) return null;
      return {
        pieceId: candidate.id,
        colourIndex: mapping.target.index,
        colourName: mapping.target.name,
        distance: mapping.distance,
      };
    })
    .filter(Boolean);

  if (!pieceMappings.length) return null;
  const coveredIndexes = new Set(pieceMappings.map(({ colourIndex }) => colourIndex));
  return {
    mappedColourNames: targetColours
      .filter(({ index }) => coveredIndexes.has(index))
      .map(({ name }) => name),
    pieceIds: pieceMappings.map(({ pieceId }) => pieceId),
    swatchCount: coveredIndexes.size,
    pieceCount: pieceMappings.length,
    averageDistance: pieceMappings.reduce((total, mapping) => total + mapping.distance, 0) / pieceMappings.length,
  };
}

function buildCombinationGuide(combination, anchorColour) {
  return {
    combinationNumber: combination.combinationNumber,
    label: `Combination ${combination.combinationNumber}`,
    swatches: combination.colours.map(({ name, hex }) => ({ name, hex })),
    anchorColour: { ...anchorColour },
    attribution: PAIRING_ATTRIBUTION,
  };
}

function emptyLookBuilder(anchorPiece, anchorColour = null) {
  return {
    anchorPiece: anchorPiece ? {
      id: anchorPiece.id,
      name: anchorPiece.name,
      part: anchorPiece.part,
      image: anchorPiece.image,
      thumbnail: anchorPiece.thumbnail,
    } : null,
    anchorColour,
    candidates: [],
    defaultCombinationGuide: null,
  };
}

export function getLookBuilder(anchorPiece, wardrobe = []) {
  if (!anchorPiece) return emptyLookBuilder(null);

  const [primaryColour, secondaryColour] = garmentColours(anchorPiece);
  if (!primaryColour || primaryColour.role !== "primary") return emptyLookBuilder(anchorPiece);

  const anchorMapping = nearestDictionaryColour(primaryColour.hex);
  if (!anchorMapping || anchorMapping.distance > MAX_ANCHOR_DISTANCE) return emptyLookBuilder(anchorPiece);

  const anchorColour = {
    garmentHex: primaryColour.hex,
    dictionaryColourName: anchorMapping.name,
    dictionaryHex: anchorMapping.hex,
    relationship: "closest to",
  };

  const candidates = (COMBINATIONS_BY_COLOUR.get(anchorMapping.index) || [])
    .filter((combination) => secondaryValidatesCombination(secondaryColour, combination))
    .map((combination) => {
      const coverage = wardrobeCoverage(anchorPiece, wardrobe, combination, anchorMapping);
      if (!coverage) return null;
      const combinationGuide = buildCombinationGuide(combination, anchorColour);
      return {
        combinationNumber: combination.combinationNumber,
        label: combinationGuide.label,
        source: DICTIONARY_SOURCE,
        coverage,
        combinationGuide,
      };
    })
    .filter(Boolean)
    .sort((first, second) => (
      second.coverage.swatchCount - first.coverage.swatchCount
      || second.coverage.pieceCount - first.coverage.pieceCount
      || first.coverage.averageDistance - second.coverage.averageDistance
      || first.combinationNumber - second.combinationNumber
    ))
    .slice(0, MAX_CANDIDATE_COMBINATIONS);

  return {
    ...emptyLookBuilder(anchorPiece, anchorColour),
    candidates,
    defaultCombinationGuide: candidates[0]?.combinationGuide || null,
  };
}
