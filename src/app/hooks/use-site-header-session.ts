import { useEffect, useState } from "react";
import { fetchCurrentUserClientCached } from "@/app/lib/current-user-client";

export type HeaderUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
} | null;

export function useSiteHeaderSession() {
  const [currentUser, setCurrentUser] = useState<HeaderUser>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMe(options: { force?: boolean } = {}) {
      try {
        setIsLoadingUser(true);

        const user = await fetchCurrentUserClientCached({
          force: options.force,
        });

        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUser(false);
        }
      }
    }

    void loadMe();

    const handleAuthChanged = () => {
      void loadMe({ force: true });
    };

    window.addEventListener("rad-auth-changed", handleAuthChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("rad-auth-changed", handleAuthChanged);
    };
  }, []);

  return {
    currentUser,
    setCurrentUser,
    isLoadingUser,
  };
}
