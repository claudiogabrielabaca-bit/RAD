"use client";

import { useEffect, useRef, useState } from "react";

type HighlightHeroImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  onLoadingChange?: (loading: boolean) => void;
  revealDelayMs?: number;
  preferImmediateSwap?: boolean;
};

export default function HighlightHeroImage({
  src,
  alt,
  className = "",
  onLoadingChange,
  revealDelayMs = 0,
  preferImmediateSwap = false,
}: HighlightHeroImageProps) {
  const normalizedSrc = src?.trim() || null;

  const [displaySrc, setDisplaySrc] = useState<string | null>(normalizedSrc);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAttemptRef = useRef(0);

  useEffect(() => {
    loadAttemptRef.current += 1;
    const currentAttempt = loadAttemptRef.current;

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    if (!normalizedSrc) {
      onLoadingChange?.(false);
      return;
    }

    if (preferImmediateSwap) {
      onLoadingChange?.(false);
      return;
    }

    if (normalizedSrc === displaySrc) {
      onLoadingChange?.(false);
      return;
    }

    onLoadingChange?.(true);

    const img = new window.Image();
    img.decoding = "async";
    img.src = normalizedSrc;

    const handleLoad = () => {
      if (loadAttemptRef.current !== currentAttempt) return;

      revealTimerRef.current = setTimeout(() => {
        if (loadAttemptRef.current !== currentAttempt) return;

        setDisplaySrc(normalizedSrc);
        onLoadingChange?.(false);
        revealTimerRef.current = null;
      }, revealDelayMs);
    };

    const handleError = () => {
      if (loadAttemptRef.current !== currentAttempt) return;

      onLoadingChange?.(false);
    };

    img.onload = handleLoad;
    img.onerror = handleError;

    return () => {
      img.onload = null;
      img.onerror = null;

      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [normalizedSrc, displaySrc, onLoadingChange, revealDelayMs, preferImmediateSwap]);

  const resolvedDisplaySrc = !normalizedSrc
    ? null
    : preferImmediateSwap
      ? normalizedSrc
      : displaySrc;

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#111] to-black" />

      {resolvedDisplaySrc ? (
        <img
          src={resolvedDisplaySrc}
          alt={alt}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-black/20" />
      )}
    </div>
  );
}