import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs
  .readFileSync("src/app/home-page-client.tsx", "utf8")
  .replace(/\r\n/g, "\n");

const hook = fs
  .readFileSync("src/app/hooks/use-hydrated.ts", "utf8")
  .replace(/\r\n/g, "\n");

test("home highlight controls stay disabled until client hydration is stable", () => {
  assert.match(home, /import \{ useHydrated \} from "@\/app\/hooks\/use-hydrated";/);
  assert.match(home, /const hydrated = useHydrated\(\);/);
  assert.match(home, /const canUseHighlightControls = hydrated && canSwitchHighlights;/);

  const disabledBindings = home.match(/disabled=\{!canUseHighlightControls\}/g) ?? [];
  assert.equal(disabledBindings.length, 3);

  assert.doesNotMatch(home, /disabled=\{!canSwitchHighlights\}/);
});

test("useHydrated avoids setState-in-effect hydration workarounds", () => {
  assert.match(hook, /useSyncExternalStore/);
  assert.match(hook, /getServerSnapshot/);
  assert.doesNotMatch(hook, /useEffect/);
  assert.doesNotMatch(hook, /setHydrated|setState/);
});
