import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("current user exposes a soft-timeout helper for non-critical public rendering", () => {
  const source = read("src/app/lib/current-user.ts");

  assert.match(source, /export async function getCurrentUserWithin/);
  assert.match(source, /Promise\.race/);
  assert.match(source, /setTimeout\(\(\) => resolve\(null\), timeoutMs\)/);
  assert.match(source, /return getCurrentUser\(\)/);
});

test("day bundle does not block public rendering indefinitely on slow session lookup", () => {
  const source = read("src/app/lib/day-bundle.ts");

  assert.match(source, /getCurrentUserWithin/);
  assert.match(source, /DAY_BUNDLE_CURRENT_USER_TIMEOUT_MS = 900/);
  assert.match(
    source,
    /export async function buildDayBundle\(day: string\)[\s\S]*getCurrentUserWithin\(DAY_BUNDLE_CURRENT_USER_TIMEOUT_MS\)/
  );
});

test("community-only bundle still uses strict current user lookup for user-specific refreshes", () => {
  const source = read("src/app/lib/day-bundle.ts");

  assert.match(
    source,
    /export async function buildDayCommunityBundle\(day: string\)\s*\{\s*const user = await getCurrentUser\(\);/
  );
});
