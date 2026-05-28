import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-home-day-controls.ts", "utf8");

test("home page delegates day navigation controls to a dedicated hook", () => {
  assert.match(hook, /export function useHomeDayControls/);
  assert.match(hook, /getDayWithOffset/);
  assert.match(hook, /getDayWithYearShift/);
  assert.match(hook, /goToToday/);
  assert.match(hook, /goToPreviousDay/);
  assert.match(hook, /goToNextDay/);
  assert.match(hook, /goToPreviousYear/);
  assert.match(hook, /goToNextYear/);
  assert.match(hook, /isAtMinDay/);
  assert.match(hook, /isAtToday/);
  assert.match(hook, /isAtMinYear/);
  assert.match(hook, /isAtMaxYear/);

  assert.match(home, /useHomeDayControls\(\{/);
  assert.match(home, /goToToday/);
  assert.match(home, /goToPreviousDay/);
  assert.match(home, /goToNextDay/);
  assert.match(home, /goToPreviousYear/);
  assert.match(home, /goToNextYear/);

  assert.doesNotMatch(home, /function goToToday\(\)/);
  assert.doesNotMatch(home, /function goToPreviousDay\(\)/);
  assert.doesNotMatch(home, /function goToNextDay\(\)/);
  assert.doesNotMatch(home, /function shiftYearBy\(/);
  assert.doesNotMatch(home, /function goToPreviousYear\(\)/);
  assert.doesNotMatch(home, /function goToNextYear\(\)/);
  assert.doesNotMatch(home, /getDayWithOffset\(/);
  assert.doesNotMatch(home, /getDayWithYearShift\(/);
  assert.doesNotMatch(home, /prevYearCandidate/);
  assert.doesNotMatch(home, /nextYearCandidate/);
});
