import { defineConfig } from "@playwright/test";

const port = process.env.SOUNDBARD_E2E_PORT ?? "3312";
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  fullyParallel: false,
  testDir: "./e2e",
  testIgnore: "**/offline.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: origin,
    browserName: "chromium",
    headless: true,
  },
  webServer: {
    command: "node scripts/e2e-server.ts",
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `${origin}/api/library`,
  },
  workers: 1,
});
