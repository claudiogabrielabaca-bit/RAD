import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authModal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const lifecycleHook = fs.readFileSync("src/app/hooks/use-auth-modal-effects.ts", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-auth-turnstile.ts", "utf8");

test("auth modal delegates Turnstile token and reset state to a dedicated hook", () => {
  assert.match(hook, /export function useAuthTurnstile/);
  assert.match(hook, /turnstileToken/);
  assert.match(hook, /turnstileResetKey/);
  assert.match(hook, /clearTurnstileToken/);
  assert.match(hook, /resetTurnstile/);

  assert.match(authModal, /useAuthTurnstile\(\)/);
  assert.match(authModal, /clearTurnstileToken/);
  assert.match(authModal, /resetTurnstile/);
  assert.match(lifecycleHook, /clearTurnstileToken\(\)/);
  assert.match(lifecycleHook, /resetTurnstile\(\)/);
  assert.match(authModal, /onTokenChange=\{setTurnstileToken\}/);

  assert.doesNotMatch(authModal, /const \[turnstileToken, setTurnstileToken\] = useState/);
  assert.doesNotMatch(authModal, /const \[turnstileResetKey, setTurnstileResetKey\] = useState/);
  assert.doesNotMatch(authModal, /function resetTurnstile\(\)/);
});
