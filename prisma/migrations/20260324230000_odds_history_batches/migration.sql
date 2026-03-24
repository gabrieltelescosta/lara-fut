-- Redundant: Prisma migrate will sync; SQLite ADD COLUMN
ALTER TABLE "OddsSnapshot" ADD COLUMN "contentHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OddsSnapshot" ADD COLUMN "snapshotBatch" TEXT NOT NULL DEFAULT '';

CREATE INDEX "OddsSnapshot_eventId_contentHash_idx" ON "OddsSnapshot"("eventId", "contentHash");

ALTER TABLE "SignalPrediction" ADD COLUMN "oddsAtSignalJson" TEXT;
