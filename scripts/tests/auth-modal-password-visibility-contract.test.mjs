import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authModal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-auth-password-visibility.ts", "utf8");

test("auth modal delegates password visibility state to a dedicated hook", () => {
  assert.match(hook, /export function useAuthPasswordVisibility/);
  assert.match(hook, /resetPasswordVisibility/);
  assert.match(hook, /toggleLoginPassword/);
  assert.match(hook, /toggleRegisterPassword/);
  assert.match(hook, /toggleNewPassword/);
  assert.match(hook, /toggleConfirmPassword/);

  assert.match(authModal, /useAuthPasswordVisibility\(\)/);
  assert.match(authModal, /resetPasswordVisibility\(\)/);
  assert.match(authModal, /onToggle=\{toggleLoginPassword\}/);
  assert.match(authModal, /onToggle=\{toggleRegisterPassword\}/);
  assert.match(authModal, /onToggle=\{toggleNewPassword\}/);
  assert.match(authModal, /onToggle=\{toggleConfirmPassword\}/);

  assert.doesNotMatch(authModal, /setShowLoginPassword/);
  assert.doesNotMatch(authModal, /setShowRegisterPassword/);
  assert.doesNotMatch(authModal, /setShowNewPassword/);
  assert.doesNotMatch(authModal, /setShowConfirmPassword/);
});
