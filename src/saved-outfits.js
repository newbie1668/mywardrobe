export const SAVED_OUTFITS_STORAGE_KEY = "open-wardrobe-saved-outfits-v1";

const GENERATION_STATES = new Set(["generating", "ready", "failed"]);
const COPY_GENERATION_STATES = new Set(["generating", "ready", "failed"]);

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
  const copyGeneration = value.copyGeneration && typeof value.copyGeneration === "object" ? value.copyGeneration : {};
  const copyStatus = COPY_GENERATION_STATES.has(copyGeneration.status) ? copyGeneration.status : "generating";
  const description = typeof value.description === "string" ? value.description : "";
  const hasCustomName = value.nameSource === "user" || (value.name && value.name !== "Saved outfit" && !value.nameSource);

  return {
    ...value,
    sourceType: "saved",
    garmentIds: Array.isArray(value.garmentIds) ? value.garmentIds : Object.values(selectedGarmentsByRole)
      .map((selection) => selection?.pieceId)
      .filter(Boolean),
    selectedGarmentsByRole,
    colourMappings: value.colourMappings && typeof value.colourMappings === "object" ? value.colourMappings : {},
    generation: { ...generation, status },
    copyGeneration: {
      ...copyGeneration,
      status: copyStatus,
      startedAt: copyGeneration.startedAt || value.createdAt,
      error: copyStatus === "failed" ? copyGeneration.error || "Outfit details could not be generated." : null,
    },
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Saved outfit",
    nameSource: hasCustomName ? "user" : value.nameSource === "generated" || description ? "generated" : "pending",
    description,
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
    nameSource: "pending",
    description: "",
    copyGeneration: {
      status: "generating",
      startedAt: createdAt,
      error: null,
    },
    reason: "Your modeled preview is being generated.",
    image: null,
  };
}

function cleanCopy(copy) {
  return {
    name: typeof copy?.name === "string" ? copy.name.trim() : "",
    description: typeof copy?.description === "string" ? copy.description.trim() : "",
  };
}

export function completeSavedOutfitCopy(outfit, copy, completedAt = new Date().toISOString()) {
  const nextCopy = cleanCopy(copy);
  const preserveUserName = outfit?.nameSource === "user";
  return {
    ...outfit,
    name: preserveUserName || !nextCopy.name ? outfit.name : nextCopy.name,
    nameSource: preserveUserName ? "user" : "generated",
    description: nextCopy.description || outfit.description || "",
    copyGeneration: {
      ...outfit.copyGeneration,
      status: "ready",
      completedAt,
      error: null,
    },
  };
}

export function failSavedOutfitCopy(outfit, error, failedAt = new Date().toISOString()) {
  return {
    ...outfit,
    copyGeneration: {
      ...outfit.copyGeneration,
      status: "failed",
      failedAt,
      error: error?.message || "Outfit details could not be generated.",
    },
  };
}

export function retrySavedOutfitCopy(outfit, startedAt = new Date().toISOString()) {
  return {
    ...outfit,
    copyGeneration: {
      status: "generating",
      startedAt,
      error: null,
    },
  };
}

export async function generateSavedOutfitCopy(outfit, generator, completedAt = new Date().toISOString()) {
  try {
    return completeSavedOutfitCopy(outfit, await generator(outfit), completedAt);
  } catch (error) {
    return failSavedOutfitCopy(outfit, error, completedAt);
  }
}

export function renameSavedOutfit(outfit, name, renamedAt = new Date().toISOString()) {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) return outfit;
  return {
    ...outfit,
    name: trimmedName,
    nameSource: "user",
    renamedAt,
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
