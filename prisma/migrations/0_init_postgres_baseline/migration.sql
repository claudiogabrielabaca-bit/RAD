-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('review_liked', 'review_replied', 'reply_liked');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyCode" TEXT,
    "emailVerifyExpiresAt" TIMESTAMP(3),
    "emailVerifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "loginCode" TEXT,
    "loginCodeExpiresAt" TIMESTAMP(3),
    "loginCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "passwordResetCode" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "day" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "review" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingLike" (
    "id" TEXT NOT NULL,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" TEXT NOT NULL,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingReply" (
    "id" TEXT NOT NULL,
    "ratingId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "parentReplyId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatingReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyLike" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyReport" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteDay" (
    "id" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayHighlightCache" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "image" TEXT,
    "articleUrl" TEXT,
    "highlights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayHighlightCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickDateCache" (
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL DEFAULT 0,
    "monthDay" TEXT NOT NULL DEFAULT '',
    "decade" INTEGER NOT NULL DEFAULT 0,
    "century" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "text" TEXT,
    "image" TEXT,
    "articleUrl" TEXT,
    "highlights" JSONB,
    "source" TEXT NOT NULL DEFAULT 'v1-pick-date-cache',
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickDateCache_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "SurprisePoolDay" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "monthDay" TEXT NOT NULL,
    "decade" INTEGER NOT NULL,
    "century" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "image" TEXT,
    "articleUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'day_highlight_cache',
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurprisePoolDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayStats" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurpriseDeck" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "deck" JSONB NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "poolSize" INTEGER NOT NULL,
    "poolSignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurpriseDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodayHistoryPool" (
    "monthDay" TEXT NOT NULL,
    "validDays" JSONB NOT NULL,
    "validCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodayHistoryPool_pkey" PRIMARY KEY ("monthDay")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "reviewId" TEXT,
    "replyId" TEXT,
    "day" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "rating_day_created_at_idx" ON "Rating"("day", "createdAt");

-- CreateIndex
CREATE INDEX "rating_day_stars_idx" ON "Rating"("day", "stars");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_anonId_day_key" ON "Rating"("anonId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_day_key" ON "Rating"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "RatingLike_ratingId_anonId_key" ON "RatingLike"("ratingId", "anonId");

-- CreateIndex
CREATE UNIQUE INDEX "RatingLike_ratingId_userId_key" ON "RatingLike"("ratingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReport_ratingId_anonId_key" ON "ReviewReport"("ratingId", "anonId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReport_ratingId_userId_key" ON "ReviewReport"("ratingId", "userId");

-- CreateIndex
CREATE INDEX "RatingReply_ratingId_idx" ON "RatingReply"("ratingId");

-- CreateIndex
CREATE INDEX "rating_reply_rating_created_at_idx" ON "RatingReply"("ratingId", "createdAt");

-- CreateIndex
CREATE INDEX "RatingReply_parentReplyId_idx" ON "RatingReply"("parentReplyId");

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

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDay_anonId_day_key" ON "FavoriteDay"("anonId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDay_userId_day_key" ON "FavoriteDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "DayHighlightCache_day_key" ON "DayHighlightCache"("day");

-- CreateIndex
CREATE INDEX "PickDateCache_status_idx" ON "PickDateCache"("status");

-- CreateIndex
CREATE INDEX "PickDateCache_source_idx" ON "PickDateCache"("source");

-- CreateIndex
CREATE INDEX "PickDateCache_year_idx" ON "PickDateCache"("year");

-- CreateIndex
CREATE INDEX "PickDateCache_month_idx" ON "PickDateCache"("month");

-- CreateIndex
CREATE INDEX "PickDateCache_monthDay_idx" ON "PickDateCache"("monthDay");

-- CreateIndex
CREATE INDEX "PickDateCache_decade_idx" ON "PickDateCache"("decade");

-- CreateIndex
CREATE INDEX "PickDateCache_century_idx" ON "PickDateCache"("century");

-- CreateIndex
CREATE INDEX "PickDateCache_generatedAt_idx" ON "PickDateCache"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SurprisePoolDay_day_key" ON "SurprisePoolDay"("day");

-- CreateIndex
CREATE INDEX "SurprisePoolDay_active_idx" ON "SurprisePoolDay"("active");

-- CreateIndex
CREATE INDEX "SurprisePoolDay_active_month_idx" ON "SurprisePoolDay"("active", "month");

-- CreateIndex
CREATE INDEX "SurprisePoolDay_active_monthDay_idx" ON "SurprisePoolDay"("active", "monthDay");

-- CreateIndex
CREATE INDEX "SurprisePoolDay_active_decade_idx" ON "SurprisePoolDay"("active", "decade");

-- CreateIndex
CREATE INDEX "SurprisePoolDay_active_century_idx" ON "SurprisePoolDay"("active", "century");

-- CreateIndex
CREATE INDEX "SurprisePoolDay_active_type_idx" ON "SurprisePoolDay"("active", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DayStats_day_key" ON "DayStats"("day");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_action_key_key" ON "RateLimit"("action", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SurpriseDeck_ownerKey_key" ON "SurpriseDeck"("ownerKey");

-- CreateIndex
CREATE INDEX "SurpriseDeck_userId_idx" ON "SurpriseDeck"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_reviewId_idx" ON "Notification"("reviewId");

-- CreateIndex
CREATE INDEX "Notification_replyId_idx" ON "Notification"("replyId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingLike" ADD CONSTRAINT "RatingLike_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingLike" ADD CONSTRAINT "RatingLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReply" ADD CONSTRAINT "RatingReply_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReply" ADD CONSTRAINT "RatingReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReply" ADD CONSTRAINT "RatingReply_parentReplyId_fkey" FOREIGN KEY ("parentReplyId") REFERENCES "RatingReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLike" ADD CONSTRAINT "ReplyLike_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "RatingReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyLike" ADD CONSTRAINT "ReplyLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyReport" ADD CONSTRAINT "ReplyReport_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "RatingReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyReport" ADD CONSTRAINT "ReplyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDay" ADD CONSTRAINT "FavoriteDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurpriseDeck" ADD CONSTRAINT "SurpriseDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "RatingReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

