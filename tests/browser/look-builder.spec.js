import { expect, test } from "@playwright/test";

const IMAGE = "data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=";

const garment = (id, name, part, color, secondaryColor = null) => ({
  id,
  name,
  part,
  color,
  secondaryColor,
  tags: ["casual"],
  image: IMAGE,
  thumbnail: IMAGE,
});

const wardrobe = [
  garment("anchor", "Hermosa pink shirt", "upperbody", "#f9c1ce"),
  ...Array.from({ length: 8 }, (_, index) => garment(
    `seashell-bottom-${index}`,
    `Seashell bottom ${index}`,
    "lowerbody",
    "#fdd4bd",
  )),
  garment("glaucous-bottom", "Light glaucous trousers", "lowerbody", "#a5c8d1"),
  garment("neutral-shoes", "Black loafers", "shoes", "#111111"),
  garment("layer-one", "Seashell layer one", "wholebody_up", "#fdd4bd"),
  garment("layer-two", "Seashell layer two", "wholebody_up", "#fdd4bd"),
  garment("accessory-one", "Calamine accessory one", "accessories_up", "#78cdd0"),
  garment("accessory-two", "Calamine accessory two", "accessories_up", "#78cdd0"),
];

async function openFixtureLookBuilder(page, fixtureWardrobe = wardrobe, fixtureOutfits = []) {
  await page.addInitScript((image) => {
    if (globalThis.__WARDROBE_TEST_SERVICES__) return;
    let reads = 0;
    globalThis.__WARDROBE_TEST_SERVICES__ = {
      modeledPreviewService: {
        start: async () => ({ id: "preview-test", status: "generating", attempts: 1 }),
        read: async () => {
          reads += 1;
          return reads === 1
            ? { id: "preview-test", status: "reviewing", attempts: 1 }
            : { id: "preview-test", status: "ready", attempts: 1, image, review: { accepted: true, reasons: [] } };
        },
      },
    };
  }, IMAGE);
  await page.route("**/api/import/wardrobe", (route) => route.fulfill({ json: fixtureWardrobe }));
  await page.route("**/api/import/outfits", (route) => route.fulfill({ json: fixtureOutfits }));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => typeof globalThis.__WARDROBE_TEST_SERVICES__?.modeledPreviewService?.start)).toBe("function");
  await page.getByTestId("wardrobe-item-anchor").click();
  await expect(page.getByRole("heading", { name: "Look Builder" })).toBeVisible();
}

function pairingRole(page, name) {
  return page.locator(".pairing-role").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
}

test("retains, removes, swaps, expands, and keeps one active Reference Combination", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await openFixtureLookBuilder(page);

  await expect(page.getByRole("tab", { name: /Combination 176/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Build your Complete Look", { exact: true })).toBeVisible();

  const bottomRole = pairingRole(page, "Bottom");
  const footwearRole = pairingRole(page, "Footwear");
  const layerRole = pairingRole(page, "Layer");
  const accessoryRole = pairingRole(page, "Accessory");
  const firstBottom = bottomRole.getByRole("button", { name: /Seashell bottom 0/ });

  await expect(bottomRole.locator(".pairing-option")).toHaveCount(6);
  await firstBottom.click();
  await footwearRole.getByRole("button", { name: /Black loafers/ }).click();
  await expect(page.getByText("Complete Look", { exact: true })).toBeVisible();

  await layerRole.getByRole("button", { name: /Seashell layer one/ }).click();
  await layerRole.getByRole("button", { name: /Seashell layer two/ }).click();
  await expect(layerRole.locator(".pairing-option.selected")).toHaveCount(1);
  await expect(layerRole.getByRole("button", { name: /Seashell layer two/ })).toHaveAttribute("aria-pressed", "true");

  await accessoryRole.getByRole("button", { name: /Calamine accessory one/ }).click();
  await accessoryRole.getByRole("button", { name: /Calamine accessory two/ }).click();
  await expect(accessoryRole.locator(".pairing-option.selected")).toHaveCount(1);
  await expect(accessoryRole.getByRole("button", { name: /Calamine accessory two/ })).toHaveAttribute("aria-pressed", "true");

  await bottomRole.getByRole("button", { name: /See all \d+ bottom options/ }).click();
  await expect.poll(() => bottomRole.locator(".pairing-option").count()).toBeGreaterThan(6);
  await expect(firstBottom).toHaveAttribute("aria-pressed", "true");

  const replacementBottom = bottomRole.getByRole("button", { name: /Seashell bottom 7/ });
  await replacementBottom.click();
  await expect(firstBottom).toHaveAttribute("aria-pressed", "false");
  await expect(replacementBottom).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("tab", { name: /Combination 227/ }).click();
  const notice = page.getByRole("status").filter({ hasText: "Switched to Combination 227" });
  await expect(notice).toContainText("Seashell bottom 7 is not a valid Bottom Pairing Option for Combination 227.");
  await expect(notice).toContainText("No replacements were selected.");
  await expect(pairingRole(page, "Footwear").getByRole("button", { name: /Black loafers/ })).toHaveAttribute("aria-pressed", "true");
  await expect(pairingRole(page, "Bottom").getByRole("button", { name: /Light glaucous trousers/ })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Build your Complete Look", { exact: true })).toBeVisible();

  await pairingRole(page, "Bottom").getByRole("button", { name: /Light glaucous trousers/ }).click();
  await expect(page.getByText("Complete Look", { exact: true })).toBeVisible();
  const selectedOptionCopy = await page.locator(".pairing-option.selected").allTextContents();
  expect(selectedOptionCopy).not.toHaveLength(0);
  expect(selectedOptionCopy.every((copy) => (
    copy.includes("Combination 227") || copy.includes("Supporting Neutral")
  ))).toBe(true);
  expect(consoleErrors).toEqual([]);
});

test("combination controls and expanded options remain usable without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixtureLookBuilder(page);

  const bottomRole = pairingRole(page, "Bottom");
  await bottomRole.getByRole("button", { name: /See all \d+ bottom options/ }).click();
  await page.getByRole("tab", { name: /Combination 227/ }).click();

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
  await expect(page.getByRole("heading", { name: "Combination 227" })).toBeVisible();
});

test("an Incomplete Combination names the Wardrobe Role the wardrobe cannot supply", async ({ page }) => {
  await openFixtureLookBuilder(page, [
    wardrobe[0],
    garment("only-bottom", "Only Seashell bottom", "lowerbody", "#fdd4bd"),
  ]);

  await expect(page.getByText("Incomplete Combination", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Incomplete Combination" })).toContainText(
    "No Pairing Options are available for Footwear in Combination 176.",
  );
});

test("an anchor edit cannot leave the active Combination and Complete Look out of sync", async ({ page }) => {
  const multicolourWardrobe = [
    garment("anchor", "Hermosa pink shirt", "upperbody", "#f9c1ce", "#fdd4bd"),
    ...wardrobe.slice(1),
  ];
  await openFixtureLookBuilder(page, multicolourWardrobe);

  await page.getByRole("tab", { name: /Combination 227/ }).click();
  await pairingRole(page, "Bottom").getByRole("button", { name: /Light glaucous trousers/ }).click();
  await pairingRole(page, "Footwear").getByRole("button", { name: /Black loafers/ }).click();
  await expect(page.getByText("Complete Look", { exact: true })).toBeVisible();

  await page.getByLabel("Choose secondary color").fill("#00dddd");

  await expect(page.getByRole("tab", { name: /Combination 176/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Combination 227/ })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Switched to Combination 176" })).toBeVisible();
  const selectedOptionCopy = await page.locator(".pairing-option.selected").allTextContents();
  expect(selectedOptionCopy.every((copy) => !copy.includes("Combination 227"))).toBe(true);
});

test("an anchor edit that removes every Candidate Combination explains each cleared selection", async ({ page }) => {
  const multicolourWardrobe = [
    garment("anchor", "Hermosa pink shirt", "upperbody", "#f9c1ce", "#90c5d0"),
    ...wardrobe.slice(1),
  ];
  await openFixtureLookBuilder(page, multicolourWardrobe);

  await page.getByRole("tab", { name: /Combination 176/ }).click();
  await pairingRole(page, "Bottom").getByRole("button", { name: /Seashell bottom 0/ }).click();
  await pairingRole(page, "Footwear").getByRole("button", { name: /Black loafers/ }).click();
  await expect(page.getByText("Complete Look", { exact: true })).toBeVisible();

  await page.getByLabel("Choose secondary color").fill("#d96629");

  await expect(page.getByText(/No Candidate Combinations are both close enough/)).toBeVisible();
  const notice = page.getByRole("status").filter({ hasText: "No Candidate Combination remains" });
  await expect(notice).toContainText("Seashell bottom 0 was removed because no Candidate Combination is available for this Anchor Piece.");
  await expect(notice).toContainText("Black loafers was removed because no Candidate Combination is available for this Anchor Piece.");
  await expect(page.locator(".pairing-option.selected")).toHaveCount(0);
});

test("saving a Complete Look persists a generating Saved Outfit ahead of Curated looks across a restart", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (localStorage.getItem("open-wardrobe-saved-outfits-v1")) return;
    localStorage.setItem("open-wardrobe-saved-outfits-v1", JSON.stringify([{
      id: "saved-earlier",
      sourceType: "saved",
      createdAt: "2026-08-08T12:00:00.000Z",
      garmentIds: ["anchor"],
      selectedGarmentsByRole: {},
      colourMappings: {},
      referenceCombination: { combinationNumber: 176 },
      generation: { status: "failed", error: "Preview could not be generated." },
      name: "Earlier saved outfit",
      reason: "Preview could not be generated.",
    }]));
  });
  await openFixtureLookBuilder(page, wardrobe, [{
    id: "curated-first",
    name: "Existing curated look",
    image: IMAGE,
    reason: "This collection was already here.",
    garmentIds: ["anchor"],
  }]);

  const saveButton = page.getByRole("button", { name: "Save and generate preview" });
  await expect(saveButton).toBeDisabled();
  await pairingRole(page, "Bottom").getByRole("button", { name: /Seashell bottom 0/ }).click();
  await pairingRole(page, "Footwear").getByRole("button", { name: /Black loafers/ }).click();
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect(page.getByRole("tab", { name: /Outfits/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Close viewer" }).click();

  const savedSection = page.getByRole("region", { name: "Saved from your wardrobe" }).getByLabel("Saved from your wardrobe");
  await expect(savedSection.getByRole("button").first()).toContainText("Hermosa pink shirt · closest to Hermosa Pink");
  await expect(savedSection.getByRole("button").nth(1)).toContainText("Earlier saved outfit");
  await expect(savedSection.getByRole("button").nth(1)).toContainText("Preview failed");
  await expect(savedSection).toContainText("Dictionary Vol. 1 · Combination 176");
  await expect(savedSection).toContainText("Your modeled preview is being generated.");
  await expect(savedSection).toContainText("Hermosa pink shirt · closest to Hermosa Pink");
  await expect(savedSection).toContainText("map closest to Hermosa Pink and Seashell Pink");
  await expect(savedSection).toContainText("Reviewing preview");
  await expect(savedSection.locator(".outfit-card-photo img").first()).toBeVisible();
  await expect(savedSection).toContainText("Your Modeled Preview is ready.");
  await savedSection.getByRole("button").first().click();
  await page.getByLabel("Outfit Name").fill("Pink shirt and loafers");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("dialog")).toContainText("Pink shirt and loafers");
  await page.getByRole("button", { name: "Close outfit viewer" }).click();
  await expect(page.getByRole("region", { name: "Curated looks" }).getByLabel("Curated looks")).toContainText("Existing curated look");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  await page.reload();
  await page.getByRole("tab", { name: /Outfits/ }).click();
  await expect(page.getByRole("region", { name: "Saved from your wardrobe" }).getByLabel("Saved from your wardrobe").getByRole("button").first()).toContainText("Pink shirt and loafers");
  await expect(page.getByRole("region", { name: "Curated looks" }).getByLabel("Curated looks")).toContainText("Existing curated look");
  expect(consoleErrors).toEqual([]);
});

test("reconciles a validated Modeled Preview that a prior browser session persisted as failed", async ({ page }) => {
  await page.addInitScript((image) => {
    if (localStorage.getItem("open-wardrobe-saved-outfits-v1")) return;
    localStorage.setItem("open-wardrobe-saved-outfits-v1", JSON.stringify([{
      id: "saved-reconciled-preview",
      sourceType: "saved",
      createdAt: "2026-08-08T21:24:11.577Z",
      garmentIds: ["anchor", "seashell-bottom-0", "neutral-shoes"],
      selectedGarmentsByRole: {
        top: { pieceId: "anchor", pieceName: "Hermosa pink shirt" },
        bottom: { pieceId: "seashell-bottom-0", pieceName: "Seashell bottom 0" },
        footwear: { pieceId: "neutral-shoes", pieceName: "Black loafers" },
      },
      colourMappings: {},
      referenceCombination: { combinationNumber: 176 },
      generation: {
        status: "failed",
        jobId: "preview-reconciled",
        error: "The fidelity review could not confirm this Modeled Preview.",
      },
      name: "Recovered modeled preview",
      reason: "Preview generation needs attention.",
      copyGeneration: { status: "ready" },
    }]));
    globalThis.__WARDROBE_TEST_SERVICES__ = {
      modeledPreviewService: {
        start: async () => { throw new Error("A failed preview must be reconciled, not regenerated."); },
        read: async () => ({
          id: "preview-reconciled",
          status: "ready",
          image,
          attempts: 1,
          review: { accepted: true, reasons: [] },
        }),
      },
    };
  }, IMAGE);
  await page.route("**/api/import/wardrobe", (route) => route.fulfill({ json: wardrobe }));
  await page.route("**/api/import/outfits", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.getByRole("tab", { name: /Outfits/ }).click();

  const savedSection = page.getByRole("region", { name: "Saved from your wardrobe" });
  await expect(savedSection).toContainText("Your Modeled Preview is ready.");
  await expect(savedSection.locator(".outfit-card-photo img")).toBeVisible();
});

test("deletes a Saved Outfit without changing curated looks or the wardrobe", async ({ page }) => {
  await page.addInitScript((image) => {
    if (localStorage.getItem("open-wardrobe-saved-outfits-v1")) return;
    localStorage.setItem("open-wardrobe-saved-outfits-v1", JSON.stringify([{
      id: "saved-delete",
      sourceType: "saved",
      createdAt: "2026-08-08T21:24:11.577Z",
      garmentIds: ["anchor", "seashell-bottom-0", "neutral-shoes"],
      selectedGarmentsByRole: {
        top: { pieceId: "anchor", pieceName: "Hermosa pink shirt" },
        bottom: { pieceId: "seashell-bottom-0", pieceName: "Seashell bottom 0" },
        footwear: { pieceId: "neutral-shoes", pieceName: "Black loafers" },
      },
      colourMappings: {},
      referenceCombination: { combinationNumber: 176 },
      generation: { status: "ready", jobId: "preview-saved-delete", review: { accepted: true }, attempts: 1 },
      name: "Saved outfit to delete",
      reason: "Your Modeled Preview is ready.",
      image,
      copyGeneration: { status: "ready" },
    }]));
    globalThis.__deleteModeledPreviewCalls = [];
    globalThis.__WARDROBE_TEST_SERVICES__ = {
      modeledPreviewService: {
        remove: async (id) => globalThis.__deleteModeledPreviewCalls.push(id),
      },
    };
  }, IMAGE);
  await page.route("**/api/import/wardrobe", (route) => route.fulfill({ json: wardrobe }));
  await page.route("**/api/import/outfits", (route) => route.fulfill({ json: [{
    id: "curated-look",
    name: "Curated look remains",
    garmentIds: ["anchor"],
    image: IMAGE,
    reason: "A curated look.",
  }] }));
  await page.goto("/");
  await page.getByRole("tab", { name: /Outfits/ }).click();

  const savedSection = page.getByRole("region", { name: "Saved from your wardrobe" });
  await savedSection.getByRole("button", { name: "View Saved outfit to delete" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Saved Outfit" }).click();

  await expect.poll(() => page.evaluate(() => globalThis.__deleteModeledPreviewCalls)).toEqual(["preview-saved-delete"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(savedSection).toContainText("Complete Looks you save will appear here.");
  await expect(page.getByRole("region", { name: "Curated looks" })).toContainText("Curated look remains");
  await page.getByRole("tab", { name: "Wardrobe" }).click();
  await expect(page.getByTestId("wardrobe-item-anchor")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Outfits/ }).click();
  await expect(page.getByRole("region", { name: "Saved from your wardrobe" })).toContainText("Complete Looks you save will appear here.");
});

test("a rejected Modeled Preview retries without replacing pieces, and a removed piece marks the Saved Outfit incomplete", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript((image) => {
    let attempt = 0;
    globalThis.__WARDROBE_TEST_SERVICES__ = {
      modeledPreviewService: {
        start: async () => {
          attempt += 1;
          if (attempt === 2) throw new Error("The image service is temporarily unavailable.");
          return { id: `preview-retry-${attempt}`, status: "generating", attempts: attempt };
        },
        read: async (id) => attempt === 1
          ? {
            id,
            status: "failed",
            attempts: 1,
            error: "The fidelity review could not confirm this Modeled Preview.",
            review: { accepted: false, reasons: ["A selected garment was not visible."] },
          }
          : { id, status: "ready", attempts: 2, image, review: { accepted: true, reasons: [] } },
      },
    };
  }, IMAGE);
  await openFixtureLookBuilder(page);

  await pairingRole(page, "Bottom").getByRole("button", { name: /Seashell bottom 0/ }).click();
  await pairingRole(page, "Footwear").getByRole("button", { name: /Black loafers/ }).click();
  await page.getByRole("button", { name: "Save and generate preview" }).click();
  await page.getByRole("button", { name: "Close viewer" }).click();

  const savedSection = page.getByRole("region", { name: "Saved from your wardrobe" }).getByLabel("Saved from your wardrobe");
  await expect(savedSection).toContainText("Preview failed");
  await savedSection.getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toContainText("A selected garment was not visible.");
  await page.getByRole("button", { name: "Retry Modeled Preview" }).click();
  await expect(page.getByRole("dialog")).toContainText("The image service is temporarily unavailable.");
  await page.getByRole("button", { name: "Retry Modeled Preview" }).click();
  await expect(page.getByRole("dialog").locator(".outfit-viewer-photo img")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Black loafers");
  await page.getByRole("button", { name: "Close outfit viewer" }).click();

  await page.getByRole("tab", { name: "Wardrobe" }).click();
  await page.getByTestId("wardrobe-item-neutral-shoes").click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("tab", { name: /Outfits/ }).click();
  await expect(savedSection).toContainText("incomplete because a selected wardrobe piece was removed");
  await savedSection.getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toContainText("Black loafers");
  await expect(page.getByRole("dialog")).toContainText("incomplete because a selected wardrobe piece was removed");
  expect(consoleErrors).toEqual([]);
});

test("a failed Outfit Name and Description retry keeps the Saved Outfit and its Modeled Preview", async ({ page }) => {
  await page.addInitScript((image) => {
    let textAttempt = 0;
    globalThis.__WARDROBE_TEST_SERVICES__ = {
      generateOutfitCopy: async () => {
        textAttempt += 1;
        if (textAttempt === 1) throw new Error("Text generation is temporarily unavailable.");
        return {
          name: "Hermosa pink shirt · closest to Hermosa Pink",
          description: "Hermosa pink shirt and Seashell bottom 0 map closest to Hermosa Pink and Seashell Pink in Dictionary Vol. 1 · Combination 176.",
        };
      },
      modeledPreviewService: {
        start: async () => ({ id: "preview-text-retry", status: "generating", attempts: 1 }),
        read: async () => ({ id: "preview-text-retry", status: "ready", attempts: 1, image, review: { accepted: true, reasons: [] } }),
      },
    };
  }, IMAGE);
  await openFixtureLookBuilder(page);

  await pairingRole(page, "Bottom").getByRole("button", { name: /Seashell bottom 0/ }).click();
  await pairingRole(page, "Footwear").getByRole("button", { name: /Black loafers/ }).click();
  await page.getByRole("button", { name: "Save and generate preview" }).click();
  await page.getByRole("button", { name: "Close viewer" }).click();

  const savedSection = page.getByRole("region", { name: "Saved from your wardrobe" }).getByLabel("Saved from your wardrobe");
  await expect(savedSection).toContainText("Text generation is temporarily unavailable.");
  await savedSection.getByRole("button").first().click();
  await page.getByRole("button", { name: "Retry Outfit Name and Description" }).click();
  await expect(page.getByRole("dialog")).toContainText("map closest to Hermosa Pink and Seashell Pink");
  await expect(page.getByRole("dialog").locator(".outfit-viewer-photo img")).toBeVisible();
});

test("a persisted Modeled Preview job is recovered after an application restart", async ({ page }) => {
  await page.addInitScript((image) => {
    localStorage.setItem("open-wardrobe-saved-outfits-v1", JSON.stringify([{
      id: "saved-restart",
      sourceType: "saved",
      createdAt: "2026-08-08T12:00:00.000Z",
      garmentIds: ["anchor", "seashell-bottom-0", "neutral-shoes"],
      selectedGarmentsByRole: {
        top: { pieceId: "anchor", pieceName: "Hermosa pink shirt", roleLabel: "Top", wardrobeRole: "top", isAnchor: true },
        bottom: { pieceId: "seashell-bottom-0", pieceName: "Seashell bottom 0", roleLabel: "Bottom", wardrobeRole: "bottom" },
        footwear: { pieceId: "neutral-shoes", pieceName: "Black loafers", roleLabel: "Footwear", wardrobeRole: "footwear" },
      },
      colourMappings: {},
      referenceCombination: { combinationNumber: 176, source: "A Dictionary of Color Combinations Vol. 1", guide: { swatches: [] } },
      generation: { status: "reviewing", jobId: "preview-restart", attempts: 1 },
      copyGeneration: { status: "ready" },
      name: "Restarted Saved Outfit",
      nameSource: "user",
      description: "A saved outfit awaiting its persisted Modeled Preview.",
    }]));
    globalThis.__WARDROBE_TEST_SERVICES__ = {
      modeledPreviewService: {
        start: async () => { throw new Error("A persisted job must be read, not restarted."); },
        read: async (id) => ({ id, status: "ready", attempts: 1, image, review: { accepted: true, reasons: [] } }),
      },
    };
  }, IMAGE);
  await openFixtureLookBuilder(page);
  const closeViewer = page.getByRole("button", { name: "Close viewer" });
  if (await closeViewer.isVisible().catch(() => false)) await closeViewer.click();

  await page.getByRole("tab", { name: /Outfits/ }).click();
  const savedSection = page.getByRole("region", { name: "Saved from your wardrobe" }).getByLabel("Saved from your wardrobe");
  await expect(savedSection).toContainText("Restarted Saved Outfit");
  await expect(savedSection.locator(".outfit-card-photo img")).toBeVisible();
  await page.reload();
  if (await closeViewer.isVisible().catch(() => false)) await closeViewer.click();
  await page.getByRole("tab", { name: /Outfits/ }).click();
  await expect(savedSection.locator(".outfit-card-photo img")).toBeVisible();
});

test("garment editing and the local importer setup remain available alongside the Look Builder", async ({ page }) => {
  await openFixtureLookBuilder(page);

  await page.getByLabel("Name").fill("Edited Hermosa pink shirt");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Edited Hermosa pink shirt");
  await page.getByRole("button", { name: "Close viewer" }).click();
  await expect(page.getByTestId("wardrobe-item-anchor")).toHaveAttribute("aria-label", "View Edited Hermosa pink shirt");

  await expect(page.getByRole("button", { name: "Add clothes" })).toBeVisible();
});
