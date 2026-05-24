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
    <section className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[#070707] shadow-[0_26px_90px_rgba(0,0,0,0.48)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.075),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.035),transparent_28%)]" />

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end lg:p-10">
        <div className="max-w-4xl">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Rate Any Day
          </div>

          <h1 className="mt-5 max-w-4xl text-[clamp(2.4rem,6vw,5.4rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white">
            Explore any day in human history.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
            Pick a date, jump to a surprise moment, or revisit today across
            history. Then rate the day and see what the community thinks.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onGoToSurpriseDay}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <span aria-hidden="true">✦</span>
              <span>Surprise me</span>
            </button>

            <button
              type="button"
              onClick={onGoToTodayInHistory}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-5 text-sm font-semibold text-zinc-100 transition hover:border-white/16 hover:bg-white/[0.085]"
            >
              <span aria-hidden="true">🗓</span>
              <span>Today in history</span>
            </button>
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Pick an exact date
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">
                Choose any day from 1800 to today.
              </div>
            </div>

            <button
              type="button"
              onClick={onGoToToday}
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/16 hover:bg-white/[0.085]"
            >
              Today
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              className="rad-dark-select h-12 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition hover:border-white/14 hover:bg-white/[0.045] focus:border-white/18 focus:ring-2 focus:ring-white/10"
              aria-label="Year"
            >
              {years.map((year) => (
                <option
                  className="bg-[#0b0b0b] text-zinc-100"
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="rad-dark-select h-12 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition hover:border-white/14 hover:bg-white/[0.045] focus:border-white/18 focus:ring-2 focus:ring-white/10"
              aria-label="Month"
            >
              {months.map((month) => (
                <option
                  className="bg-[#0b0b0b] text-zinc-100"
                  key={month.value}
                  value={month.value}
                >
                  {month.label}
                </option>
              ))}
            </select>

            <select
              value={selectedDay}
              onChange={(e) => onDayChange(e.target.value)}
              className="rad-dark-select h-12 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition hover:border-white/14 hover:bg-white/[0.045] focus:border-white/18 focus:ring-2 focus:ring-white/10"
              aria-label="Day"
            >
              {days.map((day) => (
                <option
                  className="bg-[#0b0b0b] text-zinc-100"
                  key={day}
                  value={day}
                >
                  {day}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onGoToManualDay}
            className="mt-3 h-12 w-full rounded-2xl bg-white text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Explore selected date
          </button>

          {toast ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-black/25 px-4 py-3 text-sm text-zinc-300">
              {toast}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

