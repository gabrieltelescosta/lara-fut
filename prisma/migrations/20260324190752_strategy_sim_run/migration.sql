-- CreateTable
CREATE TABLE "StrategySimRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryJson" TEXT NOT NULL
);
