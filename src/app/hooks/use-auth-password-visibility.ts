import { useState } from "react";

export function useAuthPasswordVisibility() {
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function resetPasswordVisibility() {
    setShowLoginPassword(false);
    setShowRegisterPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  return {
    showLoginPassword,
    showRegisterPassword,
    showNewPassword,
    showConfirmPassword,
    toggleLoginPassword: () => setShowLoginPassword((prev) => !prev),
    toggleRegisterPassword: () => setShowRegisterPassword((prev) => !prev),
    toggleNewPassword: () => setShowNewPassword((prev) => !prev),
    toggleConfirmPassword: () => setShowConfirmPassword((prev) => !prev),
    resetPasswordVisibility,
  };
}
