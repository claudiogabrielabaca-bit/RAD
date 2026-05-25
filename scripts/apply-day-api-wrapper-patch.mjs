#!/usr/bin/env node
import fs from "node:fs";

const homePath = "src/app/home-page-client.tsx";
let source = fs.readFileSync(homePath, "utf8");

const oldLoadDayPattern = /\n  async function loadDay\(d: string\) \{[\s\S]*?\n  async function goToSurpriseDay/;

const nextLoadDay = `
  async function refreshDayCommunity(d: string) {
    const requestId = ++dayRequestRef.current;
    setLoadingDay(true);
    setToast("");

    try {
      const payload = await navigationActionsRef.current.fetchDayBundle(d, {
        communityOnly: true,
      });

      if (requestId !== dayRequestRef.current) return;

      setData(payload.dayData);

      if (typeof payload.isFavoriteDay === "boolean") {
        setIsFavoriteDay(payload.isFavoriteDay);
      }
    } catch {
      if (requestId !== dayRequestRef.current) return;
      showToast("Error cargando el día.");
      setData(null);
    } finally {
      if (requestId === dayRequestRef.current) {
        setLoadingDay(false);
      }
    }
  }

  async function goToSurpriseDay`;

if (!oldLoadDayPattern.test(source)) {
  if (/async function refreshDayCommunity\(d: string\)/.test(source)) {
    console.log("home-page-client.tsx already uses refreshDayCommunity; skipping function patch.");
  } else {
    throw new Error("Could not find the legacy loadDay block in home-page-client.tsx");
  }
} else {
  source = source.replace(oldLoadDayPattern, nextLoadDay);
}

const oldAuthSuccess = `          setCurrentUser(user ?? null);
          void refreshFavoriteDayStatus(day);
          loadDay(day);`;
const nextAuthSuccess = `          setCurrentUser(user ?? null);
          void refreshFavoriteDayStatus(day);
          void refreshDayCommunity(day);`;

if (source.includes(oldAuthSuccess)) {
  source = source.replace(oldAuthSuccess, nextAuthSuccess);
} else if (!source.includes(nextAuthSuccess)) {
  throw new Error("Could not find AuthModal onAuthSuccess day refresh call");
}

if (/\/api\/day\?day=/.test(source)) {
  throw new Error("home-page-client.tsx still calls /api/day?day=");
}

if (/\n\s*async function loadDay\(d: string\)/.test(source)) {
  throw new Error("home-page-client.tsx still contains the legacy loadDay function");
}

if (/\n\s*loadDay\(day\);/.test(source)) {
  throw new Error("home-page-client.tsx still calls loadDay(day)");
}

if (!/async function refreshDayCommunity\(d: string\)/.test(source)) {
  throw new Error("home-page-client.tsx does not contain refreshDayCommunity");
}

if (!/void refreshDayCommunity\(day\);/.test(source)) {
  throw new Error("home-page-client.tsx does not refresh community data after auth success");
}

fs.writeFileSync(homePath, source);
console.log("Patched src/app/home-page-client.tsx to use day-bundle community refresh.");
