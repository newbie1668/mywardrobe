function joinWords(values) {
  if (values.length < 2) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function grammar(values, singular, plural) {
  return values.length === 1 ? singular : plural;
}

function mappingLabel(mapping) {
  if (mapping?.kind === "dictionary") return mapping.dictionaryColourName || null;
  if (mapping?.kind === "supporting-neutral") return "Supporting Neutral";
  return null;
}

/**
 * The narrow, serialisable input for a future text provider. It intentionally
 * excludes tags, occasions, and image analysis so generated copy remains tied
 * only to the persisted Saved Outfit and its Reference Combination.
 */
export function groundedOutfitCopyInput(outfit) {
  const garments = Object.values(outfit?.selectedGarmentsByRole || {})
    .map((selection) => ({
      name: selection?.pieceName || selection?.roleLabel || "Wardrobe piece",
      role: selection?.roleLabel || selection?.wardrobeRole || "Wardrobe role",
      mapping: mappingLabel(outfit?.colourMappings?.[selection?.wardrobeRole]) || "Unmapped",
    }));

  return {
    combinationNumber: outfit?.referenceCombination?.combinationNumber || null,
    garments,
  };
}

/**
 * A deterministic stand-in for text generation. It gives the UI a real
 * asynchronous lifecycle and an injectable seam without sending wardrobe data
 * to a provider or inventing occasions, details, or styling claims.
 */
export function createGroundedOutfitCopy(outfit) {
  const input = groundedOutfitCopyInput(outfit);
  const namedGarments = input.garments.filter((garment) => garment.name !== "Wardrobe piece");
  const dictionaryGarments = namedGarments.filter(({ mapping }) => mapping !== "Supporting Neutral" && mapping !== "Unmapped");
  const neutrals = namedGarments.filter(({ mapping }) => mapping === "Supporting Neutral");
  const combination = input.combinationNumber ? `Dictionary Vol. 1 · Combination ${input.combinationNumber}` : "Dictionary Vol. 1";
  const sentences = [];

  if (dictionaryGarments.length) {
    const names = dictionaryGarments.map(({ name }) => name);
    const mappings = dictionaryGarments.map(({ mapping }) => mapping);
    sentences.push(`${joinWords(names)} ${grammar(names, "maps", "map")} closest to ${joinWords(mappings)} in ${combination}.`);
  } else if (namedGarments.length) {
    sentences.push(`${joinWords(namedGarments.map(({ name }) => name))} ${grammar(namedGarments, "is", "are")} saved with ${combination}.`);
  }

  if (neutrals.length) {
    const names = neutrals.map(({ name }) => name);
    sentences.push(`${joinWords(names)} ${grammar(names, "is a", "are")} Supporting ${grammar(names, "Neutral", "Neutrals")}.`);
  }

  return {
    name: dictionaryGarments.length
      ? `${dictionaryGarments[0].name} · closest to ${dictionaryGarments[0].mapping}`
      : namedGarments[0]?.name || "Saved outfit",
    description: sentences.join(" ") || `Saved with ${combination}.`,
  };
}
