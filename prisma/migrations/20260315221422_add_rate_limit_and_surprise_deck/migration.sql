-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SurpriseDeck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "deck" JSONB NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "poolSize" INTEGER NOT NULL,
    "poolSignature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SurpriseDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyCode" TEXT,
    "emailVerifyExpiresAt" DATETIME,
    "emailVerifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "loginCode" TEXT,
    "loginCodeExpiresAt" DATETIME,
    "loginCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "passwordResetCode" TEXT,
    "passwordResetExpiresAt" DATETIME,
    "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "emailVerifyCode", "emailVerifyExpiresAt", "id", "loginCode", "loginCodeExpiresAt", "passwordHash", "passwordResetCode", "passwordResetExpiresAt", "updatedAt", "username") SELECT "createdAt", "email", "emailVerified", "emailVerifyCode", "emailVerifyExpiresAt", "id", "loginCode", "loginCodeExpiresAt", "passwordHash", "passwordResetCode", "passwordResetExpiresAt", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_action_key_key" ON "RateLimit"("action", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SurpriseDeck_ownerKey_key" ON "SurpriseDeck"("ownerKey");

-- CreateIndex
CREATE INDEX "SurpriseDeck_userId_idx" ON "SurpriseDeck"("userId");
