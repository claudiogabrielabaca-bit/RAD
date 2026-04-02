"use client";

import { formatAvg, formatCompactViews, truncateText, getDiscoverTypeLabel, getDiscoverTypeClasses } from "@/app/lib/home-page-utils";
import type { DiscoverCard } from "@/app/lib/rad-types";

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
      className="inline-flex h-12 w-12 -mx-3 items-center justify-center text-3xl leading-none transition-transform hover:scale-105"
      aria-label={title ?? "star"}
    >
      <span className={filled ? "text-yellow-400" : "text-zinc-700"}>★</span>
    </button>
  );
}

export { Star };

export default function DiscoverDayCard({
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
          Modern era
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