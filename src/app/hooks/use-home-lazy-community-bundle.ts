import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { SurpriseResponse } from "@/app/lib/rad-types";

type RefLike<T> = {
  current: T;
};

type NavigationActions = {
  fetchDayBundle: (day: string) => Promise<SurpriseResponse>;
  applyBundlePayload: (payload: SurpriseResponse) => void;
};

type InitialBundle =
  | (SurpriseResponse & {
      publicInitialOnly?: boolean;
    })
  | null;

export function useHomeLazyCommunityBundle({
  day,
  hasPickedInitialDay,
  initialBundle,
  pathname,
  dayBundleCacheRef,
  communityPanelRef,
  navigationActionsRef,
  showToast,
  setLoadingDay,
}: {
  day: string;
  hasPickedInitialDay: boolean;
  initialBundle: InitialBundle;
  pathname: string;
  dayBundleCacheRef: RefLike<Map<string, SurpriseResponse>>;
  communityPanelRef: RefLike<HTMLDivElement | null>;
  navigationActionsRef: RefLike<NavigationActions>;
  showToast: (message: string, duration?: number) => void;
  setLoadingDay: Dispatch<SetStateAction<boolean>>;
}) {
  const communityBundleLoadedDayRef = useRef("");

  useEffect(() => {
    if (!hasPickedInitialDay) return;

    const shouldLazyLoadPublicCommunity =
      initialBundle?.day === day &&
      !!initialBundle.publicInitialOnly &&
      pathname?.startsWith("/day/");

    if (!shouldLazyLoadPublicCommunity) return;
    if (communityBundleLoadedDayRef.current === day) return;

    let cancelled = false;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;

    async function loadCommunityBundle() {
      if (communityBundleLoadedDayRef.current === day) return;

      const cachedPayload = dayBundleCacheRef.current.get(day);

      if (cachedPayload) {
        communityBundleLoadedDayRef.current = day;

        if (!cancelled) {
          navigationActionsRef.current.applyBundlePayload(cachedPayload);
        }

        return;
      }

      communityBundleLoadedDayRef.current = day;
      setLoadingDay(true);

      try {
        const payload = await navigationActionsRef.current.fetchDayBundle(day);

        if (cancelled) return;

        navigationActionsRef.current.applyBundlePayload(payload);
      } catch {
        communityBundleLoadedDayRef.current = "";

        if (!cancelled) {
          showToast("Could not load community activity.");
        }
      } finally {
        if (!cancelled) {
          setLoadingDay(false);
        }
      }
    }

    function maybeLoadCommunityBundle() {
      if (cancelled) return;
      if (communityBundleLoadedDayRef.current === day) return;

      const target = communityPanelRef.current;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const hasScrollIntent = window.scrollY > 420;
      const isNearCommunityPanel = rect.top < window.innerHeight * 0.95;

      if (!hasScrollIntent || !isNearCommunityPanel) return;

      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }

      loadTimeout = setTimeout(() => {
        void loadCommunityBundle();
      }, 250);
    }

    window.addEventListener("scroll", maybeLoadCommunityBundle, {
      passive: true,
    });
    window.addEventListener("resize", maybeLoadCommunityBundle);

    maybeLoadCommunityBundle();

    return () => {
      cancelled = true;

      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }

      window.removeEventListener("scroll", maybeLoadCommunityBundle);
      window.removeEventListener("resize", maybeLoadCommunityBundle);
    };
  }, [
    day,
    dayBundleCacheRef,
    hasPickedInitialDay,
    initialBundle,
    pathname,
    showToast,
    communityPanelRef,
    navigationActionsRef,
    setLoadingDay,
  ]);
}
