import { getTodayDayString } from "@/app/lib/day";
import {
  HighlightBadgeKey,
  HighlightItem,
  LegacyHighlightType,
} from "@/app/lib/rad-types";

export const BADGE_LABELS: Record<HighlightBadgeKey, string> = {
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

export const BADGE_STYLES: Record<
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

export function getBadgeStyle(key: HighlightBadgeKey) {
  return BADGE_STYLES[key] ?? BADGE_STYLES.none;
}

export function getBadgeLabel(key: HighlightBadgeKey) {
  return BADGE_LABELS[key] ?? "Unknown";
}

export function normalizeLegacyTypeToBadges(
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

export function getHighlightBadges(item?: HighlightItem | null): HighlightBadgeKey[] {
  if (!item) return [];

  const rawBadges: HighlightBadgeKey[] = [];

  if (item.kind && item.kind !== "none") {
    rawBadges.push(item.kind);
  }

  if (item.category && item.category !== "general") {
    rawBadges.push(item.category);
  }

  const legacyBadges = normalizeLegacyTypeToBadges(
    item.type,
    item.secondaryType
  );

  for (const badge of legacyBadges) {
    rawBadges.push(badge);
  }

  const canonicalMap: Partial<Record<HighlightBadgeKey, HighlightBadgeKey>> = {
    births: "birth",
    deaths: "death",
    events: "event",
  };

  const badges: HighlightBadgeKey[] = [];

  for (const badge of rawBadges) {
    const normalized = canonicalMap[badge] ?? badge;

    if (!badges.includes(normalized)) {
      badges.push(normalized);
    }
  }

  const hasSpecificPrimaryBadge = badges.some((badge) =>
    ["birth", "death", "event"].includes(badge)
  );

  if (hasSpecificPrimaryBadge) {
    return badges.filter((badge) => badge !== "selected");
  }

  return badges;
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function formatAvg(n: number) {
  if (!n || Number.isNaN(n)) return "0.0";
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function pad2(n: number | string) {
  return String(n).padStart(2, "0");
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function getTodayInRandomYear(minYear = 1900) {
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

export function getRandomDay(
  min = "1900-01-01",
  max = getTodayDayString()
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

export function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCompactViews(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatReviewDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleString();
}

export function hasReviewText(text?: string) {
  return !!text && text.trim().length > 0;
}