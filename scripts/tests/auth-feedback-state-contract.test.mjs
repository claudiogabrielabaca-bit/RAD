import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authModal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-auth-feedback-state.ts", "utf8");

test("auth modal delegates feedback and loading state to a dedicated hook", () => {
  assert.match(hook, /export function useAuthFeedbackState/);
  assert.match(hook, /const \[loading, setLoading\] = useState/);
  assert.match(hook, /const \[secondaryLoading, setSecondaryLoading\] = useState/);
  assert.match(hook, /const \[message, setMessage\] = useState/);
  assert.match(hook, /const \[error, setError\] = useState/);
  assert.match(hook, /const \[devCode, setDevCode\] = useState/);
  assert.match(hook, /function resetAuthFeedback/);
  assert.match(hook, /function resetAuthLoading/);

  assert.match(authModal, /useAuthFeedbackState\(\)/);
  assert.doesNotMatch(authModal, /const \[loading, setLoading\] = useState/);
  assert.doesNotMatch(authModal, /const \[secondaryLoading, setSecondaryLoading\] = useState/);
  assert.doesNotMatch(authModal, /const \[message, setMessage\] = useState/);
  assert.doesNotMatch(authModal, /const \[error, setError\] = useState/);
  assert.doesNotMatch(authModal, /const \[devCode, setDevCode\] = useState/);
});
