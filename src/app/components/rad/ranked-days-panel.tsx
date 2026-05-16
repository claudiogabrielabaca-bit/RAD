"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAvg } from "@/app/lib/home-page-utils";
import type { TopItem } from "@/app/lib/rad-types";

type Tone = "gold" | "red";

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function getToneClasses(tone: Tone) {
  if (tone === "gold") {
    return {
      panel:
        "border-amber-400/12 bg-[linear-gradient(135deg,rgba(245,158,11,0.07),rgba(255,255,255,0.018))]",
      badge: "border-amber-500/20 bg-amber-500/12 text-amber-300",
      score: "text-amber-300",
      heading: "text-amber-200/90",
      rowGlow: "hover:border-amber-400/22 hover:bg-amber-500/[0.035]",
      rowActive:
        "border-amber-400/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.075),rgba(255,255,255,0.018))]",
      thumb:
        "border-amber-400/15 bg-amber-500/[0.06] text-amber-300",
    };
  }

  return {
    panel:
      "border-rose-400/12 bg-[linear-gradient(135deg,rgba(244,63,94,0.065),rgba(255,255,255,0.016))]",
    badge: "border-rose-500/20 bg-rose-500/12 text-rose-300",
    score: "text-rose-300",
    heading: "text-rose-200/90",
    rowGlow: "hover:border-rose-400/22 hover:bg-rose-500/[0.035]",
    rowActive:
      "border-rose-400/20 bg-[linear-gradient(135deg,rgba(244,63,94,0.07),rgba(255,255,255,0.016))]",
    thumb:
      "border-rose-400/15 bg-rose-500/[0.06] text-rose-300",
  };
}

function getItemTitle(item: TopItem) {
  return cleanText(item.title) || "No exact historical match";
}

function getItemText(item: TopItem) {
  const text = cleanText(item.text);
  const title = getItemTitle(item);
  const titlePrefix = `${title}: `;

  if (!text) return "No context available.";

  if (text.startsWith(titlePrefix)) {
    return cleanText(text.slice(titlePrefix.length)) || "No context available.";
  }

  return text;
}

function getBadgeKey(item: TopItem) {
  if (item.kind && item.kind !== "none") return item.kind;
  if (item.category && item.category !== "general") return item.category;
  if (item.type && item.type !== "none") return item.type;
  if (item.secondaryType && item.secondaryType !== "none") {
    return item.secondaryType;
  }

  return null;
}

function getBadgeLabel(key: string) {
  if (key === "births" || key === "birth") return "Birth";
  if (key === "deaths" || key === "death") return "Death";
  if (key === "events" || key === "event" || key === "selected") {
    return "Event";
  }

  return key.replace(/_/g, " ");
}

function getBadgeClasses(key: string) {
  switch (key) {
    case "birth":
    case "births":
      return "border-emerald-400/20 bg-emerald-500/12 text-emerald-200";
    case "death":
    case "deaths":
      return "border-rose-400/20 bg-rose-500/12 text-rose-200";
    case "event":
    case "events":
    case "selected":
      return "border-cyan-400/20 bg-cyan-500/12 text-cyan-200";
    case "war":
      return "border-amber-400/20 bg-amber-500/12 text-amber-200";
    case "politics":
      return "border-indigo-400/20 bg-indigo-500/12 text-indigo-200";
    case "science":
      return "border-cyan-400/20 bg-cyan-500/12 text-cyan-200";
    case "sports":
      return "border-lime-400/20 bg-lime-500/12 text-lime-200";
    case "culture":
      return "border-fuchsia-400/20 bg-fuchsia-500/12 text-fuchsia-200";
    case "crime":
      return "border-red-400/20 bg-red-500/12 text-red-200";
    case "disaster":
      return "border-orange-400/20 bg-orange-500/12 text-orange-200";
    case "discovery":
      return "border-teal-400/20 bg-teal-500/12 text-teal-200";
    default:
      return "border-zinc-400/20 bg-zinc-500/12 text-zinc-200";
  }
}

function RankBadge({
  place,
  tone,
}: {
  place: number;
  tone: Tone;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${toneClasses.badge}`}
    >
      #{place}
    </span>
  );
}

function ContextBadge({ item }: { item: TopItem }) {
  const key = getBadgeKey(item);

  if (!key) {
    return <div className="mt-2 min-h-6" />;
  }

  return (
    <div className="mt-2 flex min-h-6 items-center">
      <span
        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${getBadgeClasses(
          key
        )}`}
      >
        {getBadgeLabel(key)}
      </span>
    </div>
  );
}

function RankedThumbnail({
  item,
  tone,
}: {
  item: TopItem;
  tone: Tone;
}) {
  const toneClasses = getToneClasses(tone);
  const title = getItemTitle(item);

  if (item.image) {
    return (
      <div className="relative hidden h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:block">
        <Image
          src={item.image}
          alt={title}
          fill
          unoptimized
          sizes="64px"
          draggable={false}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-lg sm:flex ${toneClasses.thumb}`}
    >
      {tone === "gold" ? "★" : "↓"}
    </div>
  );
}

function PodiumRow({
  item,
  place,
  tone,
  onClick,
}: {
  item: TopItem;
  place: 1 | 2 | 3;
  tone: Tone;
  onClick: () => void;
}) {
  const toneClasses = getToneClasses(tone);
  const title = getItemTitle(item);
  const text = getItemText(item);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-[22px] border px-4 py-4 text-left transition ${toneClasses.rowGlow} ${
        place === 1 ? toneClasses.rowActive : "border-white/8 bg-black/[0.22]"
      }`}
    >
      <div className="grid gap-4 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-center">
        <div className="flex items-center gap-3 sm:block">
          <RankBadge place={place} tone={tone} />

          <div className={`text-lg font-semibold sm:hidden ${toneClasses.score}`}>
            ★ {formatAvg(item.avg)}
          </div>
        </div>

        <RankedThumbnail item={item} tone={tone} />

        <div className="min-w-0">
          <div className="text-xs font-medium tracking-[0.08em] text-zinc-500">
            {item.day}
          </div>

          <div className="mt-1 line-clamp-1 break-words text-base font-semibold text-zinc-100 [overflow-wrap:anywhere]">
            {title}
          </div>

          <p className="mt-1 line-clamp-2 min-h-10 break-words text-sm leading-5 text-zinc-400 [overflow-wrap:anywhere]">
            {text}
          </p>

          <ContextBadge item={item} />
        </div>

        <div className="hidden min-w-[92px] text-right sm:block">
          <div className={`text-lg font-semibold ${toneClasses.score}`}>
            ★ {formatAvg(item.avg)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {item.count} vote{item.count === 1 ? "" : "s"}
          </div>
        </div>

        <div className="text-xs text-zinc-500 sm:hidden">
          {item.count} vote{item.count === 1 ? "" : "s"}
        </div>
      </div>
    </button>
  );
}

function PodiumSection({
  title,
  subtitle,
  items,
  loading,
  tone,
  onSelectDay,
}: {
  title: string;
  subtitle: string;
  items: TopItem[];
  loading: boolean;
  tone: Tone;
  onSelectDay: (day: string) => void;
}) {
  const podiumItems = items.slice(0, 3);
  const toneClasses = getToneClasses(tone);

  return (
    <section
      className={`rounded-[30px] border p-5 backdrop-blur-sm ${toneClasses.panel}`}
    >
      <div className="mb-5 flex items-start gap-3">
        <div
          className={`mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm sm:flex ${toneClasses.badge}`}
        >
          {tone === "gold" ? "★" : "↓"}
        </div>

        <div>
          <h2 className={`text-xl font-semibold ${toneClasses.heading}`}>
            {title}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[128px] animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : podiumItems.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
          No ranked days yet.
        </div>
      ) : (
        <div className="space-y-3">
          {podiumItems.map((item, index) => (
            <PodiumRow
              key={`${title}-${item.day}-${index}`}
              item={item}
              place={(index + 1) as 1 | 2 | 3}
              tone={tone}
              onClick={() => onSelectDay(item.day)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RankedDayRow({
  item,
  index,
  tone,
  onClick,
}: {
  item: TopItem;
  index: number;
  tone: Tone;
  onClick: () => void;
}) {
  const toneClasses = getToneClasses(tone);
  const title = getItemTitle(item);
  const text = getItemText(item);
  const badgeKey = getBadgeKey(item);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border border-white/8 bg-black/[0.18] px-4 py-4 text-left transition ${toneClasses.rowGlow}`}
    >
      <div className="grid gap-4 md:grid-cols-[46px_minmax(0,1fr)_auto] md:items-center">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold ${toneClasses.badge}`}
        >
          #{index}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-medium tracking-[0.08em] text-zinc-500">
              {item.day}
            </div>

            {badgeKey ? (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${getBadgeClasses(
                  badgeKey
                )}`}
              >
                {getBadgeLabel(badgeKey)}
              </span>
            ) : null}
          </div>

          <div className="mt-1 line-clamp-1 break-words text-sm font-semibold text-zinc-100 [overflow-wrap:anywhere]">
            {title}
          </div>

          <div className="mt-1 min-h-10 line-clamp-2 break-words text-sm leading-5 text-zinc-400 [overflow-wrap:anywhere]">
            {text}
          </div>

          <div className="mt-2 text-xs text-zinc-500 md:hidden">
            {item.count} vote{item.count === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 md:block md:min-w-[76px] md:text-right">
          <div className={`text-base font-semibold ${toneClasses.score}`}>
            ★ {formatAvg(item.avg)}
          </div>
          <div className="mt-1 hidden text-xs text-zinc-500 md:block">
            {item.count} vote{item.count === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </button>
  );
}

function RankedListSection({
  title,
  subtitle,
  items,
  loading,
  tone,
  startRank,
  onSelectDay,
}: {
  title: string;
  subtitle: string;
  items: TopItem[];
  loading: boolean;
  tone: Tone;
  startRank: number;
  onSelectDay: (day: string) => void;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <section className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <h3 className={`text-lg font-semibold ${toneClasses.heading}`}>
            {title}
          </h3>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-[116px] animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
          No more ranked days yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 7).map((item, offset) => (
            <RankedDayRow
              key={`${title}-${item.day}-${offset}`}
              item={item}
              index={startRank + offset}
              tone={tone}
              onClick={() => onSelectDay(item.day)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function RankedDaysPanel() {
  const router = useRouter();
  const [top, setTop] = useState<TopItem[]>([]);
  const [low, setLow] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);

      try {
        const res = await fetch("/api/top", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load top");
        }

        const json = await res.json();

        if (cancelled) return;

        setTop((json?.top ?? []) as TopItem[]);
        setLow((json?.low ?? []) as TopItem[]);
      } catch {
        if (!cancelled) {
          setTop([]);
          setLow([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelectDay(selectedDay: string) {
    router.push(`/?day=${encodeURIComponent(selectedDay)}&focus=highlight`, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <PodiumSection
          title="Most Loved Podium"
          subtitle="Top 3 best scored by the community"
          items={top}
          loading={loading}
          tone="gold"
          onSelectDay={handleSelectDay}
        />

        <PodiumSection
          title="Lowest Rated Podium"
          subtitle="Top 3 lowest rated by the community"
          items={low}
          loading={loading}
          tone="red"
          onSelectDay={handleSelectDay}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <RankedListSection
          title="Loved Days — Top 10"
          subtitle="Positions 4 to 10"
          items={top.slice(3, 10)}
          loading={loading}
          tone="gold"
          startRank={4}
          onSelectDay={handleSelectDay}
        />

        <RankedListSection
          title="Lowest Rated Days — Top 10"
          subtitle="Positions 4 to 10"
          items={low.slice(3, 10)}
          loading={loading}
          tone="red"
          startRank={4}
          onSelectDay={handleSelectDay}
        />
      </div>

      <div className="flex justify-center text-xs text-zinc-500">
        Rankings update as the community votes.
      </div>
    </div>
  );
}