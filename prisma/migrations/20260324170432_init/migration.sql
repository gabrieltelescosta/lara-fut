-- CreateTable
CREATE TABLE "Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "sportId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "superbetEventId" INTEGER NOT NULL,
    "tournamentId" INTEGER,
    "matchName" TEXT NOT NULL,
    "matchDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "periodScores" JSONB,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "periodScores" JSONB,
    "finishedAt" DATETIME NOT NULL,
    CONSTRAINT "Result_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "marketName" TEXT NOT NULL,
    "outcomeName" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OddsSnapshot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_superbetEventId_key" ON "Event"("superbetEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_eventId_key" ON "Result"("eventId");

-- CreateIndex
CREATE INDEX "OddsSnapshot_eventId_capturedAt_idx" ON "OddsSnapshot"("eventId", "capturedAt");
