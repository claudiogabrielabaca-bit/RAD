import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authModal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const authModalParts = fs.readFileSync("src/app/components/rad/auth-modal-parts.tsx", "utf8");

test("auth modal keeps static visual parts outside the main auth component", () => {
  assert.match(authModal, /from "@\/app\/components\/rad\/auth-modal-parts"/);
  assert.doesNotMatch(authModal, /function EyeIcon\(/);
  assert.doesNotMatch(authModal, /function EyeOffIcon\(/);
  assert.doesNotMatch(authModal, /function PasswordField\(/);
  assert.doesNotMatch(authModal, /function ContextLink\(/);

  assert.match(authModalParts, /export function EyeIcon\(/);
  assert.match(authModalParts, /export function EyeOffIcon\(/);
  assert.match(authModalParts, /export function PasswordField\(/);
  assert.match(authModalParts, /export function ContextLink\(/);
});
