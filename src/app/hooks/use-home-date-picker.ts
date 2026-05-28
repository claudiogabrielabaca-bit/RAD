import { useEffect, useMemo, useState } from "react";
import { getDaysInMonth, pad2 } from "@/app/lib/home-page-utils";

export function useHomeDatePicker({
  day,
  initialDay,
  today,
}: {
  day: string;
  initialDay: string;
  today: string;
}) {
  const [selectedYear, setSelectedYear] = useState(
    initialDay?.slice(0, 4) || today.slice(0, 4)
  );
  const [selectedMonth, setSelectedMonth] = useState(
    initialDay?.slice(5, 7) || today.slice(5, 7)
  );
  const [selectedDay, setSelectedDay] = useState(
    initialDay?.slice(8, 10) || today.slice(8, 10)
  );

  const daysInSelectedMonth = getDaysInMonth(
    Number(selectedYear),
    Number(selectedMonth)
  );

  const days = useMemo(
    () => Array.from({ length: daysInSelectedMonth }, (_, i) => pad2(i + 1)),
    [daysInSelectedMonth]
  );

  useEffect(() => {
    const [y, m, d] = day.split("-");

    if (!y || !m || !d) return;

    const timeout = window.setTimeout(() => {
      setSelectedYear(y);
      setSelectedMonth(m);
      setSelectedDay(d);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [day]);

  useEffect(() => {
    if (Number(selectedDay) <= daysInSelectedMonth) return;

    const timeout = window.setTimeout(() => {
      setSelectedDay(pad2(daysInSelectedMonth));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [daysInSelectedMonth, selectedDay]);

  return {
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectedDay,
    setSelectedDay,
    days,
  };
}
