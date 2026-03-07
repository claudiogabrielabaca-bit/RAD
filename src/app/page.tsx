"use client";

import React, { useEffect, useMemo, useState } from "react";

type HighlightResponse = {
  highlight?: {
    type: "selected" | "events" | "births" | "deaths" | "none";
    year: number | null;
    text: string;
    title: string | null;
    image: string | null;
    articleUrl: string | null;
  };
};

type DayResponse = {
  day: string;
  avg: number;
  count: number;
  reviews: {
    id: string;
    stars: number;
    review: string;
    createdAt?: string;
    likesCount: number;
    likedByMe: boolean;
  }[];
};

type TopItem = {
  day: string;
  avg: number;
  count: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatAvg(n: number) {
  if (!n || Number.isNaN(n)) return "0.0";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function pad2(n: number | string) {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getRandomDay(
  min = "1900-01-01",
  max = new Date().toISOString().slice(0, 10)
) {
  const minDate = new Date(`${min}T00:00:00`);
  const maxDate = new Date(`${max}T00:00:00`);

  const minTime = minDate.getTime();
  const maxTime = maxDate.getTime();

  const randomTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  const randomDate = new Date(randomTime);

  const year = randomDate.getFullYear();
  const month = String(randomDate.getMonth() + 1).padStart(2, "0");
  const day = String(randomDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalizeHighlightType(
  type?: "selected" | "events" | "births" | "deaths" | "none"
) {
  switch (type) {
    case "selected":
      return "Seleccionado";
    case "events":
      return "Evento";
    case "births":
      return "Nacimiento";
    case "deaths":
      return "Muerte";
    default:
      return "Dato";
  }
}

function shiftDay(date: string, amount: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + amount);
  return d.toISOString().slice(0, 10);
}

function isDateInRange(date: string, min: string, max: string) {
  return date >= min && date <= max;
}

const YEARS = Array.from(
  { length: new Date().getFullYear() - 1900 + 1 },
  (_, i) => String(1900 + i)
).reverse();

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: pad2(i + 1),
  label: new Date(2000, i, 1).toLocaleString("en-US", { month: "long" }),
}));

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
      className="text-3xl leading-none transition-transform hover:scale-105"
      aria-label={title ?? "star"}
    >
      <span className={filled ? "text-yellow-400" : "text-zinc-600"}>★</span>
    </button>
  );
}

export default function Page() {
  const minDay = "1900-01-01";
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [day, setDay] = useState<string>(minDay);

  const [selectedYear, setSelectedYear] = useState("1900");
  const [selectedMonth, setSelectedMonth] = useState("01");
  const [selectedDay, setSelectedDay] = useState("01");

  const [data, setData] = useState<DayResponse | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);

  const [highlight, setHighlight] =
    useState<HighlightResponse["highlight"] | null>(null);
  const [loadingHighlight, setLoadingHighlight] = useState(false);

  const [stars, setStars] = useState<number>(0);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [review, setReview] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>("");

  const [top, setTop] = useState<TopItem[]>([]);
  const [low, setLow] = useState<TopItem[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestEvent, setSuggestEvent] = useState("");
  const [suggestDescription, setSuggestDescription] = useState("");
  const [suggestSource, setSuggestSource] = useState("");
  const [suggestEmail, setSuggestEmail] = useState("");
  const [suggestSending, setSuggestSending] = useState(false);
  const [suggestToast, setSuggestToast] = useState("");

  const daysInSelectedMonth = getDaysInMonth(
    Number(selectedYear),
    Number(selectedMonth)
  );

  const DAYS = Array.from(
    { length: daysInSelectedMonth },
    (_, i) => pad2(i + 1)
  );

  useEffect(() => {
    const [y, m, d] = day.split("-");
    if (y && m && d) {
      setSelectedYear(y);
      setSelectedMonth(m);
      setSelectedDay(d);
    }
  }, [day]);

  useEffect(() => {
    if (Number(selectedDay) > daysInSelectedMonth) {
      setSelectedDay(pad2(daysInSelectedMonth));
    }
  }, [daysInSelectedMonth, selectedDay]);

  async function loadDay(d: string) {
    setLoadingDay(true);
    setToast("");
    try {
      const res = await fetch(`/api/day?day=${encodeURIComponent(d)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as DayResponse;
      setData(json);
    } catch {
      setToast("Error cargando el día.");
      setData(null);
    } finally {
      setLoadingDay(false);
    }
  }

  async function loadHighlight(d: string) {
    setLoadingHighlight(true);
    try {
      const res = await fetch(`/api/highlight?day=${encodeURIComponent(d)}`);
      const json = (await res.json()) as HighlightResponse;
      setHighlight(json.highlight ?? null);
    } catch {
      setHighlight(null);
    } finally {
      setLoadingHighlight(false);
    }
  }

  async function loadTop() {
    setLoadingTop(true);
    try {
      const res = await fetch(`/api/top`, {
        cache: "no-store",
      });
      const json = await res.json();
      setTop((json?.top ?? []) as TopItem[]);
      setLow((json?.low ?? []) as TopItem[]);
    } catch {
      // no toast acá
    } finally {
      setLoadingTop(false);
    }
  }

  useEffect(() => {
    loadDay(day);
    loadHighlight(day);
    loadTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDay(day);
    loadHighlight(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  function goToToday() {
    setDay(today);
  }

  function goToManualDay() {
    const nextDay = `${selectedYear}-${selectedMonth}-${selectedDay}`;
    setDay(nextDay);
  }

  function goToPreviousDay() {
    const d = new Date(`${day}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const prev = d.toISOString().slice(0, 10);

    if (prev >= minDay) {
      setDay(prev);
    }
  }

  function goToNextDay() {
    const d = new Date(`${day}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);

    if (next <= today) {
      setDay(next);
    }
  }

  const isAtMinDay = day <= minDay;
  const isAtToday = day >= today;



  async function submit() {
    const s = clamp(hoverStars || stars, 1, 5);

    if (!s) {
      setToast("Elegí de 1 a 5 estrellas.");
      return;
    }

    if (!review.trim()) {
      setToast("Escribí una reseña.");
      return;
    }

    setSaving(true);
    setToast("");

    try {
      const res = await fetch(`/api/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day,
          stars: s,
          review: review.trim(),
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        setToast(`Error guardando: ${t}`);
        return;
      }

      setReview("");
      setStars(0);
      setHoverStars(0);
      setToast("Guardado ✅");

      await loadDay(day);
      await loadHighlight(day);
      await loadTop();
    } catch {
      setToast("Error guardando.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 2000);
    }
  }

  async function toggleLike(ratingId: string) {
    try {
      const res = await fetch("/api/review-like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ratingId }),
      });

      if (!res.ok) {
        const text = await res.text();
        setToast(`Error dando like: ${text}`);
        return;
      }

      await loadDay(day);
    } catch {
      setToast("Error dando like.");
    }
  }

  async function submitSuggestion() {
    if (!suggestEvent.trim()) {
      setSuggestToast("Write an event title.");
      return;
    }

    if (!suggestDescription.trim()) {
      setSuggestToast("Write a short description.");
      return;
    }

    setSuggestSending(true);
    setSuggestToast("");

    try {
      const res = await fetch("/api/suggest-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          day,
          event: suggestEvent.trim(),
          description: suggestDescription.trim(),
          source: suggestSource.trim(),
          email: suggestEmail.trim(),
          website: "",
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setSuggestToast(json?.error ?? "Could not send suggestion.");
        return;
      }

      setSuggestToast("Suggestion sent ✅");
      setSuggestEvent("");
      setSuggestDescription("");
      setSuggestSource("");
      setSuggestEmail("");

      setTimeout(() => {
        setShowSuggestModal(false);
        setSuggestToast("");
      }, 900);
    } catch {
      setSuggestToast("Could not send suggestion.");
    } finally {
      setSuggestSending(false);
    }
  }

  const shownStars = hoverStars || stars;

  return (
    <main className="min-h-screen bg-[#0b1220] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Rate Any Day in Human History
            </h1>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-zinc-100">
              Explore a day
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDay(getRandomDay(minDay, today))}
                className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-black/30"
              >
                Surprise me
              </button>

              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-black/30"
              >
                Today
              </button>
            </div>

            <div className="mt-5 text-sm text-zinc-300">
              or select manually:
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-white/20"
              >
                {YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-white/20"
              >
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-white/20"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={goToManualDay}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Go
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm text-zinc-300">Selected day</div>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={goToPreviousDay}
                    disabled={isAtMinDay}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Prev
                  </button>

                  <div className="text-xl font-semibold">{day}</div>

                  <button
                    type="button"
                    onClick={goToNextDay}
                    disabled={isAtToday}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-zinc-300">Community avg</div>
                  <div className="text-lg font-semibold">
                    {data ? formatAvg(data.avg) : "—"}
                    <span className="text-xs font-normal text-zinc-300">
                      {" "}
                      ({data?.count ?? 0})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {loadingHighlight ? (
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="animate-pulse">
                  <div className="h-4 w-28 rounded bg-white/10" />
                  <div className="mt-4 h-8 w-2/3 rounded bg-white/10" />
                  <div className="mt-3 h-4 w-full rounded bg-white/10" />
                  <div className="mt-2 h-4 w-5/6 rounded bg-white/10" />
                  <div className="mt-2 h-4 w-4/6 rounded bg-white/10" />
                </div>
              </div>
            ) : highlight ? (
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <div className="relative min-h-[320px]">
                  {highlight.image ? (
                    <img
                      src={highlight.image}
                      alt={highlight.title ?? "Historical highlight"}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/20" />

                  <div className="relative flex h-full min-h-[320px] flex-col justify-end p-5 sm:p-6">
                    <div className="text-sm text-zinc-200/90">En este día</div>
                    <div className="text-2xl font-semibold text-white">
                      {formatDisplayDate(day)}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {highlight.year ? (
                        <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                          {highlight.year}
                        </span>
                      ) : null}

                      <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-white backdrop-blur-sm">
                        {normalizeHighlightType(highlight.type)}
                      </span>
                    </div>

                    {highlight.title ? (
                      <div className="mt-3 text-3xl font-semibold leading-tight text-white">
                        {highlight.title}
                      </div>
                    ) : null}

                    <div className="mt-3 max-w-3xl text-sm leading-6 text-zinc-100/90">
                      {highlight.text}
                    </div>

                    {highlight.articleUrl ? (
                      <a
                        href={highlight.articleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex w-fit items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
                      >
                        Read on Wikipedia
                      </a>
                    ) : null}

                    {highlight.type === "none" ? (
                      <button
                        type="button"
                        onClick={() => setShowSuggestModal(true)}
                        className="mt-4 inline-flex w-fit items-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
                      >
                        Suggest an event
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm text-zinc-300">Rate this day</div>

              <div className="mt-3 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = i + 1;
                  return (
                    <Star
                      key={v}
                      filled={v <= shownStars}
                      title={`${v} star${v > 1 ? "s" : ""}`}
                      onMouseEnter={() => setHoverStars(v)}
                      onMouseLeave={() => setHoverStars(0)}
                      onClick={() => setStars(v)}
                    />
                  );
                })}

                <div className="ml-3 text-sm text-zinc-300">
                  {shownStars ? `${shownStars}/5` : "—"}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm text-zinc-300">Review</div>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Dejá una reseña corta…"
                  className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={submit}
                  disabled={saving}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Rate this day"}
                </button>

                {toast ? (
                  <div className="text-sm text-zinc-300">{toast}</div>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-300">
                  Latest reviews ({data?.reviews?.length ?? 0})
                </div>
                {loadingDay ? (
                  <div className="text-xs text-zinc-400">Loading…</div>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                {(data?.reviews ?? []).slice(0, 8).map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-yellow-400">
                        {"★".repeat(clamp(r.stars, 0, 5))}
                        <span className="text-zinc-600">
                          {"★".repeat(5 - clamp(r.stars, 0, 5))}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-zinc-200">
                      {r.review || <span className="text-zinc-500">—</span>}
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleLike(r.id)}
                        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
                      >
                        <span
                          className={`text-base ${
                            r.likedByMe ? "text-pink-400" : "text-zinc-500"
                          }`}
                        >
                          ♥
                        </span>
                        <span>{r.likesCount}</span>
                      </button>
                    </div>
                  </div>
                ))}

                {(data?.reviews?.length ?? 0) === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-zinc-400">
                    No reviews yet. Be the first.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Top Rated Days</div>
                {loadingTop ? (
                  <div className="text-xs text-zinc-400">Loading…</div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {top.slice(0, 6).map((item) => (
                  <button
                    key={item.day}
                    onClick={() => setDay(item.day)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:bg-black/30"
                  >
                    <div className="text-sm font-semibold">{item.day}</div>
                    <div className="mt-1 text-xs text-zinc-300">
                      {formatAvg(item.avg)} avg • {item.count} votes
                    </div>
                  </button>
                ))}

                {top.length === 0 ? <div className="text-sm text-zinc-400"></div> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold">Lowest Rated Days</div>

              <div className="mt-4 space-y-3">
                {low.slice(0, 6).map((item) => (
                  <button
                    key={item.day}
                    onClick={() => setDay(item.day)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:bg-black/30"
                  >
                    <div className="text-sm font-semibold">{item.day}</div>
                    <div className="mt-1 text-xs text-zinc-300">
                      {formatAvg(item.avg)} avg • {item.count} votes
                    </div>
                  </button>
                ))}

                {low.length === 0 ? <div className="text-sm text-zinc-400"></div> : null}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showSuggestModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Suggest a historical event
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {formatDisplayDate(day)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowSuggestModal(false);
                  setSuggestToast("");
                }}
                className="rounded-lg border border-white/10 px-3 py-1 text-sm text-zinc-300 transition hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Event</label>
                <input
                  value={suggestEvent}
                  onChange={(e) => setSuggestEvent(e.target.value)}
                  placeholder="Example: Boxer Protocol signed in Beijing"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Description
                </label>
                <textarea
                  value={suggestDescription}
                  onChange={(e) => setSuggestDescription(e.target.value)}
                  placeholder="Write a short description of what happened..."
                  className="h-32 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Source (optional)
                </label>
                <input
                  value={suggestSource}
                  onChange={(e) => setSuggestSource(e.target.value)}
                  placeholder="Wikipedia, article URL, book, etc."
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Your email (optional)
                </label>
                <input
                  value={suggestEmail}
                  onChange={(e) => setSuggestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              {suggestToast ? (
                <div className="text-sm text-zinc-300">{suggestToast}</div>
              ) : null}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={submitSuggestion}
                  disabled={suggestSending}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {suggestSending ? "Sending..." : "Send suggestion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}