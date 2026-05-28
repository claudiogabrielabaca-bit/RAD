import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildLoginRedirectPath,
  type ProfilePayload,
} from "@/app/profile/profile-page-utils";

export function useProfileData({ returnTo }: { returnTo: string }) {
  const router = useRouter();

  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/profile", {
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (res.status === 401) {
        router.push(buildLoginRedirectPath(returnTo));
        return;
      }

      if (!res.ok) {
        setError(json?.error ?? "Could not load profile.");
        return;
      }

      setData(json);
    } catch {
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [router, returnTo]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return {
    data,
    setData,
    loading,
    error,
    loadProfile,
  };
}
