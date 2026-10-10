import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/^file:\.\.\/\.test-data\/[A-Za-z0-9_.-]+\.db$/.test(databaseUrl)) {
  throw new Error("Refusing to run tests against anything but the isolated project test SQLite database.");
}

const databasePath = resolve(projectRoot, ".test-data", databaseUrl.slice("file:../.test-data/".length));

export function setup() {
  mkdirSync(dirname(databasePath), { recursive: true });
  execFileSync(
    process.execPath,
    [resolve(projectRoot, "tests", "prepare-test-db.mjs")],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  return () => {
    for (const suffix of ["", "-journal", "-shm", "-wal"]) {
      rmSync(`${databasePath}${suffix}`, { force: true });
    }
  };
}

export default setup;
