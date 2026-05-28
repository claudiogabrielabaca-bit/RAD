import { useState } from "react";

export function useAuthFeedbackState() {
  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");

  function resetAuthFeedback() {
    setMessage("");
    setError("");
    setDevCode("");
  }

  function resetAuthLoading() {
    setLoading(false);
    setSecondaryLoading(false);
  }

  return {
    loading,
    setLoading,
    secondaryLoading,
    setSecondaryLoading,
    message,
    setMessage,
    error,
    setError,
    devCode,
    setDevCode,
    resetAuthFeedback,
    resetAuthLoading,
  };
}
