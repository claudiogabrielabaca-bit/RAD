"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const badges = getFeedBadges(item);
  const reviewText = cleanText(item.review);
  const highlightTitle = cleanText(item.highlightTitle) || item.displayDate;
  const highlightText = cleanText(item.highlightText);

  function openDay() {
    const params = new URLSearchParams();

    params.set("day", item.day);
    params.set("reviewId", item.id);

    router.push(`/?${params.toString()}`);
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
      className="group relative border-b border-white/8 px-1 py-8 text-left transition last:border-b-0 sm:px-2 sm:py-9"
    >
      <div className="grid gap-5 sm:grid-cols-[64px_minmax(0,1fr)]">
        <div className="hidden sm:block">
          <div className="sticky top-24 flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-lg font-semibold text-zinc-400 transition group-hover:border-white/16 group-hover:text-zinc-200">
              @
            </div>

            <div className="mt-4 h-full min-h-[150px] w-px bg-white/8" />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-white">
                  @{item.username}
                </span>

                <span className="text-xs text-zinc-500">•</span>

                <span className="text-[13px] tracking-[0.04em] text-yellow-400">
                  {renderStars(item.stars)}
                </span>

                <span className="text-xs text-zinc-500">•</span>

                <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                  <span>♥</span>
                  <span>{item.likesCount}</span>
                </span>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                {formatTimestamp(item.updatedAt)}
              </div>
            </div>

            <div className="shrink-0 rounded-full border border-white/8 bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium tracking-[0.14em] text-zinc-300">
              {item.day}
            </div>
          </div>

          <div className="mt-7">
            <p className="break-words text-xl font-semibold leading-snug tracking-[-0.01em] text-zinc-50 [overflow-wrap:anywhere] sm:text-2xl">
              {reviewText || "No written review"}
            </p>
          </div>

          <div className="mt-7 border-l border-white/12 pl-5 sm:pl-7">
            <div className="grid gap-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-start">
              <div className="relative h-[96px] w-full max-w-[150px] overflow-hidden rounded-2xl border border-white/8 bg-black/40 sm:h-[104px]">
                {item.highlightImage ? (
                  <Image
                    src={item.highlightImage}
                    alt={highlightTitle}
                    fill
          unoptimized
                    sizes="150px"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#1b1b1b_0%,#0e0e0e_100%)] text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    No image
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                  On this day
                </div>

                <div className="mt-2 line-clamp-2 break-words text-lg font-semibold leading-6 text-white [overflow-wrap:anywhere]">
                  {highlightTitle}
                </div>

                {highlightText ? (
                  <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-zinc-400 [overflow-wrap:anywhere] sm:text-[15px]">
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
      </div>
    </article>
  );
}
