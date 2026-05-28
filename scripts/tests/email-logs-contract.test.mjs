import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const files = [
  "src/app/api/forgot-password/route.ts",
  "src/app/api/login/route.ts",
  "src/app/api/register/route.ts",
  "src/app/api/resend-login-code/route.ts",
  "src/app/api/resend-verification/route.ts",
  "src/app/api/suggest-event/route.ts",
];

test("transactional email success logs are development-only", () => {
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");

    const matches = [
      ...source.matchAll(/console\.log\("[^"]+ email sent:", mailResult\?\.id\);/g),
    ];

    for (const match of matches) {
      const before = source.slice(Math.max(0, match.index - 120), match.index);
      assert.match(
        before,
        /process\.env\.NODE_ENV === "development"/,
        `${file} has an email success console.log not gated to development`
      );
    }
  }
});
