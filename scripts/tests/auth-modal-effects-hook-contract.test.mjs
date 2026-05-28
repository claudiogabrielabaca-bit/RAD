import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const modal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-auth-modal-effects.ts", "utf8");

test("auth modal delegates lifecycle and escape effects to a dedicated hook", () => {
  assert.match(hook, /export function useAuthModalLifecycle/);
  assert.match(hook, /export function useAuthModalEscapeClose/);
  assert.match(hook, /useEffect/);
  assert.match(hook, /resetAuthFeedback/);
  assert.match(hook, /resetCurrentUserEmailVerified/);
  assert.match(hook, /clearTurnstileToken/);
  assert.match(hook, /resetTurnstile/);
  assert.match(hook, /window\.addEventListener\("keydown"/);
  assert.match(hook, /window\.removeEventListener\("keydown"/);

  assert.match(modal, /useAuthModalLifecycle\(\{/);
  assert.match(modal, /useAuthModalEscapeClose\(\{/);

  assert.doesNotMatch(modal, /useEffect/);
  assert.doesNotMatch(modal, /window\.addEventListener\("keydown"/);
  assert.doesNotMatch(modal, /window\.removeEventListener\("keydown"/);
});
