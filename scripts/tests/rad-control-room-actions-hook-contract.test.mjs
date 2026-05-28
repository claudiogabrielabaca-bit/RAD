import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/app/rad-control-room/page.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-rad-control-room-actions.ts", "utf8");

test("rad control room delegates admin moderation actions to a dedicated hook", () => {
  assert.match(hook, /export function useRadControlRoomActions/);
  assert.match(hook, /const \[actionKey, setActionKey\] = useState/);
  assert.match(hook, /async function updateReportStatus/);
  assert.match(hook, /async function deleteReviewAsAdmin/);
  assert.match(hook, /async function logout/);
  assert.match(hook, /fetch\("\/api\/admin\/report-resolve"/);
  assert.match(hook, /fetch\("\/api\/admin\/delete-review"/);
  assert.match(hook, /fetch\("\/api\/admin\/logout"/);
  assert.match(hook, /reportType:\s*report\.reportType/);

  assert.match(page, /useRadControlRoomActions\(\{/);
  assert.doesNotMatch(page, /const \[actionKey, setActionKey\]/);
  assert.doesNotMatch(page, /async function updateReportStatus/);
  assert.doesNotMatch(page, /async function deleteReviewAsAdmin/);
  assert.doesNotMatch(page, /async function logout/);
  assert.doesNotMatch(page, /fetch\("\/api\/admin\/report-resolve"/);
  assert.doesNotMatch(page, /fetch\("\/api\/admin\/delete-review"/);
  assert.doesNotMatch(page, /fetch\("\/api\/admin\/logout"/);
});
