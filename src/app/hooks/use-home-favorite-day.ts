import { useCallback, useEffect, useRef } from "react";
import type { AuthView } from "@/app/components/rad/auth-modal";
import type { CurrentUser } from "@/app/lib/home-page-auth";
import type { FavoriteDayResponse, SurpriseResponse } from "@/app/lib/rad-types";

type SetBoolean = React.Dispatch<React.SetStateAction<boolean>>;

type UseHomeFavoriteDayParams = {
  day: string;
  currentUser: CurrentUser;
  hasPickedInitialDay: boolean;
  initialBundle: (SurpriseResponse & { publicInitialOnly?: boolean }) | null;
  dayBundleCacheRef: React.MutableRefObject<Map<string, SurpriseResponse>>;
  isFavoriteDay: boolean;
  loadingFavoriteDay: boolean;
  setIsFavoriteDay: SetBoolean;
  setLoadingFavoriteDay: SetBoolean;
  openAuthModal: (view?: AuthView, nextEmail?: string) => void;
  requireVerifiedEmail: () => boolean;
  showToast: (message: string, duration?: number) => void;
};

export function useHomeFavoriteDay({
  day,
  currentUser,
  hasPickedInitialDay,
  initialBundle,
  dayBundleCacheRef,
  isFavoriteDay,
  loadingFavoriteDay,
  setIsFavoriteDay,
  setLoadingFavoriteDay,
  openAuthModal,
  requireVerifiedEmail,
  showToast,
}: UseHomeFavoriteDayParams) {
  const favoriteStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearFavoriteStatusTimeout = useCallback(() => {
    if (favoriteStatusTimeoutRef.current) {
      clearTimeout(favoriteStatusTimeoutRef.current);
      favoriteStatusTimeoutRef.current = null;
    }
  }, []);

  const loadFavoriteDayStatus = useCallback(
    async (targetDay: string) => {
      if (!currentUser) {
        setIsFavoriteDay(false);
        return;
      }

      setLoadingFavoriteDay(true);

      try {
        const res = await fetch(
          `/api/favorite-day?day=${encodeURIComponent(targetDay)}`,
          {
            cache: "no-store",
          }
        );

        if (!res.ok) throw new Error("Failed to load favorite day status");

        const json = (await res.json()) as FavoriteDayResponse;
        setIsFavoriteDay(!!json.isFavorite);
      } catch {
        setIsFavoriteDay(false);
      } finally {
        setLoadingFavoriteDay(false);
      }
    },
    [currentUser, setIsFavoriteDay, setLoadingFavoriteDay]
  );

  const toggleFavoriteDay = useCallback(async () => {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;
    if (loadingFavoriteDay) return;

    const previousFavorite = isFavoriteDay;
    const optimisticFavorite = !previousFavorite;

    showToast("");
    setIsFavoriteDay(optimisticFavorite);
    setLoadingFavoriteDay(true);

    try {
      const res = await fetch("/api/favorite-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          day,
          isFavorite: optimisticFavorite,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setIsFavoriteDay(previousFavorite);
        showToast(json?.error ?? "Could not update favorite day.");
        return;
      }

      setIsFavoriteDay(!!json?.isFavorite);
    } catch {
      setIsFavoriteDay(previousFavorite);
      showToast("Could not update favorite day.");
    } finally {
      setLoadingFavoriteDay(false);
    }
  }, [
    currentUser,
    day,
    isFavoriteDay,
    loadingFavoriteDay,
    openAuthModal,
    requireVerifiedEmail,
    setIsFavoriteDay,
    setLoadingFavoriteDay,
    showToast,
  ]);

  useEffect(() => {
    return () => {
      clearFavoriteStatusTimeout();
    };
  }, [clearFavoriteStatusTimeout]);

  useEffect(() => {
    if (!hasPickedInitialDay) return;

    const cachedPayload = dayBundleCacheRef.current.get(day);

    const bundledFavoriteStatus =
      cachedPayload?.day === day &&
      typeof cachedPayload.isFavoriteDay === "boolean"
        ? cachedPayload.isFavoriteDay
        : initialBundle?.day === day &&
            typeof initialBundle.isFavoriteDay === "boolean"
          ? initialBundle.isFavoriteDay
          : null;

    if (typeof bundledFavoriteStatus === "boolean") {
      clearFavoriteStatusTimeout();
      setIsFavoriteDay(bundledFavoriteStatus);
      setLoadingFavoriteDay(false);
      return;
    }

    const shouldWaitForFullPublicBundle =
      initialBundle?.day === day &&
      !!initialBundle.publicInitialOnly &&
      !cachedPayload;

    if (shouldWaitForFullPublicBundle) {
      clearFavoriteStatusTimeout();
      setLoadingFavoriteDay(false);
      return;
    }

    clearFavoriteStatusTimeout();

    favoriteStatusTimeoutRef.current = setTimeout(() => {
      favoriteStatusTimeoutRef.current = null;
      void loadFavoriteDayStatus(day);
    }, 900);
  }, [
    day,
    dayBundleCacheRef,
    hasPickedInitialDay,
    initialBundle,
    clearFavoriteStatusTimeout,
    loadFavoriteDayStatus,
    setIsFavoriteDay,
    setLoadingFavoriteDay,
  ]);

  const refreshFavoriteDayStatus = useCallback(
    async (targetDay = day) => {
      clearFavoriteStatusTimeout();
      await loadFavoriteDayStatus(targetDay);
    },
    [clearFavoriteStatusTimeout, day, loadFavoriteDayStatus]
  );

  return {
    toggleFavoriteDay,
    refreshFavoriteDayStatus,
  };
}
