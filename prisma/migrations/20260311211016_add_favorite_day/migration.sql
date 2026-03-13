-- CreateTable
CREATE TABLE "FavoriteDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anonId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDay_anonId_key" ON "FavoriteDay"("anonId");
