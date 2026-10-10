ALTER TABLE "Result" ADD COLUMN "trackRank" INTEGER;

UPDATE "Result"
SET "trackRank" = 1 + (
    SELECT COUNT(*)
    FROM "Result" AS ahead
    WHERE ahead."eventId" = "Result"."eventId"
      AND ahead."trackId" = "Result"."trackId"
      AND ahead."finalScore" > "Result"."finalScore"
)
WHERE "Result"."trackId" IS NOT NULL;

CREATE TABLE "Prize" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "trackId" TEXT,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "amount" REAL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Prize_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prize_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PrizeAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prizeId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "awardedById" TEXT NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "PrizeAward_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrizeAward_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrizeAward_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Prize_eventId_trackId_name_key" ON "Prize"("eventId", "trackId", "name");
CREATE INDEX "Prize_eventId_trackId_idx" ON "Prize"("eventId", "trackId");
CREATE UNIQUE INDEX "PrizeAward_prizeId_key" ON "PrizeAward"("prizeId");
CREATE INDEX "PrizeAward_submissionId_idx" ON "PrizeAward"("submissionId");
CREATE INDEX "Result_eventId_trackId_trackRank_idx" ON "Result"("eventId", "trackId", "trackRank");
