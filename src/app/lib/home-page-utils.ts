import type {
  DiscoverCard,
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

export function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("en-US", {
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

  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export function hasReviewText(text?: string) {
  return !!text && text.trim().length > 0;
}

export function isLongReview(text?: string, limit = 140) {
  return !!text && text.trim().length > limit;
}

export function getDiscoverTypeLabel(type?: DiscoverCard["type"]) {
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

export function getDiscoverTypeClasses(type?: DiscoverCard["type"]) {
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

export function truncateText(text: string, max = 78) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatMonthDayLabel(monthDay: string) {
  const [month, day] = monthDay.split("-").map(Number);
  const date = new Date(2000, month - 1, day);

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}