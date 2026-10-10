import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const projectRoot = process.cwd();
process.env.DATABASE_URL =
  process.env.CAMPUSOS_TEST_DATABASE_URL ?? "file:../.test-data/campusos-test.db";
if (!/^file:\.\.\/\.test-data\/[A-Za-z0-9_.-]+\.db$/.test(process.env.DATABASE_URL)) {
  throw new Error("Playwright requires an isolated SQLite CAMPUSOS_TEST_DATABASE_URL.");
}

export default defineConfig({
  testDir: resolve(projectRoot, "tests/e2e"),
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "node tests/prepare-test-db.mjs && npm run db:seed && npm run build && npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "campusos-test-secret-that-is-long-enough",
      GEMINI_API_KEY: "",
    },
  },
});
