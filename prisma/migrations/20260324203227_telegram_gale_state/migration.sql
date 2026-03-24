-- CreateTable
CREATE TABLE "TelegramGaleState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "messageId" INTEGER,
    "galeLevel" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
