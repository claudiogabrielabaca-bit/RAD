CREATE TABLE IF NOT EXISTS "DayRatingAggregate" (
  "day" TEXT NOT NULL,
  "ratingsCount" INTEGER NOT NULL DEFAULT 0,
  "starsSum" INTEGER NOT NULL DEFAULT 0,
  "avgStars" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DayRatingAggregate_pkey" PRIMARY KEY ("day")
);

CREATE INDEX IF NOT EXISTS "day_rating_aggregate_top_idx"
  ON "DayRatingAggregate" ("ratingsCount", "avgStars");

CREATE INDEX IF NOT EXISTS "day_rating_aggregate_avg_count_idx"
  ON "DayRatingAggregate" ("avgStars", "ratingsCount");

INSERT INTO "DayRatingAggregate" (
  "day",
  "ratingsCount",
  "starsSum",
  "avgStars",
  "createdAt",
  "updatedAt"
)
SELECT
  "day",
  COUNT(*)::integer AS "ratingsCount",
  COALESCE(SUM("stars"), 0)::integer AS "starsSum",
  COALESCE(AVG("stars")::double precision, 0) AS "avgStars",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM "Rating"
GROUP BY "day"
ON CONFLICT ("day") DO UPDATE SET
  "ratingsCount" = EXCLUDED."ratingsCount",
  "starsSum" = EXCLUDED."starsSum",
  "avgStars" = EXCLUDED."avgStars",
  "updatedAt" = NOW();
