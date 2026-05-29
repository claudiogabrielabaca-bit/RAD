import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const feedRoute = fs
  .readFileSync("src/app/api/feed/route.ts", "utf8")
  .replace(/\r\n/g, "\n");

const feedCard = fs
  .readFileSync("src/app/components/rad/feed-post-card.tsx", "utf8")
  .replace(/^\uFEFF/, "")
  .replace(/\r\n/g, "\n");

test("feed keeps edited reviews in their original feed position", () => {
  assert.match(feedRoute, /orderBy:\s*\[\s*{\s*createdAt: "desc"/);
  assert.doesNotMatch(feedRoute, /orderBy:\s*{\s*updatedAt: "desc"/);
});

test("feed card shows created date as primary and labels edited posts", () => {
  assert.match(feedCard, /function wasFeedPostEdited/);
  assert.match(feedCard, /formatTimestamp\(item\.createdAt\)/);
  assert.match(feedCard, />edited</);
  assert.doesNotMatch(feedCard, /\{formatTimestamp\(item\.updatedAt\)\}/);
});
