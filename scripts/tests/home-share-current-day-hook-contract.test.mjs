import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-home-share-current-day.ts", "utf8");

test("home page delegates current day sharing to a dedicated hook", () => {
  assert.match(hook, /export function useHomeShareCurrentDay/);
  assert.match(hook, /const shareCurrentDay = useCallback\(async/);
  assert.match(hook, /formatDisplayDate\(day\)/);
  assert.match(hook, /decodeHtml\(highlight\?\.title/);
  assert.match(hook, /navigator\.share/);
  assert.match(hook, /navigator\.clipboard\.writeText/);
  assert.match(hook, /Day link copied\./);
  assert.match(hook, /Unable to copy day link\./);

  assert.match(home, /useHomeShareCurrentDay\(\{/);
  assert.match(home, /shareCurrentDay/);

  assert.doesNotMatch(home, /async function shareCurrentDay/);
  assert.doesNotMatch(home, /navigator\.share/);
  assert.doesNotMatch(home, /navigator\.clipboard/);
  assert.doesNotMatch(home, /decodeHtml\(highlight\?\.title/);
});
