type HomeExplorePanelProps = {
  selectedYear: string;
  selectedMonth: string;
  selectedDay: string;
  years: string[];
  months: { value: string; label: string }[];
  days: string[];
  toast: string;
  onYearChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onDayChange: (value: string) => void;
  onGoToManualDay: () => void;
  onGoToToday: () => void;
  onGoToSurpriseDay: () => void;
  onGoToTodayInHistory: () => void;
};

export default function HomeExplorePanel({
  selectedYear,
  selectedMonth,
  selectedDay,
  years,
  months,
  days,
  toast,
  onYearChange,
  onMonthChange,
  onDayChange,
  onGoToManualDay,
  onGoToToday,
  onGoToSurpriseDay,
  onGoToTodayInHistory,
}: HomeExplorePanelProps) {
  return (
    <section className="overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.035),transparent_28%)]" />
        <div className="relative p-8 sm:p-10 lg:p-12">
          <div className="max-w-4xl">
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
              Explore a day
            </div>

            <h2 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-[4.25rem]">
              Discover what happened on any day in human history
            </h2>

            <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300 sm:text-[1.18rem]">
              Jump to a random moment, revisit this day in another year, or
              choose an exact date to explore births, deaths, and key
              historical events.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onGoToSurpriseDay}
              className="group rounded-[28px] border border-white/8 bg-white/[0.05] px-6 py-6 text-left transition hover:border-white/12 hover:bg-white/[0.08] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.07] text-xl text-white">
                  ✦
                </div>

                <div>
                  <div className="text-xl font-semibold text-white">
                    Surprise me
                  </div>
                  <div className="mt-1.5 text-base leading-7 text-zinc-400">
                    Jump into a random day and see what history gives you.
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onGoToTodayInHistory}
              className="group rounded-[28px] border border-white/8 bg-white/[0.05] px-6 py-6 text-left transition hover:border-white/12 hover:bg-white/[0.08] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.07] text-xl text-white">
                  🗓
                </div>

                <div>
                  <div className="text-xl font-semibold text-white">
                    Today in history
                  </div>
                  <div className="mt-1.5 text-base leading-7 text-zinc-400">
                    See what happened on this same month and day in a different
                    year.
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-10 rounded-[30px] border border-white/8 bg-black/25 p-7 backdrop-blur-xl">
            <div className="text-xl font-semibold text-zinc-100">
              Pick an exact date
            </div>
            <div className="mt-2 text-base text-zinc-400">
              Choose a specific day between 1800 and today.
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <select
                value={selectedYear}
                onChange={(e) => onYearChange(e.target.value)}
                className="rounded-2xl border border-white/8 bg-[#121212] px-5 py-3.5 text-base text-zinc-100 outline-none transition focus:border-white/14 focus:ring-2 focus:ring-white/10"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="rounded-2xl border border-white/8 bg-[#121212] px-5 py-3.5 text-base text-zinc-100 outline-none transition focus:border-white/14 focus:ring-2 focus:ring-white/10"
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedDay}
                onChange={(e) => onDayChange(e.target.value)}
                className="rounded-2xl border border-white/8 bg-[#121212] px-5 py-3.5 text-base text-zinc-100 outline-none transition focus:border-white/14 focus:ring-2 focus:ring-white/10"
              >
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onGoToManualDay}
                className="rounded-2xl bg-white px-6 py-3.5 text-base font-semibold text-black transition hover:bg-zinc-200"
              >
                Go
              </button>

              <button
                type="button"
                onClick={onGoToToday}
                className="rounded-2xl bg-white px-6 py-3.5 text-base font-semibold text-black transition hover:bg-zinc-200"
              >
                Today
              </button>
            </div>

            {toast ? (
              <div className="mt-4 text-sm text-zinc-300">{toast}</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}