import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authModal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-auth-form-fields.ts", "utf8");

test("auth modal delegates form field state to a dedicated hook", () => {
  assert.match(hook, /export function useAuthFormFields/);
  assert.match(hook, /const \[email, setEmail\] = useState/);
  assert.match(hook, /const \[username, setUsername\] = useState/);
  assert.match(hook, /const \[password, setPassword\] = useState/);
  assert.match(hook, /const \[code, setCode\] = useState/);
  assert.match(hook, /const \[newPassword, setNewPassword\] = useState/);
  assert.match(hook, /const \[confirmPassword, setConfirmPassword\] = useState/);

  assert.match(authModal, /useAuthFormFields\(initialEmail\)/);
  assert.doesNotMatch(authModal, /import React, \{ useEffect, useState \} from "react"/);
  assert.doesNotMatch(authModal, /const \[email, setEmail\] = useState/);
  assert.doesNotMatch(authModal, /const \[username, setUsername\] = useState/);
  assert.doesNotMatch(authModal, /const \[password, setPassword\] = useState/);
  assert.doesNotMatch(authModal, /const \[code, setCode\] = useState/);
  assert.doesNotMatch(authModal, /const \[newPassword, setNewPassword\] = useState/);
  assert.doesNotMatch(authModal, /const \[confirmPassword, setConfirmPassword\] = useState/);
  assert.doesNotMatch(authModal, /= useState\(/);
});
