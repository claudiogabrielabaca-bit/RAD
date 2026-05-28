import { useCallback, useState } from "react";

export function useAuthPasswordVisibility() {
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetPasswordVisibility = useCallback(() => {
    setShowLoginPassword(false);
    setShowRegisterPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, []);

  return {
    showLoginPassword,
    showRegisterPassword,
    showNewPassword,
    showConfirmPassword,
    toggleLoginPassword: useCallback(() => setShowLoginPassword((prev) => !prev), []),
    toggleRegisterPassword: useCallback(() => setShowRegisterPassword((prev) => !prev), []),
    toggleNewPassword: useCallback(() => setShowNewPassword((prev) => !prev), []),
    toggleConfirmPassword: useCallback(() => setShowConfirmPassword((prev) => !prev), []),
    resetPasswordVisibility,
  };
}
