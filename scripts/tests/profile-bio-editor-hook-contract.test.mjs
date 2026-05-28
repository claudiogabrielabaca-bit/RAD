import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profile = fs.readFileSync("src/app/profile/profile-page-client.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-profile-bio-editor.ts", "utf8");

test("profile page delegates bio editor state and save action to a dedicated hook", () => {
  assert.match(hook, /export function useProfileBioEditor/);
  assert.match(hook, /bioModalOpen/);
  assert.match(hook, /bioDraft/);
  assert.match(hook, /bioSaving/);
  assert.match(hook, /bioError/);
  assert.match(hook, /displayedBio/);
  assert.match(hook, /function openBioModal/);
  assert.match(hook, /function closeBioModal/);
  assert.match(hook, /function updateBioDraft/);
  assert.match(hook, /async function saveBio/);
  assert.match(hook, /\/api\/profile\/bio/);

  assert.match(profile, /useProfileBioEditor\(\{/);
  assert.match(profile, /\{displayedBio\}/);
  assert.match(profile, /onChange=\{\(e\) => updateBioDraft\(e\.target\.value\)\}/);
  assert.doesNotMatch(profile, /const \[bioModalOpen/);
  assert.doesNotMatch(profile, /const \[bioDraft/);
  assert.doesNotMatch(profile, /const \[bioSaving/);
  assert.doesNotMatch(profile, /const \[bioError/);
  assert.doesNotMatch(profile, /function getDisplayedBio/);
  assert.doesNotMatch(profile, /function openBioModal/);
  assert.doesNotMatch(profile, /function closeBioModal/);
  assert.doesNotMatch(profile, /async function saveBio/);
  assert.doesNotMatch(profile, /\/api\/profile\/bio/);
});
