import { useCallback } from "react";
import { readAuthJson } from "@/app/components/rad/auth-modal-utils";

type AuthRefreshUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
};

type AuthRefreshResponse = {
  user?: AuthRefreshUser | null;
};

export function useAuthRefreshUser({
  onAuthSuccess,
}: {
  onAuthSuccess?: (user?: AuthRefreshUser | null) => void;
}) {
  const refreshUserAndNotify = useCallback(async () => {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await readAuthJson<AuthRefreshResponse>(res);

      if (res.ok) {
        const user = json?.user ?? null;
        onAuthSuccess?.(user);
        return user;
      }

      onAuthSuccess?.(null);
      return null;
    } catch {
      onAuthSuccess?.(null);
      return null;
    }
  }, [onAuthSuccess]);

  return {
    refreshUserAndNotify,
  };
}
