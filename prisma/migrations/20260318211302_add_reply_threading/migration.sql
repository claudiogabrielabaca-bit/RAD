-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_RatingReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "parentReplyId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RatingReply_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingReply_parentReplyId_fkey" FOREIGN KEY ("parentReplyId") REFERENCES "RatingReply" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_RatingReply" (
    "id",
    "ratingId",
    "anonId",
    "userId",
    "parentReplyId",
    "text",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "ratingId",
    "anonId",
    "userId",
    NULL,
    "text",
    "createdAt",
    "updatedAt"
FROM "RatingReply";

DROP TABLE "RatingReply";
ALTER TABLE "new_RatingReply" RENAME TO "RatingReply";

CREATE INDEX "RatingReply_ratingId_idx" ON "RatingReply"("ratingId");
CREATE INDEX "RatingReply_parentReplyId_idx" ON "RatingReply"("parentReplyId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;