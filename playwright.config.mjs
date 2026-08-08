import { defineConfig } from "@playwright/test";

const port = 4174;
const appUrl = process.env.APP_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: appUrl,
    browserName: "chromium",
    ...(process.env.CI ? {} : { channel: "chrome" }),
    trace: "retain-on-failure",
  },
  webServer: process.env.APP_URL ? undefined : {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    env: { ...process.env, WARDROBE_DATA_DIR: ".playwright-data" },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
