import { getDaysInMonth, isValidDayString, pad2 } from "@/app/lib/home-page-utils";

export const SURPRISE_HISTORY_STORAGE_KEY = "rad:surprise-history";
export const SURPRISE_HISTORY_MAX = 120;
export const TODAY_HISTORY_STORAGE_KEY_PREFIX = "rad:today-history:";
export const TODAY_HISTORY_MAX = 160;
export const DAY_BACK_HISTORY_STORAGE_KEY = "rad:day-back-history";
export const DAY_BACK_HISTORY_MAX = 50;

export function getRecentSurpriseHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SURPRISE_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return Array.from(
      new Set(
        parsed.filter(
          (item): item is string =>
            typeof item === "string" && isValidDayString(item)
        )
      )
    ).slice(0, SURPRISE_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function setRecentSurpriseHistory(days: string[]) {
  if (typeof window === "undefined") return;

  try {
    const safe = Array.from(
      new Set(days.filter((item) => isValidDayString(item)))
    ).slice(0, SURPRISE_HISTORY_MAX);

    window.localStorage.setItem(
      SURPRISE_HISTORY_STORAGE_KEY,
      JSON.stringify(safe)
    );
  } catch {
    //
  }
}

export function rememberSurpriseDay(day: string) {
  if (!isValidDayString(day)) return;

  const current = getRecentSurpriseHistory().filter((item) => item !== day);
  setRecentSurpriseHistory([day, ...current]);
}

export function getTodayHistoryMonthDay() {
  const now = new Date();
  return `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function getTodayHistoryStorageKey(monthDay = getTodayHistoryMonthDay()) {
  return `${TODAY_HISTORY_STORAGE_KEY_PREFIX}${monthDay}`;
}

export function getRecentTodayHistory(monthDay = getTodayHistoryMonthDay()) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(
      getTodayHistoryStorageKey(monthDay)
    );
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return Array.from(
      new Set(
        parsed.filter(
          (item): item is string =>
            typeof item === "string" && isValidDayString(item)
        )
      )
    ).slice(0, TODAY_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function setRecentTodayHistory(
  days: string[],
  monthDay = getTodayHistoryMonthDay()
) {
  if (typeof window === "undefined") return;

  try {
    const safe = Array.from(
      new Set(days.filter((item) => isValidDayString(item)))
    ).slice(0, TODAY_HISTORY_MAX);

    window.localStorage.setItem(
      getTodayHistoryStorageKey(monthDay),
      JSON.stringify(safe)
    );
  } catch {
    //
  }
}

export function rememberTodayHistoryDay(day: string) {
  if (!isValidDayString(day)) return;

  const monthDay = day.slice(5, 10);
  const current = getRecentTodayHistory(monthDay).filter((item) => item !== day);
  setRecentTodayHistory([day, ...current], monthDay);
}

export function clearTodayHistory(monthDay = getTodayHistoryMonthDay()) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(getTodayHistoryStorageKey(monthDay));
  } catch {
    //
  }
}

export function getStoredDayBackHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(DAY_BACK_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is string =>
          typeof item === "string" && isValidDayString(item)
      )
      .slice(-DAY_BACK_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function setStoredDayBackHistory(history: string[]) {
  if (typeof window === "undefined") return;

  try {
    const safe = history
      .filter((item) => isValidDayString(item))
      .slice(-DAY_BACK_HISTORY_MAX);

    window.sessionStorage.setItem(
      DAY_BACK_HISTORY_STORAGE_KEY,
      JSON.stringify(safe)
    );
  } catch {
    //
  }
}

export function buildRandomRequestUrl(
  basePath: string,
  options?: {
    fresh?: boolean;
    currentDay?: string;
  }
) {
  const params = new URLSearchParams();

  if (options?.fresh) {
    params.set("fresh", "1");
  }

  const excludeDays = getRecentSurpriseHistory();

  if (options?.currentDay && isValidDayString(options.currentDay)) {
    excludeDays.unshift(options.currentDay);
  }

  const uniqueExcludeDays = Array.from(
    new Set(excludeDays.filter((item) => isValidDayString(item)))
  ).slice(0, SURPRISE_HISTORY_MAX);

  if (uniqueExcludeDays.length > 0) {
    params.set("excludeDays", uniqueExcludeDays.join(","));
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function buildTodayInHistoryRequestUrl(options?: {
  fresh?: boolean;
  currentDay?: string;
  bundle?: boolean;
}) {
  const params = new URLSearchParams();

  if (options?.bundle) {
    params.set("bundle", "1");
  }

  if (options?.fresh) {
    params.set("fresh", "1");
  }

  const monthDay = getTodayHistoryMonthDay();
  params.set("monthDay", monthDay);

  const excludeDays = getRecentTodayHistory(monthDay);

  if (
    options?.currentDay &&
    isValidDayString(options.currentDay) &&
    options.currentDay.slice(5, 10) === monthDay
  ) {
    excludeDays.unshift(options.currentDay);
  }

  const uniqueExcludeDays = Array.from(
    new Set(excludeDays.filter((item) => isValidDayString(item)))
  ).slice(0, TODAY_HISTORY_MAX);

  if (uniqueExcludeDays.length > 0) {
    params.set("excludeDays", uniqueExcludeDays.join(","));
  }

  const query = params.toString();
  return query ? `/api/today-valid-day?${query}` : "/api/today-valid-day";
}

export function getDayWithOffset(baseDay: string, offset: number) {
  if (!isValidDayString(baseDay)) return null;

  const d = new Date(`${baseDay}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function getDayWithYearShift(
  baseDay: string,
  delta: number,
  minDay: string,
  maxDay: string
) {
  if (!isValidDayString(baseDay)) return null;

  const [y, m, d] = baseDay.split("-").map(Number);
  const targetYear = y + delta;
  const currentRealYear = new Date().getFullYear();

  if (targetYear < 1800 || targetYear > currentRealYear) return null;

  const maxDayInMonth = getDaysInMonth(targetYear, m);
  const safeDay = Math.min(d, maxDayInMonth);
  const candidate = `${targetYear}-${pad2(m)}-${pad2(safeDay)}`;

  if (candidate < minDay || candidate > maxDay) return null;

  return candidate;
}