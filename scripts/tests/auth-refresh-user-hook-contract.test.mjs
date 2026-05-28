import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authModal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-auth-refresh-user.ts", "utf8");

test("auth modal delegates current-user refresh after auth actions to a dedicated hook", () => {
  assert.match(hook, /export function useAuthRefreshUser/);
  assert.match(hook, /refreshUserAndNotify/);
  assert.match(hook, /fetch\("\/api\/me"/);
  assert.match(hook, /onAuthSuccess\?\.\(user\)/);
  assert.match(hook, /onAuthSuccess\?\.\(null\)/);

  assert.match(authModal, /useAuthRefreshUser\(\{/);
  assert.match(authModal, /refreshUserAndNotify\(\)/);
  assert.doesNotMatch(authModal, /async function refreshUserAndNotify/);
  assert.doesNotMatch(authModal, /fetch\("\/api\/me"/);
});
