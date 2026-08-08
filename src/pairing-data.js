import wadaColors from "dictionary-of-colour-combinations";

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_ANCHOR_DISTANCE = 18;
const MAX_SECONDARY_DISTANCE = 20;
const MAX_WARDROBE_DISTANCE = 22;
const MAX_CANDIDATE_COMBINATIONS = 3;
const MAX_PAIRING_OPTIONS_PER_ROLE = 6;

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

const ROLE_LABELS = {
  top: "Top",
  bottom: "Bottom",
  "one-piece": "One-piece garment",
  footwear: "Footwear",
  layer: "Layer",
  accessory: "Accessory",
};

const SEPARATE_CLOTHING_ROLES = ["top", "bottom"];
const CLOTHING_PATHS = [SEPARATE_CLOTHING_ROLES, ["one-piece"]];
const ALTERNATIVE_CLOTHING_REQUIREMENTS = CLOTHING_PATHS
  .flat()
  .map((wardrobeRole) => ({ wardrobeRole, requirement: "alternative", alternative: "clothing" }));

const ROLE_REQUIREMENTS = {
  top: [
    { wardrobeRole: "bottom", requirement: "required" },
    { wardrobeRole: "footwear", requirement: "required" },
    { wardrobeRole: "layer", requirement: "optional" },
    { wardrobeRole: "accessory", requirement: "optional" },
  ],
  bottom: [
    { wardrobeRole: "top", requirement: "required" },
    { wardrobeRole: "footwear", requirement: "required" },
    { wardrobeRole: "layer", requirement: "optional" },
    { wardrobeRole: "accessory", requirement: "optional" },
  ],
  "one-piece": [
    { wardrobeRole: "footwear", requirement: "required" },
    { wardrobeRole: "layer", requirement: "optional" },
    { wardrobeRole: "accessory", requirement: "optional" },
  ],
  footwear: [
    ...ALTERNATIVE_CLOTHING_REQUIREMENTS,
    { wardrobeRole: "layer", requirement: "optional" },
    { wardrobeRole: "accessory", requirement: "optional" },
  ],
  layer: [
    ...ALTERNATIVE_CLOTHING_REQUIREMENTS,
    { wardrobeRole: "footwear", requirement: "required" },
    { wardrobeRole: "accessory", requirement: "optional" },
  ],
  accessory: [
    ...ALTERNATIVE_CLOTHING_REQUIREMENTS,
    { wardrobeRole: "footwear", requirement: "required" },
    { wardrobeRole: "layer", requirement: "optional" },
  ],
};

export function getWardrobeRole(item) {
  switch (item?.part) {
    case "upperbody": return "top";
    case "lowerbody": return "bottom";
    case "onepiece":
    case "one-piece":
    case "wholebody":
    case "wholebody_down": return "one-piece";
    case "shoes": return "footwear";
    case "wholebody_up": return "layer";
    case "accessories_up": return "accessory";
    default: return null;
  }
}

function searchableGarmentText(item) {
  return `${item?.name || ""} ${(item?.tags || []).join(" ")}`.toLowerCase();
}

function itemContext(item) {
  const text = searchableGarmentText(item);
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

function secondaryCombinationDistance(secondaryColour, combination) {
  if (!secondaryColour) return Number.POSITIVE_INFINITY;
  const mapping = closestMapping([secondaryColour], combination.colours);
  return mapping && mapping.distance <= MAX_SECONDARY_DISTANCE ? mapping.distance : null;
}

function supportingNeutral(item) {
  const text = searchableGarmentText(item);
  const namedNeutral = ["black", "white", "cream", "grey", "gray", "brown"]
    .find((neutral) => new RegExp(`\\b${neutral}\\b`).test(text));
  const primary = garmentColours(item)[0];
  if (!primary) return null;
  const chroma = Math.sqrt((primary.lab.a ** 2) + (primary.lab.b ** 2));
  const { lightness, a, b } = primary.lab;
  const normalizedName = namedNeutral === "gray" ? "grey" : namedNeutral;
  const namedNeutralFitsColour = {
    black: lightness <= 28 && chroma <= 25,
    white: lightness >= 82 && chroma <= 18,
    cream: lightness >= 75 && b >= 3 && chroma <= 30,
    grey: chroma <= 14,
    brown: lightness >= 15 && lightness <= 70 && a >= 2 && b >= 4 && chroma <= 50,
  };
  if (normalizedName && namedNeutralFitsColour[normalizedName]) return normalizedName;

  if (lightness <= 12 && chroma <= 8) return "black";
  if (primary.lab.lightness >= 94 && chroma <= 8) return "white";
  if (chroma <= 7) return "grey";
  return null;
}

function dictionaryGarmentMapping(item, combination, anchorMapping) {
  const [primaryColour, secondaryColour] = garmentColours(item);
  if (!primaryColour) return null;

  const targetColours = combination.colours.filter(({ index }) => index !== anchorMapping.index);
  const primaryMapping = closestMapping([primaryColour], targetColours);
  if (!primaryMapping || primaryMapping.distance > MAX_WARDROBE_DISTANCE) return null;

  let secondaryMapping = null;
  if (secondaryColour) {
    secondaryMapping = closestMapping([secondaryColour], combination.colours);
    if (!secondaryMapping || secondaryMapping.distance > MAX_SECONDARY_DISTANCE) return null;
  }

  const secondaryStrength = secondaryMapping
    ? (MAX_SECONDARY_DISTANCE - secondaryMapping.distance) / MAX_SECONDARY_DISTANCE
    : 0;
  return {
    primaryMapping,
    secondaryMapping,
    rank: primaryMapping.distance - secondaryStrength,
  };
}

function pairingOption(item, wardrobeRole, combination, anchorMapping) {
  const [primaryColour, secondaryColour] = garmentColours(item);
  const neutralName = supportingNeutral(item);
  const base = {
    pieceId: item.id,
    pieceName: item.name || ROLE_LABELS[wardrobeRole],
    image: item.image,
    thumbnail: item.thumbnail,
    wardrobeRole,
    roleLabel: ROLE_LABELS[wardrobeRole],
    referenceCombinationNumber: combination.combinationNumber,
  };

  if (neutralName) {
    if (secondaryColour) {
      const secondaryMapping = closestMapping([secondaryColour], combination.colours);
      if (!secondaryMapping || secondaryMapping.distance > MAX_SECONDARY_DISTANCE) return null;
    }
    return {
      ...base,
      rank: Number.POSITIVE_INFINITY,
      mapping: {
        kind: "supporting-neutral",
        garmentHex: primaryColour?.hex || null,
        label: "Supporting Neutral",
        neutralName,
      },
    };
  }

  const garmentMapping = dictionaryGarmentMapping(item, combination, anchorMapping);
  if (!garmentMapping) return null;
  const { primaryMapping, rank } = garmentMapping;

  return {
    ...base,
    rank,
    mapping: {
      kind: "dictionary",
      garmentHex: primaryMapping.source.hex,
      dictionaryColourName: primaryMapping.target.name,
      dictionaryHex: primaryMapping.target.hex,
      relationship: "closest to",
      distance: primaryMapping.distance,
    },
  };
}

function buildPairingOptionGroups(anchorPiece, wardrobe, combination, anchorMapping) {
  const anchorRole = getWardrobeRole(anchorPiece);
  const requirements = ROLE_REQUIREMENTS[anchorRole] || [];

  return requirements
    .map((requirement) => {
      // Context is deliberately evaluated before any perceptual colour ranking.
      const allOptions = wardrobe
        .filter((candidate) => (
          candidate.id !== anchorPiece.id
          && getWardrobeRole(candidate) === requirement.wardrobeRole
          && canPairByContext(anchorPiece, candidate)
        ))
        .map((candidate) => pairingOption(candidate, requirement.wardrobeRole, combination, anchorMapping))
        .filter(Boolean)
        .sort((first, second) => (
          first.rank - second.rank
          || first.pieceName.localeCompare(second.pieceName)
          || String(first.pieceId).localeCompare(String(second.pieceId))
        ))
        .map(({ rank: _rank, ...option }) => option);

      return {
        ...requirement,
        label: ROLE_LABELS[requirement.wardrobeRole],
        options: allOptions.slice(0, MAX_PAIRING_OPTIONS_PER_ROLE),
        allOptions,
        totalOptionCount: allOptions.length,
        hasMore: allOptions.length > MAX_PAIRING_OPTIONS_PER_ROLE,
      };
    })
    .filter(({ requirement, options }) => requirement !== "optional" || options.length > 0)
    .sort((first, second) => (
      Number(first.requirement === "optional") - Number(second.requirement === "optional")
    ));
}

function wardrobeCoverage(anchorPiece, wardrobe, combination, anchorMapping) {
  const targetColours = combination.colours.filter(({ index }) => index !== anchorMapping.index);
  if (!targetColours.length) return null;

  const allowedRoles = new Set((ROLE_REQUIREMENTS[getWardrobeRole(anchorPiece)] || []).map(({ wardrobeRole }) => wardrobeRole));

  const pieceMappings = wardrobe
    .filter((candidate) => (
      candidate.id !== anchorPiece.id
      && allowedRoles.has(getWardrobeRole(candidate))
      && canPairByContext(anchorPiece, candidate)
      && !supportingNeutral(candidate)
    ))
    .map((candidate) => {
      const garmentMapping = dictionaryGarmentMapping(candidate, combination, anchorMapping);
      if (!garmentMapping) return null;
      const { primaryMapping, rank } = garmentMapping;
      return {
        pieceId: candidate.id,
        colourIndex: primaryMapping.target.index,
        colourName: primaryMapping.target.name,
        distance: rank,
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
    .map((combination) => {
      const anchorSecondaryDistance = secondaryCombinationDistance(secondaryColour, combination);
      if (anchorSecondaryDistance === null) return null;
      const coverage = wardrobeCoverage(anchorPiece, wardrobe, combination, anchorMapping);
      if (!coverage) return null;
      const combinationGuide = buildCombinationGuide(combination, anchorColour);
      return {
        combinationNumber: combination.combinationNumber,
        label: combinationGuide.label,
        source: DICTIONARY_SOURCE,
        coverage,
        anchorSecondaryDistance,
        combinationGuide,
        pairingOptionGroups: buildPairingOptionGroups(anchorPiece, wardrobe, combination, anchorMapping),
      };
    })
    .filter(Boolean)
    .sort((first, second) => (
      second.coverage.swatchCount - first.coverage.swatchCount
      || second.coverage.pieceCount - first.coverage.pieceCount
      || first.coverage.averageDistance - second.coverage.averageDistance
      || first.anchorSecondaryDistance - second.anchorSecondaryDistance
      || first.combinationNumber - second.combinationNumber
    ))
    .slice(0, MAX_CANDIDATE_COMBINATIONS)
    .map(({ anchorSecondaryDistance: _anchorSecondaryDistance, ...candidate }) => candidate);

  return {
    ...emptyLookBuilder(anchorPiece, anchorColour),
    candidates,
    defaultCombinationGuide: candidates[0]?.combinationGuide || null,
  };
}

export function createCompleteLook(anchorPiece, referenceCombinationNumber) {
  const anchorRole = getWardrobeRole(anchorPiece);
  const selectedByRole = anchorRole ? {
    [anchorRole]: {
      pieceId: anchorPiece.id,
      pieceName: anchorPiece.name || ROLE_LABELS[anchorRole],
      image: anchorPiece.image,
      thumbnail: anchorPiece.thumbnail,
      wardrobeRole: anchorRole,
      roleLabel: ROLE_LABELS[anchorRole],
      referenceCombinationNumber,
      isAnchor: true,
    },
  } : {};

  return {
    anchorPieceId: anchorPiece.id,
    anchorRole,
    referenceCombinationNumber,
    selectedByRole,
  };
}

export function selectPairingOption(completeLook, option) {
  if (
    !completeLook
    || !option?.wardrobeRole
    || option.referenceCombinationNumber !== completeLook.referenceCombinationNumber
    || option.wardrobeRole === completeLook.anchorRole
  ) return completeLook;

  const selectedByRole = { ...completeLook.selectedByRole };
  if (option.wardrobeRole === "one-piece") {
    if (SEPARATE_CLOTHING_ROLES.includes(completeLook.anchorRole)) return completeLook;
    for (const role of SEPARATE_CLOTHING_ROLES) delete selectedByRole[role];
  } else if (SEPARATE_CLOTHING_ROLES.includes(option.wardrobeRole)) {
    if (completeLook.anchorRole === "one-piece") return completeLook;
    delete selectedByRole["one-piece"];
  }
  selectedByRole[option.wardrobeRole] = { ...option, isAnchor: false };

  return { ...completeLook, selectedByRole };
}

export function switchReferenceCombination(completeLook, referenceCombination) {
  if (!completeLook) {
    return { completeLook, retainedSelections: [], removedSelections: [] };
  }

  const referenceCombinationNumber = referenceCombination?.combinationNumber || null;
  const validOptionsByRole = new Map((referenceCombination?.pairingOptionGroups || []).map((group) => [
    group.wardrobeRole,
    new Map(group.allOptions.map((option) => [option.pieceId, option])),
  ]));
  const selectedByRole = {};
  const retainedSelections = [];
  const removedSelections = [];

  for (const [wardrobeRole, selection] of Object.entries(completeLook.selectedByRole || {})) {
    if (selection.isAnchor) {
      selectedByRole[wardrobeRole] = { ...selection, referenceCombinationNumber };
      continue;
    }

    const retainedOption = referenceCombination
      ? validOptionsByRole.get(wardrobeRole)?.get(selection.pieceId)
      : null;
    if (retainedOption) {
      selectedByRole[wardrobeRole] = { ...retainedOption, isAnchor: false };
      retainedSelections.push(selectedByRole[wardrobeRole]);
      continue;
    }

    const roleLabel = selection.roleLabel || ROLE_LABELS[wardrobeRole] || wardrobeRole;
    removedSelections.push({
      pieceId: selection.pieceId,
      pieceName: selection.pieceName,
      wardrobeRole,
      roleLabel,
      reason: referenceCombination
        ? `${selection.pieceName} is not a valid ${roleLabel} Pairing Option for Combination ${referenceCombinationNumber}.`
        : `${selection.pieceName} was removed because no Candidate Combination is available for this Anchor Piece.`,
    });
  }

  return {
    completeLook: {
      ...completeLook,
      referenceCombinationNumber,
      selectedByRole,
    },
    retainedSelections,
    removedSelections,
  };
}

function missingWearableCoreRoles(presentByRole) {
  const missingRequiredRoles = [];
  const hasClothing = CLOTHING_PATHS.some((path) => path.every((role) => presentByRole[role]));

  if (!hasClothing) {
    if (presentByRole.top) missingRequiredRoles.push("Bottom");
    else if (presentByRole.bottom) missingRequiredRoles.push("Top");
    else missingRequiredRoles.push("Top and bottom, or a one-piece garment");
  }
  if (!presentByRole.footwear) missingRequiredRoles.push("Footwear");

  return missingRequiredRoles;
}

export function getWearableCoreStatus(completeLook, referenceCombination = null) {
  const selectedByRole = completeLook?.selectedByRole || {};
  const missingRequiredRoles = missingWearableCoreRoles(selectedByRole);
  const availableByRole = referenceCombination ? { [completeLook?.anchorRole]: true } : null;

  for (const group of referenceCombination?.pairingOptionGroups || []) {
    if (group.allOptions.length) availableByRole[group.wardrobeRole] = true;
  }

  const unavailableRequiredRoles = availableByRole
    ? missingWearableCoreRoles(availableByRole)
    : [];

  const isWearableCore = missingRequiredRoles.length === 0;
  const expressesReferenceCombination = Object.values(selectedByRole).some((selection) => (
    !selection.isAnchor
    && selection.referenceCombinationNumber === completeLook?.referenceCombinationNumber
    && selection.mapping?.kind === "dictionary"
  ));
  const blockers = [];
  if (unavailableRequiredRoles.length) {
    blockers.push(`No Pairing Options are available for ${unavailableRequiredRoles.join(" and ")} in Combination ${completeLook?.referenceCombinationNumber}.`);
  }
  const selectableMissingRoles = missingRequiredRoles.filter((role) => !unavailableRequiredRoles.includes(role));
  if (selectableMissingRoles.length) blockers.push(`Add ${selectableMissingRoles.join(" and ")}.`);
  if (!expressesReferenceCombination) {
    blockers.push(`Choose at least one Pairing Option mapped to Combination ${completeLook?.referenceCombinationNumber}.`);
  }

  const canSave = isWearableCore && expressesReferenceCombination;
  const isIncompleteCombination = !canSave && unavailableRequiredRoles.length > 0;
  return {
    kind: canSave ? "complete-look" : isIncompleteCombination ? "incomplete-combination" : "builder-progress",
    label: canSave ? "Complete Look" : isIncompleteCombination ? "Incomplete Combination" : "Build your Complete Look",
    isWearableCore,
    expressesReferenceCombination,
    canSave,
    unavailableRequiredRoles,
    missingRequiredRoles,
    blockers,
  };
}
