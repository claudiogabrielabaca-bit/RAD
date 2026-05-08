"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FEATURED_MOMENTS,
  type FeaturedMoment,
} from "@/app/lib/featured-moments";
import { formatAvg, formatCompactViews } from "@/app/lib/home-page-utils";

type ImportantDaysStripProps = {
  onSelectDay: (day: string) => void;
};

type MomentStats = {
  avg: number;
  count: number;
  views: number;
};

type FilterKey = "all" | "war" | "science" | "politics" | "culture";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "war", label: "War" },
  { key: "science", label: "Science" },
  { key: "politics", label: "Politics" },
  { key: "culture", label: "Culture" },
];

const ALL_FEATURED_DAYS = [
  "1815-06-18",
  "1859-11-24",
  "1863-01-01",
  "1895-12-28",
  "1969-07-20",
];

const FALLBACK_STATS: MomentStats = {
  avg: 0,
  count: 0,
  views: 0,
};

const BADGE_CLASSES: Record<string, string> = {
  war: "border-amber-400/25 bg-amber-500/18 text-amber-200",
  science: "border-cyan-400/25 bg-cyan-500/18 text-cyan-200",
  politics: "border-indigo-400/25 bg-indigo-500/18 text-indigo-200",
  culture: "border-fuchsia-400/25 bg-fuchsia-500/18 text-fuchsia-200",
  discovery: "border-teal-400/25 bg-teal-500/18 text-teal-200",
  event: "border-sky-400/25 bg-sky-500/18 text-sky-200",
  selected: "border-white/12 bg-white/[0.08] text-white",
  general: "border-zinc-400/25 bg-zinc-500/18 text-zinc-200",
};

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function getBadgeClass(value: string) {
  return BADGE_CLASSES[value] ?? BADGE_CLASSES.general;
}

function getBadgeLabel(value: string) {
  if (value === "selected") return "Key event";
  if (value === "event") return "Event";

  return value.replace(/_/g, " ");
}

function getMomentBadges(moment: FeaturedMoment) {
  return Array.from(
    new Set(
      [moment.type, moment.secondaryType]
        .map((item) => cleanText(item))
        .filter(Boolean)
    )
  ).slice(0, 2);
}

function matchesFilter(moment: FeaturedMoment, filter: FilterKey) {
  if (filter === "all") return true;

  return moment.type === filter || moment.secondaryType === filter;
}

function getAllFeaturedMoments() {
  const byDay = new Map(FEATURED_MOMENTS.map((moment) => [moment.day, moment]));

  const curated = ALL_FEATURED_DAYS.map((day) => byDay.get(day)).filter(
    (moment): moment is FeaturedMoment => !!moment
  );

  if (curated.length >= 5) return curated.slice(0, 5);

  return FEATURED_MOMENTS.slice(0, 5);
}

async function fetchMomentStats(day: string): Promise<MomentStats> {
  try {
    const res = await fetch(`/api/day-bundle?day=${encodeURIComponent(day)}`, {
      cache: "no-store",
    });

    if (!res.ok) return FALLBACK_STATS;

    const json = await res.json();
    const dayData = json?.dayData;

    return {
      avg: typeof dayData?.avg === "number" ? dayData.avg : 0,
      count: typeof dayData?.count === "number" ? dayData.count : 0,
      views: typeof dayData?.views === "number" ? dayData.views : 0,
    };
  } catch {
    return FALLBACK_STATS;
  }
}

function MomentImage({ moment }: { moment: FeaturedMoment }) {
  const [failed, setFailed] = useState(false);

  if (!moment.image || failed) {
    return (
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(135deg,#1a1a1a_0%,#080808_100%)]" />
    );
  }

  return (
    <img
      src={moment.image}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.04]"
    />
  );
}

function MomentCard({
  moment,
  stats,
  onSelect,
}: {
  moment: FeaturedMoment;
  stats: MomentStats;
  onSelect: (day: string) => void;
}) {
  const badges = getMomentBadges(moment);

  return (
    <button
      type="button"
      onClick={() => onSelect(moment.day)}
      className="group flex min-h-[560px] overflow-hidden rounded-[30px] border border-white/10 bg-[#0a0a0a] text-left shadow-[0_22px_70px_rgba(0,0,0,0.42)] transition duration-300 hover:-translate-y-1 hover:border-white/16"
    >
      <div className="flex min-h-full w-full flex-col">
        <div className="relative h-[230px] overflow-hidden border-b border-white/8 bg-[#111]">
          <MomentImage moment={moment} />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.14)_52%,rgba(0,0,0,0.58)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.09),transparent_30%)]" />

          <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-start justify-between gap-2">
            <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-100 backdrop-blur-xl">
              {moment.day}
            </span>

            <div className="flex flex-wrap justify-end gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-xl ${getBadgeClass(
                    badge
                  )}`}
                >
                  {getBadgeLabel(badge)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="break-words text-[1.72rem] font-semibold leading-[1.08] tracking-tight text-white [overflow-wrap:anywhere]">
            {moment.title}
          </h3>

          <p className="mt-4 break-words text-[15px] leading-7 text-zinc-300 [overflow-wrap:anywhere]">
            {moment.text}
          </p>

          <div className="mt-auto pt-6">
            <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/8 pt-4">
              <div className="pr-3">
                <div className="flex items-center gap-2 text-zinc-200">
                  <span className="text-amber-300">★</span>
                  <span className="text-sm font-semibold text-white">
                    {formatAvg(stats.avg)}
                  </span>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  Rating
                </div>
              </div>

              <div className="px-3">
                <div className="text-sm font-semibold text-zinc-200">
                  {stats.count}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  Votes
                </div>
              </div>

              <div className="pl-3">
                <div className="text-sm font-semibold text-zinc-200">
                  {formatCompactViews(stats.views)}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  Views
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ImportantDaysStrip({
  onSelectDay,
}: ImportantDaysStripProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [statsByDay, setStatsByDay] = useState<Record<string, MomentStats>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      const entries = await Promise.all(
        FEATURED_MOMENTS.map(async (moment) => {
          const stats = await fetchMomentStats(moment.day);
          return [moment.day, stats] as const;
        })
      );

      if (!cancelled) {
        setStatsByDay(Object.fromEntries(entries));
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMoments = useMemo(() => {
    if (activeFilter === "all") {
      return getAllFeaturedMoments();
    }

    return FEATURED_MOMENTS.filter((moment) =>
      matchesFilter(moment, activeFilter)
    ).slice(0, 5);
  }, [activeFilter]);

  return (
    <section className="relative">
      <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-400/18 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              Modern era
            </span>

            <span className="text-sm text-zinc-500">1800s — Today</span>
          </div>

          <h2 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Important Days
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
            Curated historical moments that shaped our world from the 1800s to
            today.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.key;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`h-11 rounded-xl border px-6 text-sm font-medium transition ${
                  active
                    ? "border-amber-400/35 bg-amber-500/12 text-amber-100"
                    : "border-white/8 bg-white/[0.035] text-zinc-300 hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {filteredMoments.map((moment) => (
          <MomentCard
            key={moment.day}
            moment={moment}
            stats={statsByDay[moment.day] ?? FALLBACK_STATS}
            onSelect={onSelectDay}
          />
        ))}
      </div>
    </section>
  );
}