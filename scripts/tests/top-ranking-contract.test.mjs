import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260525000000_add_day_rating_aggregate/migration.sql");
const topRoute = read("src/app/api/top/route.ts");
const rateRoute = read("src/app/api/rate/route.ts");
const reviewDeleteRoute = read("src/app/api/review-delete/route.ts");
const adminDeleteReviewRoute = read("src/app/api/admin/delete-review/route.ts");
const aggregateLib = read("src/app/lib/rating-aggregates.ts");

test("ranking uses a persistent day rating aggregate model", () => {
  assert.match(schema, /model DayRatingAggregate/);
  assert.match(schema, /day\s+String\s+@id/);
  assert.match(schema, /ratingsCount\s+Int\s+@default\(0\)/);
  assert.match(schema, /starsSum\s+Int\s+@default\(0\)/);
  assert.match(schema, /avgStars\s+Float\s+@default\(0\)/);
  assert.match(schema, /@@index\(\[ratingsCount, avgStars\]/);
});

test("ranking migration creates and backfills DayRatingAggregate", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "DayRatingAggregate"/);
  assert.match(migration, /INSERT INTO "DayRatingAggregate"/);
  assert.match(migration, /FROM "Rating"/);
  assert.match(migration, /GROUP BY "day"/);
  assert.match(migration, /ON CONFLICT \("day"\) DO UPDATE/);
});

test("/api/top reads aggregate rows instead of grouping Rating live", () => {
  assert.match(topRoute, /FROM "DayRatingAggregate"/);
  assert.match(topRoute, /"avgStars" AS "avg"/);
  assert.match(topRoute, /"ratingsCount" AS "count"/);
  assert.doesNotMatch(topRoute, /GROUP BY "day"/);
  assert.doesNotMatch(topRoute, /FROM "Rating"/);
  assert.match(topRoute, /TOP_CACHE_TTL_MS = 60 \* 1000/);
  assert.match(topRoute, /consumeRateLimit/);
});

test("rating writes and review deletes refresh day rating aggregates", () => {
  assert.match(aggregateLib, /export async function refreshDayRatingAggregate/);
  assert.match(aggregateLib, /COUNT\(\*\)::integer AS "ratingsCount"/);
  assert.match(aggregateLib, /ON CONFLICT \("day"\) DO UPDATE/);
  assert.match(rateRoute, /refreshDayRatingAggregate\(day\)/);
  assert.match(reviewDeleteRoute, /refreshDayRatingAggregate\(review\.day\)/);
  assert.match(adminDeleteReviewRoute, /refreshDayRatingAggregate\(rating\.day\)/);
});
