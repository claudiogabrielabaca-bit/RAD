-- CreateTable
CREATE TABLE "ReplyLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "replyId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReplyLike_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "RatingReply" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReplyLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReplyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "replyId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReplyReport_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "RatingReply" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReplyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReplyLike_replyId_idx" ON "ReplyLike"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyLike_replyId_anonId_key" ON "ReplyLike"("replyId", "anonId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyLike_replyId_userId_key" ON "ReplyLike"("replyId", "userId");

-- CreateIndex
CREATE INDEX "ReplyReport_replyId_idx" ON "ReplyReport"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyReport_replyId_anonId_key" ON "ReplyReport"("replyId", "anonId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyReport_replyId_userId_key" ON "ReplyReport"("replyId", "userId");
