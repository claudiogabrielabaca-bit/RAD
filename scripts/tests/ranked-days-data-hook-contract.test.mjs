import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync("src/app/components/rad/ranked-days-panel.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-ranked-days-data.ts", "utf8");

test("ranked days panel delegates top/low ranking loading to a dedicated hook", () => {
  assert.match(hook, /export function useRankedDaysData/);
  assert.match(hook, /const \[top, setTop\] = useState/);
  assert.match(hook, /const \[low, setLow\] = useState/);
  assert.match(hook, /const \[loading, setLoading\] = useState/);
  assert.match(hook, /const \[error, setError\] = useState/);
  assert.match(hook, /fetch\("\/api\/top"/);
  assert.match(hook, /cache: "no-store"/);
  assert.match(hook, /setTop\(\(json\?\.top \?\? \[\]\) as TopItem\[\]\)/);
  assert.match(hook, /setLow\(\(json\?\.low \?\? \[\]\) as TopItem\[\]\)/);

  assert.match(panel, /useRankedDaysData\(\)/);
  assert.doesNotMatch(panel, /useEffect/);
  assert.doesNotMatch(panel, /useState/);
  assert.doesNotMatch(panel, /setTop/);
  assert.doesNotMatch(panel, /setLow/);
  assert.doesNotMatch(panel, /setLoading/);
  assert.doesNotMatch(panel, /setError/);
  assert.doesNotMatch(panel, /async function run/);
  assert.doesNotMatch(panel, /fetch\("\/api\/top"/);
});
