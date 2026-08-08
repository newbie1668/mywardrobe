const previewIllustration = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="Illustrated outfit preview">
    <defs>
      <linearGradient id="background" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f9c1ce"/><stop offset="1" stop-color="#fdd4bd"/></linearGradient>
    </defs>
    <rect width="800" height="1000" fill="url(#background)"/>
    <circle cx="400" cy="230" r="105" fill="#c58e72"/>
    <path d="M260 360c58-55 222-55 280 0l55 305H205z" fill="#f9c1ce"/>
    <path d="M285 665h230l58 240H227z" fill="#fdd4bd"/>
    <path d="M245 905h120v40H220zM435 905h120v40H435z" fill="#171717"/>
    <text x="400" y="80" text-anchor="middle" fill="#171717" font-family="sans-serif" font-size="22" letter-spacing="4">WARDROBE PREVIEW</text>
  </svg>` )}`;

function garment(id, name, part, color, secondaryColor = null) {
  return {
    id,
    name,
    part,
    color,
    secondaryColor,
    tags: ["demo", "casual"],
    image: previewIllustration,
    thumbnail: previewIllustration,
  };
}

const wardrobe = [
  garment("demo-anchor", "Rose shirt", "upperbody", "#f9c1ce"),
  garment("demo-bottom", "Seashell trousers", "lowerbody", "#fdd4bd"),
  garment("demo-shoes", "Black loafers", "shoes", "#111111"),
  garment("demo-layer", "Seashell overshirt", "wholebody_up", "#fdd4bd"),
  garment("demo-accessory", "Calamine scarf", "accessories_up", "#78cdd0"),
];

const curatedOutfits = [{
  id: "demo-curated",
  name: "Preview gallery look",
  image: previewIllustration,
  reason: "A fixture look used only for this public preview.",
  garmentIds: ["demo-anchor", "demo-bottom", "demo-shoes"],
}];

export function createPublicPreviewServices() {
  const readCounts = new Map();
  let nextJob = 1;

  return {
    loadWardrobe: async () => wardrobe,
    loadCuratedOutfits: async () => curatedOutfits,
    modeledPreviewService: {
      start: async () => ({ id: `preview-demo-${nextJob++}`, status: "generating", attempts: 1 }),
      read: async (id) => {
        const count = (readCounts.get(id) || 0) + 1;
        readCounts.set(id, count);
        return count === 1
          ? { id, status: "reviewing", attempts: 1 }
          : { id, status: "ready", attempts: 1, image: previewIllustration, review: { accepted: true, reasons: [] } };
      },
    },
    showImportFlow: false,
    previewNotice: "Public fixture preview: no personal wardrobe, identity reference, generated assets, or API key are included.",
  };
}
