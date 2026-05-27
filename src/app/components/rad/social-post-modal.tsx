"use client";

import Image from "next/image";
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

function getSocialImageProxyUrl(image: string) {
  if (image.startsWith("/")) return image;
  if (image.startsWith("/api/social-image-proxy?")) return image;

  return `/api/social-image-proxy?url=${encodeURIComponent(image)}`;
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          const timeout = window.setTimeout(resolve, 4000);

          img.addEventListener(
            "load",
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );

          img.addEventListener(
            "error",
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );
        })
    )
  );
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
  const selectionInitializedRef = useRef(false);

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
    if (!open) {
      selectionInitializedRef.current = false;
      return;
    }

    if (selectionInitializedRef.current || availableHighlights.length === 0) {
      return;
    }

    selectionInitializedRef.current = true;

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
      const availableHeight = Math.max(
        previewOuterRef.current.clientHeight,
        window.innerHeight * 0.72
      );

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

  const exportHighlight = useMemo(() => {
    if (!activeHighlight?.image) return activeHighlight;

    return {
      ...activeHighlight,
      image: getSocialImageProxyUrl(activeHighlight.image),
    };
  }, [activeHighlight]);

  if (!open || !activeHighlight) return null;

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

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-[111] w-full max-w-[980px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#151515]/90 text-zinc-300 shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition hover:bg-[#1d1d1d] hover:text-white"
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
          <div className="mx-auto flex items-start justify-center gap-5">
            <div className="min-w-0">
              <div
                ref={previewOuterRef}
                className="flex max-h-[76vh] min-h-[320px] items-start justify-center overflow-auto"
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
                      highlight={exportHighlight ?? activeHighlight}
                      review={review}
                      username={username}
                    />
                  </div>
                </div>
              </div>

              <div
                className="mt-4"
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

            {availableHighlights.length > 1 ? (
              <aside className="w-[150px] shrink-0">
                <div className="flex max-h-[76vh] flex-col gap-2 overflow-y-auto pr-1">
                  {availableHighlights.map((item, index) => {
                    const selected = index === selectedHighlightIndex;
                    const label = getHighlightPreviewLabel(item, index);

                    return (
                      <button
                        key={`${label}-${index}`}
                        type="button"
                        onClick={() => {
                          selectionInitializedRef.current = true;
                          setSelectedHighlightIndex(index);
                        }}
                        className={`group w-full overflow-hidden border text-left transition ${
                          selected
                            ? "border-white/35 bg-white/[0.06]"
                            : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="relative h-[76px] w-full overflow-hidden bg-black">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={label}
                              fill
                              unoptimized
                              sizes="150px"
                              className="object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,#1a1a1a_0%,#0d0d0d_100%)]" />
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                        </div>

                        <div className="px-2 py-1.5">
                          <div
                            className={`line-clamp-2 text-[10px] leading-3 ${
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
              </aside>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none absolute left-[-99999px] top-0 opacity-100">
          <div ref={exportRef}>
            <SocialShareCard
              day={day}
              highlight={exportHighlight ?? activeHighlight}
              review={review}
              username={username}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
