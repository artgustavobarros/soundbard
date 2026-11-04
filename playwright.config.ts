import { defineConfig } from "@playwright/test";
export default defineConfig({
  fullyParallel: false,
  testDir: "./e2e",
  testIgnore: "**/offline.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    headless: true,
  },
  webServer: {
    command: "pnpm dev",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    url: "http://127.0.0.1:3000",
  },
  workers: 1,
});
