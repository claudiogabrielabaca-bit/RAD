import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("today in history client does not force expensive fresh retries", () => {
  const homePage = read("src/app/home-page-client.tsx");

  assert.match(homePage, /requestTodayHistory\(\r?\n\s*FORCE_FRESH_MODE\r?\n\s*\)/);
  assert.doesNotMatch(homePage, /FORCE_FRESH_MODE \|\| attempt > 0/);
});

test("today in history route keeps read requests cache-first and bounded", () => {
  const route = read("src/app/api/today-valid-day/route.ts");

  assert.match(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = 2/);
  assert.doesNotMatch(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = MAX_BUNDLE_ATTEMPTS/);
  assert.doesNotMatch(route, /await prisma\.todayHistoryPool\.update/);
});
