import { useCallback, useState } from "react";

export function useAuthTurnstile() {
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const clearTurnstileToken = useCallback(() => {
    setTurnstileToken("");
  }, []);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("");
    setTurnstileResetKey((prev) => prev + 1);
  }, []);

  return {
    turnstileToken,
    turnstileResetKey,
    setTurnstileToken,
    clearTurnstileToken,
    resetTurnstile,
  };
}
