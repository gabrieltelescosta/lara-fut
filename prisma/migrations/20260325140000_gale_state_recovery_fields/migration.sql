-- Add recovery tracking fields to TelegramGaleState
ALTER TABLE "TelegramGaleState" ADD COLUMN "accumulatedLoss" REAL NOT NULL DEFAULT 0;
ALTER TABLE "TelegramGaleState" ADD COLUMN "initialOdd" REAL;
ALTER TABLE "TelegramGaleState" ADD COLUMN "baseStake" REAL NOT NULL DEFAULT 10;
