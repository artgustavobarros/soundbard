import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/offline.spec.ts",
  webServer: {
    command: "pnpm start",
    reuseExistingServer: false,
    timeout: 30_000,
    url: "http://127.0.0.1:3000",
  },
});
