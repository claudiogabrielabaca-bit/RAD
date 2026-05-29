import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-home-lazy-community-bundle.ts", "utf8");

test("home page delegates lazy public community bundle loading to a dedicated hook", () => {
  assert.match(hook, /export function useHomeLazyCommunityBundle/);
  assert.match(hook, /communityBundleLoadedDayRef/);
  assert.match(hook, /shouldLazyLoadPublicCommunity/);
  assert.match(hook, /async function loadCommunityBundle/);
  assert.match(hook, /function maybeLoadCommunityBundle/);
  assert.match(hook, /window\.addEventListener\("scroll"/);
  assert.match(hook, /window\.addEventListener\("resize"/);
  assert.match(hook, /navigationActionsRef\.current\.fetchDayBundle\(day\)/);
  assert.match(hook, /navigationActionsRef\.current\.applyBundlePayload/);
  assert.match(hook, /Could not load community activity\./);

  assert.match(home, /useHomeLazyCommunityBundle\(\{/);
  assert.match(home, /async function refreshDayCommunity/);
  assert.match(home, /requestTodayHistory\(\s*FORCE_FRESH_MODE\s*\)/);

  assert.doesNotMatch(home, /communityBundleLoadedDayRef/);
  assert.doesNotMatch(home, /async function loadCommunityBundle/);
  assert.doesNotMatch(home, /function maybeLoadCommunityBundle/);
  assert.doesNotMatch(home, /shouldLazyLoadPublicCommunity/);
  assert.doesNotMatch(home, /Could not load community activity\./);
});
