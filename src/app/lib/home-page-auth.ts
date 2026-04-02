import type { Dispatch, SetStateAction } from "react";
import type { AuthView } from "@/app/components/rad/auth-modal";

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
} | null;

export type CurrentUserResponse = {
  user: CurrentUser;
};

type SetCurrentUser = Dispatch<SetStateAction<CurrentUser>>;
type SetBoolean = Dispatch<SetStateAction<boolean>>;
type SetString = Dispatch<SetStateAction<string>>;
type SetAuthView = Dispatch<SetStateAction<AuthView>>;

export function openHomeAuthModal(params: {
  setAuthView: SetAuthView;
  setAuthEmail: SetString;
  setAuthModalOpen: SetBoolean;
  view?: AuthView;
  nextEmail?: string;
}) {
  const {
    setAuthView,
    setAuthEmail,
    setAuthModalOpen,
    view = "login",
    nextEmail = "",
  } = params;

  setAuthView(view);
  setAuthEmail(nextEmail);
  setAuthModalOpen(true);
}

export function closeHomeAuthModal(setAuthModalOpen: SetBoolean) {
  setAuthModalOpen(false);
}

export async function refreshHomeCurrentUser(params: {
  setCurrentUser: SetCurrentUser;
  setLoadingCurrentUser: SetBoolean;
}) {
  const { setCurrentUser, setLoadingCurrentUser } = params;

  try {
    const res = await fetch("/api/me", {
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as
      | CurrentUserResponse
      | null;

    if (!res.ok) {
      setCurrentUser(null);
      return;
    }

    setCurrentUser(json?.user ?? null);
  } catch {
    setCurrentUser(null);
  } finally {
    setLoadingCurrentUser(false);
  }
}

export function requireVerifiedHomeInteraction(params: {
  currentUser: CurrentUser;
  openAuthModal: (view?: AuthView, nextEmail?: string) => void;
}) {
  const { currentUser, openAuthModal } = params;

  if (!currentUser) {
    openAuthModal("login");
    return true;
  }

  if (currentUser.emailVerified === false) {
    openAuthModal("verify-email", currentUser.email);
    return true;
  }

  return false;
}