import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authModal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const authModalUtils = fs.readFileSync("src/app/components/rad/auth-modal-utils.ts", "utf8");

test("auth modal centralizes low-level request parsing helpers", () => {
  assert.match(authModalUtils, /export const AUTH_JSON_HEADERS/);
  assert.match(authModalUtils, /export function normalizeEmail/);
  assert.match(authModalUtils, /export async function readAuthJson/);

  assert.match(authModal, /from "@\/app\/components\/rad\/auth-modal-utils"/);
  assert.match(authModal, /readAuthJson<AuthEndpointResponse>/);
  assert.match(authModal, /headers: AUTH_JSON_HEADERS/);

  assert.doesNotMatch(authModal, /function normalizeEmail\(value: string\)/);
  assert.doesNotMatch(authModal, /res\.json\(\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(authModal, /"Content-Type": "application\/json"/);
});

test("auth modal keeps view title and subtitle outside the main component", () => {
  assert.match(authModalUtils, /export function getAuthViewContent/);
  assert.match(authModal, /getAuthViewContent\(view\)/);
  assert.doesNotMatch(authModal, /const title = useMemo/);
  assert.doesNotMatch(authModal, /const subtitle = useMemo/);
  assert.doesNotMatch(authModal, /useMemo/);
});
