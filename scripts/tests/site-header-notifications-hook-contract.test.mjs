import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const header = fs.readFileSync("src/app/components/rad/site-header.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-site-header-notifications.ts", "utf8");

test("site header delegates notification state and actions to a dedicated hook", () => {
  assert.match(hook, /export function useSiteHeaderNotifications/);
  assert.match(hook, /notificationsOpen/);
  assert.match(hook, /unreadNotifications/);
  assert.match(hook, /toggleNotificationsMuted/);
  assert.match(hook, /handleOpenNotifications/);
  assert.match(hook, /handleNotificationClick/);
  assert.match(hook, /handleClearNotifications/);

  assert.match(header, /useSiteHeaderNotifications\(\{/);
  assert.doesNotMatch(header, /fetchNotificationsClientCached/);
  assert.doesNotMatch(header, /clearNotificationsClientCache/);
  assert.doesNotMatch(header, /buildNotificationHref/);
  assert.doesNotMatch(header, /NOTIFICATIONS_MUTED_STORAGE_KEY/);
  assert.doesNotMatch(header, /NOTIFICATIONS_POLL_INTERVAL_MS/);
  assert.doesNotMatch(header, /const loadNotifications/);
  assert.doesNotMatch(header, /function toggleNotificationsMuted/);
  assert.doesNotMatch(header, /async function handleOpenNotifications/);
  assert.doesNotMatch(header, /async function handleNotificationClick/);
  assert.doesNotMatch(header, /async function handleClearNotifications/);
});
