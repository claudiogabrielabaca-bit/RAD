import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const modal = fs.readFileSync("src/app/components/rad/auth-modal.tsx", "utf8");
const api = fs.readFileSync("src/app/components/rad/auth-modal-api.ts", "utf8");

test("auth modal delegates auth endpoint requests to a dedicated api helper", () => {
  assert.match(api, /export type AuthEndpointResponse/);
  assert.match(api, /async function postAuthJson/);
  assert.match(api, /AUTH_JSON_HEADERS/);
  assert.match(api, /readAuthJson<AuthEndpointResponse>/);

  for (const endpoint of [
    "/api/login",
    "/api/login-code",
    "/api/resend-login-code",
    "/api/register",
    "/api/forgot-password",
    "/api/reset-password",
    "/api/verify-email",
    "/api/resend-verification",
  ]) {
    assert.match(api, new RegExp(endpoint.replaceAll("/", "\\/")));
  }

  for (const helper of [
    "submitLogin",
    "submitLoginCode",
    "submitResendLoginCode",
    "submitRegister",
    "submitForgotPassword",
    "submitResetPassword",
    "submitVerifyEmail",
    "submitResendVerification",
  ]) {
    assert.match(modal, new RegExp(helper));
  }

  assert.doesNotMatch(modal, /fetch\(/);
  assert.doesNotMatch(modal, /AUTH_JSON_HEADERS/);
  assert.doesNotMatch(modal, /readAuthJson/);
  assert.doesNotMatch(modal, /AuthEndpointResponse/);
});
