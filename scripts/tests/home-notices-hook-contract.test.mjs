import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-home-notices.ts", "utf8");

test("home page delegates toast and today-in-history notices to a dedicated hook", () => {
  assert.match(hook, /export function useHomeNotices/);
  assert.match(hook, /const \[toast, setToast\] = useState/);
  assert.match(hook, /const \[todayHistoryNotice, setTodayHistoryNotice\] = useState/);
  assert.match(hook, /toastTimeoutRef/);
  assert.match(hook, /todayHistoryNoticeTimeoutRef/);
  assert.match(hook, /const showToast = useCallback/);
  assert.match(hook, /const showTodayHistoryNotice = useCallback/);
  assert.match(hook, /clearTimeout/);

  assert.match(home, /useHomeNotices\(\)/);
  assert.match(home, /showToast/);
  assert.match(home, /showTodayHistoryNotice/);
  assert.match(home, /setToast/);
  assert.match(home, /setTodayHistoryNotice/);

  assert.doesNotMatch(home, /toastTimeoutRef/);
  assert.doesNotMatch(home, /todayHistoryNoticeTimeoutRef/);
  assert.doesNotMatch(home, /function showToast/);
  assert.doesNotMatch(home, /function showTodayHistoryNotice/);
});
