-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewReport_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RatingReply_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReport_ratingId_anonId_key" ON "ReviewReport"("ratingId", "anonId");
