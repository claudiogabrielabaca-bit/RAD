import { useState, type RefObject } from "react";
import { toPng } from "html-to-image";
import {
  SOCIAL_POST_HEIGHT,
  SOCIAL_POST_WIDTH,
} from "@/app/components/rad/social-share-card";
import { waitForImages } from "@/app/components/rad/social-post-modal-utils";

export function useSocialPostDownload({
  exportRef,
  day,
}: {
  exportRef: RefObject<HTMLDivElement | null>;
  day: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!exportRef.current) return;

    try {
      setDownloading(true);
      await waitForImages(exportRef.current);

      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        canvasWidth: SOCIAL_POST_WIDTH,
        canvasHeight: SOCIAL_POST_HEIGHT,
      });

      const link = document.createElement("a");
      link.download = `rad-post-${day}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Could not export social post:", error);
    } finally {
      setDownloading(false);
    }
  }

  return {
    downloading,
    handleDownload,
  };
}
