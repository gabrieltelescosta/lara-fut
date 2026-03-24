-- CreateTable
CREATE TABLE "SignalPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "superbetEventId" INTEGER NOT NULL,
    "matchName" TEXT NOT NULL,
    "matchDate" DATETIME NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "focusTeam" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "picksJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "hitOneX2" BOOLEAN,
    "hitBtts" BOOLEAN,
    "hitTeamOu" BOOLEAN,
    "hitsTotal" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalPrediction_superbetEventId_key" ON "SignalPrediction"("superbetEventId");
