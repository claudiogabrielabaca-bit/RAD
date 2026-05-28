import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const strip = fs.readFileSync("src/app/components/rad/important-days-strip.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-important-days-stats.ts", "utf8");

test("important days strip delegates stats loading and cache to a dedicated hook", () => {
  assert.match(hook, /export type MomentStats/);
  assert.match(hook, /export const EMPTY_IMPORTANT_DAY_STATS/);
  assert.match(hook, /export function useImportantDaysStats/);
  assert.match(hook, /importantDaysStatsCache/);
  assert.match(hook, /importantDaysStatsRequest/);
  assert.match(hook, /function buildFallbackStatsMap/);
  assert.match(hook, /function normalizeStatsMap/);
  assert.match(hook, /async function loadImportantDaysStats/);
  assert.match(hook, /fetch\("\/api\/day-stats-batch"/);
  assert.match(hook, /cache: "no-store"/);
  assert.match(hook, /setStatsByDay\(stats\)/);

  assert.match(strip, /from "@\/app\/hooks\/use-important-days-stats"/);
  assert.match(strip, /useImportantDaysStats\(\)/);
  assert.match(strip, /EMPTY_IMPORTANT_DAY_STATS/);
  assert.match(strip, /type MomentStats/);

  assert.doesNotMatch(strip, /type MomentStats =/);
  assert.doesNotMatch(strip, /useEffect/);
  assert.doesNotMatch(strip, /DayStatsBatchResponse/);
  assert.doesNotMatch(strip, /FALLBACK_STATS/);
  assert.doesNotMatch(strip, /importantDaysStatsCache/);
  assert.doesNotMatch(strip, /importantDaysStatsRequest/);
  assert.doesNotMatch(strip, /function buildFallbackStatsMap/);
  assert.doesNotMatch(strip, /function normalizeStatsMap/);
  assert.doesNotMatch(strip, /async function loadImportantDaysStats/);
  assert.doesNotMatch(strip, /setStatsByDay/);
  assert.doesNotMatch(strip, /fetch\("\/api\/day-stats-batch"/);
});
