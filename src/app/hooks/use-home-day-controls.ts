import { useCallback, useMemo } from "react";
import {
  getDayWithOffset,
  getDayWithYearShift,
} from "@/app/lib/home-page-history";
import {
  getDaysInMonth,
  isValidDayString,
  pad2,
} from "@/app/lib/home-page-utils";

type OpenDay = (
  day: string,
  options: {
    scrollToHighlight: boolean;
  }
) => void | Promise<void>;

export function useHomeDayControls({
  day,
  navigationDay,
  minDay,
  today,
  openDay,
}: {
  day: string;
  navigationDay: string;
  minDay: string;
  today: string;
  openDay: OpenDay;
}) {
  const goToToday = useCallback(() => {
    void openDay(today, { scrollToHighlight: true });
  }, [openDay, today]);

  const goToPreviousDay = useCallback(() => {
    const prev = getDayWithOffset(navigationDay, -1);

    if (prev && prev >= minDay) {
      void openDay(prev, { scrollToHighlight: false });
    }
  }, [minDay, navigationDay, openDay]);

  const goToNextDay = useCallback(() => {
    const next = getDayWithOffset(navigationDay, 1);

    if (next && next <= today) {
      void openDay(next, { scrollToHighlight: false });
    }
  }, [navigationDay, openDay, today]);

  const shiftYearBy = useCallback(
    (delta: number) => {
      const nextDay = getDayWithYearShift(
        navigationDay,
        delta,
        minDay,
        today
      );

      if (!nextDay) return;

      void openDay(nextDay, { scrollToHighlight: false });
    },
    [minDay, navigationDay, openDay, today]
  );

  const goToPreviousYear = useCallback(() => {
    shiftYearBy(-1);
  }, [shiftYearBy]);

  const goToNextYear = useCallback(() => {
    shiftYearBy(1);
  }, [shiftYearBy]);

  const navigationLimits = useMemo(() => {
    const isAtMinDay = !isValidDayString(day) || navigationDay <= minDay;
    const isAtToday = !isValidDayString(day) || navigationDay >= today;

    const [currentYear] = today.split("-").map(Number);
    const [selectedYearNum, selectedMonthNum, selectedDayNum] = navigationDay
      .split("-")
      .map(Number);

    const prevYearCandidate = `${selectedYearNum - 1}-${pad2(
      selectedMonthNum
    )}-${pad2(
      Math.min(
        selectedDayNum,
        getDaysInMonth(selectedYearNum - 1, selectedMonthNum)
      )
    )}`;

    const nextYearCandidate = `${selectedYearNum + 1}-${pad2(
      selectedMonthNum
    )}-${pad2(
      Math.min(
        selectedDayNum,
        getDaysInMonth(selectedYearNum + 1, selectedMonthNum)
      )
    )}`;

    return {
      isAtMinDay,
      isAtToday,
      isAtMinYear: selectedYearNum <= 1800 || prevYearCandidate < minDay,
      isAtMaxYear: selectedYearNum >= currentYear || nextYearCandidate > today,
    };
  }, [day, minDay, navigationDay, today]);

  return {
    goToToday,
    goToPreviousDay,
    goToNextDay,
    goToPreviousYear,
    goToNextYear,
    ...navigationLimits,
  };
}
