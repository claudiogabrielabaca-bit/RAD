import { useRef } from "react";
import { getDayWithOffset } from "@/app/lib/home-page-history";
import { isValidDayString } from "@/app/lib/home-page-utils";
import type { DayResponse, HighlightItem, SurpriseResponse } from "@/app/lib/rad-types";

type SetBoolean = React.Dispatch<React.SetStateAction<boolean>>;
type SetString = React.Dispatch<React.SetStateAction<string>>;
type SetDayResponse = React.Dispatch<React.SetStateAction<DayResponse | null>>;
type SetHighlightItem = React.Dispatch<React.SetStateAction<HighlightItem | null>>;
type SetHighlightItems = React.Dispatch<React.SetStateAction<HighlightItem[]>>;
type SetNumber = React.Dispatch<React.SetStateAction<number>>;

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
    dayBackHistoryRef,
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

  function beginDayTransition() {
    transitionIdRef.current += 1;
    const currentTransitionId = transitionIdRef.current;

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
    setIsDayTransitioning(false);
  }

  function cacheBundlePayload(payload: SurpriseResponse) {
    dayBundleCacheRef.current.set(payload.day, payload);
  }

  function invalidateDayCache(targetDay?: string) {
    if (!targetDay) return;
    dayBundleCacheRef.current.delete(targetDay);
  }

  async function fetchDayBundle(targetDay: string) {
    const res = await fetch(
      `/api/day-bundle?day=${encodeURIComponent(targetDay)}`,
      {
        cache: "no-store",
      }
    );

    const json = (await res.json().catch(() => null)) as
      | SurpriseResponse
      | null;

    if (!res.ok || !json?.day || !json?.dayData || !json?.highlightData) {
      throw new Error("Failed to load day bundle");
    }

    return json;
  }

  async function prefetchDayBundle(targetDay: string) {
    if (!isValidDayString(targetDay)) return;
    if (dayBundleCacheRef.current.has(targetDay)) return;
    if (prefetchingDaysRef.current.has(targetDay)) return;

    prefetchingDaysRef.current.add(targetDay);

    try {
      const payload = await fetchDayBundle(targetDay);
      cacheBundlePayload(payload);
    } catch {
      //
    } finally {
      prefetchingDaysRef.current.delete(targetDay);
    }
  }

  async function prefetchRelatedDays(baseDay: string) {
    const candidate = getDayWithOffset(baseDay, 1);

    if (!candidate || candidate === baseDay) {
      return;
    }

    const schedule =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback.bind(window)
        : (cb: IdleRequestCallback) =>
            window.setTimeout(
              () =>
                cb({
                  didTimeout: false,
                  timeRemaining: () => 0,
                } as IdleDeadline),
              500
            );

    schedule(() => {
      void prefetchDayBundle(candidate);
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
    } catch {
      if (transitionIdRef.current !== transitionId) return;
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
