"use client";

import { useEffect, useRef, useState } from "react";

type HighlightHeroImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  onLoadingChange?: (loading: boolean) => void;
  revealDelayMs?: number;
};

export default function HighlightHeroImage({
  src,
  alt,
  className = "",
  onLoadingChange,
  revealDelayMs = 0,
}: HighlightHeroImageProps) {
  const normalizedSrc = src?.trim() || null;

  const [displaySrc, setDisplaySrc] = useState<string | null>(normalizedSrc);
  const lastLoadedSrcRef = useRef<string | null>(normalizedSrc);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    if (!normalizedSrc) {
      setDisplaySrc(null);
      lastLoadedSrcRef.current = null;
      onLoadingChange?.(false);
      return;
    }

    if (normalizedSrc === lastLoadedSrcRef.current) {
      setDisplaySrc(normalizedSrc);
      onLoadingChange?.(false);
      return;
    }

    onLoadingChange?.(true);

    // CLAVE: ocultar la imagen anterior apenas cambia el src
    setDisplaySrc(null);

    const img = new window.Image();
    img.decoding = "async";
    img.src = normalizedSrc;

    const handleLoad = () => {
      revealTimerRef.current = setTimeout(() => {
        setDisplaySrc(normalizedSrc);
        lastLoadedSrcRef.current = normalizedSrc;
        onLoadingChange?.(false);
        revealTimerRef.current = null;
      }, revealDelayMs);
    };

    const handleError = () => {
      setDisplaySrc(null);
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
  }, [normalizedSrc, onLoadingChange, revealDelayMs]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#111] to-black" />

      {displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-black/20" />
      )}
    </div>
  );
}