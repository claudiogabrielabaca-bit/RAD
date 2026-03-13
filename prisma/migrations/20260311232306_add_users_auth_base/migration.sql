-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FavoriteDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anonId" TEXT,
    "userId" TEXT,
    "day" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FavoriteDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FavoriteDay" ("anonId", "createdAt", "day", "id", "updatedAt") SELECT "anonId", "createdAt", "day", "id", "updatedAt" FROM "FavoriteDay";
DROP TABLE "FavoriteDay";
ALTER TABLE "new_FavoriteDay" RENAME TO "FavoriteDay";
CREATE UNIQUE INDEX "FavoriteDay_anonId_day_key" ON "FavoriteDay"("anonId", "day");
CREATE UNIQUE INDEX "FavoriteDay_userId_day_key" ON "FavoriteDay"("userId", "day");
CREATE TABLE "new_Rating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anonId" TEXT,
    "userId" TEXT,
    "day" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "review" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Rating" ("anonId", "createdAt", "day", "id", "review", "stars", "updatedAt") SELECT "anonId", "createdAt", "day", "id", "review", "stars", "updatedAt" FROM "Rating";
DROP TABLE "Rating";
ALTER TABLE "new_Rating" RENAME TO "Rating";
CREATE UNIQUE INDEX "Rating_anonId_day_key" ON "Rating"("anonId", "day");
CREATE UNIQUE INDEX "Rating_userId_day_key" ON "Rating"("userId", "day");
CREATE TABLE "new_RatingLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingLike_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RatingLike" ("anonId", "createdAt", "id", "ratingId") SELECT "anonId", "createdAt", "id", "ratingId" FROM "RatingLike";
DROP TABLE "RatingLike";
ALTER TABLE "new_RatingLike" RENAME TO "RatingLike";
CREATE UNIQUE INDEX "RatingLike_ratingId_anonId_key" ON "RatingLike"("ratingId", "anonId");
CREATE UNIQUE INDEX "RatingLike_ratingId_userId_key" ON "RatingLike"("ratingId", "userId");
CREATE TABLE "new_RatingReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RatingReply_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RatingReply" ("anonId", "createdAt", "id", "ratingId", "text", "updatedAt") SELECT "anonId", "createdAt", "id", "ratingId", "text", "updatedAt" FROM "RatingReply";
DROP TABLE "RatingReply";
ALTER TABLE "new_RatingReply" RENAME TO "RatingReply";
CREATE TABLE "new_ReviewReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewReport_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReviewReport" ("anonId", "createdAt", "id", "ratingId", "reason", "status", "updatedAt") SELECT "anonId", "createdAt", "id", "ratingId", "reason", "status", "updatedAt" FROM "ReviewReport";
DROP TABLE "ReviewReport";
ALTER TABLE "new_ReviewReport" RENAME TO "ReviewReport";
CREATE UNIQUE INDEX "ReviewReport_ratingId_anonId_key" ON "ReviewReport"("ratingId", "anonId");
CREATE UNIQUE INDEX "ReviewReport_ratingId_userId_key" ON "ReviewReport"("ratingId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
