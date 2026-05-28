import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const modal = fs.readFileSync("src/app/components/rad/social-post-modal.tsx", "utf8");
const utils = fs.readFileSync("src/app/components/rad/social-post-modal-utils.ts", "utf8");

test("social post modal keeps image/export helpers outside the modal component", () => {
  assert.match(modal, /from "@\/app\/components\/rad\/social-post-modal-utils"/);

  assert.match(utils, /export type ImageLoadStatus/);
  assert.match(utils, /export function getHighlightPreviewLabel/);
  assert.match(utils, /export function getSocialImageProxyUrl/);
  assert.match(utils, /export function withProxiedImage/);
  assert.match(utils, /export function preloadImage/);
  assert.match(utils, /export async function waitForImages/);

  assert.doesNotMatch(modal, /type ImageLoadStatus =/);
  assert.doesNotMatch(modal, /function getHighlightPreviewLabel\(/);
  assert.doesNotMatch(modal, /function getSocialImageProxyUrl\(/);
  assert.doesNotMatch(modal, /function withProxiedImage\(/);
  assert.doesNotMatch(modal, /function preloadImage\(/);
  assert.doesNotMatch(modal, /async function waitForImages\(/);
});
