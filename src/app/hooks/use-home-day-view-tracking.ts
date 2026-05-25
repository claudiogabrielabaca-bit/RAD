import { useEffect, useRef } from "react";
import { DAY_VIEW_TRACKING_DELAY_MS } from "@/app/lib/home-page-client-constants";
import { isValidDayString } from "@/app/lib/home-page-utils";

function sendDayView(day: string) {
  const payload = JSON.stringify({ day });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], {
      type: "application/json",
    });

    if (navigator.sendBeacon("/api/day-view", blob)) {
      return;
    }
  }

  fetch("/api/day-view", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function useHomeDayViewTracking({
  day,
  hasPickedInitialDay,
}: {
  day: string;
  hasPickedInitialDay: boolean;
}) {
  const dayViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dayViewTimeoutRef.current) {
      clearTimeout(dayViewTimeoutRef.current);
      dayViewTimeoutRef.current = null;
    }

    if (!hasPickedInitialDay) return;
    if (!isValidDayString(day)) return;

    let cancelled = false;

    dayViewTimeoutRef.current = setTimeout(() => {
      dayViewTimeoutRef.current = null;

      if (cancelled || document.visibilityState !== "visible") {
        return;
      }

      sendDayView(day);
    }, DAY_VIEW_TRACKING_DELAY_MS);

    return () => {
      cancelled = true;

      if (dayViewTimeoutRef.current) {
        clearTimeout(dayViewTimeoutRef.current);
        dayViewTimeoutRef.current = null;
      }
    };
  }, [day, hasPickedInitialDay]);
}
