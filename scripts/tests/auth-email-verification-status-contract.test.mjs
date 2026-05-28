import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authModal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const hook = fs.readFileSync(
  "src/app/hooks/use-auth-email-verification-status.ts",
  "utf8"
);

test("auth modal delegates verify-email current user status to a dedicated hook", () => {
  assert.match(hook, /export function useAuthEmailVerificationStatus/);
  assert.match(hook, /currentUserEmailVerified/);
  assert.match(hook, /resetCurrentUserEmailVerified/);
  assert.match(hook, /markCurrentUserEmailVerified/);
  assert.match(hook, /markCurrentUserEmailUnverified/);
  assert.match(hook, /fetch\("\/api\/me"/);
  assert.match(hook, /view !== "verify-email"/);
  assert.match(hook, /setEmail\(meEmail\)/);

  assert.match(authModal, /useAuthEmailVerificationStatus\(\{/);
  assert.match(authModal, /resetCurrentUserEmailVerified/);
  assert.doesNotMatch(authModal, /const \[currentUserEmailVerified/);
  assert.doesNotMatch(authModal, /async function loadMe\(\)/);
});
