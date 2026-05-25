import { useCallback, useEffect, useState } from "react";
import type { AuthView } from "@/app/components/rad/auth-modal";
import type { CurrentUser } from "@/app/lib/home-page-auth";
import {
  fetchCurrentUserClientCached,
  setCurrentUserClientCache,
} from "@/app/lib/current-user-client";

type ReplaceOptions = {
  scroll?: boolean;
};

type HomeRouter = {
  replace: (href: string, options?: ReplaceOptions) => void;
};

type SearchParamsLike = {
  get: (name: string) => string | null;
  toString: () => string;
};

type UseHomeAuthStateParams = {
  router: HomeRouter;
  pathname: string;
  searchParams: SearchParamsLike;
};

function getAuthViewFromQuery(value: string | null): AuthView | null {
  switch (value) {
    case "login":
    case "login-code":
    case "register":
    case "forgot-password":
    case "reset-password":
    case "verify-email":
      return value;
    default:
      return null;
  }
}

export function useHomeAuthState({
  router,
  pathname,
  searchParams,
}: UseHomeAuthStateParams) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [, setLoadingCurrentUser] = useState(true);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [authEmail, setAuthEmail] = useState("");

  const openAuthModal = useCallback(
    (view: AuthView = "login", nextEmail = "") => {
      setAuthView(view);
      setAuthEmail(nextEmail);
      setAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  useEffect(() => {
    const requestedAuthView = getAuthViewFromQuery(searchParams.get("auth"));

    if (!requestedAuthView) return;

    const requestedEmail = searchParams.get("email") ?? "";

    setAuthView(requestedAuthView);
    setAuthEmail(requestedEmail);
    setAuthModalOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    params.delete("email");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const user = await fetchCurrentUserClientCached();
      setCurrentUser(user);
    } catch {
      setCurrentUserClientCache(null);
      setCurrentUser(null);
    } finally {
      setLoadingCurrentUser(false);
    }
  }, []);

  const requireVerifiedEmail = useCallback(() => {
    if (!currentUser) {
      openAuthModal("login");
      return true;
    }

    if (currentUser.emailVerified === false) {
      openAuthModal("verify-email", currentUser.email);
      return true;
    }

    return false;
  }, [currentUser, openAuthModal]);

  const handleProtectedActionStatus = useCallback(
    (status: number) => {
      if (status === 401) {
        setCurrentUser(null);
        openAuthModal("login");
        return true;
      }

      if (status === 403) {
        if (currentUser?.email) {
          openAuthModal("verify-email", currentUser.email);
        } else {
          openAuthModal("login");
        }

        return true;
      }

      return false;
    },
    [currentUser?.email, openAuthModal]
  );

  const requireReplyInteraction = useCallback(() => {
    if (!currentUser) {
      openAuthModal("login");
      return true;
    }

    if (currentUser.emailVerified === false) {
      openAuthModal("verify-email", currentUser.email);
      return true;
    }

    return false;
  }, [currentUser, openAuthModal]);

  return {
    currentUser,
    setCurrentUser,
    authModalOpen,
    authView,
    authEmail,
    setAuthView,
    setAuthEmail,
    openAuthModal,
    closeAuthModal,
    refreshCurrentUser,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    requireReplyInteraction,
  };
}
