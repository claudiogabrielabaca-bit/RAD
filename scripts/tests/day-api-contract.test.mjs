import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const homePage = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const legacyDayRoute = fs.readFileSync("src/app/api/day/route.ts", "utf8");
const dayBundleLib = fs.readFileSync("src/app/lib/day-bundle.ts", "utf8");

test("legacy /api/day delegates to the bounded day-bundle community builder", () => {
  assert.match(legacyDayRoute, /buildDayCommunityBundle/);
  assert.match(legacyDayRoute, /consumeRateLimit/);
  assert.match(legacyDayRoute, /action: "day-legacy"/);
  assert.match(legacyDayRoute, /NextResponse\.json\(payload\.dayData/);
  assert.doesNotMatch(legacyDayRoute, /prisma\.rating\.findMany/);
  assert.doesNotMatch(legacyDayRoute, /buildReplyTree/);
});

test("home page no longer calls the legacy /api/day endpoint", () => {
  assert.doesNotMatch(homePage, /\/api\/day\?day=/);
  assert.doesNotMatch(homePage, /\n\s*async function loadDay\(d: string\)/);
  assert.doesNotMatch(homePage, /\n\s*loadDay\(day\);/);
  assert.match(homePage, /async function refreshDayCommunity/);
  assert.match(homePage, /void refreshDayCommunity\(day\);/);
  assert.match(homePage, /fetchDayBundle\(d, \{\n\s+communityOnly: true,\n\s+\}\)/);
});

test("day-bundle community builder remains bounded and highlight-light", () => {
  assert.match(dayBundleLib, /const DAY_BUNDLE_REVIEW_LIMIT = 50/);
  assert.match(dayBundleLib, /const DAY_BUNDLE_REPLY_LIMIT_PER_REVIEW = 25/);
  assert.match(dayBundleLib, /export async function buildDayCommunityBundle/);
  assert.match(dayBundleLib, /includeHighlights: false/);
});


test("home page has no legacy loadDay helper or legacy day endpoint call", () => {
  assert.doesNotMatch(homePage, /\/api\/day\?day=/);
  assert.doesNotMatch(homePage, /\bloadDay\s*\(/);
});
