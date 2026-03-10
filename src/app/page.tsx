"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type LegacyHighlightType =
  | "selected"
  | "events"
  | "births"
  | "deaths"
  | "war"
  | "disaster"
  | "politics"
  | "science"
  | "culture"
  | "sports"
  | "discovery"
  | "crime"
  | "none";

type HighlightKind = "selected" | "event" | "birth" | "death" | "none";

type HighlightCategory =
  | "general"
  | "war"
  | "disaster"
  | "politics"
  | "science"
  | "culture"
  | "sports"
  | "discovery"
  | "crime";

type HighlightBadgeKey =
  | LegacyHighlightType
  | HighlightKind
  | HighlightCategory;

type HighlightItem = {
  kind?: HighlightKind;
  category?: HighlightCategory;
  type?: LegacyHighlightType;
  secondaryType?: LegacyHighlightType | null;
  year: number | null;
  text: string;
  title: string | null;
  image: string | null;
  articleUrl: string | null;
};

type HighlightResponse = {
  highlight?: HighlightItem;
  highlights?: HighlightItem[];
};

type DayResponse = {
  day: string;
  avg: number;
  count: number;
  views?: number;
  reviews: {
    id: string;
    stars: number;
    review: string;
    createdAt?: string;
    likesCount: number;
    likedByMe: boolean;
    isMine?: boolean;
    authorLabel: string;
    replies: {
      id: string;
      text: string;
      createdAt?: string;
      isMine?: boolean;
      authorLabel: string;
    }[];
  }[];
};

type TopItem = {
  day: string;
  avg: number;
  count: number;
  title?: string | null;
};

type DiscoverCard = {
  day: string;
  title: string;
  image: string | null;
  avg: number;
  count: number;
  views: number;
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
    pill: "bg-white/15",
    text: "text-white",
    border: "border-white/20",
  },
  event: {
    pill: "bg-sky-500/20",
    text: "text-sky-300",
    border: "border-sky-400/30",
  },
  events: {
    pill: "bg-sky-500/20",
    text: "text-sky-300",
    border: "border-sky-400/30",
  },
  birth: {
    pill: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-400/30",
  },
  births: {
    pill: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-400/30",
  },
  death: {
    pill: "bg-rose-500/20",
    text: "text-rose-300",
    border: "border-rose-400/30",
  },
  deaths: {
    pill: "bg-rose-500/20",
    text: "text-rose-300",
    border: "border-rose-400/30",
  },
  war: {
    pill: "bg-amber-500/20",
    text: "text-amber-300",
    border: "border-amber-400/30",
  },
  disaster: {
    pill: "bg-orange-500/20",
    text: "text-orange-300",
    border: "border-orange-400/30",
  },
  politics: {
    pill: "bg-indigo-500/20",
    text: "text-indigo-300",
    border: "border-indigo-400/30",
  },
  science: {
    pill: "bg-cyan-500/20",
    text: "text-cyan-300",
    border: "border-cyan-400/30",
  },
  culture: {
    pill: "bg-fuchsia-500/20",
    text: "text-fuchsia-300",
    border: "border-fuchsia-400/30",
  },
  sports: {
    pill: "bg-lime-500/20",
    text: "text-lime-300",
    border: "border-lime-400/30",
  },
  discovery: {
    pill: "bg-teal-500/20",
    text: "text-teal-300",
    border: "border-teal-400/30",
  },
  crime: {
    pill: "bg-red-500/20",
    text: "text-red-300",
    border: "border-red-400/30",
  },
  general: {
    pill: "bg-zinc-500/20",
    text: "text-zinc-300",
    border: "border-zinc-400/30",
  },
  none: {
    pill: "bg-zinc-500/20",
    text: "text-zinc-300",
    border: "border-zinc-400/30",
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

function getTodayInRandomYear(minYear = 1900) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const randomYear =
    Math.floor(Math.random() * (currentYear - minYear + 1)) + minYear;

  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const maxDayInMonth = new Date(randomYear, Number(month), 0).getDate();
  const safeDay = String(Math.min(Number(day), maxDayInMonth)).padStart(2, "0");

  return `${randomYear}-${month}-${safeDay}`;
}

function getRandomDay(
  min = "1900-01-01",
  max = new Date().toISOString().slice(0, 10)
) {
  const minDate = new Date(`${min}T00:00:00`);
  const maxDate = new Date(`${max}T00:00:00`);

  const minTime = minDate.getTime();
  const maxTime = maxDate.getTime();

  const randomTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  const randomDate = new Date(randomTime);

  const year = randomDate.getFullYear();
  const month = String(randomDate.getMonth() + 1).padStart(2, "0");
  const day = String(randomDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("es-AR", {
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

async function loadDiscoverRandomDays(n = 5): Promise<DiscoverCard[]> {
  const uniqueDays = new Set<string>();

  while (uniqueDays.size < n) {
    uniqueDays.add(getRandomDay());
  }

  const days = Array.from(uniqueDays);

  const results = await Promise.all(
    days.map(async (day) => {
      try {
        const [highlightRes, dayRes] = await Promise.all([
          fetch(`/api/highlight?day=${encodeURIComponent(day)}`, {
            cache: "no-store",
          }),
          fetch(`/api/day?day=${encodeURIComponent(day)}`, {
            cache: "no-store",
          }),
        ]);

        if (!highlightRes.ok || !dayRes.ok) {
          throw new Error("Failed discover fetch");
        }

        const highlightJson = (await highlightRes.json()) as HighlightResponse;
        const dayJson = (await dayRes.json()) as DayResponse;

        const first =
          highlightJson.highlights?.[0] ?? highlightJson.highlight ?? null;

        return {
          day,
          title: first?.title?.trim() || "Historical day",
          image: first?.image ?? null,
          avg: dayJson?.avg ?? 0,
          count: dayJson?.count ?? 0,
          views: dayJson?.views ?? 0,
        };
      } catch {
        return {
          day,
          title: "Historical day",
          image: null,
          avg: 0,
          count: 0,
          views: 0,
        };
      }
    })
  );

  return results;
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
      <span className={filled ? "text-yellow-400" : "text-zinc-600"}>★</span>
    </button>
  );
}

export default function Page() {
  const minDay = "1900-01-01";
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const rateBoxRef = useRef<HTMLDivElement | null>(null);
  const dayRequestRef = useRef(0);
  const highlightRequestRef = useRef(0);

  const [day, setDay] = useState<string>(minDay);
  const [hasPickedInitialDay, setHasPickedInitialDay] = useState(false);

  const [selectedYear, setSelectedYear] = useState("1900");
  const [selectedMonth, setSelectedMonth] = useState("01");
  const [selectedDay, setSelectedDay] = useState("01");

  const [data, setData] = useState<DayResponse | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);

  const [highlight, setHighlight] = useState<HighlightItem | null>(null);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const [isHighlightPaused, setIsHighlightPaused] = useState(false);
  const [loadingHighlight, setLoadingHighlight] = useState(false);

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

  const daysInSelectedMonth = getDaysInMonth(
    Number(selectedYear),
    Number(selectedMonth)
  );

  const DAYS = Array.from(
    { length: daysInSelectedMonth },
    (_, i) => pad2(i + 1)
  );

  useEffect(() => {
    const random = getRandomDay(minDay, today);
    setDay(random);
    setHasPickedInitialDay(true);
  }, [today]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoadingDiscover(true);
      const items = await loadDiscoverRandomDays(5);
      if (!cancelled) {
        setDiscoverDays(items);
        setLoadingDiscover(false);
      }
    }

    run();

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

  async function loadDay(d: string) {
    const requestId = ++dayRequestRef.current;
    setLoadingDay(true);
    setToast("");

    try {
      const res = await fetch(`/api/day?day=${encodeURIComponent(d)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load day");
      }

      const json = (await res.json()) as DayResponse;

      if (requestId !== dayRequestRef.current) return;
      setData(json);
    } catch {
      if (requestId !== dayRequestRef.current) return;
      setToast("Error cargando el día.");
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

      if (!res.ok) {
        throw new Error("Failed to load highlight");
      }

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

  async function loadTop() {
    setLoadingTop(true);

    try {
      const res = await fetch(`/api/top`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load top");
      }

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

  useEffect(() => {
    if (!hasPickedInitialDay) return;

    fetch("/api/day-view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ day }),
    }).catch(() => {});

    loadDay(day);
    loadHighlight(day);
  }, [day, hasPickedInitialDay]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;
    loadTop();
  }, [hasPickedInitialDay]);

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

  function goToToday() {
    setDay(getTodayInRandomYear(1900));
  }

  function goToManualDay() {
    const nextDay = `${selectedYear}-${selectedMonth}-${selectedDay}`;
    setDay(nextDay);
  }

  function goToPreviousDay() {
    const d = new Date(`${day}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const prev = d.toISOString().slice(0, 10);

    if (prev >= minDay) {
      setDay(prev);
    }
  }

  function goToNextDay() {
    const d = new Date(`${day}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);

    if (next <= today) {
      setDay(next);
    }
  }

  function shiftYearBy(delta: number) {
    const [y, m, d] = day.split("-");
    const year = Number(y);
    const month = Number(m);
    const currentDay = Number(d);

    const targetYear = year + delta;
    const currentRealYear = new Date().getFullYear();

    if (targetYear < 1900 || targetYear > currentRealYear) return;

    const maxDay = getDaysInMonth(targetYear, month);
    const safeDay = Math.min(currentDay, maxDay);

    const nextDay = `${targetYear}-${pad2(month)}-${pad2(safeDay)}`;

    if (nextDay < minDay || nextDay > today) return;

    setDay(nextDay);
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
  const myReview = (data?.reviews ?? []).find((r) => r.isMine);

  const allReviews = data?.reviews ?? [];
  const ratingsCount = allReviews.length;

  const starDistribution = [5, 4, 3, 2, 1].map((value) => ({
    stars: value,
    count: allReviews.filter((r) => r.stars === value).length,
  }));

  const maxDistributionCount = Math.max(
    1,
    ...starDistribution.map((item) => item.count)
  );

  const otherReviews = allReviews.filter((r) => !r.isMine);

  const sortedOtherReviews = [...otherReviews].sort((a, b) => {
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

  async function submit() {
    const s = clamp(hoverStars || stars, 1, 5);

    if (!s) {
      setToast("Elegí de 1 a 5 estrellas.");
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

      if (!res.ok) {
        const t = await res.text();
        setToast(`Error guardando: ${t}`);
        return;
      }

      await loadDay(day);
      await loadHighlight(day);
      await loadTop();
      setToast("");
    } catch {
      setToast("Error guardando.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 2000);
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
        setToast(json?.error ?? "Could not delete review.");
        return;
      }

      if (myReview?.id === ratingId) {
        setStars(0);
        setHoverStars(0);
        setReview("");
      }

      await loadDay(day);
      await loadTop();
      setToast("Review deleted.");
    } catch {
      setToast("Could not delete review.");
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function reportReview(ratingId: string) {
    const reason = window.prompt(
      "Why are you reporting this review?",
      "Spam or abusive content"
    );

    if (!reason || reason.trim().length < 3) {
      setToast("Report reason must be at least 3 characters.");
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
        setToast(json?.error ?? "Could not report review.");
        return;
      }

      setToast("Review reported.");
    } catch {
      setToast("Could not report review.");
    } finally {
      setReportingReviewId(null);
    }
  }

  async function toggleLike(ratingId: string) {
    try {
      const res = await fetch("/api/review-like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ratingId }),
      });

      if (!res.ok) {
        const text = await res.text();
        setToast(`Error dando like: ${text}`);
        return;
      }

      await loadDay(day);
    } catch {
      setToast("Error dando like.");
    }
  }

  async function submitReply(ratingId: string) {
    const text = (replyTextByRating[ratingId] ?? "").trim();

    if (!text) {
      setToast("Reply cannot be empty.");
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
        setToast(json?.error ?? "Could not send reply.");
        return;
      }

      setReplyTextByRating((prev) => ({
        ...prev,
        [ratingId]: "",
      }));
      setReplyingToId(null);

      await loadDay(day);
      setToast("Reply sent.");
    } catch {
      setToast("Could not send reply.");
    } finally {
      setSendingReplyId(null);
    }
  }

  async function deleteReply(replyId: string) {
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
        setToast(json?.error ?? "Could not delete reply.");
        return;
      }

      await loadDay(day);
      setToast("Reply deleted.");
    } catch {
      setToast("Could not delete reply.");
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
    <main className="min-h-screen bg-[#0b1220] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Rate Any Day in Human History
            </h1>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-zinc-100">
              Explore a day
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDay(getRandomDay(minDay, today))}
                className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-black/30"
              >
                Surprise me
              </button>

              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-black/30"
              >
                Today in the history
              </button>
            </div>

            <div className="mt-5 text-sm text-zinc-300">
              or select manually:
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-white/20"
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
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-white/20"
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
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-white/20"
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
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Go
              </button>
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-zinc-200">
              Discover random days
            </div>

            {loadingDiscover ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-72 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {discoverDays.map((card, index) => (
                  <button
                    key={`${card.day}-${index}`}
                    type="button"
                    onClick={() => setDay(card.day)}
                    className="group relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-black/20 text-left transition hover:-translate-y-1 hover:border-white/20"
                  >
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 transition group-hover:from-black/95 group-hover:via-black/50 group-hover:to-black/25" />

                    <div className="absolute left-3 right-3 bottom-3 z-10">
                      <div className="line-clamp-1 text-xs text-zinc-300">
                        {card.day}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                        {card.title}
                      </div>
                    </div>

                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition duration-200 group-hover:opacity-100">
                      <div className="rounded-2xl border border-white/10 bg-black/55 px-5 py-5 backdrop-blur-md">
                        <div className="flex items-center justify-center gap-2 text-white">
                          <span className="text-lg">👁</span>
                          <span className="text-2xl font-semibold">
                            {formatCompactViews(card.views)}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-center gap-2 text-white">
                          <span className="text-lg">★</span>
                          <span className="text-2xl font-semibold">
                            {formatAvg(card.avg)}
                          </span>
                        </div>

                        <div className="mt-2 text-center text-xs text-zinc-200">
                          {card.count} vote{card.count === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-300">Selected day</div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={goToPreviousYear}
                    disabled={isAtMinYear}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    «
                  </button>

                  <button
                    type="button"
                    onClick={goToPreviousDay}
                    disabled={isAtMinDay}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ‹
                  </button>

                  <div className="text-xl font-semibold">{day}</div>

                  <button
                    type="button"
                    onClick={goToNextDay}
                    disabled={isAtToday}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ›
                  </button>

                  <button
                    type="button"
                    onClick={goToNextYear}
                    disabled={isAtMaxYear}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    »
                  </button>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-xs text-zinc-300">Community avg</div>
                <div className="text-lg font-semibold">
                  {data ? formatAvg(data.avg) : "—"}
                  <span className="text-xs font-normal text-zinc-300">
                    {" "}
                    ({data?.count ?? 0})
                  </span>
                </div>

                <div className="mt-2 text-xs text-zinc-400">Views</div>
                <div className="text-sm font-medium text-zinc-200">
                  {formatCompactViews(data?.views ?? 0)}
                </div>
              </div>
            </div>

            {!hasPickedInitialDay || loadingHighlight ? (
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-5">
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
                className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                onMouseEnter={() => setIsHighlightPaused(true)}
                onMouseLeave={() => setIsHighlightPaused(false)}
              >
                <div className="relative min-h-[320px]">
                  {highlight.image ? (
                    <img
                      src={highlight.image}
                      alt={highlight.title ?? "Historical highlight"}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/20" />

                  <div className="relative flex h-full min-h-[320px] flex-col justify-end p-5 sm:p-6">
                    <div className="text-sm text-zinc-200/90">In this day</div>
                    <div className="text-2xl font-semibold text-white">
                      {formatDisplayDate(day)}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {highlight.year ? (
                        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                          {highlight.year}
                        </span>
                      ) : null}

                      {activeBadges.map((badge) => {
                        const style = getBadgeStyle(badge);

                        return (
                          <span
                            key={badge}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur-sm ${style.pill} ${style.text} ${style.border}`}
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
                          className="inline-flex w-fit items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
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
                        className="inline-flex w-fit items-center rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
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
                            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20"
                          >
                            ←
                          </button>

                          <button
                            type="button"
                            onClick={goToNextHighlight}
                            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20"
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
              className="mt-6 scroll-mt-24 rounded-2xl border border-white/10 bg-black/20 p-5"
            >
              <div className="text-sm text-zinc-300">Rate this day</div>

              {myReview ? (
                <div className="mt-2 text-xs text-emerald-300">
                  You already rated this day. You can update your review below.
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-1">
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

                <div className="ml-3 text-sm text-zinc-300">
                  {shownStars ? `${shownStars}/5` : ""}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm text-zinc-300">Review</div>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Optional review…"
                  className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={submit}
                  disabled={saving}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
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

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-5">
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
                        ? "border border-white/10 bg-white/10 text-white"
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
                        ? "border border-white/10 bg-white/10 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Newest
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-3xl font-semibold text-white">
                    ★ {formatAvg(data?.avg ?? 0)}
                  </div>
                  <div className="text-sm text-zinc-400">
                    ({ratingsCount} rating{ratingsCount === 1 ? "" : "s"})
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {starDistribution.map((item) => (
                    <div key={item.stars} className="flex items-center gap-3">
                      <div className="w-12 shrink-0 text-sm text-zinc-300">
                        {item.stars} ★
                      </div>

                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-yellow-400"
                          style={{
                            width: `${(item.count / maxDistributionCount) * 100}%`,
                          }}
                        />
                      </div>

                      <div className="w-6 shrink-0 text-right text-sm text-zinc-400">
                        {item.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {myReview ? (
                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-zinc-200">
                    Your rating
                  </div>

                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-yellow-400">
                        {"★".repeat(clamp(myReview.stars, 0, 5))}
                        <span className="text-zinc-600">
                          {"★".repeat(5 - clamp(myReview.stars, 0, 5))}
                        </span>
                      </div>

                      <span className="rounded-md border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
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
                        onClick={() =>
                          setReplyingToId((prev) =>
                            prev === myReview.id ? null : myReview.id
                          )
                        }
                        className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
                      >
                        Reply
                      </button>
                    </div>

                    {myReview.replies?.length ? (
                      <div className="mt-4 space-y-3 border-l border-white/10 pl-4">
                        {myReview.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="rounded-xl border border-white/10 bg-black/20 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
                                {reply.authorLabel}
                              </span>

                              <div className="text-xs text-zinc-400">
                                {formatReviewDate(reply.createdAt)}
                              </div>

                              {reply.isMine ? (
                                <button
                                  type="button"
                                  onClick={() => deleteReply(reply.id)}
                                  disabled={deletingReplyId === reply.id}
                                  className="text-xs text-red-300 underline underline-offset-4 transition hover:text-red-200 disabled:opacity-50"
                                >
                                  {deletingReplyId === reply.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              ) : null}
                            </div>

                            <div className="mt-2 text-sm leading-6 text-zinc-200">
                              {reply.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {replyingToId === myReview.id ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                        <textarea
                          value={replyTextByRating[myReview.id] ?? ""}
                          onChange={(e) =>
                            setReplyTextByRating((prev) => ({
                              ...prev,
                              [myReview.id]: e.target.value,
                            }))
                          }
                          placeholder="Write a reply..."
                          className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-white/20"
                        />

                        <div className="mt-3 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => submitReply(myReview.id)}
                            disabled={sendingReplyId === myReview.id}
                            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                          >
                            {sendingReplyId === myReview.id
                              ? "Sending..."
                              : "Send reply"}
                          </button>

                          <button
                            type="button"
                            onClick={() => setReplyingToId(null)}
                            className="text-sm text-zinc-400 transition hover:text-zinc-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
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
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-yellow-400">
                            {"★".repeat(clamp(r.stars, 0, 5))}
                            <span className="text-zinc-600">
                              {"★".repeat(5 - clamp(r.stars, 0, 5))}
                            </span>
                          </div>

                          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
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
                            onClick={() =>
                              setReplyingToId((prev) =>
                                prev === r.id ? null : r.id
                              )
                            }
                            className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
                          >
                            Reply
                          </button>
                        </div>

                        {r.replies?.length ? (
                          <div className="mt-4 space-y-3 border-l border-white/10 pl-4">
                            {r.replies.map((reply) => (
                              <div
                                key={reply.id}
                                className="rounded-xl border border-white/10 bg-black/20 p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
                                    {reply.authorLabel}
                                  </span>

                                  <div className="text-xs text-zinc-400">
                                    {formatReviewDate(reply.createdAt)}
                                  </div>

                                  {reply.isMine ? (
                                    <button
                                      type="button"
                                      onClick={() => deleteReply(reply.id)}
                                      disabled={deletingReplyId === reply.id}
                                      className="text-xs text-red-300 underline underline-offset-4 transition hover:text-red-200 disabled:opacity-50"
                                    >
                                      {deletingReplyId === reply.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </button>
                                  ) : null}
                                </div>

                                <div className="mt-2 text-sm leading-6 text-zinc-200">
                                  {reply.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {replyingToId === r.id ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                            <textarea
                              value={replyTextByRating[r.id] ?? ""}
                              onChange={(e) =>
                                setReplyTextByRating((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                              placeholder="Write a reply..."
                              className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-white/20"
                            />

                            <div className="mt-3 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => submitReply(r.id)}
                                disabled={sendingReplyId === r.id}
                                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                              >
                                {sendingReplyId === r.id
                                  ? "Sending..."
                                  : "Send reply"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setReplyingToId(null)}
                                className="text-sm text-zinc-400 transition hover:text-zinc-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {otherReviews.length === 0 && !myReview ? (
                    <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-zinc-400">
                      No reviews yet. Be the first.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
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
                    onClick={() => setDay(item.day)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:bg-black/30"
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

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
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
                    onClick={() => setDay(item.day)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:bg-black/30"
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
      </div>

      {showSuggestModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl">
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
                className="rounded-lg border border-white/10 px-3 py-1 text-sm text-zinc-300 transition hover:bg-white/5"
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
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
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
                  className="h-32 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
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
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
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
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
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
    </main>
  );
}