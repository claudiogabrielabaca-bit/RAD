import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-home-date-picker.ts", "utf8");

test("home page delegates manual date picker state to a dedicated hook", () => {
  assert.match(hook, /export function useHomeDatePicker/);
  assert.match(hook, /const \[selectedYear, setSelectedYear\] = useState/);
  assert.match(hook, /const \[selectedMonth, setSelectedMonth\] = useState/);
  assert.match(hook, /const \[selectedDay, setSelectedDay\] = useState/);
  assert.match(hook, /getDaysInMonth/);
  assert.match(hook, /Array\.from\(\{ length: daysInSelectedMonth \}/);
  assert.match(hook, /setSelectedYear\(y\)/);
  assert.match(hook, /setSelectedMonth\(m\)/);
  assert.match(hook, /setSelectedDay\(d\)/);

  assert.match(home, /useHomeDatePicker\(\{/);
  assert.match(home, /days: DAYS/);
  assert.match(home, /selectedYear=\{selectedYear\}/);
  assert.match(home, /onYearChange=\{setSelectedYear\}/);

  assert.doesNotMatch(home, /const \[selectedYear, setSelectedYear\] = useState/);
  assert.doesNotMatch(home, /const \[selectedMonth, setSelectedMonth\] = useState/);
  assert.doesNotMatch(home, /const \[selectedDay, setSelectedDay\] = useState/);
  assert.doesNotMatch(home, /const daysInSelectedMonth = getDaysInMonth/);
  assert.doesNotMatch(home, /const DAYS = Array\.from/);
  assert.doesNotMatch(home, /setSelectedYear\(y\)/);
  assert.doesNotMatch(home, /setSelectedMonth\(m\)/);
  assert.doesNotMatch(home, /setSelectedDay\(d\)/);
});
