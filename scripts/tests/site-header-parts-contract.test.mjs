import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const header = fs.readFileSync("src/app/components/rad/site-header.tsx", "utf8");
const parts = fs.readFileSync("src/app/components/rad/site-header-parts.tsx", "utf8");

const names = [
  "SearchIcon",
  "FeedIcon",
  "ImportantDaysIcon",
  "RankedDaysIcon",
  "LockIcon",
  "PencilIcon",
  "BellIcon",
  "NotificationSoundIcon",
  "BugIcon",
  "LogoutIcon",
  "HeaderNavLink",
  "HeaderNavButton",
  "MenuIconBadge",
];

test("site header keeps static visual parts outside the main header component", () => {
  assert.match(header, /from "@\/app\/components\/rad\/site-header-parts"/);
  assert.equal(parts.includes('import Link from "next/link";'), true);
  assert.equal(parts.includes('import type { ReactNode } from "react";'), true);

  for (const name of names) {
    assert.equal(parts.includes(`export function ${name}(`), true);
    assert.equal(header.includes(`function ${name}(`), false);
  }

  assert.equal(header.includes("type ReactNode"), false);
});
