import { useEffect, type Dispatch, type SetStateAction } from "react";

type AuthView =
  | "login"
  | "login-code"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email";

type StringSetter = Dispatch<SetStateAction<string>>;

export function useAuthModalLifecycle({
  open,
  view,
  initialEmail,
  setEmail,
  setUsername,
  setPassword,
  setCode,
  setNewPassword,
  setConfirmPassword,
  resetAuthFeedback,
  resetAuthLoading,
  resetCurrentUserEmailVerified,
  clearTurnstileToken,
  resetTurnstile,
  resetPasswordVisibility,
}: {
  open: boolean;
  view: AuthView;
  initialEmail: string;
  setEmail: StringSetter;
  setUsername: StringSetter;
  setPassword: StringSetter;
  setCode: StringSetter;
  setNewPassword: StringSetter;
  setConfirmPassword: StringSetter;
  resetAuthFeedback: () => void;
  resetAuthLoading: () => void;
  resetCurrentUserEmailVerified: () => void;
  clearTurnstileToken: () => void;
  resetTurnstile: () => void;
  resetPasswordVisibility: () => void;
}) {
  useEffect(() => {
    if (!open) {
      setEmail(initialEmail || "");
      setUsername("");
      setPassword("");
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      resetAuthFeedback();
      resetAuthLoading();
      resetCurrentUserEmailVerified();
      clearTurnstileToken();
      resetPasswordVisibility();
      return;
    }

    setEmail(initialEmail || "");
    resetAuthLoading();
    resetCurrentUserEmailVerified();
    resetTurnstile();
    resetPasswordVisibility();

    if (view === "login") {
      setPassword("");
      setCode("");
    }

    if (view === "login-code") {
      setCode("");
    }

    if (view === "register") {
      setUsername("");
      setPassword("");
      setCode("");
    }

    if (view === "forgot-password") {
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    }

    if (view === "reset-password") {
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    }

    if (view === "verify-email") {
      setCode("");
    }
  }, [
    open,
    view,
    initialEmail,
    clearTurnstileToken,
    resetAuthFeedback,
    resetAuthLoading,
    resetCurrentUserEmailVerified,
    resetPasswordVisibility,
    resetTurnstile,
    setCode,
    setConfirmPassword,
    setEmail,
    setNewPassword,
    setPassword,
    setUsername,
  ]);
}

export function useAuthModalEscapeClose({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
}
