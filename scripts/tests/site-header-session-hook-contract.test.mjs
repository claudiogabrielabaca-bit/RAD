import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const header = fs.readFileSync("src/app/components/rad/site-header.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-site-header-session.ts", "utf8");

test("site header delegates current-user session loading to a dedicated hook", () => {
  assert.match(hook, /export function useSiteHeaderSession/);
  assert.match(hook, /fetchCurrentUserClientCached/);
  assert.match(hook, /rad-auth-changed/);
  assert.match(hook, /currentUser/);
  assert.match(hook, /isLoadingUser/);
  assert.match(hook, /setCurrentUser/);

  assert.match(header, /useSiteHeaderSession\(\)/);
  assert.match(header, /window\.dispatchEvent\(new Event\("rad-auth-changed"\)\)/);
  assert.doesNotMatch(header, /fetchCurrentUserClientCached/);
  assert.doesNotMatch(header, /type HeaderUser/);
  assert.doesNotMatch(header, /async function loadMe/);
  assert.doesNotMatch(header, /setIsLoadingUser/);
});
