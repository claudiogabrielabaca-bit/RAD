"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { HighlightItem, ReviewItem } from "@/app/lib/rad-types";
import SocialShareCard, {
  SOCIAL_POST_HEIGHT,
  SOCIAL_POST_WIDTH,
} from "@/app/components/rad/social-share-card";

function getHighlightPreviewLabel(item: HighlightItem, fallbackIndex: number) {
  const title = item.title?.trim();
  if (title) return title;
  if (item.year) return String(item.year);
  return `Option ${fallbackIndex + 1}`;
}

export default function SocialPostModal({
  open,
  day,
  highlight,
  highlights = [],
  review,
  username,
  onClose,
}: {
  open: boolean;
  day: string;
  highlight: HighlightItem | null;
  highlights?: HighlightItem[];
  review: ReviewItem | null;
  username?: string | null;
  onClose: () => void;
}) {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const previewOuterRef = useRef<HTMLDivElement | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(0.42);
  const [selectedHighlightIndex, setSelectedHighlightIndex] = useState(0);

  const availableHighlights = useMemo(() => {
    const filtered = highlights.filter(
      (item) => item && (item.image || item.title || item.text)
    );

    if (filtered.length > 0) return filtered;
    return highlight ? [highlight] : [];
  }, [highlight, highlights]);

  useEffect(() => {
    if (!open) return;

    const activeIndex = highlight
      ? availableHighlights.findIndex(
          (item) =>
            item.title === highlight.title &&
            item.text === highlight.text &&
            item.image === highlight.image &&
            item.year === highlight.year
        )
      : -1;

    setSelectedHighlightIndex(activeIndex >= 0 ? activeIndex : 0);
  }, [open, highlight, availableHighlights]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !downloading) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, downloading, onClose]);

  useEffect(() => {
    if (!open) return;

    function updateScale() {
      if (!previewOuterRef.current) return;

      const availableWidth = previewOuterRef.current.clientWidth;
      const availableHeight = previewOuterRef.current.clientHeight;

      const scaleFromWidth = availableWidth / SOCIAL_POST_WIDTH;
      const scaleFromHeight = availableHeight / SOCIAL_POST_HEIGHT;

      const nextScale = Math.min(1, scaleFromWidth, scaleFromHeight);
      setScale(Math.max(0.2, nextScale));
    }

    updateScale();
    window.addEventListener("resize", updateScale);

    return () => {
      window.removeEventListener("resize", updateScale);
    };
  }, [open, selectedHighlightIndex]);

  const scaledWidth = useMemo(
    () => Math.round(SOCIAL_POST_WIDTH * scale),
    [scale]
  );

  const scaledHeight = useMemo(
    () => Math.round(SOCIAL_POST_HEIGHT * scale),
    [scale]
  );

  const activeHighlight =
    availableHighlights[selectedHighlightIndex] ??
    availableHighlights[0] ??
    null;

  if (!open || !activeHighlight) return null;

  async function handleDownload() {
    if (!exportRef.current) return;

    try {
      setDownloading(true);

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

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-[111] w-full max-w-[900px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 z-20 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#151515]/90 text-zinc-300 shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition hover:bg-[#1d1d1d] hover:text-white"
          aria-label="Close create post modal"
          title="Close"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6l-12 12" />
          </svg>
        </button>

        <div className="pt-14">
          <div
            ref={previewOuterRef}
            className="mx-auto flex max-h-[78vh] min-h-[320px] items-start justify-center overflow-auto"
          >
            <div
              style={{
                width: scaledWidth,
                height: scaledHeight,
              }}
            >
              <div
                style={{
                  width: SOCIAL_POST_WIDTH,
                  height: SOCIAL_POST_HEIGHT,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <SocialShareCard
                  day={day}
                  highlight={activeHighlight}
                  review={review}
                  username={username}
                />
              </div>
            </div>
          </div>

          {availableHighlights.length > 1 ? (
            <div
              className="mx-auto mt-4"
              style={{
                width: scaledWidth,
                maxWidth: "100%",
              }}
            >
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Choose image
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1">
                {availableHighlights.map((item, index) => {
                  const selected = index === selectedHighlightIndex;
                  const label = getHighlightPreviewLabel(item, index);

                  return (
                    <button
                      key={`${label}-${index}`}
                      type="button"
                      onClick={() => setSelectedHighlightIndex(index)}
                      className={`group shrink-0 overflow-hidden rounded-2xl border transition ${
                        selected
                          ? "border-white/20 bg-white/[0.08]"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="relative h-20 w-28 overflow-hidden bg-black">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={label}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[linear-gradient(135deg,#1a1a1a_0%,#0d0d0d_100%)]" />
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </div>

                      <div className="w-28 px-2 py-2 text-left">
                        <div
                          className={`line-clamp-2 text-[11px] leading-4 ${
                            selected ? "text-white" : "text-zinc-300"
                          }`}
                        >
                          {label}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div
            className="mx-auto mt-4"
            style={{
              width: scaledWidth,
              maxWidth: "100%",
            }}
          >
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
            >
              {downloading ? "Generating..." : "Download PNG"}
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute left-[-99999px] top-0 opacity-100">
          <div ref={exportRef}>
            <SocialShareCard
              day={day}
              highlight={activeHighlight}
              review={review}
              username={username}
            />
          </div>
        </div>
      </div>
    </div>
  );
}