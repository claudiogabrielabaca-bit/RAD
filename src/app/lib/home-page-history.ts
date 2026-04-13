  import { getDaysInMonth, isValidDayString, pad2 } from "@/app/lib/home-page-utils";
import {
  getDayWithOffset as shiftDayStringByOffset,
  getTodayDayString,
} from "@/app/lib/day";

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
  } catch {}
}

export function rememberSurpriseDay(day: string) {
  if (!isValidDayString(day)) return;

  const current = getRecentSurpriseHistory().filter((item) => item !== day);
  setRecentSurpriseHistory([day, ...current]);
}

export function getTodayHistoryMonthDay() {
  return getTodayDayString().slice(5, 10);
}

export function getTodayHistoryStorageKey(monthDay = getTodayHistoryMonthDay()) {
  return `${TODAY_HISTORY_STORAGE_KEY_PREFIX}${monthDay}`;
}

export function getRecentTodayHistory(monthDay = getTodayHistoryMonthDay()) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getTodayHistoryStorageKey(monthDay));
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
  } catch {}
}

export function rememberTodayHistoryDay(
  day: string,
  monthDay = getTodayHistoryMonthDay()
) {
  if (!isValidDayString(day)) return;

  const current = getRecentTodayHistory(monthDay).filter((item) => item !== day);
  setRecentTodayHistory([day, ...current], monthDay);
}

export function clearTodayHistory(monthDay = getTodayHistoryMonthDay()) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(getTodayHistoryStorageKey(monthDay));
  } catch {}
}

export function getStoredDayBackHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(DAY_BACK_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function setStoredDayBackHistory(days: string[]) {
  if (typeof window === "undefined") return;

  try {
    const safe = days
      .filter((item): item is string => typeof item === "string")
      .slice(-DAY_BACK_HISTORY_MAX);

    window.localStorage.setItem(
      DAY_BACK_HISTORY_STORAGE_KEY,
      JSON.stringify(safe)
    );
  } catch {}
}

export function buildRandomRequestUrl({
  excludeDays = [],
  fresh = false,
}: {
  excludeDays?: string[];
  fresh?: boolean;
} = {}) {
  const params = new URLSearchParams();

  if (fresh) {
    params.set("fresh", "1");
  }

  const uniqueExcludeDays = Array.from(
    new Set(excludeDays.filter((item) => isValidDayString(item)))
  ).slice(0, 30);

  if (uniqueExcludeDays.length > 0) {
    params.set("excludeDays", uniqueExcludeDays.join(","));
  }

  const query = params.toString();
  return query ? `/api/random-valid-day?${query}` : "/api/random-valid-day";
}

export function buildTodayInHistoryRequestUrl({
  excludeDays = [],
  fresh = false,
  bundle = false,
  monthDay = getTodayHistoryMonthDay(),
}: {
  excludeDays?: string[];
  fresh?: boolean;
  bundle?: boolean;
  monthDay?: string;
} = {}) {
  const params = new URLSearchParams();

  if (fresh) {
    params.set("fresh", "1");
  }

  if (bundle) {
    params.set("bundle", "1");
  }

  if (monthDay) {
    params.set("monthDay", monthDay);
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
  return shiftDayStringByOffset(baseDay, offset);
}

export function getDayWithYearShift(
  baseDay: string,
  yearOffset: number,
  minDay = "1800-01-01",
  maxDay?: string
) {
  if (!isValidDayString(baseDay)) return null;

  const [year, month, day] = baseDay.split("-").map(Number);
  const targetYear = year + yearOffset;

  if (targetYear < 1800) {
    return null;
  }

  const maxAllowedDay = maxDay && isValidDayString(maxDay) ? maxDay : undefined;

  if (maxAllowedDay) {
    const [maxYear] = maxAllowedDay.split("-").map(Number);

    if (targetYear > maxYear) {
      return null;
    }
  }

  const maxDayInTargetMonth = getDaysInMonth(targetYear, month);
  const safeDay = Math.min(day, maxDayInTargetMonth);

  const nextDay = `${targetYear}-${pad2(month)}-${pad2(safeDay)}`;

  if (nextDay < minDay) {
    return null;
  }

  if (maxAllowedDay && nextDay > maxAllowedDay) {
    return null;
  }

  return nextDay;
}