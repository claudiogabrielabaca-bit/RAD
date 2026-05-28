"use client";

import { useHomeAuthState } from "@/app/hooks/use-home-auth-state";
import { useHomeDayBackHistory } from "@/app/hooks/use-home-day-back-history";
import { useHomeFavoriteDay } from "@/app/hooks/use-home-favorite-day";
import { useHomeDayViewTracking } from "@/app/hooks/use-home-day-view-tracking";
import { useHomeDeleteActions } from "@/app/hooks/use-home-delete-actions";
import { useHomeDayNavigation } from "@/app/hooks/use-home-day-navigation";
import { useHomeReviewDerivedState } from "@/app/hooks/use-home-review-derived-state";
import { useHomeHighlightCarousel } from "@/app/hooks/use-home-highlight-carousel";
import { useHomeReviewReport } from "@/app/hooks/use-home-review-report";
import { useHomeSuggestEvent } from "@/app/hooks/use-home-suggest-event";
import { useHomeReplyComposer } from "@/app/hooks/use-home-reply-composer";
import { useHomeDeleteMutations } from "@/app/hooks/use-home-delete-mutations";
import { useHomeReviewLike } from "@/app/hooks/use-home-review-like";
import { useHomeRatingSubmit } from "@/app/hooks/use-home-rating-submit";
import { useHomeNotices } from "@/app/hooks/use-home-notices";
import ReportReasonModal from "@/app/components/rad/report-reason-modal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AuthModal from "@/app/components/rad/auth-modal";
import CosmicLoading from "@/app/components/rad/cosmic-loading";
import HighlightHeroImage from "@/app/components/rad/highlight-hero-image";
import { decodeHtml } from "@/app/lib/html";
import SocialPostModal from "@/app/components/rad/social-post-modal";
import HomeExplorePanel from "@/app/components/rad/home/home-explore-panel";
import HomeReactionsPanel from "@/app/components/rad/home/home-reactions-panel";
import ConfirmModal from "@/app/components/rad/confirm-modal";
import {
  getBadgeStyle,
  getBadgeLabel,
  getHighlightBadges,
  formatAvg,
  pad2,
  getDaysInMonth,
  formatDisplayDate,
  formatCompactViews,
  isValidDayString,
  formatMonthDayLabel,
} from "@/app/lib/home-page-utils";
import { getTodayDayString } from "@/app/lib/day";
import type {
  DayResponse,
  HighlightItem,
  SurpriseResponse,
} from "@/app/lib/rad-types";
import {
  SURPRISE_HISTORY_MAX,
  getRecentSurpriseHistory,
  rememberSurpriseDay,
  getTodayHistoryMonthDay,
  rememberTodayHistoryDay,
  clearTodayHistory,
  buildRandomRequestUrl,
  buildTodayInHistoryRequestUrl,
  getDayWithOffset,
  getDayWithYearShift,
} from "@/app/lib/home-page-history";
import { YEARS, MONTHS } from "@/app/lib/home-page-discover";
import {
  FORCE_FRESH_MODE,
  HERO_IMAGE_REVEAL_DELAY_MS,
  HIGHLIGHT_SCROLL_OFFSET,
  LAST_DAY_STORAGE_KEY,
  MIN_DAY_TRANSITION_MS,
  REVIEW_MAX_LENGTH,
} from "@/app/lib/home-page-client-constants";

type TodayInHistoryResponse = SurpriseResponse & {
  restartedRound?: boolean;
};

type InitialBundle = SurpriseResponse & {
  publicInitialOnly?: boolean;
};

export default function Page({
  initialBundle = null,
}: {
  initialBundle?: InitialBundle | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    currentUser,
    setCurrentUser,
    authModalOpen,
    authView,
    authEmail,
    setAuthView,
    setAuthEmail,
    openAuthModal,
    closeAuthModal,
    refreshCurrentUser,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    requireReplyInteraction,
  } = useHomeAuthState({ router, pathname, searchParams });

  const minDay = "1800-01-01";
  const today = useMemo(() => getTodayDayString(), []);

  const rateBoxRef = useRef<HTMLDivElement | null>(null);
  const myReviewBlockRef = useRef<HTMLDivElement | null>(null);
  const communityPanelRef = useRef<HTMLDivElement | null>(null);
  const highlightBlockRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToHighlightRef = useRef(false);
  const minTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const consumedProfileJumpRef = useRef(false);
  const consumedNotificationJumpKeyRef = useRef("");
  const didInitDayRef = useRef(false);
  const dayRequestRef = useRef(0);
  const skipNextAutoDayLoadRef = useRef(false);
  const communityBundleLoadedDayRef = useRef("");

  const currentVisibleDayRef = useRef(initialBundle?.day ?? "");

  const {
    dayBackHistoryRef,
    isGoingBackRef,
    canGoBack,
    pushCurrentDayToBackHistory,
    goBackToLastViewed,
  } = useHomeDayBackHistory();

  const initialHighlightItems = initialBundle?.highlightData?.highlights?.length
    ? initialBundle.highlightData.highlights
    : initialBundle?.highlightData?.highlight
      ? [initialBundle.highlightData.highlight]
      : [];

  const [day, setDay] = useState<string>(initialBundle?.day ?? "");
  const [hasPickedInitialDay, setHasPickedInitialDay] = useState(
    !!initialBundle
  );
  const [selectedYear, setSelectedYear] = useState(
    initialBundle?.day?.slice(0, 4) ?? today.slice(0, 4)
  );
  const [selectedMonth, setSelectedMonth] = useState(
    initialBundle?.day?.slice(5, 7) ?? today.slice(5, 7)
  );
  const [selectedDay, setSelectedDay] = useState(
    initialBundle?.day?.slice(8, 10) ?? today.slice(8, 10)
  );


  const [data, setData] = useState<DayResponse | null>(
    initialBundle?.dayData ?? null
  );
  const [loadingDay, setLoadingDay] = useState(false);

  const [highlight, setHighlight] = useState<HighlightItem | null>(
    initialHighlightItems[0] ?? null
  );
  const [highlights, setHighlights] =
    useState<HighlightItem[]>(initialHighlightItems);
  const [loadingHighlight, setLoadingHighlight] = useState(false);
  const [
    preferImmediateHighlightImageSwap,
    setPreferImmediateHighlightImageSwap,
  ] = useState(false);

  const [isFavoriteDay, setIsFavoriteDay] = useState(false);
  const [loadingFavoriteDay, setLoadingFavoriteDay] = useState(false);

  const [stars, setStars] = useState<number>(0);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [review, setReview] = useState<string>("");


  const [expandedReviews, setExpandedReviews] = useState<
    Record<string, boolean>
  >({});

  const [reviewsSort, setReviewsSort] = useState<"helpful" | "newest">(
    "helpful"
  );

  const [socialPostOpen, setSocialPostOpen] = useState(false);

  const [isDayTransitioning, setIsDayTransitioning] = useState(false);
  const [minimumTransitionDone, setMinimumTransitionDone] = useState(true);
  const [, setHeroImageLoading] = useState(false);

  const {
    toast,
    setToast,
    todayHistoryNotice,
    setTodayHistoryNotice,
    showToast,
    showTodayHistoryNotice,
  } = useHomeNotices();

  const daysInSelectedMonth = getDaysInMonth(
    Number(selectedYear),
    Number(selectedMonth)
  );

  const DAYS = Array.from({ length: daysInSelectedMonth }, (_, i) =>
    pad2(i + 1)
  );

  const navigationDay = isValidDayString(day) ? day : today;
  const visibleDayLabel =
    hasPickedInitialDay && isValidDayString(day) ? day : "Finding a day...";


  const {
    activeHighlightIndex,
    setActiveHighlightIndex,
    canSwitchHighlights,
    transitionToHighlight,
    goToPrevHighlight,
    goToNextHighlight,
    pauseHighlightCarousel,
    resumeHighlightCarousel,
  } = useHomeHighlightCarousel({
    day,
    highlights,
    hasPickedInitialDay,
    isDayTransitioning,
    minimumTransitionDone,
    loadingDay,
    preferImmediateHighlightImageSwap,
    setHighlight,
    setPreferImmediateHighlightImageSwap,
  });

  const {
    transitionIdRef,
    dayBundleCacheRef,
    prefetchingDaysRef,
    beginDayTransition,
    finishDayTransition,
    cacheBundlePayload,
    invalidateDayCache,
    fetchDayBundle,
    prefetchRelatedDays,
    applyBundlePayload,
    openDay,
  } = useHomeDayNavigation({
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
    minTransitionMs: MIN_DAY_TRANSITION_MS,
  });

  const { toggleFavoriteDay, refreshFavoriteDayStatus } = useHomeFavoriteDay({
    day,
    currentUser,
    hasPickedInitialDay,
    initialBundle,
    dayBundleCacheRef,
    isFavoriteDay,
    loadingFavoriteDay,
    setIsFavoriteDay,
    setLoadingFavoriteDay,
    openAuthModal,
    requireVerifiedEmail,
    showToast,
  });

  const {
    reportingReviewId,
    reportReviewModalOpen,
    reportReviewReason,
    reportReviewError,
    setReportReviewReason,
    reportReview,
    closeReviewReportModal,
    submitReviewReport,
  } = useHomeReviewReport({
    currentUser,
    openAuthModal,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    setToast,
    showToast,
  });

  const {
    replyingToId,
    replyTextByRating,
    sendingReplyId,
    setReplyingToId,
    setReplyTextByRating,
    submitReply,
  } = useHomeReplyComposer({
    day,
    currentUser,
    openAuthModal,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    setToast,
    showToast,
    setData,
    invalidateDayCache,
  });

  const {
    showSuggestModal,
    suggestEvent,
    suggestDescription,
    suggestSource,
    suggestEmail,
    suggestSending,
    suggestToast,
    setSuggestEvent,
    setSuggestDescription,
    setSuggestSource,
    setSuggestEmail,
    openSuggestModal,
    closeSuggestModal,
    submitSuggestion,
  } = useHomeSuggestEvent({ day });

  useHomeDayViewTracking({
    day,
    hasPickedInitialDay,
  });

  const navigationActionsRef = useRef({
    transitionIdRef,
    cacheBundlePayload,
    fetchDayBundle,
    applyBundlePayload,
    finishDayTransition,
    prefetchRelatedDays,
  });

  useEffect(() => {
    navigationActionsRef.current = {
      transitionIdRef,
      cacheBundlePayload,
      fetchDayBundle,
      applyBundlePayload,
      finishDayTransition,
      prefetchRelatedDays,
    };
  }, [
    transitionIdRef,
    cacheBundlePayload,
    fetchDayBundle,
    applyBundlePayload,
    finishDayTransition,
    prefetchRelatedDays,
  ]);

  function scrollToHighlightBlock(offset = HIGHLIGHT_SCROLL_OFFSET) {
    if (!highlightBlockRef.current) return;

    const elementTop =
      highlightBlockRef.current.getBoundingClientRect().top + window.scrollY;

    window.scrollTo({
      top: elementTop - offset,
      behavior: "smooth",
    });
  }

  const buildSurpriseRequestUrl = useCallback(
    ({
      fresh = false,
      excludeDays = [],
    }: {
      fresh?: boolean;
      excludeDays?: string[];
    } = {}) => {
    const params = new URLSearchParams();

    if (fresh) {
      params.set("fresh", "1");
    }

    const historyDays = getRecentSurpriseHistory();

    const uniqueExcludeDays = Array.from(
      new Set(
        [...historyDays, ...excludeDays, day].filter((item) =>
          isValidDayString(item)
        )
      )
    ).slice(0, SURPRISE_HISTORY_MAX);

    if (uniqueExcludeDays.length > 0) {
      params.set("excludeDays", uniqueExcludeDays.join(","));
    }

    const query = params.toString();
    return query ? `/api/surprise?${query}` : "/api/surprise";
    },
    [day]
  );

  async function fetchPickDateBundle(targetDay: string) {
    const res = await fetch(
      `/api/pick-date-bundle?day=${encodeURIComponent(targetDay)}`,
      {
        cache: "no-store",
      }
    );

    const json = (await res.json().catch(() => null)) as
      | SurpriseResponse
      | null;

    if (!res.ok || !json?.day || !json?.dayData || !json?.highlightData) {
      throw new Error("Failed to load pick date bundle");
    }

    return json;
  }

  async function openPickDate(
    nextDay: string,
    options?: { scrollToHighlight?: boolean }
  ) {
    const shouldScrollToHighlight = !!options?.scrollToHighlight;

    const shouldRecordHistory =
      nextDay !== day &&
      hasPickedInitialDay &&
      isValidDayString(day) &&
      !isGoingBackRef.current;

    beginDayTransition();
    const transitionId = transitionIdRef.current;
    pendingScrollToHighlightRef.current = shouldScrollToHighlight;

    try {
      const payload = await fetchPickDateBundle(nextDay);

      if (transitionIdRef.current !== transitionId) return;

      if (shouldRecordHistory) {
        pushCurrentDayToBackHistory(day, payload.day);
      }

      /*
       * Pick a Date must load dayData + highlightData together from
       * /api/pick-date-bundle. This intentionally skips the automatic
       * /api/day-bundle reload that normally runs when `day` changes.
       */
      skipNextAutoDayLoadRef.current = true;
      applyBundlePayload(payload);
      setDay(payload.day);

      if (payload.day === day) {
        finishDayTransition(transitionId);
      }
    } catch {
      if (transitionIdRef.current !== transitionId) return;
      showToast("Could not load this date.");
      finishDayTransition(transitionId);
    }
  }

  function clearMinTransitionTimer() {
    if (minTransitionTimerRef.current) {
      clearTimeout(minTransitionTimerRef.current);
      minTransitionTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearMinTransitionTimer();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (!cancelled) {
        void refreshCurrentUser();
      }
    };

    const browserWindow =
      typeof window !== "undefined"
        ? (window as Window & {
            requestIdleCallback?: (
              callback: () => void,
              options?: { timeout?: number }
            ) => number;
            cancelIdleCallback?: (handle: number) => void;
          })
        : null;

    if (browserWindow?.requestIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(run, {
        timeout: 1500,
      });

      return () => {
        cancelled = true;
        browserWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeout = setTimeout(run, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [refreshCurrentUser]);

  const resetUserScopedNavigationState = useCallback(() => {
    dayBundleCacheRef.current.clear();
    prefetchingDaysRef.current.clear();
    setTodayHistoryNotice("");
  }, [dayBundleCacheRef, prefetchingDaysRef, setTodayHistoryNotice]);

  useEffect(() => {
    resetUserScopedNavigationState();
  }, [currentUser?.id, resetUserScopedNavigationState]);

  useEffect(() => {
    if (isValidDayString(day)) {
      currentVisibleDayRef.current = day;
    }
  }, [day]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;
    if (!isValidDayString(day)) return;

    try {
      window.localStorage.setItem(LAST_DAY_STORAGE_KEY, day);
    } catch {
      //
    }
  }, [day, hasPickedInitialDay]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;
    if (!isValidDayString(day)) return;

    const routeDayMatch = pathname.match(/^\/day\/([^/]+)\/?$/);

    if (routeDayMatch) {
      const currentRouteDay = routeDayMatch[1]
        ? decodeURIComponent(routeDayMatch[1])
        : "";

      if (currentRouteDay === day) return;

      router.replace(`/day/${encodeURIComponent(day)}`, { scroll: false });
      return;
    }

    const currentQueryDay = searchParams.get("day");

    if (currentQueryDay === day) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("day", day);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [day, hasPickedInitialDay, pathname, router, searchParams]);

  useEffect(() => {
    if (didInitDayRef.current) return;
    didInitDayRef.current = true;

    if (
      initialBundle?.day &&
      initialBundle?.dayData &&
      initialBundle?.highlightData
    ) {
      if (!initialBundle.publicInitialOnly) {
        navigationActionsRef.current.cacheBundlePayload(initialBundle);
        skipNextAutoDayLoadRef.current = true;
      }

      setHasPickedInitialDay(true);
      return;
    }

    let cancelled = false;

    async function run() {
      const queryDay = searchParams.get("day");

      setIsDayTransitioning(false);
      setLoadingDay(false);
      setLoadingHighlight(false);

      if (queryDay && isValidDayString(queryDay)) {
        try {
          const payload =
            await navigationActionsRef.current.fetchDayBundle(queryDay);

          if (!cancelled) {
            skipNextAutoDayLoadRef.current = true;
            navigationActionsRef.current.applyBundlePayload(payload);
            setDay(payload.day);
          }
        } catch {
          if (!cancelled) {
            setDay(queryDay);
          }
        } finally {
          if (!cancelled) {
            setHasPickedInitialDay(true);
          }
        }

        return;
      }

      let storedDay = "";

      try {
        const value = window.localStorage.getItem(LAST_DAY_STORAGE_KEY);
        storedDay = isValidDayString(value) ? value : "";
      } catch {
        storedDay = "";
      }

      if (storedDay) {
        try {
          const payload =
            await navigationActionsRef.current.fetchDayBundle(storedDay);

          if (!cancelled) {
            skipNextAutoDayLoadRef.current = true;
            navigationActionsRef.current.applyBundlePayload(payload);
            setDay(payload.day);
          }
        } catch {
          if (!cancelled) {
            setDay(storedDay);
          }
        } finally {
          if (!cancelled) {
            setHasPickedInitialDay(true);
          }
        }

        return;
      }

      try {
        const res = await fetch(
          buildSurpriseRequestUrl({
            fresh: FORCE_FRESH_MODE,
          }),
          {
            cache: "no-store",
          }
        );

        const json = (await res.json().catch(() => null)) as
          | SurpriseResponse
          | null;

        if (
          !cancelled &&
          res.ok &&
          json?.day &&
          json?.dayData &&
          json?.highlightData
        ) {
          skipNextAutoDayLoadRef.current = true;
          navigationActionsRef.current.applyBundlePayload(json);
          setDay(json.day);
          rememberSurpriseDay(json.day);
          return;
        }

        const fallbackRes = await fetch(
          buildRandomRequestUrl({
            fresh: FORCE_FRESH_MODE,
          }),
          {
            cache: "no-store",
          }
        );

        const fallbackJson = await fallbackRes.json().catch(() => null);

        if (!cancelled && fallbackRes.ok && fallbackJson?.day) {
          setDay(fallbackJson.day);
          rememberSurpriseDay(fallbackJson.day);
        }
      } finally {
        if (!cancelled) {
          setHasPickedInitialDay(true);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [initialBundle, searchParams, buildSurpriseRequestUrl]);

  useEffect(() => {
    const [y, m, d] = day.split("-");
    if (y && m && d) {
      setSelectedYear(y);
      setSelectedMonth(m);
      setSelectedDay(d);
    }
  }, [day]);

  useEffect(() => {
    if (Number(selectedDay) > daysInSelectedMonth) {
      setSelectedDay(pad2(daysInSelectedMonth));
    }
  }, [daysInSelectedMonth, selectedDay]);

  useEffect(() => {
    const queryDay = searchParams.get("day");
    const focus = searchParams.get("focus");
    const reviewId = searchParams.get("reviewId");
    const replyId = searchParams.get("replyId");

    const hasProfileJump =
      !!queryDay &&
      isValidDayString(queryDay) &&
      (focus === "my-review" || focus === "highlight");

    const hasNotificationJump =
      !!queryDay &&
      isValidDayString(queryDay) &&
      (!!reviewId || !!replyId);

    if (!hasProfileJump && !hasNotificationJump) {
      consumedProfileJumpRef.current = false;
      consumedNotificationJumpKeyRef.current = "";
      return;
    }

    if (day !== queryDay) return;

    if (hasProfileJump) {
      if (consumedProfileJumpRef.current) return;

      if (focus === "my-review") {
        if (!myReviewBlockRef.current) return;

        consumedProfileJumpRef.current = true;

        const timeout = setTimeout(() => {
          myReviewBlockRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          router.replace(`${pathname}?day=${encodeURIComponent(queryDay)}`, {
            scroll: false,
          });
        }, 500);

        return () => clearTimeout(timeout);
      }

      if (focus === "highlight") {
        if (!highlightBlockRef.current) return;

        consumedProfileJumpRef.current = true;

        const timeout = setTimeout(() => {
          scrollToHighlightBlock();

          router.replace(`${pathname}?day=${encodeURIComponent(queryDay)}`, {
            scroll: false,
          });
        }, 500);

        return () => clearTimeout(timeout);
      }

      return;
    }

    const jumpKey = `${queryDay}|${reviewId ?? ""}|${replyId ?? ""}`;

    if (consumedNotificationJumpKeyRef.current === jumpKey) return;

    const selector = replyId
      ? `[data-reply-id="${replyId}"]`
      : reviewId
        ? `[data-review-id="${reviewId}"]`
        : "";

    if (!selector) return;

    const target = document.querySelector<HTMLElement>(selector);

    if (!target) return;

    consumedNotificationJumpKeyRef.current = jumpKey;

    const currentHash = decodeURIComponent(
      window.location.hash.replace(/^#/, "")
    );

    if (currentHash && target.id && currentHash === target.id) {
      consumedNotificationJumpKeyRef.current = jumpKey;
      return;
    }

    target.scrollIntoView({
      behavior: "auto",
      block: "center",
    });

    router.replace(`${pathname}?day=${encodeURIComponent(queryDay)}`, {
      scroll: false,
    });
  }, [searchParams, day, pathname, router, loadingDay, data]);

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

  async function goToSurpriseDay(scrollToResult = false) {
    beginDayTransition();
    const transitionId = transitionIdRef.current;

    try {
      const res = await fetch(
        buildSurpriseRequestUrl({
          fresh: FORCE_FRESH_MODE,
        }),
        {
          cache: "no-store",
        }
      );

      const json = (await res.json().catch(() => null)) as
        | SurpriseResponse
        | null;

      if (transitionIdRef.current !== transitionId) return;

      if (!res.ok || !json?.day || !json?.dayData || !json?.highlightData) {
        showToast("No random day available.");
        finishDayTransition(transitionId);
        return;
      }

      rememberSurpriseDay(json.day);

      if (json.day === day) {
        applyBundlePayload(json);
        finishDayTransition(transitionId);

        if (
          scrollToResult &&
          (json.highlightData.highlight || json.highlightData.highlights?.length)
        ) {
          requestAnimationFrame(() => {
            scrollToHighlightBlock();
          });
        }

        return;
      }

      skipNextAutoDayLoadRef.current = true;
      pendingScrollToHighlightRef.current = scrollToResult;

      if (
        hasPickedInitialDay &&
        isValidDayString(day) &&
        !isGoingBackRef.current
      ) {
        pushCurrentDayToBackHistory(day, json.day);
      }

      applyBundlePayload(json);
      setDay(json.day);
    } catch {
      if (transitionIdRef.current !== transitionId) return;

      showToast("Could not load a random day.");
      finishDayTransition(transitionId);
    }
  }

  async function goToTodayInHistory(scrollToResult = false) {
    beginDayTransition();
    const transitionId = transitionIdRef.current;
    const monthDay = getTodayHistoryMonthDay();
    const currentDayForRequest = isValidDayString(currentVisibleDayRef.current)
      ? currentVisibleDayRef.current
      : isValidDayString(day)
        ? day
        : "";
    const excludedDays = new Set<string>();

    if (currentDayForRequest) {
      excludedDays.add(currentDayForRequest);
    }

    async function requestTodayHistory(fresh: boolean) {
      const res = await fetch(
        buildTodayInHistoryRequestUrl({
          bundle: true,
          fresh,
          monthDay,
          currentDay: currentDayForRequest,
          excludeDays: Array.from(excludedDays),
        }),
        {
          cache: "no-store",
        }
      );

      const json = (await res.json().catch(() => null)) as
        | TodayInHistoryResponse
        | { error?: string }
        | null;

      return { res, json };
    }

    try {
      let payload: TodayInHistoryResponse | null = null;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { res, json } = await requestTodayHistory(
          FORCE_FRESH_MODE
        );

        if (transitionIdRef.current !== transitionId) return;

        const candidate =
          res.ok &&
          json &&
          "day" in json &&
          "dayData" in json &&
          "highlightData" in json
            ? (json as TodayInHistoryResponse)
            : null;

        if (!candidate) {
          break;
        }

        if (currentDayForRequest && candidate.day === currentDayForRequest) {
          excludedDays.add(candidate.day);
          continue;
        }

        payload = candidate;
        break;
      }

      if (!payload || (currentDayForRequest && payload.day === currentDayForRequest)) {
        showToast("Could not load another today in history moment. Please try again.");
        finishDayTransition(transitionId);
        return;
      }

      if (payload.restartedRound) {
        clearTodayHistory(monthDay);
        showTodayHistoryNotice(
          `You explored all available moments for ${formatMonthDayLabel(
            monthDay
          )}. A new round has started.`
        );
      }

      rememberTodayHistoryDay(payload.day);

      skipNextAutoDayLoadRef.current = true;
      pendingScrollToHighlightRef.current = scrollToResult;

      if (
        hasPickedInitialDay &&
        currentDayForRequest &&
        !isGoingBackRef.current
      ) {
        pushCurrentDayToBackHistory(currentDayForRequest, payload.day);
      }

      applyBundlePayload(payload);
      setDay(payload.day);
    } catch {
      if (transitionIdRef.current !== transitionId) return;

      showToast("Could not load today in history.");
      finishDayTransition(transitionId);
    }
  }


  useEffect(() => {
    if (!hasPickedInitialDay) return;

    let cancelled = false;
    const transitionId = transitionIdRef.current;

    async function run() {
      if (skipNextAutoDayLoadRef.current) {
        skipNextAutoDayLoadRef.current = false;

        if (!cancelled) {
          setLoadingDay(false);
          setLoadingHighlight(false);
          navigationActionsRef.current.finishDayTransition(transitionId);
          void navigationActionsRef.current.prefetchRelatedDays(day);
        }

        return;
      }

      const shouldKeepPublicInitialBundleLightweight =
        initialBundle?.day === day &&
        !!initialBundle.publicInitialOnly &&
        pathname?.startsWith("/day/");

      if (shouldKeepPublicInitialBundleLightweight) {
        if (!cancelled) {
          setLoadingDay(false);
          setLoadingHighlight(false);
          navigationActionsRef.current.finishDayTransition(transitionId);
        }

        return;
      }

      const cachedPayload = dayBundleCacheRef.current.get(day);

      if (cachedPayload) {
        if (!cancelled) {
          navigationActionsRef.current.applyBundlePayload(cachedPayload);
          setLoadingDay(false);
          setLoadingHighlight(false);
          navigationActionsRef.current.finishDayTransition(transitionId);
          void navigationActionsRef.current.prefetchRelatedDays(day);
        }

        return;
      }

      setLoadingDay(true);
      setLoadingHighlight(true);

      try {
        const payload = await navigationActionsRef.current.fetchDayBundle(day, {
          communityOnly: true,
        });

        if (cancelled) return;

        setData(payload.dayData);

        if (typeof payload.isFavoriteDay === "boolean") {
          setIsFavoriteDay(payload.isFavoriteDay);
        }
      } catch {
        if (cancelled) return;
        showToast("Error cargando el día.");
      } finally {
        if (cancelled) return;
        navigationActionsRef.current.finishDayTransition(transitionId);
        void navigationActionsRef.current.prefetchRelatedDays(day);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    day,
    dayBundleCacheRef,
    hasPickedInitialDay,
    initialBundle?.day,
    initialBundle?.publicInitialOnly,
    pathname,
    showToast,
    transitionIdRef,
  ]);

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
  ]);

  useEffect(() => {
    if (
      !loadingHighlight &&
      pendingScrollToHighlightRef.current &&
      highlight &&
      highlightBlockRef.current
    ) {
      pendingScrollToHighlightRef.current = false;
      requestAnimationFrame(() => {
        scrollToHighlightBlock();
      });
    }
  }, [loadingHighlight, highlight]);

  function goToManualDay() {
    const nextDay = `${selectedYear}-${selectedMonth}-${selectedDay}`;
    void openPickDate(nextDay, { scrollToHighlight: true });
  }

  function goToToday() {
    void openDay(today, { scrollToHighlight: true });
  }

  function goToPreviousDay() {
    const prev = getDayWithOffset(navigationDay, -1);

    if (prev && prev >= minDay) {
      void openDay(prev, { scrollToHighlight: false });
    }
  }

  function goToNextDay() {
    const next = getDayWithOffset(navigationDay, 1);

    if (next && next <= today) {
      void openDay(next, { scrollToHighlight: false });
    }
  }

  function shiftYearBy(delta: number) {
    const nextDay = getDayWithYearShift(navigationDay, delta, minDay, today);

    if (!nextDay) return;

    void openDay(nextDay, { scrollToHighlight: false });
  }

  function goToPreviousYear() {
    shiftYearBy(-1);
  }

  function goToNextYear() {
    shiftYearBy(1);
  }

  const isAtMinDay = !isValidDayString(day) || navigationDay <= minDay;
  const isAtToday = !isValidDayString(day) || navigationDay >= today;

  const [currentYear] = today.split("-").map(Number);
  const [selectedYearNum, selectedMonthNum, selectedDayNum] = navigationDay
    .split("-")
    .map(Number);

  const prevYearCandidate = `${selectedYearNum - 1}-${pad2(
    selectedMonthNum
  )}-${pad2(
    Math.min(
      selectedDayNum,
      getDaysInMonth(selectedYearNum - 1, selectedMonthNum)
    )
  )}`;

  const nextYearCandidate = `${selectedYearNum + 1}-${pad2(
    selectedMonthNum
  )}-${pad2(
    Math.min(
      selectedDayNum,
      getDaysInMonth(selectedYearNum + 1, selectedMonthNum)
    )
  )}`;

  const isAtMinYear = selectedYearNum <= 1800 || prevYearCandidate < minDay;
  const isAtMaxYear =
    selectedYearNum >= currentYear || nextYearCandidate > today;

  const shownStars = hoverStars || stars;
  const activeBadges = getHighlightBadges(highlight);

  const { myReview, otherReviews, sortedOtherReviews } =
    useHomeReviewDerivedState({
      data,
      reviewsSort,
      setStars,
      setHoverStars,
      setReview,
    });

  const { deletingReviewId, deletingReplyId, deleteReview, deleteReply } =
    useHomeDeleteMutations({
      day,
      myReviewId: myReview?.id ?? null,
      handleProtectedActionStatus,
      invalidateDayCache,
      setStars,
      setHoverStars,
      setReview,
      setToast,
      showToast,
      setData,
    });

  const {
    pendingDeleteAction,
    openDeleteReviewModal,
    openDeleteReplyModal,
    closeDeleteModal,
    handleConfirmDelete,
  } = useHomeDeleteActions({
    deletingReviewId,
    deletingReplyId,
    showToast,
    deleteReview,
    deleteReply,
  });

  const { toggleLike } = useHomeReviewLike({
    data,
    currentUser,
    openAuthModal,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    setData,
    showToast,
  });

  const { saving, submit } = useHomeRatingSubmit({
    day,
    currentUser,
    hoverStars,
    stars,
    review,
    myReviewId: myReview?.id ?? null,
    openAuthModal,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    invalidateDayCache,
    refreshDayCommunity,
    setToast,
    showToast,
    setData,
  });

  async function shareCurrentDay() {
    const displayDate = formatDisplayDate(day);
    const cleanTitle = decodeHtml(highlight?.title ?? "").trim();
    const title = cleanTitle
      ? `${cleanTitle} — ${displayDate} | RAD`
      : `${displayDate} | RAD`;

    const text = `Explore and rate ${displayDate} on RAD.`;
    const url = `${window.location.origin}/day/${encodeURIComponent(day)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url,
        });

        return;
      }

      await navigator.clipboard.writeText(url);
      setToast("Day link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        setToast("Day link copied.");
      } catch {
        setToast("Unable to copy day link.");
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-[17px] text-zinc-100">
      <div className="mx-auto max-w-[1280px] px-8 py-12 xl:px-10">
        <div className="flex flex-col gap-6">
          <HomeExplorePanel
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            selectedDay={selectedDay}
            years={YEARS}
            months={MONTHS}
            days={DAYS}
            toast={toast}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            onDayChange={setSelectedDay}
            onGoToManualDay={goToManualDay}
            onGoToToday={goToToday}
            onGoToSurpriseDay={() => goToSurpriseDay(true)}
            onGoToTodayInHistory={() => goToTodayInHistory(true)}
          />
        </div>

        <div className="mt-12">
          <section className="rounded-[30px] border border-white/8 bg-white/[0.04] p-7 shadow-[0_20px_70px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Now exploring
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {visibleDayLabel}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xs text-zinc-400">Community avg</div>
                  <div className="text-lg font-semibold text-white">
                    {data ? formatAvg(data.avg) : "—"}
                    <span className="text-xs font-normal text-zinc-300">
                      {" "}
                      ({data?.count ?? 0})
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-zinc-500">Views</div>
                  <div className="text-sm font-medium text-zinc-200">
                    {formatCompactViews(data?.views ?? 0)}
                  </div>
                </div>
              </div>

              <div className="mt-2 border-t border-white/8 pt-5 sm:pt-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                        Quick actions
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => goToSurpriseDay(false)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-white/16 hover:bg-white/[0.075]"
                      >
                        <span
                          aria-hidden="true"
                          className="inline-flex h-4 w-4 items-center justify-center text-zinc-200"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="currentColor"
                          >
                            <path d="M12 2.75a.75.75 0 0 1 .73.57l1.05 4.1a2 2 0 0 0 1.43 1.43l4.1 1.05a.75.75 0 0 1 0 1.46l-4.1 1.05a2 2 0 0 0-1.43 1.43l-1.05 4.1a.75.75 0 0 1-1.46 0l-1.05-4.1a2 2 0 0 0-1.43-1.43l-4.1-1.05a.75.75 0 0 1 0-1.46l4.1-1.05a2 2 0 0 0 1.43-1.43l1.05-4.1A.75.75 0 0 1 12 2.75Z" />
                          </svg>
                        </span>
                        <span>Surprise me</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => goToTodayInHistory(false)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-white/16 hover:bg-white/[0.075]"
                      >
                        <span
                          aria-hidden="true"
                          className="inline-flex h-4 w-4 items-center justify-center text-zinc-200"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M8 2v3" />
                            <path d="M16 2v3" />
                            <rect x="3" y="5" width="18" height="16" rx="2" />
                            <path d="M3 10h18" />
                            <path d="M12 14h.01" />
                          </svg>
                        </span>
                        <span>Today in history</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void goBackToLastViewed(openDay);
                        }}
                        disabled={!canGoBack}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-white/16 hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span
                          aria-hidden="true"
                          className="inline-flex h-4 w-4 items-center justify-center text-zinc-200"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M19 12H5" />
                            <path d="m12 19-7-7 7-7" />
                          </svg>
                        </span>
                        <span>Go back</span>
                      </button>
                    </div>

                    {todayHistoryNotice ? (
                      <div className="rounded-xl border border-sky-400/15 bg-sky-500/10 px-3 py-2 text-xs text-sky-100/90 backdrop-blur-xl">
                        ↻ {todayHistoryNotice}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-col gap-3 lg:items-start">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                        Step through time
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={goToPreviousYear}
                        disabled={isAtMinYear}
                        className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-sm text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.065] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        «
                      </button>

                      <button
                        type="button"
                        onClick={goToPreviousDay}
                        disabled={isAtMinDay}
                        className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-sm text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.065] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ‹
                      </button>

                      <button
                        type="button"
                        onClick={goToNextDay}
                        disabled={isAtToday}
                        className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-sm text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.065] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ›
                      </button>

                      <button
                        type="button"
                        onClick={goToNextYear}
                        disabled={isAtMaxYear}
                        className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-sm text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.065] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        »
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {!hasPickedInitialDay ? (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-black/20 p-5">
                  <div className="animate-pulse">
                    <div className="h-4 w-28 rounded bg-white/10" />
                    <div className="mt-4 h-8 w-2/3 rounded bg-white/10" />
                    <div className="mt-3 h-4 w-full rounded bg-white/10" />
                    <div className="mt-2 h-4 w-5/6 rounded bg-white/10" />
                    <div className="mt-2 h-4 w-4/6 rounded bg-white/10" />
                  </div>
                </div>
              ) : highlight ? (
                <div
                  ref={highlightBlockRef}
                  className="mt-6 space-y-3"
                  onMouseEnter={pauseHighlightCarousel}
                  onMouseLeave={resumeHighlightCarousel}
                >
                  <div className="relative h-[460px] overflow-hidden rounded-2xl border border-white/8 bg-black/20 sm:h-[540px] lg:h-[640px]">
                    <button
                      type="button"
                      onClick={toggleFavoriteDay}
                      disabled={loadingFavoriteDay}
                      aria-label={
                        isFavoriteDay
                          ? "Remove favorite day"
                          : "Set as favorite day"
                      }
                      title={
                        isFavoriteDay
                          ? "Remove favorite day"
                          : "Set as favorite day"
                      }
                      className={`rad-pressable absolute right-5 top-5 z-30 flex h-12 w-12 items-center justify-center rounded-xl border backdrop-blur-xl ${
                        isFavoriteDay
                          ? "border-yellow-400/35 bg-yellow-500/20 text-yellow-300 shadow-[0_0_28px_rgba(250,204,21,0.14)] hover:bg-yellow-500/25"
                          : "border-white/15 bg-black/40 text-white hover:bg-black/50"
                      } ${loadingFavoriteDay ? "rad-pending-pulse" : ""}`}
                    >
                      <span
                        key={isFavoriteDay ? "favorite-on" : "favorite-off"}
                        className="rad-soft-pop text-2xl leading-none"
                      >
                        {isFavoriteDay ? "★" : "☆"}
                      </span>
                    </button>

                    <HighlightHeroImage
                      key={`${day}-${activeHighlightIndex}-${highlight.image ?? "no-image"}`}
                      src={highlight.image}
                      alt={decodeHtml(highlight.title) || "Historical highlight"}
                      resetKey={`${day}-${activeHighlightIndex}`}
                      revealDelayMs={HERO_IMAGE_REVEAL_DELAY_MS}
                      preferImmediateSwap={preferImmediateHighlightImageSwap}
                      onLoadingChange={(loading: boolean) => {
                        if (isDayTransitioning || !minimumTransitionDone) {
                          setHeroImageLoading(loading);
                        } else if (!loading) {
                          setHeroImageLoading(false);
                        }
                      }}
                    />

                    <div className="absolute inset-0 z-[1] bg-gradient-to-r from-black/82 via-black/56 to-black/18" />
                    <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/28 via-transparent to-black/62" />

                    <div className="relative z-20 flex h-full items-end p-6 sm:p-8">
                      <div
                        key={`${day}-${activeHighlightIndex}`}
                        className="rad-fade-swap max-w-[760px]"
                      >
                        <div className="text-sm text-zinc-200/90">In this day</div>

                        <div className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                          {formatDisplayDate(day)}
                        </div>

                        <div className="mt-5 flex min-h-[32px] flex-wrap items-center gap-2">
                          {activeBadges.map((badge) => {
                            const style = getBadgeStyle(badge);

                            return (
                              <span
                                key={badge}
                                className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur-xl ${style.pill} ${style.text} ${style.border}`}
                              >
                                {getBadgeLabel(badge)}
                              </span>
                            );
                          })}
                        </div>

                        {highlight.title ? (
                          <h2 className="mt-5 max-w-[13ch] text-[clamp(1.8rem,3.8vw,3.4rem)] font-semibold leading-[1] tracking-tight text-white">
                            {highlight.title}
                          </h2>
                        ) : null}

                        <div className="mt-5 max-w-4xl text-[17px] leading-8 text-zinc-100/90">
                          {highlight.text}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={
                      highlights.length > 1 ? "pt-1" : "inline-block pt-1"
                    }
                  >
                    <div
                      className={`grid gap-4 ${
                        highlights.length > 1
                          ? "sm:grid-cols-[1fr_auto_auto] sm:items-center"
                          : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={shareCurrentDay}
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-medium text-white transition hover:border-white/16 hover:bg-white/[0.085]"
                          aria-label="Share this day"
                          title="Share this day"
                        >
                          Share day
                        </button>

                        {highlight.articleUrl ? (
                          <a
                            href={highlight.articleUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-medium text-white transition hover:border-white/16 hover:bg-white/[0.085]"
                          >
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center justify-center text-[13px] font-semibold leading-none text-white/90"
                            >
                              W
                            </span>
                            <span>Read on Wikipedia</span>
                          </a>
                        ) : null}

                        <button
                          type="button"
                          onClick={openSuggestModal}
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-medium text-white transition hover:border-white/16 hover:bg-white/[0.085]"
                        >
                          <span
                            aria-hidden="true"
                            className="inline-flex items-center justify-center text-white/90"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9 18h6" />
                              <path d="M10 22h4" />
                              <path d="M12 2a7 7 0 0 0-4 12.75c.52.36 1 1.04 1 1.75V17h6v-.5c0-.71.48-1.39 1-1.75A7 7 0 0 0 12 2Z" />
                            </svg>
                          </span>
                          <span>Suggest an event</span>
                        </button>
                      </div>

                      {highlights.length > 1 ? (
                        <>
                          <div className="flex min-w-[56px] items-center justify-center gap-2">
                            {highlights.map((_, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => void transitionToHighlight(index)}
                                disabled={!canSwitchHighlights}
                                className={`h-2.5 w-2.5 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                  index === activeHighlightIndex
                                    ? "bg-white"
                                    : "bg-white/30"
                                }`}
                                aria-label={`Go to highlight ${index + 1}`}
                              />
                            ))}
                          </div>

                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={goToPrevHighlight}
                              disabled={!canSwitchHighlights}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-sm text-white transition hover:border-white/16 hover:bg-white/[0.085] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ←
                            </button>

                            <button
                              type="button"
                              onClick={goToNextHighlight}
                              disabled={!canSwitchHighlights}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-sm text-white transition hover:border-white/16 hover:bg-white/[0.085] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              →
                            </button>

                            <div className="min-w-[36px] text-right text-xs text-zinc-300">
                              {activeHighlightIndex + 1}/{highlights.length}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={communityPanelRef}>
                <HomeReactionsPanel
                  rateBoxRef={rateBoxRef}
                myReviewBlockRef={myReviewBlockRef}
                targetReviewId={searchParams.get("reviewId")}
                myReview={myReview ?? null}
                shownStars={shownStars}
                review={review}
                saving={saving}
                toast={toast}
                reviewsSort={reviewsSort}
                expandedReviews={expandedReviews}
                deletingReviewId={deletingReviewId}
                deletingReplyId={deletingReplyId}
                replyingToId={replyingToId}
                replyTextByRating={replyTextByRating}
                sendingReplyId={sendingReplyId}
                reportingReviewId={reportingReviewId}
                otherReviews={otherReviews}
                sortedOtherReviews={sortedOtherReviews}
                loadingDay={loadingDay}
                currentUser={currentUser}
                onSetHoverStars={setHoverStars}
                onSetStars={setStars}
                onSetReview={setReview}
                onSubmit={submit}
                onSetReviewsSort={setReviewsSort}
                onSetSocialPostOpen={setSocialPostOpen}
                onOpenDeleteReviewModal={openDeleteReviewModal}
                onSetExpandedReviews={setExpandedReviews}
                onToggleLike={toggleLike}
                onOpenAuthModal={openAuthModal}
                onRequireVerifiedEmail={requireVerifiedEmail}
                onSetReplyingToId={setReplyingToId}
                onOpenDeleteReplyModal={openDeleteReplyModal}
                onRequireReplyInteraction={requireReplyInteraction}
            onProtectedActionStatus={handleProtectedActionStatus}
                onSetReplyTextByRating={setReplyTextByRating}
                onSubmitReply={submitReply}
                onReportReview={reportReview}
                  reviewMaxLength={REVIEW_MAX_LENGTH}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {showSuggestModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">
                  Suggest an event
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  Help improve this day with a reliable source.
                </div>
              </div>

              <button
                type="button"
                onClick={closeSuggestModal}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Event title
                </span>
                <input
                  value={suggestEvent}
                  onChange={(event) => setSuggestEvent(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/20"
                  placeholder="Example: Important historical event"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Description
                </span>
                <textarea
                  value={suggestDescription}
                  onChange={(event) => setSuggestDescription(event.target.value)}
                  className="mt-1 min-h-[110px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/20"
                  placeholder="What happened?"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Source URL
                </span>
                <input
                  value={suggestSource}
                  onChange={(event) => setSuggestSource(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/20"
                  placeholder="https://..."
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Your email, optional
                </span>
                <input
                  value={suggestEmail}
                  onChange={(event) => setSuggestEmail(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/20"
                  placeholder="you@example.com"
                />
              </label>

              {suggestToast ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200">
                  {suggestToast}
                </div>
              ) : null}

              <button
                type="button"
                onClick={submitSuggestion}
                disabled={suggestSending}
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestSending ? "Sending..." : "Send suggestion"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ReportReasonModal
        open={reportReviewModalOpen}
        title="Report review"
        subtitle="Tell us why you are reporting this review."
        value={reportReviewReason}
        onChange={setReportReviewReason}
        onClose={closeReviewReportModal}
        onSubmit={submitReviewReport}
        submitting={!!reportingReviewId}
        error={reportReviewError}
        submitLabel="Send review report"
      />

      <ConfirmModal
        open={!!pendingDeleteAction}
        eyebrow="RAD Account"
        title={
          pendingDeleteAction?.kind === "review"
            ? "Delete the day's rating?"
            : "Delete response?"
        }
        description={
          pendingDeleteAction?.kind === "review"
            ? "This action cannot be undone. Your rating, review, and any responses associated with this day will be deleted."
            : "This action cannot be undone. Your answer will be deleted, and any associated answers will also be deleted."
        }
        confirmLabel="Eliminate"
        cancelLabel="Cancel"
        loading={
          pendingDeleteAction?.kind === "review"
            ? deletingReviewId === pendingDeleteAction.id
            : deletingReplyId === pendingDeleteAction?.id
        }
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />

      <SocialPostModal
        open={socialPostOpen}
        day={day}
        highlight={highlight}
        highlights={highlights}
        review={myReview ?? null}
        username={currentUser?.username ?? null}
        onClose={() => setSocialPostOpen(false)}
      />

      <CosmicLoading
        open={
          !minimumTransitionDone ||
          isDayTransitioning ||
          (loadingHighlight && !highlight) ||
          (loadingDay && !data)
        }
        label="Searching historical archives..."
      />

      <AuthModal
        open={authModalOpen}
        view={authView}
        initialEmail={authEmail}
        onClose={closeAuthModal}
        onChangeView={(view, nextEmail) => {
          setAuthView(view);

          if (typeof nextEmail === "string") {
            setAuthEmail(nextEmail);
          }
        }}
        onAuthSuccess={(user) => {
          setCurrentUser(user ?? null);
          void refreshFavoriteDayStatus(day);
          void refreshDayCommunity(day);
        }}
      />
    </main>
  );
}
