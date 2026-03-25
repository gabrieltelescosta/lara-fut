-- CreateTable
CREATE TABLE "TelegramAppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "enabled" BOOLEAN,
    "botToken" TEXT,
    "chatId" TEXT,
    "signalMarkets" TEXT,
    "galeMax" INTEGER,
    "timezone" TEXT,
    "updatedAt" DATETIME NOT NULL
);
