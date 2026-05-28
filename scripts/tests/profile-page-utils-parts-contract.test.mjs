import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profile = fs.readFileSync("src/app/profile/profile-page-client.tsx", "utf8");
const utils = fs.readFileSync("src/app/profile/profile-page-utils.ts", "utf8");
const parts = fs.readFileSync("src/app/profile/profile-page-parts.tsx", "utf8");

test("profile page keeps pure helpers, DTO types, and static icon outside the client component", () => {
  assert.match(profile, /from "@\/app\/profile\/profile-page-utils"/);
  assert.match(profile, /from "@\/app\/profile\/profile-page-parts"/);

  assert.match(utils, /export const BIO_MAX_LENGTH = 160/);
  assert.match(utils, /export type ProfilePayload/);
  assert.match(utils, /export function formatDateTime/);
  assert.match(utils, /export function buildReviewDeepLink/);
  assert.match(utils, /export function buildLoginRedirectPath/);
  assert.match(utils, /export function buildVerifyEmailRedirectPath/);
  assert.match(parts, /export function PencilIcon/);
  assert.match(parts, /export function renderStars/);

  assert.doesNotMatch(profile, /type ProfilePayload =/);
  assert.doesNotMatch(profile, /function formatDateTime\(/);
  assert.doesNotMatch(profile, /function buildReviewDeepLink\(/);
  assert.doesNotMatch(profile, /function PencilIcon\(/);
});
