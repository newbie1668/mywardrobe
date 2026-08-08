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

async function openFixtureLookBuilder(page) {
  await page.route("**/api/import/wardrobe", (route) => route.fulfill({ json: wardrobe }));
  await page.route("**/api/import/outfits", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
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
  await expect(page.getByText("Incomplete Combination", { exact: true })).toBeVisible();

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
  await expect(page.getByText("Incomplete Combination", { exact: true })).toBeVisible();

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
