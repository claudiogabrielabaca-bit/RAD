"use client";
import { useHomeDeleteActions } from "@/app/hooks/use-home-delete-actions";
import { useHomeDayNavigation } from "@/app/hooks/use-home-day-navigation";
import ReportReasonModal from "@/app/components/rad/report-reason-modal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AuthModal, { type AuthView } from "@/app/components/rad/auth-modal";
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
  clamp,
  formatAvg,
  pad2,
  getDaysInMonth,
  formatDisplayDate,
  formatCompactViews,
  hasReviewText,
  isValidDayString,
  formatMonthDayLabel,
} from "@/app/lib/home-page-utils";
import type {
  DayResponse,
  FavoriteDayResponse,
  HighlightItem,
  HighlightResponse,
  SurpriseResponse,
} from "@/app/lib/rad-types";
import {
  DAY_BACK_HISTORY_MAX,
  setRecentSurpriseHistory,
  rememberSurpriseDay,
  getTodayHistoryMonthDay,
  rememberTodayHistoryDay,
  clearTodayHistory,
  getStoredDayBackHistory,
  setStoredDayBackHistory,
  buildRandomRequestUrl,
  buildTodayInHistoryRequestUrl,
  getDayWithOffset,
  getDayWithYearShift,
} from "@/app/lib/home-page-history";
import { YEARS, MONTHS } from "@/app/lib/home-page-discover";
import {
  type CurrentUser,
  type CurrentUserResponse,
} from "@/app/lib/home-page-auth";

const REVIEW_MAX_LENGTH = 280;
const REPLY_MAX_LENGTH = 220;
const HIGHLIGHT_SCROLL_OFFSET = 365;
const FORCE_FRESH_MODE = false;


const MIN_DAY_TRANSITION_MS = 1000;
const HERO_IMAGE_REVEAL_DELAY_MS = 150;

type TodayInHistoryResponse = SurpriseResponse & {
  restartedRound?: boolean;
};

export default function Page({
  initialBundle = null,
}: {
  initialBundle?: SurpriseResponse | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const minDay = "1800-01-01";
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const rateBoxRef = useRef<HTMLDivElement | null>(null);
  const myReviewBlockRef = useRef<HTMLDivElement | null>(null);
  const highlightBlockRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToHighlightRef = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayHistoryNoticeTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const minTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const consumedProfileJumpRef = useRef(false);
  const didInitDayRef = useRef(false);

  const dayRequestRef = useRef(0);
  const highlightRequestRef = useRef(0);
  const skipNextAutoDayLoadRef = useRef(false);

  const dayBackHistoryRef = useRef<string[]>([]);
  const isGoingBackRef = useRef(false);

  const initialHighlightItems = initialBundle?.highlightData?.highlights?.length
    ? initialBundle.highlightData.highlights
    : initialBundle?.highlightData?.highlight
      ? [initialBundle.highlightData.highlight]
      : [];

  const [day, setDay] = useState<string>(initialBundle?.day ?? minDay);
  const [hasPickedInitialDay, setHasPickedInitialDay] = useState(!!initialBundle);
  const [canGoBack, setCanGoBack] = useState(false);

  const [selectedYear, setSelectedYear] = useState("1800");
  const [selectedMonth, setSelectedMonth] = useState("01");
  const [selectedDay, setSelectedDay] = useState("01");

  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [, setLoadingCurrentUser] = useState(true);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [authEmail, setAuthEmail] = useState("");

  const [data, setData] = useState<DayResponse | null>(
    initialBundle?.dayData ?? null
  );
  const [loadingDay, setLoadingDay] = useState(false);

  const [highlight, setHighlight] = useState<HighlightItem | null>(
    initialHighlightItems[0] ?? null
  );
  const [highlights, setHighlights] = useState<HighlightItem[]>(initialHighlightItems);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const [isHighlightPaused, setIsHighlightPaused] = useState(false);
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

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>("");

  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>(
    {}
  );

  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(
    null
  );
  const [reportReviewModalOpen, setReportReviewModalOpen] = useState(false);
  const [reportReviewTargetId, setReportReviewTargetId] = useState<string | null>(null);
  const [reportReviewReason, setReportReviewReason] = useState("Spam or abusive content");
  const [reportReviewError, setReportReviewError] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyTextByRating, setReplyTextByRating] = useState<
    Record<string, string>
  >({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [reviewsSort, setReviewsSort] = useState<"helpful" | "newest">(
    "helpful"
  );

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestEvent, setSuggestEvent] = useState("");
  const [suggestDescription, setSuggestDescription] = useState("");
  const [suggestSource, setSuggestSource] = useState("");
  const [suggestEmail, setSuggestEmail] = useState("");
  const [suggestSending, setSuggestSending] = useState(false);
  const [suggestToast, setSuggestToast] = useState("");

  const [socialPostOpen, setSocialPostOpen] = useState(false);

  const [isDayTransitioning, setIsDayTransitioning] = useState(false);
  const [minimumTransitionDone, setMinimumTransitionDone] = useState(true);
  const [heroImageLoading, setHeroImageLoading] = useState(false);
  const [todayHistoryNotice, setTodayHistoryNotice] = useState("");

  const daysInSelectedMonth = getDaysInMonth(
    Number(selectedYear),
    Number(selectedMonth)
  );

  const DAYS = Array.from(
    { length: daysInSelectedMonth },
    (_, i) => pad2(i + 1)
  );


  function openAuthModal(view: AuthView = "login", nextEmail = "") {
    setAuthView(view);
    setAuthEmail(nextEmail);
    setAuthModalOpen(true);
  }

  function closeAuthModal() {
    setAuthModalOpen(false);
  }

  function syncDayBackHistory(nextHistory: string[]) {
    const safe = nextHistory
      .filter((item) => isValidDayString(item))
      .slice(-DAY_BACK_HISTORY_MAX);

    dayBackHistoryRef.current = safe;
    setCanGoBack(safe.length > 0);
    setStoredDayBackHistory(safe);
  }

  function pushCurrentDayToBackHistory(currentDay: string, nextDay: string) {
    if (!isValidDayString(currentDay) || !isValidDayString(nextDay)) return;
    if (currentDay === nextDay) return;

    const currentHistory = [...dayBackHistoryRef.current];
    const lastItem = currentHistory[currentHistory.length - 1];

    if (lastItem === currentDay) return;

    syncDayBackHistory([...currentHistory, currentDay]);
  }

  async function goBackToLastViewed() {
    const currentHistory = [...dayBackHistoryRef.current];
    const previousDay = currentHistory[currentHistory.length - 1];

    if (!previousDay) return;

    syncDayBackHistory(currentHistory.slice(0, -1));

    isGoingBackRef.current = true;

    try {
      await openDay(previousDay, { scrollToHighlight: false });
    } finally {
      isGoingBackRef.current = false;
    }
  }

  async function refreshCurrentUser() {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as
        | CurrentUserResponse
        | null;

      if (!res.ok) {
        setCurrentUser(null);
        return;
      }

      setCurrentUser(json?.user ?? null);
    } catch {
      setCurrentUser(null);
    } finally {
      setLoadingCurrentUser(false);
    }
  }

  function requireVerifiedEmail() {
    if (!currentUser) {
      openAuthModal("login");
      return true;
    }

    if (currentUser.emailVerified === false) {
      openAuthModal("verify-email", currentUser.email);
      return true;
    }

    return false;
  }

  function requireReplyInteraction() {
    if (!currentUser) {
      openAuthModal("login");
      return true;
    }

    if (currentUser.emailVerified === false) {
      openAuthModal("verify-email", currentUser.email);
      return true;
    }

    return false;
  }
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

  function showToast(message: string, duration = 2500) {
    setToast(message);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast("");
      toastTimeoutRef.current = null;
    }, duration);
  }

  function showTodayHistoryNotice(message: string, duration = 4200) {
    setTodayHistoryNotice(message);

    if (todayHistoryNoticeTimeoutRef.current) {
      clearTimeout(todayHistoryNoticeTimeoutRef.current);
    }

    todayHistoryNoticeTimeoutRef.current = setTimeout(() => {
      setTodayHistoryNotice("");
      todayHistoryNoticeTimeoutRef.current = null;
    }, duration);
  }

  function scrollToHighlightBlock(offset = HIGHLIGHT_SCROLL_OFFSET) {
    if (!highlightBlockRef.current) return;

    const elementTop =
      highlightBlockRef.current.getBoundingClientRect().top + window.scrollY;

    window.scrollTo({
      top: elementTop - offset,
      behavior: "smooth",
    });
  }

  const preloadImage = useCallback((src?: string | null) => {
    const normalizedSrc = src?.trim();

    if (!normalizedSrc) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const img = new window.Image();
      img.decoding = "async";

      const done = () => resolve();

      img.onload = done;
      img.onerror = done;
      img.src = normalizedSrc;

      if (img.complete) {
        resolve();
      }
    });
  }, []);

  const transitionToHighlight = useCallback(async (nextIndex: number) => {
    if (highlights.length <= 1) return;
    if (nextIndex < 0 || nextIndex >= highlights.length) return;
    if (nextIndex === activeHighlightIndex) return;

    const nextItem = highlights[nextIndex];
    const nextImage = nextItem?.image?.trim() || "";

    await preloadImage(nextImage);

    setPreferImmediateHighlightImageSwap(true);
    setActiveHighlightIndex(nextIndex);
  }, [activeHighlightIndex, highlights, preloadImage]);

  function clearMinTransitionTimer() {
    if (minTransitionTimerRef.current) {
      clearTimeout(minTransitionTimerRef.current);
      minTransitionTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      if (todayHistoryNoticeTimeoutRef.current) {
        clearTimeout(todayHistoryNoticeTimeoutRef.current);
      }

      clearMinTransitionTimer();
    };
  }, []);

  useEffect(() => {
    refreshCurrentUser();
  }, []);

  useEffect(() => {
    const storedHistory = getStoredDayBackHistory();
    dayBackHistoryRef.current = storedHistory;
    setCanGoBack(storedHistory.length > 0);
  }, []);

  const resetUserScopedNavigationState = useCallback(() => {
    dayBundleCacheRef.current.clear();
    prefetchingDaysRef.current.clear();
    setRecentSurpriseHistory([]);
    clearTodayHistory();
    setTodayHistoryNotice("");
  }, [dayBundleCacheRef, prefetchingDaysRef]);

  useEffect(() => {
    resetUserScopedNavigationState();
  }, [currentUser?.id, resetUserScopedNavigationState]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;
    if (!isValidDayString(day)) return;

    try {
      window.localStorage.setItem("rad:lastDay", day);
    } catch {
      //
    }
  }, [day, hasPickedInitialDay]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;
    if (!isValidDayString(day)) return;

    const currentQueryDay = searchParams.get("day");

    if (currentQueryDay === day) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("day", day);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [day, hasPickedInitialDay, pathname, router, searchParams]);

  useEffect(() => {
    if (didInitDayRef.current) return;
    didInitDayRef.current = true;

    if (initialBundle?.day && initialBundle?.dayData && initialBundle?.highlightData) {
      navigationActionsRef.current.cacheBundlePayload(initialBundle);
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
          const payload = await navigationActionsRef.current.fetchDayBundle(queryDay);

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

      try {
        const res = await fetch(
          buildRandomRequestUrl("/api/surprise", {
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
          buildRandomRequestUrl("/api/random-valid-day", {
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
  }, [initialBundle, searchParams]);

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

    const hasSupportedJumpParams =
      !!queryDay &&
      isValidDayString(queryDay) &&
      (focus === "my-review" || focus === "highlight");

    if (!hasSupportedJumpParams) {
      consumedProfileJumpRef.current = false;
      return;
    }

    if (consumedProfileJumpRef.current) return;
    if (day !== queryDay) return;

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
  }, [searchParams, day, pathname, router]);

  async function loadDay(d: string) {
    const requestId = ++dayRequestRef.current;
    setLoadingDay(true);
    setToast("");

    try {
      const res = await fetch(`/api/day?day=${encodeURIComponent(d)}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load day");

      const json = (await res.json()) as DayResponse;

      if (requestId !== dayRequestRef.current) return;
      setData(json);
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

  async function loadHighlight(d: string) {
    const requestId = ++highlightRequestRef.current;
    setLoadingHighlight(true);

    try {
      const res = await fetch(`/api/highlight?day=${encodeURIComponent(d)}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load highlight");

      const json = (await res.json()) as HighlightResponse;

      const items = json.highlights?.length
        ? json.highlights
        : json.highlight
          ? [json.highlight]
          : [];

      if (requestId !== highlightRequestRef.current) return;

      setHighlights(items);
      setHighlight(items[0] ?? null);
      setActiveHighlightIndex(0);
      setPreferImmediateHighlightImageSwap(false);
    } catch {
      if (requestId !== highlightRequestRef.current) return;
      setHighlights([]);
      setHighlight(null);
    } finally {
      if (requestId === highlightRequestRef.current) {
        setLoadingHighlight(false);
      }
    }
  }

  const loadFavoriteDayStatus = useCallback(async (d: string) => {
    if (!currentUser) {
      setIsFavoriteDay(false);
      return;
    }

    setLoadingFavoriteDay(true);

    try {
      const res = await fetch(`/api/favorite-day?day=${encodeURIComponent(d)}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load favorite day status");

      const json = (await res.json()) as FavoriteDayResponse;
      setIsFavoriteDay(!!json.isFavorite);
    } catch {
      setIsFavoriteDay(false);
    } finally {
      setLoadingFavoriteDay(false);
    }
  }, [currentUser]);

  async function toggleFavoriteDay() {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    try {
      setToast("");
      setLoadingFavoriteDay(true);

      const res = await fetch("/api/favorite-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ day }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        return;
      }

      setIsFavoriteDay(!!json?.isFavorite);
    } catch {
      //
    } finally {
      setLoadingFavoriteDay(false);
    }
  }

  async function goToSurpriseDay(scrollToResult = false) {
    beginDayTransition();
    const transitionId = transitionIdRef.current;

    try {
      const res = await fetch(
        buildRandomRequestUrl("/api/surprise", {
          fresh: FORCE_FRESH_MODE,
          currentDay: day,
        }),
        {
          cache: "no-store",
        }
      );

      const json = (await res.json().catch(() => null)) as
        | SurpriseResponse
        | null;

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

      if (hasPickedInitialDay && isValidDayString(day) && !isGoingBackRef.current) {
        pushCurrentDayToBackHistory(day, json.day);
      }

      applyBundlePayload(json);
      setDay(json.day);
    } catch {
      showToast("Could not load a random day.");
      finishDayTransition(transitionId);
    }
  }

  async function goToTodayInHistory(scrollToResult = false) {
    beginDayTransition();
    const transitionId = transitionIdRef.current;
    const monthDay = getTodayHistoryMonthDay();

    async function requestTodayHistory() {
      const res = await fetch(
        buildTodayInHistoryRequestUrl({
          bundle: true,
          fresh: FORCE_FRESH_MODE,
          currentDay: day,
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
      const { res, json } = await requestTodayHistory();

      const payload =
        res.ok &&
        json &&
        "day" in json &&
        "dayData" in json &&
        "highlightData" in json
          ? (json as TodayInHistoryResponse)
          : null;

      if (!payload) {
        showToast("No valid 'today in history' day available yet.");
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

      if (payload.day === day) {
        applyBundlePayload(payload);
        finishDayTransition(transitionId);

        if (
          scrollToResult &&
          (payload.highlightData.highlight ||
            payload.highlightData.highlights?.length)
        ) {
          requestAnimationFrame(() => {
            scrollToHighlightBlock();
          });
        }

        return;
      }

      skipNextAutoDayLoadRef.current = true;
      pendingScrollToHighlightRef.current = scrollToResult;

      if (hasPickedInitialDay && isValidDayString(day) && !isGoingBackRef.current) {
        pushCurrentDayToBackHistory(day, payload.day);
      }

      applyBundlePayload(payload);
      setDay(payload.day);
    } catch {
      showToast("Could not load today in history.");
      finishDayTransition(transitionId);
    }
  }

  useEffect(() => {
    if (!hasPickedInitialDay) return;

    let cancelled = false;
    const transitionId = transitionIdRef.current;

    async function run() {
      fetch("/api/day-view", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ day }),
      }).catch(() => {});

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

      setLoadingDay(true);
      setLoadingHighlight(true);

      try {
        const payload = await navigationActionsRef.current.fetchDayBundle(day);

        if (cancelled) return;

        navigationActionsRef.current.applyBundlePayload(payload);
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
  }, [day, hasPickedInitialDay, transitionIdRef]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;
    void loadFavoriteDayStatus(day);
  }, [day, hasPickedInitialDay, loadFavoriteDayStatus]);

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

  useEffect(() => {
    if (highlights.length <= 1 || isHighlightPaused) return;

    const interval = setInterval(() => {
      const nextIndex =
        activeHighlightIndex + 1 >= highlights.length
          ? 0
          : activeHighlightIndex + 1;

      void transitionToHighlight(nextIndex);
    }, 6000);

    return () => clearInterval(interval);
  }, [highlights, isHighlightPaused, activeHighlightIndex, transitionToHighlight]);

  useEffect(() => {
    setHighlight(highlights[activeHighlightIndex] ?? null);
  }, [activeHighlightIndex, highlights]);

  useEffect(() => {
    if (!preferImmediateHighlightImageSwap) return;

    const raf = requestAnimationFrame(() => {
      setPreferImmediateHighlightImageSwap(false);
    });

    return () => cancelAnimationFrame(raf);
  }, [activeHighlightIndex, preferImmediateHighlightImageSwap]);

  function goToManualDay() {
    const nextDay = `${selectedYear}-${selectedMonth}-${selectedDay}`;
    void openDay(nextDay, { scrollToHighlight: true });
  }

  function goToToday() {
    void openDay(today, { scrollToHighlight: true });
  }

  function goToPreviousDay() {
    const prev = getDayWithOffset(day, -1);

    if (prev && prev >= minDay) {
      void openDay(prev, { scrollToHighlight: false });
    }
  }

  function goToNextDay() {
    const next = getDayWithOffset(day, 1);

    if (next && next <= today) {
      void openDay(next, { scrollToHighlight: false });
    }
  }

  function shiftYearBy(delta: number) {
    const nextDay = getDayWithYearShift(day, delta, minDay, today);

    if (!nextDay) return;

    void openDay(nextDay, { scrollToHighlight: false });
  }

  function goToPreviousYear() {
    shiftYearBy(-1);
  }

  function goToNextYear() {
    shiftYearBy(1);
  }

  function goToPrevHighlight() {
    if (highlights.length <= 1) return;
    const nextIndex =
      activeHighlightIndex === 0
        ? highlights.length - 1
        : activeHighlightIndex - 1;
    void transitionToHighlight(nextIndex);
  }

  function goToNextHighlight() {
    if (highlights.length <= 1) return;
    const nextIndex =
      activeHighlightIndex === highlights.length - 1
        ? 0
        : activeHighlightIndex + 1;
    void transitionToHighlight(nextIndex);
  }

  const isAtMinDay = day <= minDay;
  const isAtToday = day >= today;

  const [currentYear] = today.split("-").map(Number);
  const [selectedYearNum, selectedMonthNum, selectedDayNum] = day
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

  const allReviews = useMemo(() => data?.reviews ?? [], [data?.reviews]);

  const myReview = useMemo(() => allReviews.find((r) => r.isMine), [allReviews]);

  useEffect(() => {
    if (!myReview) {
      setStars(0);
      setHoverStars(0);
      setReview("");
      return;
    }

    setStars(myReview.stars);
    setHoverStars(0);
    setReview(myReview.review);
  }, [myReview]);

  const otherReviews = useMemo(
    () => allReviews.filter((r) => !r.isMine),
    [allReviews]
  );

  const sortedOtherReviews = useMemo(() => {
    return [...otherReviews].sort((a, b) => {
      if (reviewsSort === "helpful") {
        if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;

        const aHasText = hasReviewText(a.review) ? 1 : 0;
        const bHasText = hasReviewText(b.review) ? 1 : 0;
        if (bHasText !== aHasText) return bHasText - aHasText;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [otherReviews, reviewsSort]);

  async function submit() {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    const s = clamp(hoverStars || stars, 1, 5);

    if (!s) {
      showToast("Elegí de 1 a 5 estrellas.");
      return;
    }

    if (review.length > REVIEW_MAX_LENGTH) {
      showToast(`Review is too long (max ${REVIEW_MAX_LENGTH} chars).`);
      return;
    }

    setSaving(true);
    setToast("");

    try {
      const res = await fetch(`/api/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day,
          stars: s,
          review: review.trim(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast(json?.error ?? "Error saving review.");
        return;
      }

      invalidateDayCache(day);
      await Promise.all([loadDay(day), loadHighlight(day)]);
      showToast("Review saved.");
    } catch {
      showToast("Error guardando.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview(ratingId: string) {
    setDeletingReviewId(ratingId);
    setToast("");

    try {
      const res = await fetch("/api/review-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ratingId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast(json?.error ?? "Could not delete review.");
        return;
      }

      if (myReview?.id === ratingId) {
        setStars(0);
        setHoverStars(0);
        setReview("");
      }

      invalidateDayCache(day);
      await Promise.all([loadDay(day)]);
      showToast("Review deleted.");
    } catch {
      showToast("Could not delete review.");
    } finally {
      setDeletingReviewId(null);
    }
  }

  function reportReview(ratingId: string) {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    setReportReviewTargetId(ratingId);
    setReportReviewReason("Spam or abusive content");
    setReportReviewError("");
    setReportReviewModalOpen(true);
  }

  async function submitReviewReport() {
    if (!reportReviewTargetId) return;

    const reason = reportReviewReason.trim();

    if (reason.length < 3) {
      setReportReviewError("Report reason must be at least 3 characters.");
      return;
    }

    setReportingReviewId(reportReviewTargetId);
    setReportReviewError("");
    setToast("");

    try {
      const res = await fetch("/api/review-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingId: reportReviewTargetId,
          reason,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setReportReviewError(json?.error ?? "Could not report review.");
        return;
      }

      setReportReviewModalOpen(false);
      setReportReviewTargetId(null);
      setReportReviewReason("Spam or abusive content");
      showToast("Review reported.");
    } catch {
      setReportReviewError("Could not report review.");
    } finally {
      setReportingReviewId(null);
    }
  }

  async function toggleLike(ratingId: string) {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    try {
      const res = await fetch("/api/review-like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ratingId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast(json?.error ?? "Error giving like.");
        return;
      }

      invalidateDayCache(day);
      await loadDay(day);
    } catch {
      showToast("Error dando like.");
    }
  }

  async function submitReply(ratingId: string) {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    const text = (replyTextByRating[ratingId] ?? "").trim();

    if (!text) {
      showToast("Reply cannot be empty.");
      return;
    }

    if (text.length > REPLY_MAX_LENGTH) {
      showToast(`Reply is too long (max ${REPLY_MAX_LENGTH} chars).`);
      return;
    }

    setSendingReplyId(ratingId);
    setToast("");

    try {
      const res = await fetch("/api/review-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingId,
          text,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast(json?.error ?? "Could not send reply.");
        return;
      }

      setReplyTextByRating((prev) => ({
        ...prev,
        [ratingId]: "",
      }));
      setReplyingToId(null);

      invalidateDayCache(day);
      await loadDay(day);
      showToast("Reply sent.");
    } catch {
      showToast("Could not send reply.");
    } finally {
      setSendingReplyId(null);
    }
  }

  async function deleteReply(replyId?: string | null) {
    if (!replyId || typeof replyId !== "string") {
      showToast("Invalid replyId.");
      return;
    }

    setDeletingReplyId(replyId);
    setToast("");

    try {
      const res = await fetch("/api/reply-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ replyId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast(json?.error ?? "Could not delete reply.");
        return;
      }

      invalidateDayCache(day);
      await loadDay(day);
      showToast("Reply deleted.");
    } catch {
      showToast("Could not delete reply.");
    } finally {
      setDeletingReplyId(null);
    }
  }

  async function submitSuggestion() {
    if (!suggestEvent.trim()) {
      setSuggestToast("Write an event title.");
      return;
    }

    if (!suggestDescription.trim()) {
      setSuggestToast("Write a short description.");
      return;
    }

    setSuggestSending(true);
    setSuggestToast("");

    try {
      const res = await fetch("/api/suggest-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          day,
          event: suggestEvent.trim(),
          description: suggestDescription.trim(),
          source: suggestSource.trim(),
          email: suggestEmail.trim(),
          website: "",
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setSuggestToast(json?.error ?? "Could not send suggestion.");
        return;
      }

      setSuggestToast("Suggestion sent ✅");
      setSuggestEvent("");
      setSuggestDescription("");
      setSuggestSource("");
      setSuggestEmail("");

      setTimeout(() => {
        setShowSuggestModal(false);
        setSuggestToast("");
      }, 900);
    } catch {
      setSuggestToast("Could not send suggestion.");
    } finally {
      setSuggestSending(false);
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
                    {day}
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

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4 sm:p-5 backdrop-blur-xl">
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
                        className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-white/12 hover:bg-white/[0.08]"
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
                        className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-white/12 hover:bg-white/[0.08]"
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
                        onClick={goBackToLastViewed}
                        disabled={!canGoBack}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-white/12 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
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
                        className="rounded-xl border border-white/8 bg-black/20 px-3.5 py-2 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        «
                      </button>

                      <button
                        type="button"
                        onClick={goToPreviousDay}
                        disabled={isAtMinDay}
                        className="rounded-xl border border-white/8 bg-black/20 px-3.5 py-2 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ‹
                      </button>

                      <button
                        type="button"
                        onClick={goToNextDay}
                        disabled={isAtToday}
                        className="rounded-xl border border-white/8 bg-black/20 px-3.5 py-2 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ›
                      </button>

                      <button
                        type="button"
                        onClick={goToNextYear}
                        disabled={isAtMaxYear}
                        className="rounded-xl border border-white/8 bg-black/20 px-3.5 py-2 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
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
    onMouseEnter={() => setIsHighlightPaused(true)}
    onMouseLeave={() => setIsHighlightPaused(false)}
  >
    <div className="relative h-[460px] overflow-hidden rounded-2xl border border-white/8 bg-black/20 sm:h-[540px] lg:h-[640px]">
      <button
        type="button"
        onClick={toggleFavoriteDay}
        disabled={loadingFavoriteDay}
        aria-label={
          isFavoriteDay ? "Remove favorite day" : "Set as favorite day"
        }
        title={isFavoriteDay ? "Remove favorite day" : "Set as favorite day"}
        className={`absolute right-5 top-5 z-30 flex h-12 w-12 items-center justify-center rounded-xl border backdrop-blur-xl transition ${
          isFavoriteDay
            ? "border-yellow-400/30 bg-yellow-500/18 text-yellow-300 hover:bg-yellow-500/22"
            : "border-white/15 bg-black/40 text-white hover:bg-black/48"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="text-2xl leading-none">
          {isFavoriteDay ? "★" : "☆"}
        </span>
      </button>

      <HighlightHeroImage
        src={highlight.image}
        alt={decodeHtml(highlight.title) || "Historical highlight"}
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

      {heroImageLoading ? (
        <div className="absolute inset-0 z-10 bg-black/30 backdrop-blur-[2px]" />
      ) : null}

      <div className="relative z-20 flex h-full items-end p-6 sm:p-8">
        <div className="max-w-[760px]">
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
      className={`rounded-2xl border border-white/8 bg-black/20 p-4 backdrop-blur-xl ${
        highlights.length > 1 ? "" : "inline-block"
      }`}
    >
      <div
        className={`grid gap-4 ${
          highlights.length > 1 ? "sm:grid-cols-[1fr_auto_auto] sm:items-center" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {highlight.articleUrl ? (
            <a
              href={highlight.articleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 text-sm font-medium text-white transition hover:bg-white/[0.12]"
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
            onClick={() => setShowSuggestModal(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 text-sm font-medium text-white transition hover:bg-white/[0.12]"
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
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === activeHighlightIndex ? "bg-white" : "bg-white/30"
                  }`}
                  aria-label={`Go to highlight ${index + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={goToPrevHighlight}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-sm text-white transition hover:bg-white/[0.12]"
              >
                ←
              </button>

              <button
                type="button"
                onClick={goToNextHighlight}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-sm text-white transition hover:bg-white/[0.12]"
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
              <HomeReactionsPanel
                rateBoxRef={rateBoxRef}
                myReviewBlockRef={myReviewBlockRef}
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
                onSetReplyTextByRating={setReplyTextByRating}
                onSubmitReply={submitReply}
                onReportReview={reportReview}
                reviewMaxLength={REVIEW_MAX_LENGTH}
              />
            </div>
          </section>

          </div>

        </div>

      {showSuggestModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-[28px] border border-white/8 bg-[#111111]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Suggest a historical event
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {formatDisplayDate(day)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowSuggestModal(false);
                  setSuggestToast("");
                }}
                className="rounded-lg border border-white/8 px-3 py-1 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Event
                </label>
                <input
                  value={suggestEvent}
                  onChange={(e) => setSuggestEvent(e.target.value)}
                  placeholder="Example: Boxer Protocol signed in Beijing"
                  className="w-full rounded-xl border border-white/8 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Description
                </label>
                <textarea
                  value={suggestDescription}
                  onChange={(e) => setSuggestDescription(e.target.value)}
                  placeholder="Write a short description of what happened..."
                  className="h-32 w-full resize-none rounded-xl border border-white/8 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Source (optional)
                </label>
                <input
                  value={suggestSource}
                  onChange={(e) => setSuggestSource(e.target.value)}
                  placeholder="Wikipedia, article URL, book, etc."
                  className="w-full rounded-xl border border-white/8 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Your email (optional)
                </label>
                <input
                  value={suggestEmail}
                  onChange={(e) => setSuggestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl border border-white/8 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/10"
                />
              </div>

              {suggestToast ? (
                <div className="text-sm text-zinc-300">{suggestToast}</div>
              ) : null}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={submitSuggestion}
                  disabled={suggestSending}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {suggestSending ? "Sending..." : "Send suggestion"}
                </button>
              </div>
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
        onClose={() => {
          if (reportingReviewId) return;
          setReportReviewModalOpen(false);
          setReportReviewTargetId(null);
          setReportReviewError("");
        }}
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
        review={myReview ?? null}
        username={currentUser?.username ?? null}
        onClose={() => setSocialPostOpen(false)}
      />

      <CosmicLoading
        open={
          !minimumTransitionDone ||
          isDayTransitioning ||
          (loadingHighlight && !highlight) ||
          (loadingDay && !data) ||
          heroImageLoading
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
          setLoadingCurrentUser(false);
          loadFavoriteDayStatus(day);
          loadDay(day);
        }}
      />
    </main>
  );
}