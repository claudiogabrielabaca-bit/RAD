import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const header = fs.readFileSync("src/app/components/rad/site-header.tsx", "utf8");
const notifications = fs.readFileSync(
  "src/app/components/rad/site-header-notifications.ts",
  "utf8"
);

test("site header keeps notification client helpers outside the main header component", () => {
  assert.match(header, /from "@\/app\/components\/rad\/site-header-notifications"/);

  assert.match(notifications, /export type HeaderNotification/);
  assert.match(notifications, /export const NOTIFICATIONS_MUTED_STORAGE_KEY/);
  assert.match(notifications, /export const NOTIFICATIONS_POLL_INTERVAL_MS/);
  assert.match(notifications, /export function clearNotificationsClientCache/);
  assert.match(notifications, /export async function fetchNotificationsClientCached/);
  assert.match(notifications, /export function buildNotificationHref/);
  assert.match(notifications, /export function formatNotificationTime/);

  assert.doesNotMatch(header, /type NotificationsResponse/);
  assert.doesNotMatch(header, /type NotificationsClientCache/);
  assert.doesNotMatch(header, /type NotificationsClientRequest/);
  assert.doesNotMatch(header, /let notificationsClientCache/);
  assert.doesNotMatch(header, /let notificationsClientRequest/);
  assert.doesNotMatch(header, /function clearNotificationsClientCache/);
  assert.doesNotMatch(header, /async function fetchNotificationsClientCached/);
  assert.doesNotMatch(header, /function buildNotificationHref/);
  assert.doesNotMatch(header, /function formatNotificationTime/);
});
