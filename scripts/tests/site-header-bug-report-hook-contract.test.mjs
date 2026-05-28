import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const header = fs.readFileSync("src/app/components/rad/site-header.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-site-header-bug-report.ts", "utf8");

test("site header delegates bug report state and actions to a dedicated hook", () => {
  assert.match(hook, /export function useSiteHeaderBugReport/);
  assert.match(hook, /reportBugOpen/);
  assert.match(hook, /bugDescription/);
  assert.match(hook, /bugScreenshot/);
  assert.match(hook, /openBugReport/);
  assert.match(hook, /closeBugReport/);
  assert.match(hook, /submitBugReport/);
  assert.match(hook, /\/api\/report-bug/);

  assert.match(header, /useSiteHeaderBugReport\(\{/);
  assert.match(header, /onClose=\{closeBugReport\}/);
  assert.doesNotMatch(header, /function openBugReport/);
  assert.doesNotMatch(header, /async function submitBugReport/);
  assert.doesNotMatch(header, /new FormData\(/);
  assert.doesNotMatch(header, /\/api\/report-bug/);
  assert.doesNotMatch(header, /setReportBugOpen/);
  assert.doesNotMatch(header, /setReportBugError/);
  assert.doesNotMatch(header, /setReportBugSuccess/);
});
