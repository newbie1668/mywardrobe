import wadaColors from "dictionary-of-colour-combinations";

const HEX = /^#[0-9a-f]{6}$/i;
const MATCH_SCORING = {
  candidateSecondaryPenalty: 5,
  paletteSizeWeight: 0.35,
  seasonalAnchorWeight: 0.65,
  seasonalCandidateWeight: 0.9,
  seasonalBias: 4,
  secondaryAnchorPenalty: 10,
  partPenalty: 2.2,
};

// These are a small seasonal lens inspired by the Vol. 2 idea, using familiar
// Japanese color names as an editorial bridge. The open Vol. 1 dataset below
// remains the primary matching source; this layer is intentionally not
// presented as a copy of the book's paid digital collection.
const SEASONAL_PALETTES = [
  {
    id: "seasonal-spring",
    name: "Spring / Sakura and young leaves",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Sakura-iro", hex: "#fef4f4" },
      { name: "Kurenai", hex: "#cb1b45" },
      { name: "Moegi", hex: "#5b8930" },
      { name: "Ai-iro", hex: "#165e83" },
    ],
  },
  {
    id: "seasonal-plum",
    name: "Late spring / Plum blossom",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Kōbai", hex: "#e16b8c" },
      { name: "Ume", hex: "#d05a6e" },
      { name: "Wakakusa", hex: "#c7d14f" },
      { name: "Nando-iro", hex: "#0089a7" },
    ],
  },
  {
    id: "seasonal-early-summer",
    name: "Early summer / Clear water",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Shinbashi-iro", hex: "#6fb7b7" },
      { name: "Mizu-asagi", hex: "#80aba9" },
      { name: "Kinari", hex: "#fbfaf5" },
      { name: "Kobicha", hex: "#6b4423" },
    ],
  },
  {
    id: "seasonal-midsummer",
    name: "Midsummer / Indigo and sun",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Ai-iro", hex: "#165e83" },
      { name: "Ruri", hex: "#1e50a2" },
      { name: "Kitsune-iro", hex: "#9b6e23" },
      { name: "Shiro", hex: "#ffffff" },
    ],
  },
  {
    id: "seasonal-lotus",
    name: "Midsummer / Lotus and shade",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Hasu-iro", hex: "#e3b4b8" },
      { name: "Matsuba-iro", hex: "#454d32" },
      { name: "Nibi", hex: "#727171" },
      { name: "Kujaku-ao", hex: "#007b87" },
    ],
  },
  {
    id: "seasonal-autumn",
    name: "Autumn / Persimmon and moss",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Kaki-iro", hex: "#ed6d3d" },
      { name: "Karakurenai", hex: "#d0104c" },
      { name: "Matsuba-iro", hex: "#454d32" },
      { name: "Kuri-iro", hex: "#762f07" },
    ],
  },
  {
    id: "seasonal-maple",
    name: "Autumn / Maple and stone",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Momiji", hex: "#b33e5c" },
      { name: "Akakuchiba", hex: "#db8449" },
      { name: "Nezumi", hex: "#787878" },
      { name: "Kitsune-iro", hex: "#9b6e23" },
    ],
  },
  {
    id: "seasonal-winter",
    name: "Winter / Ink and snow",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Kuro", hex: "#2b2b2b" },
      { name: "Ginnezu", hex: "#c0c0c0" },
      { name: "Ai-iro", hex: "#165e83" },
      { name: "Shiro", hex: "#ffffff" },
    ],
  },
  {
    id: "seasonal-winter-plum",
    name: "Winter / Plum and charcoal",
    source: "Vol. 2-inspired seasonal lens",
    colors: [
      { name: "Suō", hex: "#8e354a" },
      { name: "Kokushoku", hex: "#171412" },
      { name: "Usuzumi", hex: "#887f7a" },
      { name: "Kinari", hex: "#fbfaf5" },
    ],
  },
];

function hexToRgb(hex) {
  if (!HEX.test(hex)) return null;
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
  const y = ((red * 0.2126) + (green * 0.7152) + (blue * 0.0722)) / 1;
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

const WADA_COLORS = wadaColors
  .map((color, index) => ({ index, name: color.name, hex: color.hex, lab: rgbToLab(color.hex) }))
  .filter((color) => color.lab);

const WADA_PALETTES = [...wadaColors.reduce((map, color, colorIndex) => {
  for (const combination of color.combinations || []) {
    const palette = map.get(combination) || { id: combination, source: "Vol. 1", name: `Plate ${combination}`, colors: [] };
    if (!palette.colors.some((entry) => entry.index === colorIndex)) {
      palette.colors.push({ index: colorIndex, name: color.name, hex: color.hex, lab: rgbToLab(color.hex) });
    }
    map.set(combination, palette);
  }
  return map;
}, new Map()).values()].sort((first, second) => first.id - second.id);

const WADA_PALETTES_BY_COLOR = new Map();
for (const palette of WADA_PALETTES) {
  for (const color of palette.colors) {
    const palettes = WADA_PALETTES_BY_COLOR.get(color.index) || [];
    palettes.push(palette);
    WADA_PALETTES_BY_COLOR.set(color.index, palettes);
  }
}

function nearestWadaColor(hex) {
  const lab = rgbToLab(hex);
  if (!lab) return null;
  return WADA_COLORS.reduce((closest, color) => {
    const distance = labDistance(lab, color.lab);
    return !closest || distance < closest.distance ? { ...color, distance } : closest;
  }, null);
}

function itemColors(item) {
  const colors = [];
  for (const [role, hex] of [["primary", item?.color], ["secondary", item?.secondaryColor]]) {
    if (!HEX.test(hex || "") || colors.some((color) => color.hex === hex.toLowerCase())) continue;
    const lab = rgbToLab(hex);
    if (lab) colors.push({ hex: hex.toLowerCase(), lab, role });
  }
  return colors;
}

function closestColorPair(sourceColors, targetColors) {
  let closest = null;
  for (const source of sourceColors) {
    for (const target of targetColors) {
      const distance = labDistance(source.lab, target.lab)
        + (source.role === "secondary" ? MATCH_SCORING.candidateSecondaryPenalty : 0);
      if (!closest || distance < closest.distance) closest = { source, target, distance };
    }
  }
  return closest;
}

function bestClassicMatch(anchors, candidateColors) {
  let best = null;
  for (const anchor of anchors) {
    for (const palette of WADA_PALETTES_BY_COLOR.get(anchor.index) || []) {
      const targets = palette.colors.filter((color) => color.index !== anchor.index);
      const match = closestColorPair(candidateColors, targets);
      if (!match) continue;
      const score = match.distance
        + (anchor.role === "secondary" ? MATCH_SCORING.secondaryAnchorPenalty : 0)
        + (palette.colors.length * MATCH_SCORING.paletteSizeWeight);
      if (!best || score < best.score) {
        best = { ...match, score, palette, source: "Vol. 1", anchor };
      }
    }
  }
  return best;
}

function bestSeasonalMatch(selectedColors, candidateColors) {
  let best = null;
  for (const palette of SEASONAL_PALETTES) {
    const anchor = closestColorPair(selectedColors, palette.colors.map((color) => ({ ...color, lab: rgbToLab(color.hex) })));
    if (!anchor) continue;
    const targets = palette.colors.filter((color) => color.hex.toLowerCase() !== anchor.target.hex.toLowerCase())
      .map((color) => ({ ...color, lab: rgbToLab(color.hex) }));
    const match = closestColorPair(candidateColors, targets);
    if (!match) continue;
    const score = (anchor.distance * MATCH_SCORING.seasonalAnchorWeight)
      + (match.distance * MATCH_SCORING.seasonalCandidateWeight)
      + (anchor.source?.role === "secondary" ? MATCH_SCORING.secondaryAnchorPenalty : 0)
      + MATCH_SCORING.seasonalBias;
    if (!best || score < best.score) {
      best = { ...match, score, palette, source: "Vol. 2-inspired seasonal lens", anchorDistance: anchor.distance, anchor };
    }
  }
  return best;
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

function canPairByContext(selected, candidate) {
  const selectedContext = itemContext(selected);
  const candidateContext = itemContext(candidate);

  // Swimwear needs a visible beach/resort/summer cue on the other piece.
  if (selectedContext.swim !== candidateContext.swim) {
    if (!selectedContext.summer || !candidateContext.summer) return false;
  }

  // Keep formal tailoring away from obvious sportswear and novelty graphics.
  if ((selectedContext.formal && candidateContext.athletic) || (candidateContext.formal && selectedContext.athletic)) return false;
  if ((selectedContext.formal && candidateContext.graphic) || (candidateContext.formal && selectedContext.graphic)) return false;

  return true;
}

export function getPairingRecommendations(item, items) {
  if (!item) return null;
  const selectedColors = itemColors(item);
  const anchors = selectedColors
    .map((color) => {
      const nearest = nearestWadaColor(color.hex);
      return nearest ? { ...nearest, role: color.role } : null;
    })
    .filter(Boolean);
  if (!selectedColors.length || !anchors.length) return { anchors: [], reference: null, suggestions: [] };

  const preferredParts = COMPLEMENTARY_PARTS[item.part] || Object.keys(COMPLEMENTARY_PARTS);
  const suggestions = items
    .filter((candidate) => candidate.id !== item.id && preferredParts.includes(candidate.part) && canPairByContext(item, candidate))
    .map((candidate) => {
      const candidateColors = itemColors(candidate);
      const classic = bestClassicMatch(anchors, candidateColors);
      const seasonal = bestSeasonalMatch(selectedColors, candidateColors);
      const match = classic && seasonal ? (classic.score <= seasonal.score ? classic : seasonal) : classic || seasonal;
      if (!match) return null;
      const partPenalty = Math.max(0, preferredParts.indexOf(candidate.part)) * MATCH_SCORING.partPenalty;
      return {
        item: candidate,
        match,
        score: match.score + partPenalty,
        matchedColor: match.target,
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.score - second.score || first.item.name.localeCompare(second.item.name))
    .slice(0, 6);

  return {
    anchors,
    reference: WADA_PALETTES_BY_COLOR.get(anchors[0].index)?.[0] || suggestions[0]?.match?.palette || null,
    suggestions,
  };
}

export const PAIRING_ATTRIBUTION = "Wada Sanzo, A Dictionary of Color Combinations Vol. 1; Vol. 2-inspired seasonal lens; Japanese traditional color names.";
