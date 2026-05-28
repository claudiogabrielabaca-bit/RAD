import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profile = fs.readFileSync("src/app/profile/profile-page-client.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-profile-data.ts", "utf8");

test("profile page delegates profile data loading to a dedicated hook", () => {
  assert.match(hook, /export function useProfileData/);
  assert.match(hook, /fetch\("\/api\/profile"/);
  assert.match(hook, /buildLoginRedirectPath/);
  assert.match(hook, /setLoading/);
  assert.match(hook, /setError/);
  assert.match(hook, /loadProfile/);
  assert.match(hook, /useEffect/);
  assert.match(hook, /type ProfilePayload/);

  assert.match(profile, /useProfileData\(\{/);
  assert.doesNotMatch(profile, /useCallback/);
  assert.doesNotMatch(profile, /useEffect/);
  assert.doesNotMatch(profile, /setLoading/);
  assert.doesNotMatch(profile, /setError/);
  assert.doesNotMatch(profile, /const loadProfile/);
  assert.doesNotMatch(profile, /fetch\("\/api\/profile"/);
  assert.doesNotMatch(profile, /buildLoginRedirectPath/);
  assert.doesNotMatch(profile, /ProfilePayload/);
});
