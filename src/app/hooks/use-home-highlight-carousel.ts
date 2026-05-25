import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { HighlightItem } from "@/app/lib/rad-types";

export function useHomeHighlightCarousel({
  day,
  highlights,
  hasPickedInitialDay,
  isDayTransitioning,
  minimumTransitionDone,
  loadingDay,
  preferImmediateHighlightImageSwap,
  setHighlight,
  setPreferImmediateHighlightImageSwap,
}: {
  day: string;
  highlights: HighlightItem[];
  hasPickedInitialDay: boolean;
  isDayTransitioning: boolean;
  minimumTransitionDone: boolean;
  loadingDay: boolean;
  preferImmediateHighlightImageSwap: boolean;
  setHighlight: Dispatch<SetStateAction<HighlightItem | null>>;
  setPreferImmediateHighlightImageSwap: Dispatch<SetStateAction<boolean>>;
}) {
  const highlightTransitionRequestRef = useRef(0);
  const pendingHighlightIndexRef = useRef(0);

  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const [isHighlightPaused, setIsHighlightPaused] = useState(false);

  const isHighlightSwitchLocked =
    !hasPickedInitialDay ||
    isDayTransitioning ||
    !minimumTransitionDone ||
    loadingDay;

  const canSwitchHighlights =
    highlights.length > 1 && !isHighlightSwitchLocked;

  const transitionToHighlight = useCallback(
    async (nextIndex: number) => {
      if (!canSwitchHighlights) return;
      if (nextIndex < 0 || nextIndex >= highlights.length) return;

      const currentPendingIndex = pendingHighlightIndexRef.current;

      if (
        nextIndex === activeHighlightIndex &&
        nextIndex === currentPendingIndex
      ) {
        return;
      }

      pendingHighlightIndexRef.current = nextIndex;
      highlightTransitionRequestRef.current += 1;

      setPreferImmediateHighlightImageSwap(false);
      setActiveHighlightIndex(nextIndex);
    },
    [
      activeHighlightIndex,
      canSwitchHighlights,
      highlights.length,
      setPreferImmediateHighlightImageSwap,
    ]
  );

  useEffect(() => {
    pendingHighlightIndexRef.current = activeHighlightIndex;
  }, [activeHighlightIndex]);

  useEffect(() => {
    if (!isHighlightSwitchLocked) return;

    highlightTransitionRequestRef.current += 1;
    pendingHighlightIndexRef.current = activeHighlightIndex;
  }, [activeHighlightIndex, isHighlightSwitchLocked]);

  useEffect(() => {
    highlightTransitionRequestRef.current += 1;
    pendingHighlightIndexRef.current = activeHighlightIndex;
  }, [day, highlights, activeHighlightIndex]);

  useEffect(() => {
    if (!canSwitchHighlights || isHighlightPaused) return;

    const interval = setInterval(() => {
      const nextIndex =
        activeHighlightIndex + 1 >= highlights.length
          ? 0
          : activeHighlightIndex + 1;

      void transitionToHighlight(nextIndex);
    }, 6000);

    return () => clearInterval(interval);
  }, [
    canSwitchHighlights,
    highlights,
    isHighlightPaused,
    activeHighlightIndex,
    transitionToHighlight,
  ]);

  useEffect(() => {
    setHighlight(highlights[activeHighlightIndex] ?? null);
  }, [activeHighlightIndex, highlights, setHighlight]);

  useEffect(() => {
    if (!preferImmediateHighlightImageSwap) return;

    const raf = requestAnimationFrame(() => {
      setPreferImmediateHighlightImageSwap(false);
    });

    return () => cancelAnimationFrame(raf);
  }, [
    activeHighlightIndex,
    preferImmediateHighlightImageSwap,
    setPreferImmediateHighlightImageSwap,
  ]);

  const goToPrevHighlight = useCallback(() => {
    if (!canSwitchHighlights) return;

    const baseIndex = pendingHighlightIndexRef.current;
    const nextIndex = baseIndex === 0 ? highlights.length - 1 : baseIndex - 1;

    void transitionToHighlight(nextIndex);
  }, [canSwitchHighlights, highlights.length, transitionToHighlight]);

  const goToNextHighlight = useCallback(() => {
    if (!canSwitchHighlights) return;

    const baseIndex = pendingHighlightIndexRef.current;
    const nextIndex = baseIndex === highlights.length - 1 ? 0 : baseIndex + 1;

    void transitionToHighlight(nextIndex);
  }, [canSwitchHighlights, highlights.length, transitionToHighlight]);

  const pauseHighlightCarousel = useCallback(() => {
    setIsHighlightPaused(true);
  }, []);

  const resumeHighlightCarousel = useCallback(() => {
    setIsHighlightPaused(false);
  }, []);

  return {
    activeHighlightIndex,
    setActiveHighlightIndex,
    canSwitchHighlights,
    transitionToHighlight,
    goToPrevHighlight,
    goToNextHighlight,
    pauseHighlightCarousel,
    resumeHighlightCarousel,
  };
}
