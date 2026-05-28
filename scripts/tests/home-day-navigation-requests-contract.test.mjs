import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const hook = fs.readFileSync("src/app/hooks/use-home-day-navigation.ts", "utf8");
const requests = fs.readFileSync("src/app/lib/home-day-navigation-requests.ts", "utf8");

test("home day navigation delegates day-bundle HTTP to a request helper", () => {
  assert.match(requests, /export async function fetchDayBundleRequest/);
  assert.match(requests, /new URLSearchParams\(\{ day: targetDay \}\)/);
  assert.match(requests, /communityOnly/);
  assert.match(requests, /params\.set\("communityOnly", "1"\)/);
  assert.match(requests, /fetch\("/);
  assert.match(requests, /\/api\/day-bundle/);
  assert.match(requests, /cache: "no-store"/);
  assert.match(requests, /signal: options\?\.signal/);
  assert.match(requests, /res\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(requests, /Failed to load day bundle/);

  assert.match(hook, /from "@\/app\/lib\/home-day-navigation-requests"/);
  assert.match(hook, /fetchDayBundleRequest\(targetDay/);
  assert.match(hook, /signal: controller\.signal/);

  assert.doesNotMatch(hook, /await fetch\(/);
  assert.doesNotMatch(hook, /const res = await fetch/);
  assert.doesNotMatch(hook, /res\.json\(\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(hook, /\/api\/day-bundle/);
  assert.doesNotMatch(hook, /new URLSearchParams\(\{ day: targetDay \}\)/);
});
