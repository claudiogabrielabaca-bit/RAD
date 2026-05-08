"use client";

type RatingDistributionItem = {
  stars: number;
  count: number;
};

export default function RatingDistribution({
  avg,
  ratingsCount,
  starDistribution,
  compact = false,
}: {
  avg: string;
  ratingsCount: number;
  starDistribution: RatingDistributionItem[];
  compact?: boolean;
}) {
  const maxDistributionCount = Math.max(
    1,
    ...starDistribution.map((item) => item.count)
  );

  if (compact) {
    return (
      <div className="pt-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Rating snapshot
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="text-3xl font-semibold text-white">
            <span className="text-yellow-400">★</span> {avg}
          </div>
          <div className="pb-1 text-sm text-zinc-400">
            {ratingsCount} rating{ratingsCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {starDistribution.map((item) => (
            <div key={item.stars} className="flex items-center gap-3">
              <div className="w-10 shrink-0 text-xs font-medium text-zinc-400">
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

              <div className="w-6 shrink-0 text-right text-xs text-zinc-500">
                {item.count}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-3xl font-semibold text-white">★ {avg}</div>
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
  );
}
