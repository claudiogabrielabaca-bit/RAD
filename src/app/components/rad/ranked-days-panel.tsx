"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAvg } from "@/app/lib/home-page-utils";
import type { TopItem } from "@/app/lib/rad-types";

type Tone = "gold" | "red";

function getToneClasses(tone: Tone) {
  if (tone === "gold") {
    return {
      badge: "border-amber-500/20 bg-amber-500/12 text-amber-300",
      score: "text-amber-300",
      glow: "shadow-[0_18px_50px_rgba(245,158,11,0.10)]",
      pillar:
        "bg-gradient-to-b from-amber-400/18 via-amber-500/10 to-white/[0.03] border-amber-400/10",
    };
  }

  return {
    badge: "border-rose-500/20 bg-rose-500/12 text-rose-300",
    score: "text-rose-300",
    glow: "shadow-[0_18px_50px_rgba(244,63,94,0.10)]",
    pillar:
      "bg-gradient-to-b from-rose-400/18 via-rose-500/10 to-white/[0.03] border-rose-400/10",
  };
}

function PodiumCard({
  item,
  place,
  tone,
  featured = false,
  onClick,
}: {
  item: TopItem;
  place: 1 | 2 | 3;
  tone: Tone;
  featured?: boolean;
  onClick: () => void;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-[24px] border border-white/8 bg-[#070707] p-4 pb-24 text-left transition hover:-translate-y-0.5 hover:border-white/14 hover:bg-[#0b0b0b] ${toneClasses.glow} ${
        featured ? "min-h-[300px]" : "min-h-[260px]"
      }`}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-xs font-semibold ${toneClasses.badge}`}
          >
            #{place}
          </span>

          <div className={`text-lg font-semibold ${toneClasses.score}`}>
            ★ {formatAvg(item.avg)}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold text-zinc-100">{item.day}</div>
          <div className="mt-2 line-clamp-2 text-[15px] font-medium text-zinc-300">
            {item.title?.trim() || "Historical day"}
          </div>
        </div>

        <div className="mt-6 text-xs text-zinc-500">
          {item.count} vote{item.count === 1 ? "" : "s"}
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-4 bottom-4 z-0 h-14 rounded-[18px] border ${toneClasses.pillar}`}
      />
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
  const podiumItems = useMemo(() => items.slice(0, 3), [items]);
  const byPlace: Array<TopItem | null> = [
    podiumItems[0] ?? null,
    podiumItems[1] ?? null,
    podiumItems[2] ?? null,
  ];

  return (
    <section className="rounded-[30px] border border-white/8 bg-black/20 p-5 backdrop-blur-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`animate-pulse rounded-[24px] border border-white/8 bg-white/[0.03] ${
                i === 1 ? "h-[300px]" : "h-[260px]"
              }`}
            />
          ))}
        </div>
      ) : podiumItems.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
          No ranked days yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
          <div className="md:order-1">
            {byPlace[1] ? (
              <PodiumCard
                item={byPlace[1]}
                place={2}
                tone={tone}
                onClick={() => onSelectDay(byPlace[1]!.day)}
              />
            ) : (
              <div className="h-[260px] rounded-[24px] border border-white/8 bg-white/[0.02]" />
            )}
          </div>

          <div className="md:order-2">
            {byPlace[0] ? (
              <PodiumCard
                item={byPlace[0]}
                place={1}
                tone={tone}
                featured
                onClick={() => onSelectDay(byPlace[0]!.day)}
              />
            ) : (
              <div className="h-[300px] rounded-[24px] border border-white/8 bg-white/[0.02]" />
            )}
          </div>

          <div className="md:order-3">
            {byPlace[2] ? (
              <PodiumCard
                item={byPlace[2]}
                place={3}
                tone={tone}
                onClick={() => onSelectDay(byPlace[2]!.day)}
              />
            ) : (
              <div className="h-[260px] rounded-[24px] border border-white/8 bg-white/[0.02]" />
            )}
          </div>
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

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-white/8 bg-black/20 px-4 py-4 text-left transition hover:border-white/14 hover:bg-black/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold ${toneClasses.badge}`}
            >
              #{index}
            </span>

            <div className="text-sm font-semibold text-zinc-100">{item.day}</div>
          </div>

          <div className="mt-2 line-clamp-1 text-sm text-zinc-400">
            {item.title?.trim() || "Historical day"}
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            {item.count} vote{item.count === 1 ? "" : "s"}
          </div>
        </div>

        <div className={`shrink-0 text-base font-semibold ${toneClasses.score}`}>
          ★ {formatAvg(item.avg)}
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
  return (
    <section className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-[84px] animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]"
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

        if (!cancelled) {
          setTop((json?.top ?? []) as TopItem[]);
          setLow((json?.low ?? []) as TopItem[]);
        }
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
    </div>
  );
}