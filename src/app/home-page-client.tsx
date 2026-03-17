"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RatingDistribution from "@/app/components/rad/rating-distribution";
import ReplyList from "@/app/components/rad/reply-list";
import ReplyComposer from "@/app/components/rad/reply-composer";
import AuthModal, { type AuthView } from "@/app/components/rad/auth-modal";
import CosmicLoading from "@/app/components/rad/cosmic-loading";
import HighlightHeroImage from "@/app/components/rad/highlight-hero-image";
import { decodeHtml } from "@/app/lib/html";

import type {
  DayResponse,
  DiscoverCard,
  FavoriteDayResponse,
  HighlightBadgeKey,
  HighlightItem,
  HighlightResponse,
  LegacyHighlightType,
  SurpriseResponse,
  TopItem,
} from "@/app/lib/rad-types";

const REVIEW_MAX_LENGTH = 280;
const REPLY_MAX_LENGTH = 220;
const HIGHLIGHT_SCROLL_OFFSET = 350;
const FORCE_FRESH_MODE = false;
const SURPRISE_HISTORY_STORAGE_KEY = "rad:surprise-history";
const SURPRISE_HISTORY_MAX = 120;
const TODAY_HISTORY_STORAGE_KEY_PREFIX = "rad:today-history:";
const TODAY_HISTORY_MAX = 160;

// Ajustá estos dos valores a gusto
const MIN_DAY_TRANSITION_MS = 1000;
const HERO_IMAGE_REVEAL_DELAY_MS = 150;

type CurrentUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
} | null;

type CurrentUserResponse = {
  user: CurrentUser;
};

type TodayInHistoryResponse = SurpriseResponse & {
  restartedRound?: boolean;
};

const BADGE_LABELS: Record<HighlightBadgeKey, string> = {
  selected: "Selected",
  event: "Event",
  birth: "Birth",
  death: "Death",
  events: "Event",
  births: "Birth",
  deaths: "Death",
  war: "War",
  disaster: "Disaster",
  politics: "Politics",
  science: "Science",
  culture: "Culture",
  sports: "Sports",
  discovery: "Discovery",
  crime: "Crime",
  general: "General",
  none: "No data",
};

const BADGE_STYLES: Record<
  HighlightBadgeKey,
  { pill: string; text: string; border: string }
> = {
  selected: {
    pill: "bg-white/12",
    text: "text-white",
    border: "border-white/15",
  },
  event: {
    pill: "bg-sky-500/18",
    text: "text-sky-200",
    border: "border-sky-400/25",
  },
  events: {
    pill: "bg-sky-500/18",
    text: "text-sky-200",
    border: "border-sky-400/25",
  },
  birth: {
    pill: "bg-emerald-500/18",
    text: "text-emerald-200",
    border: "border-emerald-400/25",
  },
  births: {
    pill: "bg-emerald-500/18",
    text: "text-emerald-200",
    border: "border-emerald-400/25",
  },
  death: {
    pill: "bg-rose-500/18",
    text: "text-rose-200",
    border: "border-rose-400/25",
  },
  deaths: {
    pill: "bg-rose-500/18",
    text: "text-rose-200",
    border: "border-rose-400/25",
  },
  war: {
    pill: "bg-amber-500/18",
    text: "text-amber-200",
    border: "border-amber-400/25",
  },
  disaster: {
    pill: "bg-orange-500/18",
    text: "text-orange-200",
    border: "border-orange-400/25",
  },
  politics: {
    pill: "bg-indigo-500/18",
    text: "text-indigo-200",
    border: "border-indigo-400/25",
  },
  science: {
    pill: "bg-cyan-500/18",
    text: "text-cyan-200",
    border: "border-cyan-400/25",
  },
  culture: {
    pill: "bg-fuchsia-500/18",
    text: "text-fuchsia-200",
    border: "border-fuchsia-400/25",
  },
  sports: {
    pill: "bg-lime-500/18",
    text: "text-lime-200",
    border: "border-lime-400/25",
  },
  discovery: {
    pill: "bg-teal-500/18",
    text: "text-teal-200",
    border: "border-teal-400/25",
  },
  crime: {
    pill: "bg-red-500/18",
    text: "text-red-200",
    border: "border-red-400/25",
  },
  general: {
    pill: "bg-zinc-500/18",
    text: "text-zinc-200",
    border: "border-zinc-400/25",
  },
  none: {
    pill: "bg-zinc-500/18",
    text: "text-zinc-200",
    border: "border-zinc-400/25",
  },
};

function getBadgeStyle(key: HighlightBadgeKey) {
  return BADGE_STYLES[key] ?? BADGE_STYLES.none;
}

function getBadgeLabel(key: HighlightBadgeKey) {
  return BADGE_LABELS[key] ?? "Unknown";
}

function normalizeLegacyTypeToBadges(
  type?: LegacyHighlightType,
  secondaryType?: LegacyHighlightType | null
): HighlightBadgeKey[] {
  const badges: HighlightBadgeKey[] = [];

  if (type && type !== "none") {
    badges.push(type);
  }

  if (secondaryType && secondaryType !== "none" && secondaryType !== type) {
    badges.push(secondaryType);
  }

  return badges;
}

function getHighlightBadges(item?: HighlightItem | null): HighlightBadgeKey[] {
  if (!item) return [];

  const badges: HighlightBadgeKey[] = [];

  if (item.kind && item.kind !== "none") {
    badges.push(item.kind);
  }

  if (item.category && item.category !== "general") {
    badges.push(item.category);
  }

  if (badges.length > 0) {
    return badges;
  }

  return normalizeLegacyTypeToBadges(item.type, item.secondaryType);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatAvg(n: number) {
  if (!n || Number.isNaN(n)) return "0.0";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function pad2(n: number | string) {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCompactViews(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatReviewDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleString();
}

function hasReviewText(text?: string) {
  return !!text && text.trim().length > 0;
}

function getDiscoverTypeLabel(type?: DiscoverCard["type"]) {
  switch (type) {
    case "births":
      return "Birth";
    case "deaths":
      return "Death";
    case "events":
      return "Event";
    case "war":
      return "War";
    case "disaster":
      return "Disaster";
    case "politics":
      return "Politics";
    case "science":
      return "Science";
    case "culture":
      return "Culture";
    case "sports":
      return "Sports";
    case "discovery":
      return "Discovery";
    case "crime":
      return "Crime";
    case "selected":
      return "Selected";
    default:
      return "History";
  }
}

function getDiscoverTypeClasses(type?: DiscoverCard["type"]) {
  switch (type) {
    case "births":
      return "border-emerald-400/25 bg-emerald-500/18 text-emerald-200";
    case "deaths":
      return "border-rose-400/25 bg-rose-500/18 text-rose-200";
    case "events":
      return "border-sky-400/25 bg-sky-500/18 text-sky-200";
    case "war":
      return "border-amber-400/25 bg-amber-500/18 text-amber-200";
    case "disaster":
      return "border-orange-400/25 bg-orange-500/18 text-orange-200";
    case "politics":
      return "border-indigo-400/25 bg-indigo-500/18 text-indigo-200";
    case "science":
      return "border-cyan-400/25 bg-cyan-500/18 text-cyan-200";
    case "culture":
      return "border-fuchsia-400/25 bg-fuchsia-500/18 text-fuchsia-200";
    case "sports":
      return "border-lime-400/25 bg-lime-500/18 text-lime-200";
    case "discovery":
      return "border-teal-400/25 bg-teal-500/18 text-teal-200";
    case "crime":
      return "border-red-500/18 text-red-200";
    default:
      return "border-white/10 bg-black/45 text-white";
  }
}

function truncateText(text: string, max = 78) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getRecentSurpriseHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SURPRISE_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return Array.from(
      new Set(
        parsed.filter(
          (item): item is string =>
            typeof item === "string" && isValidDayString(item)
        )
      )
    ).slice(0, SURPRISE_HISTORY_MAX);
  } catch {
    return [];
  }
}

function setRecentSurpriseHistory(days: string[]) {
  if (typeof window === "undefined") return;

  try {
    const safe = Array.from(
      new Set(days.filter((item) => isValidDayString(item)))
    ).slice(0, SURPRISE_HISTORY_MAX);

    window.localStorage.setItem(
      SURPRISE_HISTORY_STORAGE_KEY,
      JSON.stringify(safe)
    );
  } catch {
    //
  }
}

function rememberSurpriseDay(day: string) {
  if (!isValidDayString(day)) return;

  const current = getRecentSurpriseHistory().filter((item) => item !== day);
  setRecentSurpriseHistory([day, ...current]);
}

function getTodayHistoryMonthDay() {
  const now = new Date();
  return `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function getTodayHistoryStorageKey(monthDay = getTodayHistoryMonthDay()) {
  return `${TODAY_HISTORY_STORAGE_KEY_PREFIX}${monthDay}`;
}

function getRecentTodayHistory(monthDay = getTodayHistoryMonthDay()) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getTodayHistoryStorageKey(monthDay));
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return Array.from(
      new Set(
        parsed.filter(
          (item): item is string =>
            typeof item === "string" && isValidDayString(item)
        )
      )
    ).slice(0, TODAY_HISTORY_MAX);
  } catch {
    return [];
  }
}

function setRecentTodayHistory(
  days: string[],
  monthDay = getTodayHistoryMonthDay()
) {
  if (typeof window === "undefined") return;

  try {
    const safe = Array.from(
      new Set(days.filter((item) => isValidDayString(item)))
    ).slice(0, TODAY_HISTORY_MAX);

    window.localStorage.setItem(
      getTodayHistoryStorageKey(monthDay),
      JSON.stringify(safe)
    );
  } catch {
    //
  }
}

function rememberTodayHistoryDay(day: string) {
  if (!isValidDayString(day)) return;

  const monthDay = day.slice(5, 10);
  const current = getRecentTodayHistory(monthDay).filter((item) => item !== day);
  setRecentTodayHistory([day, ...current], monthDay);
}

function clearTodayHistory(monthDay = getTodayHistoryMonthDay()) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(getTodayHistoryStorageKey(monthDay));
  } catch {
    //
  }
}

function formatMonthDayLabel(monthDay: string) {
  const [month, day] = monthDay.split("-").map(Number);
  const date = new Date(2000, month - 1, day);

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function buildRandomRequestUrl(
  basePath: string,
  options?: {
    fresh?: boolean;
    currentDay?: string;
  }
) {
  const params = new URLSearchParams();

  if (options?.fresh) {
    params.set("fresh", "1");
  }

  const excludeDays = getRecentSurpriseHistory();

  if (options?.currentDay && isValidDayString(options.currentDay)) {
    excludeDays.unshift(options.currentDay);
  }

  const uniqueExcludeDays = Array.from(
    new Set(excludeDays.filter((item) => isValidDayString(item)))
  ).slice(0, SURPRISE_HISTORY_MAX);

  if (uniqueExcludeDays.length > 0) {
    params.set("excludeDays", uniqueExcludeDays.join(","));
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function buildTodayInHistoryRequestUrl(options?: {
  fresh?: boolean;
  currentDay?: string;
  bundle?: boolean;
}) {
  const params = new URLSearchParams();

  if (options?.bundle) {
    params.set("bundle", "1");
  }

  if (options?.fresh) {
    params.set("fresh", "1");
  }

  const monthDay = getTodayHistoryMonthDay();
  const excludeDays = getRecentTodayHistory(monthDay);

  if (
    options?.currentDay &&
    isValidDayString(options.currentDay) &&
    options.currentDay.slice(5, 10) === monthDay
  ) {
    excludeDays.unshift(options.currentDay);
  }

  const uniqueExcludeDays = Array.from(
    new Set(excludeDays.filter((item) => isValidDayString(item)))
  ).slice(0, TODAY_HISTORY_MAX);

  if (uniqueExcludeDays.length > 0) {
    params.set("excludeDays", uniqueExcludeDays.join(","));
  }

  const query = params.toString();
  return query ? `/api/today-valid-day?${query}` : "/api/today-valid-day";
}

function getDayWithOffset(baseDay: string, offset: number) {
  if (!isValidDayString(baseDay)) return null;

  const d = new Date(`${baseDay}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function getDayWithYearShift(
  baseDay: string,
  delta: number,
  minDay: string,
  maxDay: string
) {
  if (!isValidDayString(baseDay)) return null;

  const [y, m, d] = baseDay.split("-").map(Number);
  const targetYear = y + delta;
  const currentRealYear = new Date().getFullYear();

  if (targetYear < 1900 || targetYear > currentRealYear) return null;

  const maxDayInMonth = getDaysInMonth(targetYear, m);
  const safeDay = Math.min(d, maxDayInMonth);
  const candidate = `${targetYear}-${pad2(m)}-${pad2(safeDay)}`;

  if (candidate < minDay || candidate > maxDay) return null;

  return candidate;
}

async function loadDiscoverRandomDays(
  n = 5,
  fresh = FORCE_FRESH_MODE
): Promise<DiscoverCard[]> {
  try {
    const res = await fetch(
      `/api/discover?count=${n}${fresh ? "&fresh=1" : ""}`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error("Failed to load discover cards");
    }

    const json = await res.json();
    return (json.cards ?? []) as DiscoverCard[];
  } catch {
    return [];
  }
}

const YEARS = Array.from(
  { length: new Date().getFullYear() - 1900 + 1 },
  (_, i) => String(1900 + i)
).reverse();

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: pad2(i + 1),
  label: new Date(2000, i, 1).toLocaleString("en-US", { month: "long" }),
}));

function Star({
  filled,
  onClick,
  onMouseEnter,
  onMouseLeave,
  title,
}: {
  filled: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="text-3xl leading-none transition-transform hover:scale-105"
      aria-label={title ?? "star"}
    >
      <span className={filled ? "text-yellow-400" : "text-zinc-700"}>★</span>
    </button>
  );
}

function DiscoverDayCard({
  card,
  onSelect,
}: {
  card: DiscoverCard;
  onSelect: (day: string) => void;
}) {
  const badgeLabel = getDiscoverTypeLabel(card.type);
  const badgeClasses = getDiscoverTypeClasses(card.type);

  return (
    <button
      type="button"
      onClick={() => onSelect(card.day)}
      className="group relative h-[360px] overflow-hidden rounded-[30px] border border-white/8 bg-[#121212]/70 text-left shadow-[0_18px_70px_rgba(0,0,0,0.45)] transition duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-white/14"
    >
      {card.image ? (
        <img
          src={card.image}
          alt={card.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#121212] to-black" />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/90" />

      <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-xl">
          20th century
        </span>

        <span
          className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-xl ${badgeClasses}`}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
        <div className="min-h-[156px] rounded-[24px] border border-white/10 bg-black/58 p-4 backdrop-blur-2xl">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
            {card.day}
          </div>

          <div className="mt-2 line-clamp-2 min-h-[56px] text-[32px] leading-[1.05] font-semibold text-white">
            <div className="text-xl leading-tight">{card.title}</div>
          </div>

          <div className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-zinc-300">
            {truncateText(card.text, 88)}
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="flex items-center gap-2 text-zinc-200">
              <span className="text-sm">★</span>
              <span className="text-sm font-semibold">
                {formatAvg(card.avg)}
              </span>
            </div>

            <div className="text-xs text-zinc-300">
              {card.count} vote{card.count === 1 ? "" : "s"}
            </div>

            <div className="text-xs text-zinc-400">
              {formatCompactViews(card.views)} views
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const minDay = "1900-01-01";
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
  const transitionIdRef = useRef(0);

  const dayRequestRef = useRef(0);
  const highlightRequestRef = useRef(0);
  const skipNextAutoDayLoadRef = useRef(false);

  const dayBundleCacheRef = useRef<Map<string, SurpriseResponse>>(new Map());
  const prefetchingDaysRef = useRef<Set<string>>(new Set());

  const [day, setDay] = useState<string>(minDay);
  const [hasPickedInitialDay, setHasPickedInitialDay] = useState(false);

  const [selectedYear, setSelectedYear] = useState("1900");
  const [selectedMonth, setSelectedMonth] = useState("01");
  const [selectedDay, setSelectedDay] = useState("01");

  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [loadingCurrentUser, setLoadingCurrentUser] = useState(true);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [authEmail, setAuthEmail] = useState("");

  const [data, setData] = useState<DayResponse | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);

  const [highlight, setHighlight] = useState<HighlightItem | null>(null);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const [isHighlightPaused, setIsHighlightPaused] = useState(false);
  const [loadingHighlight, setLoadingHighlight] = useState(false);

  const [isFavoriteDay, setIsFavoriteDay] = useState(false);
  const [loadingFavoriteDay, setLoadingFavoriteDay] = useState(false);

  const [stars, setStars] = useState<number>(0);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [review, setReview] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>("");

  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(
    null
  );
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyTextByRating, setReplyTextByRating] = useState<
    Record<string, string>
  >({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [reviewsSort, setReviewsSort] = useState<"helpful" | "newest">(
    "helpful"
  );

  const [top, setTop] = useState<TopItem[]>([]);
  const [low, setLow] = useState<TopItem[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestEvent, setSuggestEvent] = useState("");
  const [suggestDescription, setSuggestDescription] = useState("");
  const [suggestSource, setSuggestSource] = useState("");
  const [suggestEmail, setSuggestEmail] = useState("");
  const [suggestSending, setSuggestSending] = useState(false);
  const [suggestToast, setSuggestToast] = useState("");

  const [discoverDays, setDiscoverDays] = useState<DiscoverCard[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);

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

  const profileHref =
    hasPickedInitialDay && isValidDayString(day)
      ? `/profile?returnTo=${encodeURIComponent(`/?day=${day}`)}`
      : "/profile";

  function openAuthModal(view: AuthView = "login", nextEmail = "") {
    setAuthView(view);
    setAuthEmail(nextEmail);
    setAuthModalOpen(true);
  }

  function closeAuthModal() {
    setAuthModalOpen(false);
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
    }, MIN_DAY_TRANSITION_MS);
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
    const candidates = [
      getDayWithOffset(baseDay, -1),
      getDayWithOffset(baseDay, 1),
      getDayWithYearShift(baseDay, -1, minDay, today),
      getDayWithYearShift(baseDay, 1, minDay, today),
    ].filter((item): item is string => !!item && item !== baseDay);

    for (const candidate of candidates) {
      void prefetchDayBundle(candidate);
    }
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

    pendingScrollToHighlightRef.current = shouldScrollToHighlight;
    beginDayTransition();
    const transitionId = transitionIdRef.current;

    const cached = dayBundleCacheRef.current.get(nextDay);

    if (cached) {
      skipNextAutoDayLoadRef.current = true;
      applyBundlePayload(cached);
      setDay(cached.day);
      return;
    }

    try {
      const payload = await fetchDayBundle(nextDay);

      if (transitionIdRef.current !== transitionId) return;

      skipNextAutoDayLoadRef.current = true;
      applyBundlePayload(payload);
      setDay(payload.day);
    } catch {
      if (transitionIdRef.current !== transitionId) return;
      showToast("Could not load this day.");
      finishDayTransition(transitionId);
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

      if (minTransitionTimerRef.current) {
        clearTimeout(minTransitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    refreshCurrentUser();
  }, []);

  useEffect(() => {
    dayBundleCacheRef.current.clear();
    prefetchingDaysRef.current.clear();
    setRecentSurpriseHistory([]);
    clearTodayHistory();
    setTodayHistoryNotice("");
  }, [currentUser?.id]);

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

    let cancelled = false;

    async function run() {
      const queryDay = searchParams.get("day");

      setIsDayTransitioning(false);
      setLoadingDay(false);
      setLoadingHighlight(false);

      if (queryDay && isValidDayString(queryDay)) {
        try {
          const payload = await fetchDayBundle(queryDay);

          if (!cancelled) {
            skipNextAutoDayLoadRef.current = true;
            applyBundlePayload(payload);
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
          applyBundlePayload(json);
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
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoadingDiscover(true);
      const items = await loadDiscoverRandomDays(5, FORCE_FRESH_MODE);
      if (!cancelled) {
        setDiscoverDays(items);
        setLoadingDiscover(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

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

    const hasProfileJumpParams =
      !!queryDay &&
      isValidDayString(queryDay) &&
      focus === "my-review";

    if (!hasProfileJumpParams) {
      consumedProfileJumpRef.current = false;
      return;
    }

    if (consumedProfileJumpRef.current) return;
    if (day !== queryDay) return;
    if (!myReviewBlockRef.current) return;

    consumedProfileJumpRef.current = true;

    const timeout = setTimeout(() => {
      myReviewBlockRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      router.replace(pathname, { scroll: false });
    }, 500);

    return () => clearTimeout(timeout);
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

  async function loadFavoriteDayStatus(d: string) {
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
  }

  async function toggleFavoriteDay() {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    try {
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
        showToast(json?.error ?? "Could not update favorite day.");
        return;
      }

      setIsFavoriteDay(!!json?.isFavorite);
      showToast(
        json?.message ??
          (json?.isFavorite ? "Favorite day saved." : "Removed from favorites.")
      );
    } catch {
      showToast("Could not update favorite day.");
    } finally {
      setLoadingFavoriteDay(false);
    }
  }

  async function loadTop() {
    setLoadingTop(true);

    try {
      const res = await fetch(`/api/top`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load top");

      const json = await res.json();
      setTop((json?.top ?? []) as TopItem[]);
      setLow((json?.low ?? []) as TopItem[]);
    } catch {
      setTop([]);
      setLow([]);
    } finally {
      setLoadingTop(false);
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
          finishDayTransition(transitionId);
          void prefetchRelatedDays(day);
        }

        return;
      }

      await Promise.allSettled([loadDay(day), loadHighlight(day)]);

      if (cancelled) return;

      finishDayTransition(transitionId);
      void prefetchRelatedDays(day);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [day, hasPickedInitialDay]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;
    void loadTop();
  }, [hasPickedInitialDay]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;
    void loadFavoriteDayStatus(day);
  }, [day, hasPickedInitialDay, currentUser]);

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
      setActiveHighlightIndex((prev) => {
        const next = prev + 1;
        return next >= highlights.length ? 0 : next;
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [highlights, isHighlightPaused]);

  useEffect(() => {
    setHighlight(highlights[activeHighlightIndex] ?? null);
  }, [activeHighlightIndex, highlights]);

  function goToManualDay() {
    const nextDay = `${selectedYear}-${selectedMonth}-${selectedDay}`;
    void openDay(nextDay, { scrollToHighlight: true });
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
    setActiveHighlightIndex((prev) =>
      prev === 0 ? highlights.length - 1 : prev - 1
    );
  }

  function goToNextHighlight() {
    if (highlights.length <= 1) return;
    setActiveHighlightIndex((prev) =>
      prev === highlights.length - 1 ? 0 : prev + 1
    );
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

  const isAtMinYear = selectedYearNum <= 1900 || prevYearCandidate < minDay;
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
  }, [myReview?.id, day]);

  const ratingsCount = allReviews.length;

  const starDistribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((value) => ({
        stars: value,
        count: allReviews.filter((r) => r.stars === value).length,
      })),
    [allReviews]
  );

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
      await Promise.all([loadDay(day), loadHighlight(day), loadTop()]);
      showToast("Review saved.");
    } catch {
      showToast("Error guardando.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview(ratingId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete your review?"
    );

    if (!confirmed) return;

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
      await Promise.all([loadDay(day), loadTop()]);
      showToast("Review deleted.");
    } catch {
      showToast("Could not delete review.");
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function reportReview(ratingId: string) {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    const reason = window.prompt(
      "Why are you reporting this review?",
      "Spam or abusive content"
    );

    if (!reason || reason.trim().length < 3) {
      showToast("Report reason must be at least 3 characters.");
      return;
    }

    setReportingReviewId(ratingId);
    setToast("");

    try {
      const res = await fetch("/api/review-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingId,
          reason: reason.trim(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast(json?.error ?? "Could not report review.");
        return;
      }

      showToast("Review reported.");
    } catch {
      showToast("Could not report review.");
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

    const confirmed = window.confirm(
      "Are you sure you want to delete your reply?"
    );

    if (!confirmed) return;

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
    <main className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.035),transparent_28%)]" />

              <div className="absolute right-6 top-6 z-20">
                {loadingCurrentUser ? (
                  <div className="rounded-xl border border-white/8 bg-white/[0.06] px-4 py-2 text-sm text-zinc-400 backdrop-blur-xl">
                    Loading...
                  </div>
                ) : currentUser ? (
                  <div className="flex items-center gap-2">
                    {currentUser.emailVerified === false ? (
                      <button
                        type="button"
                        onClick={() =>
                          openAuthModal("verify-email", currentUser.email)
                        }
                        className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/15"
                      >
                        Verify email
                      </button>
                    ) : null}

                    <Link
                      href={profileHref}
                      className="rounded-xl border border-white/8 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.12] backdrop-blur-xl"
                    >
                      @{currentUser.username}
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAuthModal("login")}
                      className="rounded-xl border border-white/8 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.09] backdrop-blur-xl"
                    >
                      Log in
                    </button>

                    <button
                      type="button"
                      onClick={() => openAuthModal("register")}
                      className="rounded-xl border border-white/8 bg-white/[0.1] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.14] backdrop-blur-xl"
                    >
                      Register
                    </button>
                  </div>
                )}
              </div>

              <div className="relative p-6 sm:p-8">
                <div className="max-w-2xl">
                  <div className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Explore a day
                  </div>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Discover what happened on any day in human history
                  </h2>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
                    Jump to a random moment, revisit this day in another year,
                    or choose an exact date to explore births, deaths, and key
                    historical events.
                  </p>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => goToSurpriseDay(true)}
                    className="group rounded-2xl border border-white/8 bg-white/[0.05] px-5 py-4 text-left transition hover:border-white/12 hover:bg-white/[0.08] backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.07] text-lg text-white">
                        ✦
                      </div>

                      <div>
                        <div className="text-base font-semibold text-white">
                          Surprise me
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          Jump into a random day and see what history gives you.
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToTodayInHistory(true)}
                    className="group rounded-2xl border border-white/8 bg-white/[0.05] px-5 py-4 text-left transition hover:border-white/12 hover:bg-white/[0.08] backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.07] text-lg text-white">
                        🗓
                      </div>

                      <div>
                        <div className="text-base font-semibold text-white">
                          Today in history
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          See what happened on this same month and day in a
                          different year.
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="mt-8 rounded-2xl border border-white/8 bg-black/25 p-5 backdrop-blur-xl">
                  <div className="text-sm font-medium text-zinc-200">
                    Pick an exact date
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    Choose a specific day between 1900 and today.
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="rounded-xl border border-white/8 bg-[#121212] px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-white/14 focus:ring-2 focus:ring-white/10"
                    >
                      {YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="rounded-xl border border-white/8 bg-[#121212] px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-white/14 focus:ring-2 focus:ring-white/10"
                    >
                      {MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="rounded-xl border border-white/8 bg-[#121212] px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-white/14 focus:ring-2 focus:ring-white/10"
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={goToManualDay}
                      className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                    >
                      Go
                    </button>
                  </div>

                  {toast ? (
                    <div className="mt-4 text-sm text-zinc-300">{toast}</div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-white/8 bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Now exploring
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
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

              <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 sm:p-4 backdrop-blur-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Quick actions
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToSurpriseDay(false)}
                    className="rounded-xl border border-white/8 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-white/12 hover:bg-white/[0.08]"
                  >
                    Surprise me
                  </button>

                  <button
                    type="button"
                    onClick={() => goToTodayInHistory(false)}
                    className="rounded-xl border border-white/8 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-white/12 hover:bg-white/[0.08]"
                  >
                    Today in history
                  </button>
                </div>

                {todayHistoryNotice ? (
                  <div className="rounded-xl border border-sky-400/15 bg-sky-500/10 px-3 py-2 text-xs text-sky-100/90 backdrop-blur-xl">
                    ↻ {todayHistoryNotice}
                  </div>
                ) : null}

                <div className="mt-1 flex flex-wrap items-center gap-2">
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
                className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-black/20"
                onMouseEnter={() => setIsHighlightPaused(true)}
                onMouseLeave={() => setIsHighlightPaused(false)}
              >
                <div className="relative min-h-[320px]">
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
                    onLoadingChange={(loading) => {
                      if (isDayTransitioning || !minimumTransitionDone) {
                        setHeroImageLoading(loading);
                      } else if (!loading) {
                        setHeroImageLoading(false);
                      }
                    }}
                  />
                   {heroImageLoading ? (
                  <div className="absolute inset-0 z-10 bg-black/25 backdrop-blur-[2px]" />
                  ) : null}

                  <div className="relative flex h-full min-h-[320px] flex-col justify-end p-5 sm:p-6">
                    <div className="text-sm text-zinc-200/90">In this day</div>
                    <div className="text-2xl font-semibold text-white">
                      {formatDisplayDate(day)}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {highlight.year ? (
                        <span className="rounded-md bg-white/12 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xl">
                          {highlight.year}
                        </span>
                      ) : null}

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
                      <div className="mt-3 text-3xl font-semibold leading-tight text-white">
                        {highlight.title}
                      </div>
                    ) : null}

                    <div className="mt-3 max-w-3xl text-sm leading-6 text-zinc-100/90">
                      {highlight.text}
                    </div>

                    <div className="mt-4 flex flex-col items-start gap-2">
                      {highlight.articleUrl ? (
                        <a
                          href={highlight.articleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit items-center rounded-lg border border-white/15 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/[0.12]"
                        >
                          Read on Wikipedia
                        </a>
                      ) : null}

                      <div className="text-sm text-zinc-200/85">
                        Think we&apos;re missing an important event?
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSuggestModal(true)}
                        className="inline-flex w-fit items-center rounded-lg border border-white/15 bg-white/[0.08] px-3 py-1.5 text-sm font-medium text-white backdrop-blur-xl transition hover:bg-white/[0.12]"
                      >
                        Suggest an event
                      </button>
                    </div>

                    {highlights.length > 1 ? (
                      <div className="mt-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={goToPrevHighlight}
                            className="rounded-lg border border-white/15 bg-white/[0.08] px-3 py-1.5 text-sm text-white transition hover:bg-white/[0.12]"
                          >
                            ←
                          </button>

                          <button
                            type="button"
                            onClick={goToNextHighlight}
                            className="rounded-lg border border-white/15 bg-white/[0.08] px-3 py-1.5 text-sm text-white transition hover:bg-white/[0.12]"
                          >
                            →
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {highlights.map((_, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setActiveHighlightIndex(index)}
                              className={`h-2.5 w-2.5 rounded-full transition ${
                                index === activeHighlightIndex
                                  ? "bg-white"
                                  : "bg-white/30"
                              }`}
                              aria-label={`Go to highlight ${index + 1}`}
                            />
                          ))}
                        </div>

                        <div className="text-xs text-zinc-300">
                          {activeHighlightIndex + 1}/{highlights.length}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div
              ref={rateBoxRef}
              className="mt-6 scroll-mt-24 overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_28%)]" />

                <div className="relative p-5 sm:p-6">
                  <div className="max-w-2xl">
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Your reaction
                    </div>

                    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          Rate this day
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-zinc-400">
                          Share your take on this moment in history.
                        </p>
                      </div>

                      {myReview ? (
                        <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-4 py-2 text-right backdrop-blur-xl">
                          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300/90">
                            Your current rating
                          </div>
                          <div className="mt-1 text-lg font-semibold text-white">
                            ★ {myReview.stars}.0
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl">
                    {!currentUser ? (
                      <div className="mb-5 rounded-2xl border border-amber-400/18 bg-amber-500/10 px-4 py-3 backdrop-blur-xl">
                        <div className="text-sm font-medium text-amber-200">
                          Login required to interact
                        </div>
                        <div className="mt-1 text-xs text-amber-100/80">
                          You can explore freely, but ratings, favorites, likes
                          and replies only work with an account and are the only
                          ones that count in stats.
                        </div>
                      </div>
                    ) : currentUser.emailVerified === false ? (
                      <div className="mb-5 rounded-2xl border border-amber-400/18 bg-amber-500/10 px-4 py-3 backdrop-blur-xl">
                        <div className="text-sm font-medium text-amber-200">
                          Verify your email to interact
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-amber-100/80">
                          <span>
                            Your account exists, but you should verify your email
                            first.
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              openAuthModal("verify-email", currentUser.email)
                            }
                            className="rounded-lg border border-amber-300/18 bg-amber-400/10 px-3 py-1.5 text-amber-100 transition hover:bg-amber-400/18"
                          >
                            Verify now
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {myReview ? (
                      <div className="mb-5 rounded-2xl border border-emerald-400/18 bg-emerald-500/8 px-4 py-3 backdrop-blur-xl">
                        <div className="text-sm font-medium text-emerald-300">
                          You already rated this day.
                        </div>
                        <div className="mt-1 text-xs text-emerald-200/80">
                          You can update your review below whenever you want.
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => {
                            const v = i + 1;
                            return (
                              <Star
                                key={v}
                                filled={v <= shownStars}
                                title={`${v} star${v > 1 ? "s" : ""}`}
                                onMouseEnter={() => setHoverStars(v)}
                                onMouseLeave={() => setHoverStars(0)}
                                onClick={() => setStars(v)}
                              />
                            );
                          })}
                        </div>

                        <div className="min-w-[56px] text-2xl font-semibold tracking-tight text-white">
                          {shownStars ? `${shownStars}/5` : "—/5"}
                        </div>
                      </div>

                      <div className="text-sm text-zinc-400 md:text-right">
                        {shownStars
                          ? "Choose how this day feels to you"
                          : "Select a rating from 1 to 5 stars"}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="mb-2 text-sm font-medium text-zinc-200">
                        Review
                      </div>
                      <textarea
                        value={review}
                        onChange={(e) =>
                          setReview(e.target.value.slice(0, REVIEW_MAX_LENGTH))
                        }
                        maxLength={REVIEW_MAX_LENGTH}
                        placeholder="Add a short review, reaction, or opinion about this day..."
                        className="h-28 w-full resize-none rounded-[20px] border border-white/8 bg-[#101010]/90 px-4 py-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-white/14 focus:ring-2 focus:ring-white/10"
                      />
                      <div className="mt-2 flex justify-end">
                        <div
                          className={`text-xs ${
                            review.length >= REVIEW_MAX_LENGTH
                              ? "text-red-400"
                              : review.length >= REVIEW_MAX_LENGTH - 40
                                ? "text-amber-300"
                                : "text-zinc-500"
                          }`}
                        >
                          {review.length} / {REVIEW_MAX_LENGTH}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button
                        onClick={submit}
                        disabled={saving}
                        className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                      >
                        {saving
                          ? "Saving..."
                          : myReview
                            ? "Update your review"
                            : "Rate this day"}
                      </button>

                      {toast ? (
                        <div className="text-sm text-zinc-300">{toast}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-black/18 p-5 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-zinc-100">
                    Community reactions
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    See how people rated this day
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewsSort("helpful")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      reviewsSort === "helpful"
                        ? "border border-white/8 bg-white/[0.08] text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Most helpful
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewsSort("newest")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      reviewsSort === "newest"
                        ? "border border-white/8 bg-white/[0.08] text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Newest
                  </button>
                </div>
              </div>

              <RatingDistribution
                avg={formatAvg(data?.avg ?? 0)}
                ratingsCount={ratingsCount}
                starDistribution={starDistribution}
              />

              {myReview ? (
                <div ref={myReviewBlockRef} className="mt-5">
                  <div className="mb-2 text-sm font-medium text-zinc-200">
                    Your rating
                  </div>

                  <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/5 p-4 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-yellow-400">
                        {"★".repeat(clamp(myReview.stars, 0, 5))}
                        <span className="text-zinc-700">
                          {"★".repeat(5 - clamp(myReview.stars, 0, 5))}
                        </span>
                      </div>

                      <span className="rounded-md border border-emerald-400/20 bg-emerald-500/18 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        Your review
                      </span>

                      <div className="text-xs text-zinc-400">
                        {formatReviewDate(myReview.createdAt)}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setStars(myReview.stars);
                          setHoverStars(0);
                          setReview(myReview.review);
                          rateBoxRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                        className="text-xs text-zinc-300 underline underline-offset-4 transition hover:text-white"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteReview(myReview.id)}
                        disabled={deletingReviewId === myReview.id}
                        className="text-xs text-red-300 underline underline-offset-4 transition hover:text-red-200 disabled:opacity-50"
                      >
                        {deletingReviewId === myReview.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>

                    {hasReviewText(myReview.review) ? (
                      <div className="mt-3 text-sm leading-6 text-zinc-200">
                        {myReview.review}
                      </div>
                    ) : null}

                    <div
                      className={`${
                        hasReviewText(myReview.review) ? "mt-3" : "mt-2"
                      } flex flex-wrap items-center gap-4`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleLike(myReview.id)}
                        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
                      >
                        <span
                          className={`text-base ${
                            myReview.likedByMe
                              ? "text-pink-400"
                              : "text-zinc-500"
                          }`}
                        >
                          ♥
                        </span>
                        <span>{myReview.likesCount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!currentUser) {
                            openAuthModal("login");
                            return;
                          }

                          if (requireVerifiedEmail()) return;

                          setReplyingToId((prev) =>
                            prev === myReview.id ? null : myReview.id
                          );
                        }}
                        className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
                      >
                        Reply
                      </button>
                    </div>

                    <ReplyList
                      replies={myReview.replies}
                      deletingReplyId={deletingReplyId}
                      onDeleteReply={deleteReply}
                    />

                    {replyingToId === myReview.id ? (
                      <ReplyComposer
                        value={replyTextByRating[myReview.id] ?? ""}
                        onChange={(value) =>
                          setReplyTextByRating((prev) => ({
                            ...prev,
                            [myReview.id]: value,
                          }))
                        }
                        onSubmit={() => submitReply(myReview.id)}
                        onCancel={() => setReplyingToId(null)}
                        sending={sendingReplyId === myReview.id}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <div className="mb-2 text-sm font-medium text-zinc-200">
                  Latest reviews ({otherReviews.length})
                </div>

                {loadingDay ? (
                  <div className="mb-3 text-xs text-zinc-400">Loading…</div>
                ) : null}

                <div className="space-y-3">
                  {sortedOtherReviews.slice(0, 8).map((r) => {
                    const compact = !hasReviewText(r.review);

                    return (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-white/8 bg-black/20 p-4 backdrop-blur-xl"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-yellow-400">
                            {"★".repeat(clamp(r.stars, 0, 5))}
                            <span className="text-zinc-700">
                              {"★".repeat(5 - clamp(r.stars, 0, 5))}
                            </span>
                          </div>

                          <span className="rounded-md border border-white/8 bg-white/[0.05] px-2 py-0.5 text-xs text-zinc-300">
                            {r.authorLabel}
                          </span>

                          <div className="text-xs text-zinc-400">
                            {formatReviewDate(r.createdAt)}
                          </div>

                          <button
                            type="button"
                            onClick={() => reportReview(r.id)}
                            disabled={reportingReviewId === r.id}
                            className="ml-auto text-xs text-amber-300 underline underline-offset-4 transition hover:text-amber-200 disabled:opacity-50"
                          >
                            {reportingReviewId === r.id
                              ? "Reporting..."
                              : "Report"}
                          </button>
                        </div>

                        {!compact ? (
                          <div className="mt-3 text-sm leading-6 text-zinc-200">
                            {r.review}
                          </div>
                        ) : null}

                        <div
                          className={`${
                            compact ? "mt-2" : "mt-3"
                          } flex flex-wrap items-center gap-4`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleLike(r.id)}
                            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
                          >
                            <span
                              className={`text-base ${
                                r.likedByMe ? "text-pink-400" : "text-zinc-500"
                              }`}
                            >
                              ♥
                            </span>
                            <span>{r.likesCount}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!currentUser) {
                                openAuthModal("login");
                                return;
                              }

                              if (requireVerifiedEmail()) return;

                              setReplyingToId((prev) =>
                                prev === r.id ? null : r.id
                              );
                            }}
                            className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
                          >
                            Reply
                          </button>
                        </div>

                        <ReplyList
                          replies={r.replies}
                          deletingReplyId={deletingReplyId}
                          onDeleteReply={deleteReply}
                        />

                        {replyingToId === r.id ? (
                          <ReplyComposer
                            value={replyTextByRating[r.id] ?? ""}
                            onChange={(value) =>
                              setReplyTextByRating((prev) => ({
                                ...prev,
                                [r.id]: value,
                              }))
                            }
                            onSubmit={() => submitReply(r.id)}
                            onCancel={() => setReplyingToId(null)}
                            sending={sendingReplyId === r.id}
                          />
                        ) : null}
                      </div>
                    );
                  })}

                  {otherReviews.length === 0 && !myReview ? (
                    <div className="rounded-xl border border-white/8 bg-black/15 p-4 text-sm text-zinc-400">
                      No reviews yet. Be the first.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-6 backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Most Loved Days</div>
                  <div className="text-xs text-zinc-400">
                    Best scored by the community
                  </div>
                </div>

                {loadingTop ? (
                  <div className="text-xs text-zinc-400">Loading…</div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {top.slice(0, 6).map((item, index) => (
                  <button
                    key={item.day}
                    onClick={() =>
                      openDay(item.day, { scrollToHighlight: false })
                    }
                    className="w-full rounded-xl border border-white/8 bg-black/20 p-4 text-left transition hover:bg-black/30 backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-yellow-500/20 text-xs font-semibold text-yellow-400">
                          #{index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{item.day}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-zinc-400">
                            {item.title?.trim() || "Historical day"}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-sm font-semibold text-yellow-400">
                        ★ {formatAvg(item.avg)}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">
                      {item.count} votes
                    </div>
                  </button>
                ))}

                {top.length === 0 ? (
                  <div className="text-sm text-zinc-400"></div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-6 backdrop-blur-2xl">
              <div>
                <div className="text-sm font-semibold">
                  Most Controversial Days
                </div>
                <div className="text-xs text-zinc-400">
                  Days people rated the lowest
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {low.slice(0, 6).map((item, index) => (
                  <button
                    key={item.day}
                    onClick={() =>
                      openDay(item.day, { scrollToHighlight: false })
                    }
                    className="w-full rounded-xl border border-white/8 bg-black/20 p-4 text-left transition hover:bg-black/30 backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-500/20 text-xs font-semibold text-red-400">
                          #{index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{item.day}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-zinc-400">
                            {item.title?.trim() || "Historical day"}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-sm font-semibold text-red-400">
                        ★ {formatAvg(item.avg)}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">
                      {item.count} votes
                    </div>
                  </button>
                ))}

                {low.length === 0 ? (
                  <div className="text-sm text-zinc-400"></div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-14">
          <div className="mb-5">
            <div className="text-xl font-semibold text-zinc-100">
              5 moments that defined the 20th century
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              A editorial selection of turning points that reshaped the modern
              world
            </div>
          </div>

          {loadingDiscover ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[360px] animate-pulse rounded-[30px] border border-white/8 bg-white/[0.04]"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {discoverDays.map((card, index) => (
                <DiscoverDayCard
                  key={`${card.day}-${index}`}
                  card={card}
                  onSelect={(selectedDay) =>
                    openDay(selectedDay, { scrollToHighlight: true })
                  }
                />
              ))}
            </div>
          )}
        </section>
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