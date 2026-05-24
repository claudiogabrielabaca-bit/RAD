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

      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="max-w-5xl">
          <h1 className="max-w-5xl text-[clamp(2.4rem,6vw,5.4rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white">
            Explore any day in human history.
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
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
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 2v3" />
                <path d="M16 2v3" />
                <rect x="3" y="5" width="18" height="16" rx="2.5" />
                <path d="M3 10h18" />
                <path d="M12 14h.01" />
              </svg>
              <span>Today in history</span>
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.032] p-5 backdrop-blur-xl">
          <div>
            <div className="text-lg font-semibold tracking-[-0.02em] text-white">
              Pick an exact date
            </div>
            <div className="mt-2 text-sm leading-6 text-zinc-400">
              Choose a specific day between 1800 and today.
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              className="rad-dark-select h-11 w-[108px] rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-medium text-zinc-100 outline-none transition hover:border-white/14 hover:bg-white/[0.045] focus:border-white/18 focus:ring-2 focus:ring-white/10"
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
              className="rad-dark-select h-11 w-[158px] rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-medium text-zinc-100 outline-none transition hover:border-white/14 hover:bg-white/[0.045] focus:border-white/18 focus:ring-2 focus:ring-white/10"
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
              className="rad-dark-select h-11 w-[92px] rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-medium text-zinc-100 outline-none transition hover:border-white/14 hover:bg-white/[0.045] focus:border-white/18 focus:ring-2 focus:ring-white/10"
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

            <button
              type="button"
              onClick={onGoToManualDay}
              className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Go
            </button>

            <button
              type="button"
              onClick={onGoToToday}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/16 hover:bg-white/[0.085]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 2v3" />
                <path d="M16 2v3" />
                <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
                <path d="M3.5 9h17" />
                <path d="M8 13h2" />
                <path d="M14 13h2" />
                <path d="M8 17h2" />
                <path d="m13.3 17 1.4 1.4 3-3" />
              </svg>
              <span>Today</span>
            </button>
          </div>

          {toast ? (
            <div className="mt-3 rounded-xl border border-white/8 bg-black/25 px-4 py-3 text-sm text-zinc-300">
              {toast}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
