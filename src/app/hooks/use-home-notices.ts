import { useCallback, useEffect, useRef, useState } from "react";

export function useHomeNotices() {
  const [toast, setToast] = useState("");
  const [todayHistoryNotice, setTodayHistoryNotice] = useState("");

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayHistoryNoticeTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, duration = 2500) => {
    setToast(message);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast("");
      toastTimeoutRef.current = null;
    }, duration);
  }, []);

  const showTodayHistoryNotice = useCallback(
    (message: string, duration = 4200) => {
      setTodayHistoryNotice(message);

      if (todayHistoryNoticeTimeoutRef.current) {
        clearTimeout(todayHistoryNoticeTimeoutRef.current);
      }

      todayHistoryNoticeTimeoutRef.current = setTimeout(() => {
        setTodayHistoryNotice("");
        todayHistoryNoticeTimeoutRef.current = null;
      }, duration);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      if (todayHistoryNoticeTimeoutRef.current) {
        clearTimeout(todayHistoryNoticeTimeoutRef.current);
      }
    };
  }, []);

  return {
    toast,
    setToast,
    todayHistoryNotice,
    setTodayHistoryNotice,
    showToast,
    showTodayHistoryNotice,
  };
}
