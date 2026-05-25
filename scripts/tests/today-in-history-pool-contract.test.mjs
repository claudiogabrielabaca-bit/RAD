import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("today in history route does not shrink the persisted pool during reads", () => {
  const route = read("src/app/api/today-valid-day/route.ts");

  assert.match(route, /TodayHistoryPool/);
  assert.match(route, /read endpoint\. It must not shrink TodayHistoryPool/);
  assert.doesNotMatch(route, /prisma\.todayHistoryPool\.update/);
  assert.doesNotMatch(route, /validDays:\s*nextDays/);
  assert.match(route, /read-route-does-not-mutate-pool/);
});

test("today in history bundle validation can inspect more than one live candidate", () => {
  const route = read("src/app/api/today-valid-day/route.ts");

  assert.match(route, /const MAX_BUNDLE_ATTEMPTS = 12/);
  assert.match(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = MAX_BUNDLE_ATTEMPTS/);
  assert.doesNotMatch(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = 1/);
});

test("today in history keeps large client-side history instead of capping to a few days", () => {
  const history = read("src/app/lib/home-page-history.ts");

  assert.match(history, /export const TODAY_HISTORY_MAX = 1000/);
  assert.match(history, /TODAY_HISTORY_STORAGE_KEY_PREFIX/);
  assert.match(history, /rememberTodayHistoryDay/);
  assert.match(history, /clearTodayHistory/);
});
