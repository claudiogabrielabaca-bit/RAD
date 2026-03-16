"use client";

import { useEffect, useRef, useState } from "react";

type HighlightHeroImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  onLoadingChange?: (loading: boolean) => void;
};

export default function HighlightHeroImage({
  src,
  alt,
  className = "",
  onLoadingChange,
}: HighlightHeroImageProps) {
  const normalizedSrc = src?.trim() || null;

  const [displaySrc, setDisplaySrc] = useState<string | null>(normalizedSrc);
  const lastLoadedSrcRef = useRef<string | null>(normalizedSrc);

  useEffect(() => {
    if (!normalizedSrc) {
      setDisplaySrc(null);
      lastLoadedSrcRef.current = null;
      onLoadingChange?.(false);
      return;
    }

    if (normalizedSrc === lastLoadedSrcRef.current) {
      onLoadingChange?.(false);
      return;
    }

    onLoadingChange?.(true);

    const img = new window.Image();
    img.decoding = "async";
    img.src = normalizedSrc;

    const handleLoad = () => {
      setDisplaySrc(normalizedSrc);
      lastLoadedSrcRef.current = normalizedSrc;
      onLoadingChange?.(false);
    };

    const handleError = () => {
      onLoadingChange?.(false);
    };

    img.onload = handleLoad;
    img.onerror = handleError;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [normalizedSrc, onLoadingChange]);

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
      ) : null}
    </div>
  );
}