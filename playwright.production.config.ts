import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/offline.spec.ts",
  webServer: {
    command: "node scripts/e2e-server.ts --production",
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `${base.use?.baseURL}/api/library`,
  },
});
