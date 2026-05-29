import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const card = fs
  .readFileSync("src/app/components/rad/social-share-card.tsx", "utf8")
  .replace(/\r\n/g, "\n");

test("social share card never injects automatic review promo text", () => {
  assert.doesNotMatch(card, /Rated this day on/);
  assert.match(card, /const reviewText = normalizeReviewText\(review\?\.review\);/);
  assert.match(card, /const reviewClass = reviewText \? getReviewClass\(reviewText\.length\) : "";/);
  assert.match(card, /\{reviewText \? \(/);
  assert.match(card, /\{SITE_LABEL\}/);
});
