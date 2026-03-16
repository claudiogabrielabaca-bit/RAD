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
  const normalizedSrc = src?.trim() || null;

  const [displaySrc, setDisplaySrc] = useState<string | null>(normalizedSrc);
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const lastLoadedSrcRef = useRef<string | null>(normalizedSrc);

  useEffect(() => {
    if (!normalizedSrc) {
      return;
    }

    if (normalizedSrc === lastLoadedSrcRef.current) {
      return;
    }

    setIsSwitching(true);

    const img = new window.Image();
    img.decoding = "async";
    img.src = normalizedSrc;

    const handleLoad = () => {
      setIncomingSrc(normalizedSrc);

      requestAnimationFrame(() => {
        setDisplaySrc(normalizedSrc);
        lastLoadedSrcRef.current = normalizedSrc;
        setIncomingSrc(null);
        setIsSwitching(false);
      });
    };

    const handleError = () => {
      setIncomingSrc(null);
      setIsSwitching(false);
    };

    img.onload = handleLoad;
    img.onerror = handleError;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [normalizedSrc]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#111] to-black" />

      {displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 opacity-100"
        />
      ) : null}

      {isSwitching ? (
        <div className="absolute inset-0 bg-black/12 backdrop-blur-[1px]" />
      ) : null}
    </div>
  );
}