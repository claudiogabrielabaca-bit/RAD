import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const reactions = fs
  .readFileSync("src/app/components/rad/home/home-reactions-panel.tsx", "utf8")
  .replace(/\r\n/g, "\n");
const modal = fs
  .readFileSync("src/app/components/rad/social-post-modal.tsx", "utf8")
  .replace(/\r\n/g, "\n");
const utils = fs
  .readFileSync("src/app/components/rad/social-post-modal-utils.ts", "utf8")
  .replace(/\r\n/g, "\n");
const card = fs
  .readFileSync("src/app/components/rad/social-share-card.tsx", "utf8")
  .replace(/\r\n/g, "\n");
const proxy = fs
  .readFileSync("src/app/api/social-image-proxy/route.ts", "utf8")
  .replace(/\r\n/g, "\n");

test("target review does not render a persistent cyan box", () => {
  assert.doesNotMatch(reactions, /border-sky-400\/25/);
  assert.doesNotMatch(reactions, /bg-sky-500\/10/);
  assert.doesNotMatch(reactions, /const isTargetReview/);
  assert.ok(reactions.includes("id={`review-${item.id}`}"));
  assert.ok(reactions.includes("data-review-id={item.id}"));
});

test("social post image loading does not get stuck forever on image error", () => {
  assert.match(utils, /export function preloadImage\(url: string, attempts = 3\)/);
  assert.match(utils, /window\.setTimeout\(tryLoad, 260 \* attempt\)/);
  assert.match(modal, /\? imageStatusByUrl\[activeHighlight\.image\] \?\? "loading"/);
  assert.match(modal, /selectedImageStatus === "loading"/);
  assert.match(modal, /selectedImageStatus === "error"/);
  assert.match(modal, /const shareHighlight = selectedImageError/);
  assert.match(modal, /highlight=\{shareHighlight\}/);
  assert.doesNotMatch(modal, /selectedImageStatus !== "ready"/);
});

test("social image proxy retries transient Wikimedia failures", () => {
  assert.match(proxy, /fetchImageWithRetry/);
  assert.match(proxy, /RETRYABLE_IMAGE_STATUSES/);
  assert.match(proxy, /502/);
  assert.match(proxy, /503/);
  assert.match(proxy, /RateAnyDay\/1\.0/);
});

test("social share card uses the exact lowercase site label", () => {
  assert.match(card, /const SITE_LABEL = "rateanyday\.com";/);
  assert.doesNotMatch(card, /Rated this day on/);
  assert.match(card, /\{SITE_LABEL\}/);
  assert.doesNotMatch(card, /Rateanyday\.com/);
});
