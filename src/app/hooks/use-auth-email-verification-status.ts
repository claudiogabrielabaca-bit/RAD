import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  normalizeEmail,
  readAuthJson,
} from "@/app/components/rad/auth-modal-utils";

type AuthEmailStatusResponse = {
  user?: {
    email?: string;
    emailVerified?: boolean;
  } | null;
};

export function useAuthEmailVerificationStatus({
  open,
  view,
  initialEmail,
  email,
  setEmail,
}: {
  open: boolean;
  view: string;
  initialEmail: string;
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
}) {
  const [currentUserEmailVerified, setCurrentUserEmailVerified] = useState<
    boolean | null
  >(null);

  const resetCurrentUserEmailVerified = useCallback(() => {
    setCurrentUserEmailVerified(null);
  }, []);

  const markCurrentUserEmailVerified = useCallback(() => {
    setCurrentUserEmailVerified(true);
  }, []);

  const markCurrentUserEmailUnverified = useCallback(() => {
    setCurrentUserEmailVerified(false);
  }, []);

  useEffect(() => {
    if (!open || view !== "verify-email") {
      return;
    }

    let cancelled = false;

    async function loadMe() {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
        });

        const json = await readAuthJson<AuthEmailStatusResponse>(res);

        if (cancelled) return;

        if (!res.ok) {
          setCurrentUserEmailVerified(null);
          return;
        }

        const meEmail =
          typeof json?.user?.email === "string"
            ? normalizeEmail(json.user.email)
            : "";

        const formEmail = normalizeEmail(initialEmail || email);

        if (meEmail && !formEmail) {
          setEmail(meEmail);
          setCurrentUserEmailVerified(
            typeof json?.user?.emailVerified === "boolean"
              ? json.user.emailVerified
              : null
          );
          return;
        }

        if (meEmail && formEmail && meEmail === formEmail) {
          setCurrentUserEmailVerified(
            typeof json?.user?.emailVerified === "boolean"
              ? json.user.emailVerified
              : null
          );
        } else {
          setCurrentUserEmailVerified(null);
        }
      } catch {
        if (!cancelled) {
          setCurrentUserEmailVerified(null);
        }
      }
    }

    void loadMe();

    return () => {
      cancelled = true;
    };
  }, [open, view, initialEmail, email, setEmail]);

  return {
    currentUserEmailVerified,
    resetCurrentUserEmailVerified,
    markCurrentUserEmailVerified,
    markCurrentUserEmailUnverified,
  };
}
