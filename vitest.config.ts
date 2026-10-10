import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = dirname(fileURLToPath(import.meta.url));

process.env.DATABASE_URL =
  process.env.CAMPUSOS_TEST_DATABASE_URL ?? "file:../.test-data/campusos-test.db";
if (!/^file:\.\.\/\.test-data\/[A-Za-z0-9_.-]+\.db$/.test(process.env.DATABASE_URL)) {
  throw new Error("Vitest requires an isolated SQLite CAMPUSOS_TEST_DATABASE_URL.");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
      "server-only": resolve(projectRoot, "tests/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "tests/pptx-text.test.ts", "tests/rate-limit.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/scoring.ts", "src/lib/utils.ts", "src/lib/validation.ts", "src/services/gemini.ts"],
      exclude: ["src/**/*.d.ts"],
    },
  },
});
