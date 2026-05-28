import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const modal = fs.readFileSync("src/app/components/rad/social-post-modal.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-social-post-download.ts", "utf8");

test("social post modal delegates PNG download generation to a dedicated hook", () => {
  assert.match(hook, /export function useSocialPostDownload/);
  assert.match(hook, /const \[downloading, setDownloading\] = useState/);
  assert.match(hook, /async function handleDownload/);
  assert.match(hook, /waitForImages/);
  assert.match(hook, /toPng/);
  assert.match(hook, /SOCIAL_POST_WIDTH/);
  assert.match(hook, /SOCIAL_POST_HEIGHT/);
  assert.match(hook, /link\.download =/);
  assert.match(hook, /rad-post-\$\{day\}\.png/);

  assert.match(modal, /useSocialPostDownload\(\{/);
  assert.match(modal, /onClick=\{handleDownload\}/);
  assert.match(modal, /disabled=\{downloading \|\| selectedImageLoading\}/);

  assert.doesNotMatch(modal, /from "html-to-image"/);
  assert.doesNotMatch(modal, /waitForImages/);
  assert.doesNotMatch(modal, /setDownloading/);
  assert.doesNotMatch(modal, /async function handleDownload/);
  assert.doesNotMatch(modal, /toPng\(/);
  assert.doesNotMatch(modal, /link\.download =/);
});

