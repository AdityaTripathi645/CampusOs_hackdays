import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());

  const [{ db }, { createLocalStorageAdapter, createS3StorageAdapter }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/storage"),
  ]);
  const source = createLocalStorageAdapter();
  const destination = createS3StorageAdapter();
  let copied = 0;
  let skipped = 0;
  let failed = 0;

  try {
    if (!destination.exists) {
      throw new Error("The configured S3 storage adapter does not support checking existing objects.");
    }
    const files = await db.submissionFile.findMany({
      select: { storageKey: true, mimeType: true },
      orderBy: { id: "asc" },
    });

    for (const file of files) {
      try {
        if (await destination.exists(file.storageKey)) {
          skipped += 1;
          continue;
        }
        const data = await source.get(file.storageKey);
        await destination.put(file.storageKey, data, file.mimeType);
        copied += 1;
      } catch (error) {
        failed += 1;
        console.error(`Failed to migrate ${file.storageKey}:`, error);
      }
    }

    console.log(
      `Storage migration complete: ${files.length} total, ${copied} copied, ${skipped} skipped, ${failed} failed.`,
    );
    if (failed > 0) process.exitCode = 1;
  } finally {
    source.close?.();
    destination.close?.();
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Storage migration could not complete:", error);
  process.exitCode = 1;
});
