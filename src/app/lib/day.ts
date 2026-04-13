export function pad2(n: number | string) {
  return String(n).padStart(2, "0");
}

export function getDaysInMonth(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return 0;
  }

  if (month < 1 || month > 12) {
    return 0;
  }

  return new Date(year, month, 0).getDate();
}

export function parseDayString(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }

  const maxDay = getDaysInMonth(year, month);

  if (day < 1 || day > maxDay) {
    return null;
  }

  return { year, month, day };
}

export function isValidDayString(value?: string | null): value is string {
  return parseDayString(value) !== null;
}

export function parseMonthDayString(value?: string | null) {
  if (!value || !/^\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [monthStr, dayStr] = value.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }

  const maxDay = getDaysInMonth(2000, month);

  if (day < 1 || day > maxDay) {
    return null;
  }

  return { month, day };
}

export function isValidMonthDayString(
  value?: string | null
): value is string {
  return parseMonthDayString(value) !== null;
}

export function formatDayString(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function formatDayStringFromDate(date: Date) {
  return formatDayString(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
}

export function getTodayDayString() {
  return formatDayStringFromDate(new Date());
}

export function getDayWithOffset(baseDay: string, offset: number) {
  const parsed = parseDayString(baseDay);

  if (!parsed) {
    return null;
  }

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() + offset);

  return formatDayStringFromDate(date);
}