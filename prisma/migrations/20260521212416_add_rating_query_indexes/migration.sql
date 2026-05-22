CREATE INDEX IF NOT EXISTS "rating_day_created_at_idx" ON "Rating"("day", "createdAt");
CREATE INDEX IF NOT EXISTS "rating_day_stars_idx" ON "Rating"("day", "stars");
CREATE INDEX IF NOT EXISTS "rating_reply_rating_created_at_idx" ON "RatingReply"("ratingId", "createdAt");
