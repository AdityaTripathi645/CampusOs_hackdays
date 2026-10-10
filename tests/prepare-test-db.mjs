import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.CAMPUSOS_TEST_DATABASE_URL ?? "file:../.test-data/campusos-test.db";
if (!/^file:\.\.\/\.test-data\/[A-Za-z0-9_.-]+\.db$/.test(databaseUrl)) {
  throw new Error("Refusing to run tests against anything but the isolated project test SQLite database.");
}

process.env.DATABASE_URL = databaseUrl;
const databasePath = resolve(projectRoot, ".test-data", databaseUrl.slice("file:../.test-data/".length));
mkdirSync(dirname(databasePath), { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    resolve(projectRoot, "node_modules", "prisma", "build", "index.js"),
    "db",
    "push",
    "--schema",
    "prisma/schema.prisma",
    "--skip-generate",
    "--force-reset",
  ],
  { cwd: projectRoot, env: process.env, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
