import { expect, test } from "@playwright/test";

test.skip(process.env.PUBLIC_PREVIEW_E2E !== "true", "Runs only against the fixture-only public preview.");

function pairingRole(page, name) {
  return page.locator(".pairing-role").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
}

test("the fixture-only preview completes the public Look Builder journey without API requests", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Public fixture preview");
  await page.getByTestId("wardrobe-item-demo-anchor").click();
  await expect(page.getByRole("heading", { name: "Look Builder" })).toBeVisible();
  await pairingRole(page, "Bottom").getByRole("button", { name: /Seashell trousers/ }).click();
  await pairingRole(page, "Footwear").getByRole("button", { name: /Black loafers/ }).click();
  await page.getByRole("button", { name: "Save and generate preview" }).click();
  await page.getByRole("button", { name: "Close viewer" }).click();

  const savedSection = page.getByRole("region", { name: "Saved from your wardrobe" }).getByLabel("Saved from your wardrobe");
  await expect(savedSection).toContainText("Your Modeled Preview is ready.");
  await expect(savedSection.locator(".outfit-card-photo img")).toBeVisible();
  await expect(page.getByRole("region", { name: "Curated looks" })).toContainText("Preview gallery look");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(consoleErrors).toEqual([]);
});
