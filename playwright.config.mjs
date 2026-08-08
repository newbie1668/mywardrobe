import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    ...(process.env.CI ? {} : { channel: "chrome" }),
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174",
    env: { ...process.env, WARDROBE_DATA_DIR: ".playwright-data" },
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
});
