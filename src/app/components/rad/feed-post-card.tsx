"use client";

import Image from "next/image";

type FeedBadgeKey =
  | "event"
  | "birth"
  | "death"
  | "war"
  | "disaster"
  | "politics"
  | "science"
  | "culture"
  | "sports"
  | "discovery"
  | "crime"
  | "general"
  | "selected";

export type FeedPostItem = {
  id: string;
  day: string;
  displayDate: string;
  username: string;
  review: string;
  stars: number;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  highlightTitle: string | null;
  highlightText: string | null;
  highlightImage: string | null;
  highlightType: string | null;
  highlightCategory: string | null;
  highlightSecondaryType: string | null;
};

const BADGE_LABELS: Record<FeedBadgeKey, string> = {
  selected: "Selected",
  event: "Event",
  birth: "Birth",
  death: "Death",
  war: "War",
  disaster: "Disaster",
  politics: "Politics",
  science: "Science",
  culture: "Culture",
  sports: "Sports",
  discovery: "Discovery",
  crime: "Crime",
  general: "General",
};

const BADGE_CLASSES: Record<FeedBadgeKey, string> = {
  selected: "border-white/12 bg-white/[0.08] text-white",
  event: "border-sky-400/25 bg-sky-500/18 text-sky-200",
  birth: "border-emerald-400/25 bg-emerald-500/18 text-emerald-200",
  death: "border-rose-400/25 bg-rose-500/18 text-rose-200",
  war: "border-amber-400/25 bg-amber-500/18 text-amber-200",
  disaster: "border-orange-400/25 bg-orange-500/18 text-orange-200",
  politics: "border-indigo-400/25 bg-indigo-500/18 text-indigo-200",
  science: "border-cyan-400/25 bg-cyan-500/18 text-cyan-200",
  culture: "border-fuchsia-400/25 bg-fuchsia-500/18 text-fuchsia-200",
  sports: "border-lime-400/25 bg-lime-500/18 text-lime-200",
  discovery: "border-teal-400/25 bg-teal-500/18 text-teal-200",
  crime: "border-red-400/25 bg-red-500/18 text-red-200",
  general: "border-zinc-400/25 bg-zinc-500/18 text-zinc-200",
};

function renderStars(stars: number) {
  const safeStars = Math.max(0, Math.min(5, stars));
  return `${"★".repeat(safeStars)}${"☆".repeat(5 - safeStars)}`;
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function formatTimestamp(value: string) {
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
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function wasFeedPostEdited(createdAt: string, updatedAt: string) {
  const createdTime = new Date(createdAt).getTime();
  const updatedTime = new Date(updatedAt).getTime();

  if (!Number.isFinite(createdTime) || !Number.isFinite(updatedTime)) {
    return false;
  }

  return updatedTime - createdTime > 60_000;
}

function normalizeBadgeKey(value?: string | null): FeedBadgeKey | null {
  if (!value) return null;

  const canonical: Record<string, FeedBadgeKey> = {
    births: "birth",
    birth: "birth",
    deaths: "death",
    death: "death",
    events: "event",
    event: "event",
    war: "war",
    disaster: "disaster",
    politics: "politics",
    science: "science",
    culture: "culture",
    sports: "sports",
    discovery: "discovery",
    crime: "crime",
    general: "general",
    selected: "selected",
  };

  return canonical[value.toLowerCase()] ?? null;
}

function getFeedBadges(item: FeedPostItem): FeedBadgeKey[] {
  const raw = [
    normalizeBadgeKey(item.highlightType),
    normalizeBadgeKey(item.highlightCategory),
    normalizeBadgeKey(item.highlightSecondaryType),
  ].filter(Boolean) as FeedBadgeKey[];

  const unique = Array.from(new Set(raw));

  if (
    unique.some(
      (badge) => badge === "birth" || badge === "death" || badge === "event"
    )
  ) {
    return unique.filter((badge) => badge !== "selected" && badge !== "general");
  }

  return unique.filter((badge) => badge !== "general");
}

export default function FeedPostCard({ item }: { item: FeedPostItem }) {
  const badges = getFeedBadges(item);
  const reviewText = cleanText(item.review);
  const highlightTitle = cleanText(item.highlightTitle) || item.displayDate;
  const highlightText = cleanText(item.highlightText);
  const edited = wasFeedPostEdited(item.createdAt, item.updatedAt);

  function openDay() {
    const params = new URLSearchParams();

    params.set("day", item.day);
    params.set("reviewId", item.id);

    window.location.assign(
      `/?${params.toString()}#review-${encodeURIComponent(item.id)}`
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openDay}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDay();
        }
      }}
      className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018)_42%,rgba(0,0,0,0.32))] p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.34)] transition duration-300 hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.055] sm:p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,197,24,0.045),transparent_28%)] opacity-80" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 text-lg font-semibold text-zinc-300 shadow-inner shadow-white/[0.03] transition group-hover:border-white/16 group-hover:text-white">
              @
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-white">
                  @{item.username}
                </span>

                <span className="text-xs text-zinc-600">•</span>

                <span className="text-[13px] tracking-[0.04em] text-yellow-400">
                  {renderStars(item.stars)}
                </span>

                <span className="text-xs text-zinc-600">•</span>

                <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                  <span>♥</span>
                  <span>{item.likesCount}</span>
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{formatTimestamp(item.createdAt)}</span>
                {edited ? (
                  <>
                    <span className="text-zinc-700">?</span>
                    <span>edited</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-zinc-300 shadow-inner shadow-white/[0.03]">
            {item.day}
          </div>
        </div>

        <div className="mt-5">
          <p className="break-words text-[1.45rem] font-semibold leading-snug tracking-[-0.02em] text-zinc-50 [overflow-wrap:anywhere] sm:text-[1.65rem]">
            {reviewText || "No written review"}
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/24 p-4 shadow-inner shadow-black/35 transition group-hover:border-white/14 sm:p-5">
          <div className="grid gap-5 sm:grid-cols-[210px_minmax(0,1fr)] sm:items-start">
            <div className="relative h-[132px] w-full overflow-hidden rounded-2xl border border-white/8 bg-black/45 sm:h-[142px]">
              {item.highlightImage ? (
                <Image
                  src={item.highlightImage}
                  alt={highlightTitle}
                  fill
                  unoptimized
                  sizes="(min-width: 768px) 210px, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.035]"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#1b1b1b_0%,#0e0e0e_100%)] text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  No image
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                On this day
              </div>

              <div className="mt-2 line-clamp-2 break-words text-xl font-semibold leading-7 text-white [overflow-wrap:anywhere]">
                {highlightTitle}
              </div>

              {highlightText ? (
                <p className="mt-3 line-clamp-3 break-words text-[15px] leading-6 text-zinc-400 [overflow-wrap:anywhere]">
                  {highlightText}
                </p>
              ) : null}

              {badges.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${BADGE_CLASSES[badge]}`}
                    >
                      {BADGE_LABELS[badge]}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
