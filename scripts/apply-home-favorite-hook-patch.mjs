#!/usr/bin/env node
import fs from "node:fs";

const file = "src/app/home-page-client.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(target, replacement, label) {
  if (!source.includes(target)) {
    throw new Error(`Could not find expected block: ${label}`);
  }
  source = source.replace(target, replacement);
}

replaceOnce(
  'import { useHomeAuthState } from "@/app/hooks/use-home-auth-state";\nimport { useHomeDayBackHistory } from "@/app/hooks/use-home-day-back-history";',
  'import { useHomeAuthState } from "@/app/hooks/use-home-auth-state";\nimport { useHomeDayBackHistory } from "@/app/hooks/use-home-day-back-history";\nimport { useHomeFavoriteDay } from "@/app/hooks/use-home-favorite-day";',
  "favorite hook import"
);

replaceOnce(
  'import type {\n  DayResponse,\n  FavoriteDayResponse,\n  HighlightItem,\n  SurpriseResponse,\n} from "@/app/lib/rad-types";',
  'import type {\n  DayResponse,\n  HighlightItem,\n  SurpriseResponse,\n} from "@/app/lib/rad-types";',
  "remove FavoriteDayResponse import"
);

replaceOnce(
  '  const favoriteStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(\n    null\n  );\n\n',
  '',
  "remove favorite status timeout ref"
);

replaceOnce(
  '  const navigationActionsRef = useRef({\n    transitionIdRef,\n    cacheBundlePayload,\n    fetchDayBundle,\n    applyBundlePayload,\n    finishDayTransition,\n    prefetchRelatedDays,\n  });',
  '  const { toggleFavoriteDay, refreshFavoriteDayStatus } = useHomeFavoriteDay({\n    day,\n    currentUser,\n    hasPickedInitialDay,\n    initialBundle,\n    dayBundleCacheRef,\n    isFavoriteDay,\n    loadingFavoriteDay,\n    setIsFavoriteDay,\n    setLoadingFavoriteDay,\n    openAuthModal,\n    requireVerifiedEmail,\n    showToast,\n  });\n\n  const navigationActionsRef = useRef({\n    transitionIdRef,\n    cacheBundlePayload,\n    fetchDayBundle,\n    applyBundlePayload,\n    finishDayTransition,\n    prefetchRelatedDays,\n  });',
  "insert favorite hook usage"
);

replaceOnce(
  '  const loadFavoriteDayStatus = useCallback(\n    async (d: string) => {\n      if (!currentUser) {\n        setIsFavoriteDay(false);\n        return;\n      }\n\n      setLoadingFavoriteDay(true);\n\n      try {\n        const res = await fetch(\n          `/api/favorite-day?day=${encodeURIComponent(d)}`,\n          {\n            cache: "no-store",\n          }\n        );\n\n        if (!res.ok) throw new Error("Failed to load favorite day status");\n\n        const json = (await res.json()) as FavoriteDayResponse;\n        setIsFavoriteDay(!!json.isFavorite);\n      } catch {\n        setIsFavoriteDay(false);\n      } finally {\n        setLoadingFavoriteDay(false);\n      }\n    },\n    [currentUser]\n  );\n\n  async function toggleFavoriteDay() {\n    if (!currentUser) {\n      openAuthModal("login");\n      return;\n    }\n\n    if (requireVerifiedEmail()) return;\n    if (loadingFavoriteDay) return;\n\n    const previousFavorite = isFavoriteDay;\n    const optimisticFavorite = !previousFavorite;\n\n    setToast("");\n    setIsFavoriteDay(optimisticFavorite);\n    setLoadingFavoriteDay(true);\n\n    try {\n      const res = await fetch("/api/favorite-day", {\n        method: "POST",\n        headers: {\n          "Content-Type": "application/json",\n        },\n        body: JSON.stringify({\n          day,\n          isFavorite: optimisticFavorite,\n        }),\n      });\n\n      const json = await res.json().catch(() => null);\n\n      if (!res.ok) {\n        setIsFavoriteDay(previousFavorite);\n        showToast(json?.error ?? "Could not update favorite day.");\n        return;\n      }\n\n      setIsFavoriteDay(!!json?.isFavorite);\n    } catch {\n      setIsFavoriteDay(previousFavorite);\n      showToast("Could not update favorite day.");\n    } finally {\n      setLoadingFavoriteDay(false);\n    }\n  }\n\n',
  '',
  "remove inline favorite functions"
);

replaceOnce(
  '  useEffect(() => {\n    if (!hasPickedInitialDay) return;\n\n    const cachedPayload = dayBundleCacheRef.current.get(day);\n\n    const bundledFavoriteStatus =\n      cachedPayload?.day === day &&\n      typeof cachedPayload.isFavoriteDay === "boolean"\n        ? cachedPayload.isFavoriteDay\n        : initialBundle?.day === day &&\n            typeof initialBundle.isFavoriteDay === "boolean"\n          ? initialBundle.isFavoriteDay\n          : null;\n\n    if (typeof bundledFavoriteStatus === "boolean") {\n      setIsFavoriteDay(bundledFavoriteStatus);\n      setLoadingFavoriteDay(false);\n      return;\n    }\n\n    const shouldWaitForFullPublicBundle =\n      initialBundle?.day === day &&\n      !!initialBundle.publicInitialOnly &&\n      !cachedPayload;\n\n    if (shouldWaitForFullPublicBundle) {\n      setLoadingFavoriteDay(false);\n      return;\n    }\n\n    if (favoriteStatusTimeoutRef.current) {\n      clearTimeout(favoriteStatusTimeoutRef.current);\n    }\n\n    favoriteStatusTimeoutRef.current = setTimeout(() => {\n      favoriteStatusTimeoutRef.current = null;\n      void loadFavoriteDayStatus(day);\n    }, 900);\n  }, [\n    day,\n    dayBundleCacheRef,\n    hasPickedInitialDay,\n    initialBundle,\n    loadFavoriteDayStatus,\n  ]);\n\n',
  '',
  "remove inline favorite status effect"
);

replaceOnce(
  '        onAuthSuccess={(user) => {\n          setCurrentUser(user ?? null);\n          loadFavoriteDayStatus(day);\n          loadDay(day);\n        }}',
  '        onAuthSuccess={(user) => {\n          setCurrentUser(user ?? null);\n          void refreshFavoriteDayStatus(day);\n          loadDay(day);\n        }}',
  "refresh favorite after auth success"
);

const remainingForbidden = [
  "FavoriteDayResponse",
  "favoriteStatusTimeoutRef",
  "loadFavoriteDayStatus",
].filter((token) => source.includes(token));

if (remainingForbidden.length > 0) {
  throw new Error(
    `Favorite refactor incomplete. Still found in home-page-client.tsx: ${remainingForbidden.join(", ")}`
  );
}

fs.writeFileSync(file, source);
console.log("Patched src/app/home-page-client.tsx to use useHomeFavoriteDay.");
