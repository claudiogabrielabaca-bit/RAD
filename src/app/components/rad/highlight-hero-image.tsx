"use client";

import { useEffect, useRef, useState } from "react";

type HighlightHeroImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export default function HighlightHeroImage({
  src,
  alt,
  className = "",
}: HighlightHeroImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(src ?? null);
  const [nextSrc, setNextSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(true);
  const lastStableSrcRef = useRef<string | null>(src ?? null);

  useEffect(() => {
    const normalized = src?.trim() || null;

    if (!normalized) {
      setNextSrc(null);
      setDisplaySrc(null);
      setLoaded(true);
      lastStableSrcRef.current = null;
      return;
    }

    if (normalized === lastStableSrcRef.current) {
      return;
    }

    setLoaded(false);

    const img = new window.Image();
    img.src = normalized;

    const handleLoad = () => {
      setNextSrc(normalized);

      requestAnimationFrame(() => {
        setDisplaySrc(normalized);
        lastStableSrcRef.current = normalized;
        setLoaded(true);
      });
    };

    const handleError = () => {
      setNextSrc(null);
      setLoaded(true);
    };

    img.onload = handleLoad;
    img.onerror = handleError;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-black" />

      {displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-100"
          }`}
          draggable={false}
        />
      ) : null}

      {!loaded && displaySrc ? (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
      ) : null}

      {!displaySrc && !nextSrc ? (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#111] to-black" />
      ) : null}

      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}