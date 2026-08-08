import { defineConfig } from "@playwright/test";

const publicPreviewE2E = process.env.PUBLIC_PREVIEW_E2E === "true";
const port = publicPreviewE2E ? 4175 : 4174;
const publicPreviewUrl = process.env.PUBLIC_PREVIEW_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: publicPreviewUrl,
    browserName: "chromium",
    ...(process.env.CI ? {} : { channel: "chrome" }),
    trace: "retain-on-failure",
  },
  webServer: process.env.PUBLIC_PREVIEW_URL ? undefined : {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    env: { ...process.env, WARDROBE_DATA_DIR: ".playwright-data", ...(publicPreviewE2E ? { VITE_PUBLIC_FIXTURE_PREVIEW: "true" } : {}) },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
