export const SAVED_OUTFITS_STORAGE_KEY = "open-wardrobe-saved-outfits-v1";

const GENERATION_STATES = new Set(["generating", "ready", "failed"]);

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function savedOutfitId() {
  if (globalThis.crypto?.randomUUID) return `saved-${globalThis.crypto.randomUUID()}`;
  return `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function selectedGarmentSnapshot(selection) {
  return {
    pieceId: selection.pieceId,
    pieceName: selection.pieceName,
    wardrobeRole: selection.wardrobeRole,
    roleLabel: selection.roleLabel,
    isAnchor: Boolean(selection.isAnchor),
  };
}

function normaliseSavedOutfit(value) {
  if (!value || typeof value !== "object" || typeof value.id !== "string" || typeof value.createdAt !== "string") return null;
  const selectedGarmentsByRole = value.selectedGarmentsByRole && typeof value.selectedGarmentsByRole === "object"
    ? value.selectedGarmentsByRole
    : {};
  const generation = value.generation && typeof value.generation === "object" ? value.generation : {};
  const status = GENERATION_STATES.has(generation.status) ? generation.status : "generating";

  return {
    ...value,
    sourceType: "saved",
    garmentIds: Array.isArray(value.garmentIds) ? value.garmentIds : Object.values(selectedGarmentsByRole)
      .map((selection) => selection?.pieceId)
      .filter(Boolean),
    selectedGarmentsByRole,
    colourMappings: value.colourMappings && typeof value.colourMappings === "object" ? value.colourMappings : {},
    generation: { ...generation, status },
  };
}

export function createSavedOutfit(completeLook, referenceCombination, options = {}) {
  const createdAt = options.now || new Date().toISOString();
  const selections = Object.entries(completeLook?.selectedByRole || {});
  const selectedGarmentsByRole = Object.fromEntries(selections.map(([role, selection]) => [
    role,
    selectedGarmentSnapshot(selection),
  ]));
  const colourMappings = Object.fromEntries(selections
    .filter(([, selection]) => selection.mapping)
    .map(([role, selection]) => [role, copy(selection.mapping)]));
  const guide = referenceCombination?.combinationGuide || {};
  if (completeLook?.anchorRole && guide.anchorColour) {
    colourMappings[completeLook.anchorRole] = copy({
      kind: "dictionary",
      ...guide.anchorColour,
    });
  }

  return {
    id: options.id || savedOutfitId(),
    sourceType: "saved",
    createdAt,
    anchorPieceId: completeLook?.anchorPieceId || null,
    anchorRole: completeLook?.anchorRole || null,
    anchorPiece: selectedGarmentsByRole[completeLook?.anchorRole] || null,
    garmentIds: selections.map(([, selection]) => selection.pieceId),
    selectedGarmentsByRole,
    referenceCombination: {
      combinationNumber: referenceCombination?.combinationNumber || completeLook?.referenceCombinationNumber || null,
      label: referenceCombination?.label || "Dictionary Combination",
      source: referenceCombination?.source || "A Dictionary of Color Combinations Vol. 1",
      guide: {
        swatches: copy(guide.swatches || []),
        anchorColour: copy(guide.anchorColour || null),
      },
    },
    colourMappings,
    generation: {
      status: "generating",
      startedAt: createdAt,
      error: null,
    },
    name: "Saved outfit",
    reason: "Your modeled preview is being generated.",
    image: null,
  };
}

export function readSavedOutfits(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SAVED_OUTFITS_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map(normaliseSavedOutfit)
      .filter(Boolean)
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  } catch {
    return [];
  }
}

export function writeSavedOutfits(outfits, storage = globalThis.localStorage) {
  storage?.setItem(SAVED_OUTFITS_STORAGE_KEY, JSON.stringify(outfits));
}

function normaliseCuratedOutfit(outfit) {
  return {
    ...outfit,
    sourceType: "curated",
    garmentIds: Array.isArray(outfit.garmentIds) ? outfit.garmentIds : [],
    generation: { status: "ready" },
  };
}

export function readOutfitCollection(curatedOutfits, storage = globalThis.localStorage) {
  return {
    saved: readSavedOutfits(storage),
    curated: (Array.isArray(curatedOutfits) ? curatedOutfits : []).map(normaliseCuratedOutfit),
  };
}
