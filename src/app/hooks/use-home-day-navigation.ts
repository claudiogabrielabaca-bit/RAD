import { useEffect, useRef } from "react";
import { getDayWithOffset } from "@/app/lib/home-page-history";
import { isValidDayString } from "@/app/lib/home-page-utils";
import type { DayResponse, HighlightItem, SurpriseResponse } from "@/app/lib/rad-types";

type SetBoolean = React.Dispatch<React.SetStateAction<boolean>>;
type SetString = React.Dispatch<React.SetStateAction<string>>;
type SetDayResponse = React.Dispatch<React.SetStateAction<DayResponse | null>>;
type SetHighlightItem = React.Dispatch<React.SetStateAction<HighlightItem | null>>;
type SetHighlightItems = React.Dispatch<React.SetStateAction<HighlightItem[]>>;
type SetNumber = React.Dispatch<React.SetStateAction<number>>;

type ScheduledPrefetch = {
  id: number;
  type: "idle" | "timeout";
};

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

export function useHomeDayNavigation(params: {
  day: string;
  hasPickedInitialDay: boolean;
  highlight: HighlightItem | null;
  pendingScrollToHighlightRef: React.MutableRefObject<boolean>;
  highlightBlockRef: React.MutableRefObject<HTMLDivElement | null>;
  minTransitionTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  dayBackHistoryRef: React.MutableRefObject<string[]>;
  isGoingBackRef: React.MutableRefObject<boolean>;
  pushCurrentDayToBackHistory: (currentDay: string, nextDay: string) => void;
  showToast: (message: string, duration?: number) => void;
  scrollToHighlightBlock: (offset?: number) => void;
  setDay: SetString;
  setData: SetDayResponse;
  setHighlights: SetHighlightItems;
  setHighlight: SetHighlightItem;
  setActiveHighlightIndex: SetNumber;
  setLoadingDay: SetBoolean;
  setLoadingHighlight: SetBoolean;
  setPreferImmediateHighlightImageSwap: SetBoolean;
  setHeroImageLoading: SetBoolean;
  setIsFavoriteDay: SetBoolean;
  setIsDayTransitioning: SetBoolean;
  setMinimumTransitionDone: SetBoolean;
  minTransitionMs: number;
}) {
  const {
    day,
    hasPickedInitialDay,
    highlight,
    pendingScrollToHighlightRef,
    highlightBlockRef,
    minTransitionTimerRef,
    isGoingBackRef,
    pushCurrentDayToBackHistory,
    showToast,
    scrollToHighlightBlock,
    setDay,
    setData,
    setHighlights,
    setHighlight,
    setActiveHighlightIndex,
    setLoadingDay,
    setLoadingHighlight,
    setPreferImmediateHighlightImageSwap,
    setHeroImageLoading,
    setIsFavoriteDay,
    setIsDayTransitioning,
    setMinimumTransitionDone,
    minTransitionMs,
  } = params;

  const transitionIdRef = useRef(0);
  const dayBundleCacheRef = useRef<Map<string, SurpriseResponse>>(new Map());
  const prefetchingDaysRef = useRef<Set<string>>(new Set());
  const dayBundleAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const scheduledPrefetchesRef = useRef<ScheduledPrefetch[]>([]);

  function cancelScheduledPrefetches() {
    if (typeof window === "undefined") {
      scheduledPrefetchesRef.current = [];
      return;
    }

    const browserWindow = window as IdleCapableWindow;

    for (const scheduled of scheduledPrefetchesRef.current) {
      if (
        scheduled.type === "idle" &&
        typeof browserWindow.cancelIdleCallback === "function"
      ) {
        browserWindow.cancelIdleCallback(scheduled.id);
      } else {
        browserWindow.clearTimeout(scheduled.id);
      }
    }

    scheduledPrefetchesRef.current = [];
  }

  function removeScheduledPrefetch(id: number, type: ScheduledPrefetch["type"]) {
    scheduledPrefetchesRef.current = scheduledPrefetchesRef.current.filter(
      (item) => item.id !== id || item.type !== type
    );
  }

  function abortInFlightDayBundleRequests() {
    for (const controller of dayBundleAbortControllersRef.current) {
      controller.abort();
    }

    dayBundleAbortControllersRef.current.clear();
    prefetchingDaysRef.current.clear();
  }

  useEffect(() => {
    return () => {
      cancelScheduledPrefetches();
      abortInFlightDayBundleRequests();
    };
  }, []);

  function beginDayTransition() {
    transitionIdRef.current += 1;
    const currentTransitionId = transitionIdRef.current;

    cancelScheduledPrefetches();
    abortInFlightDayBundleRequests();

    setMinimumTransitionDone(false);
    setIsDayTransitioning(true);
    setLoadingDay(true);
    setLoadingHighlight(true);
    setIsFavoriteDay(false);

    if (minTransitionTimerRef.current) {
      clearTimeout(minTransitionTimerRef.current);
    }

    minTransitionTimerRef.current = setTimeout(() => {
      if (transitionIdRef.current === currentTransitionId) {
        setMinimumTransitionDone(true);
      }
    }, minTransitionMs);
  }

  function finishDayTransition(transitionId: number) {
    if (transitionIdRef.current !== transitionId) return;

    setLoadingDay(false);
    setLoadingHighlight(false);
    setIsDayTransitioning(false);
  }

  function cacheBundlePayload(payload: SurpriseResponse) {
    dayBundleCacheRef.current.set(payload.day, payload);
  }

  function invalidateDayCache(targetDay?: string) {
    if (!targetDay) return;
    dayBundleCacheRef.current.delete(targetDay);
  }

  async function fetchDayBundle(
    targetDay: string,
    options?: { communityOnly?: boolean }
  ) {
    const controller = new AbortController();
    dayBundleAbortControllersRef.current.add(controller);

    const params = new URLSearchParams({ day: targetDay });

    if (options?.communityOnly) {
      params.set("communityOnly", "1");
    }

    try {
      const res = await fetch(
        "/api/day-bundle?" + params.toString(),
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const json = (await res.json().catch(() => null)) as
        | SurpriseResponse
        | null;

      if (!res.ok || !json?.day || !json?.dayData || !json?.highlightData) {
        throw new Error("Failed to load day bundle");
      }

      return json;
    } finally {
      dayBundleAbortControllersRef.current.delete(controller);
    }
  }

  async function prefetchDayBundle(targetDay: string) {
    if (!isValidDayString(targetDay)) return;
    if (dayBundleCacheRef.current.has(targetDay)) return;
    if (prefetchingDaysRef.current.has(targetDay)) return;

    prefetchingDaysRef.current.add(targetDay);

    try {
      const payload = await fetchDayBundle(targetDay);
      cacheBundlePayload(payload);
    } catch (error) {
      if (!isAbortError(error)) {
        // Prefetch failures are intentionally silent.
      }
    } finally {
      prefetchingDaysRef.current.delete(targetDay);
    }
  }

  async function prefetchRelatedDays(baseDay: string) {
    const candidate = getDayWithOffset(baseDay, 1);

    if (!candidate || candidate === baseDay) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const browserWindow = window as IdleCapableWindow;

    if (typeof browserWindow.requestIdleCallback === "function") {
      const id = browserWindow.requestIdleCallback(() => {
        removeScheduledPrefetch(id, "idle");
        void prefetchDayBundle(candidate);
      });

      scheduledPrefetchesRef.current.push({
        id,
        type: "idle",
      });

      return;
    }

    const id = browserWindow.setTimeout(() => {
      removeScheduledPrefetch(id, "timeout");
      void prefetchDayBundle(candidate);
    }, 500);

    scheduledPrefetchesRef.current.push({
      id,
      type: "timeout",
    });
  }

  function applyBundlePayload(payload: SurpriseResponse) {
    cacheBundlePayload(payload);

    const items = payload.highlightData?.highlights?.length
      ? payload.highlightData.highlights
      : payload.highlightData?.highlight
        ? [payload.highlightData.highlight]
        : [];

    const nextHighlight = items[0] ?? null;
    const currentImage = highlight?.image?.trim() || "";
    const nextImage = nextHighlight?.image?.trim() || "";

    setHeroImageLoading(!!nextImage && nextImage !== currentImage);

    setData(payload.dayData);
    setHighlights(items);
    setHighlight(nextHighlight);
    setActiveHighlightIndex(0);
    setIsFavoriteDay(!!payload.isFavoriteDay);
    setLoadingDay(false);
    setLoadingHighlight(false);
    setPreferImmediateHighlightImageSwap(false);
  }

  async function openDay(
    nextDay: string,
    options?: { scrollToHighlight?: boolean }
  ) {
    const shouldScrollToHighlight = !!options?.scrollToHighlight;

    if (nextDay === day) {
      setIsDayTransitioning(false);

      if (shouldScrollToHighlight && highlight && highlightBlockRef.current) {
        pendingScrollToHighlightRef.current = false;
        requestAnimationFrame(() => {
          scrollToHighlightBlock();
        });
      }

      return;
    }

    const shouldRecordHistory =
      hasPickedInitialDay &&
      isValidDayString(day) &&
      !isGoingBackRef.current;

    pendingScrollToHighlightRef.current = shouldScrollToHighlight;
    beginDayTransition();
    const transitionId = transitionIdRef.current;

    const cached = dayBundleCacheRef.current.get(nextDay);

    if (cached) {
      if (shouldRecordHistory) {
        pushCurrentDayToBackHistory(day, cached.day);
      }

      applyBundlePayload(cached);
      setDay(cached.day);
      return;
    }

    try {
      const payload = await fetchDayBundle(nextDay);

      if (transitionIdRef.current !== transitionId) return;

      if (shouldRecordHistory) {
        pushCurrentDayToBackHistory(day, payload.day);
      }

      applyBundlePayload(payload);
      setDay(payload.day);
    } catch (error) {
      if (transitionIdRef.current !== transitionId) return;
      if (isAbortError(error)) return;

      showToast("Could not load this day.");
      finishDayTransition(transitionId);
    }
  }

  return {
    transitionIdRef,
    dayBundleCacheRef,
    prefetchingDaysRef,
    beginDayTransition,
    finishDayTransition,
    cacheBundlePayload,
    invalidateDayCache,
    fetchDayBundle,
    prefetchDayBundle,
    prefetchRelatedDays,
    applyBundlePayload,
    openDay,
  };
}
