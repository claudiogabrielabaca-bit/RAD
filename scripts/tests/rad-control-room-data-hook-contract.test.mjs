import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/app/rad-control-room/page.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-rad-control-room-data.ts", "utf8");

test("rad control room delegates initial admin data loading to a dedicated hook", () => {
  assert.match(hook, /export function useRadControlRoomData/);
  assert.match(hook, /const \[reports, setReports\] = useState/);
  assert.match(hook, /const \[recentReviews, setRecentReviews\] = useState/);
  assert.match(hook, /const \[stats, setStats\] = useState/);
  assert.match(hook, /const \[loading, setLoading\] = useState/);
  assert.match(hook, /const \[toast, setToast\] = useState/);
  assert.match(hook, /fetch\("\/api\/admin\/reports"/);
  assert.match(hook, /fetch\("\/api\/admin\/stats"/);
  assert.match(hook, /fetch\("\/api\/admin\/recent-reviews"/);
  assert.match(hook, /readReportsPayload/);
  assert.match(hook, /readReviewsPayload/);
  assert.match(hook, /readStatsPayload/);
  assert.match(hook, /void loadAll\(\)/);

  assert.match(page, /useRadControlRoomData\(\)/);
  assert.doesNotMatch(page, /useCallback/);
  assert.doesNotMatch(page, /useEffect/);
  assert.doesNotMatch(page, /const \[reports, setReports\]/);
  assert.doesNotMatch(page, /const \[recentReviews, setRecentReviews\]/);
  assert.doesNotMatch(page, /const \[stats, setStats\]/);
  assert.doesNotMatch(page, /const \[loading, setLoading\]/);
  assert.doesNotMatch(page, /const \[toast, setToast\]/);
  assert.doesNotMatch(page, /const loadAll =/);
  assert.doesNotMatch(page, /fetch\("\/api\/admin\/reports"/);
  assert.doesNotMatch(page, /fetch\("\/api\/admin\/stats"/);
  assert.doesNotMatch(page, /fetch\("\/api\/admin\/recent-reviews"/);
});
