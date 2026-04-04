"use client";

import { useEffect, useState } from "react";
import DiscoverDayCard from "@/app/components/rad/discover-day-card";
import { loadDiscoverRandomDays } from "@/app/lib/home-page-discover";
import type { DiscoverCard } from "@/app/lib/rad-types";

export default function ImportantDaysStrip({
  onSelectDay,
}: {
  onSelectDay: (day: string) => void;
}) {
  const [days, setDays] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      const items = await loadDiscoverRandomDays(5, false);

      if (!cancelled) {
        setDays(items);
        setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="w-full pt-4">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-zinc-100">
          Important Days
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          A curated selection of defining moments from the modern era
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[360px] animate-pulse rounded-[30px] border border-white/8 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {days.map((card, index) => (
            <DiscoverDayCard
              key={`${card.day}-${index}`}
              card={card}
              onSelect={(selectedDay) => onSelectDay(selectedDay)}
            />
          ))}
        </div>
      )}
    </section>
  );
}