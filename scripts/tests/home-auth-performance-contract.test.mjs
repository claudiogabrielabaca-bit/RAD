import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const homePage = readFileSync(join(root, "src/app/home-page-client.tsx"), "utf8");

test("home page defers initial current-user refresh so day bundle can render first", () => {
  assert.match(homePage, /requestIdleCallback/);
  assert.match(homePage, /timeout:\s*1500/);
  assert.match(homePage, /setTimeout\(run,\s*1200\)/);
  assert.match(homePage, /void refreshCurrentUser\(\)/);
  assert.doesNotMatch(
    homePage,
    /useEffect\(\(\) => \{\s*refreshCurrentUser\(\);\s*\}, \[refreshCurrentUser\]\);/
  );
});
