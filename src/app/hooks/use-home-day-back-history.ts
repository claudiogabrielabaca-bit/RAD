import { useCallback, useEffect, useRef, useState } from "react";
import {
  DAY_BACK_HISTORY_MAX,
  getStoredDayBackHistory,
  setStoredDayBackHistory,
} from "@/app/lib/home-page-history";
import { isValidDayString } from "@/app/lib/home-page-utils";

type OpenDayFn = (
  day: string,
  options?: { scrollToHighlight?: boolean }
) => Promise<void> | void;

export function useHomeDayBackHistory() {
  const dayBackHistoryRef = useRef<string[]>([]);
  const isGoingBackRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const syncDayBackHistory = useCallback((nextHistory: string[]) => {
    const safe = nextHistory
      .filter((item) => isValidDayString(item))
      .slice(-DAY_BACK_HISTORY_MAX);

    dayBackHistoryRef.current = safe;
    setCanGoBack(safe.length > 0);
    setStoredDayBackHistory(safe);
  }, []);

  const pushCurrentDayToBackHistory = useCallback(
    (currentDay: string, nextDay: string) => {
      if (!isValidDayString(currentDay) || !isValidDayString(nextDay)) return;
      if (currentDay === nextDay) return;

      const currentHistory = [...dayBackHistoryRef.current];
      const lastItem = currentHistory[currentHistory.length - 1];

      if (lastItem === currentDay) return;

      syncDayBackHistory([...currentHistory, currentDay]);
    },
    [syncDayBackHistory]
  );

  const goBackToLastViewed = useCallback(
    async (openDay: OpenDayFn) => {
      const currentHistory = [...dayBackHistoryRef.current];
      const previousDay = currentHistory[currentHistory.length - 1];

      if (!previousDay) return;

      syncDayBackHistory(currentHistory.slice(0, -1));

      isGoingBackRef.current = true;

      try {
        await openDay(previousDay, { scrollToHighlight: false });
      } finally {
        isGoingBackRef.current = false;
      }
    },
    [syncDayBackHistory]
  );

  useEffect(() => {
    const storedHistory = getStoredDayBackHistory();
    dayBackHistoryRef.current = storedHistory;
    setCanGoBack(storedHistory.length > 0);
  }, []);

  return {
    dayBackHistoryRef,
    isGoingBackRef,
    canGoBack,
    pushCurrentDayToBackHistory,
    goBackToLastViewed,
  };
}
