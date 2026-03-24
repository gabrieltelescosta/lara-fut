-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TelegramGaleState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "messageId" INTEGER,
    "galeLevel" INTEGER NOT NULL DEFAULT 0,
    "currentAttempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "pendingEditNext" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TelegramGaleState" ("galeLevel", "id", "messageId", "updatedAt") SELECT "galeLevel", "id", "messageId", "updatedAt" FROM "TelegramGaleState";
DROP TABLE "TelegramGaleState";
ALTER TABLE "new_TelegramGaleState" RENAME TO "TelegramGaleState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
