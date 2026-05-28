import { useCallback, type Dispatch, type SetStateAction } from "react";
import { decodeHtml } from "@/app/lib/html";
import { formatDisplayDate } from "@/app/lib/home-page-utils";
import type { HighlightItem } from "@/app/lib/rad-types";

export function useHomeShareCurrentDay({
  day,
  highlight,
  setToast,
}: {
  day: string;
  highlight: HighlightItem | null;
  setToast: Dispatch<SetStateAction<string>>;
}) {
  const shareCurrentDay = useCallback(async () => {
    const displayDate = formatDisplayDate(day);
    const cleanTitle = decodeHtml(highlight?.title ?? "").trim();
    const title = cleanTitle
      ? `${cleanTitle} ? ${displayDate} | RAD`
      : `${displayDate} | RAD`;

    const text = `Explore and rate ${displayDate} on RAD.`;
    const url = `${window.location.origin}/day/${encodeURIComponent(day)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url,
        });

        return;
      }

      await navigator.clipboard.writeText(url);
      setToast("Day link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        setToast("Day link copied.");
      } catch {
        setToast("Unable to copy day link.");
      }
    }
  }, [day, highlight, setToast]);

  return {
    shareCurrentDay,
  };
}
