import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const card = fs
  .readFileSync("src/app/components/rad/social-share-card.tsx", "utf8")
  .replace(/\r\n/g, "\n");

test("social share card uses automatic fallback text with the exact lowercase site label", () => {
  assert.match(card, /const SITE_LABEL = "rateanyday\.com";/);
  assert.match(card, /Rated this day on \$\{SITE_LABEL\}\./);
  assert.match(card, /const reviewClass = getReviewClass\(reviewText\.length\);/);
  assert.match(card, /\{reviewText\}/);
  assert.match(card, /\{SITE_LABEL\}/);
  assert.doesNotMatch(card, /Rateanyday\.com/);
});
