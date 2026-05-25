import { useCallback, useState } from "react";

export function useHomeSuggestEvent({ day }: { day: string }) {
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestEvent, setSuggestEvent] = useState("");
  const [suggestDescription, setSuggestDescription] = useState("");
  const [suggestSource, setSuggestSource] = useState("");
  const [suggestEmail, setSuggestEmail] = useState("");
  const [suggestSending, setSuggestSending] = useState(false);
  const [suggestToast, setSuggestToast] = useState("");

  const openSuggestModal = useCallback(() => {
    setShowSuggestModal(true);
  }, []);

  const closeSuggestModal = useCallback(() => {
    setShowSuggestModal(false);
  }, []);

  const submitSuggestion = useCallback(async () => {
    if (!suggestEvent.trim()) {
      setSuggestToast("Write an event title.");
      return;
    }

    if (!suggestDescription.trim()) {
      setSuggestToast("Write a short description.");
      return;
    }

    if (!suggestSource.trim()) {
      setSuggestToast("Source is required.");
      return;
    }

    setSuggestSending(true);
    setSuggestToast("");

    try {
      const res = await fetch("/api/suggest-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          day,
          event: suggestEvent.trim(),
          description: suggestDescription.trim(),
          source: suggestSource.trim(),
          email: suggestEmail.trim(),
          website: "",
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setSuggestToast(json?.error ?? "Could not send suggestion.");
        return;
      }

      setSuggestToast("Suggestion sent");
      setSuggestEvent("");
      setSuggestDescription("");
      setSuggestSource("");
      setSuggestEmail("");

      setTimeout(() => {
        setShowSuggestModal(false);
        setSuggestToast("");
      }, 900);
    } catch {
      setSuggestToast("Could not send suggestion.");
    } finally {
      setSuggestSending(false);
    }
  }, [day, suggestDescription, suggestEmail, suggestEvent, suggestSource]);

  return {
    showSuggestModal,
    suggestEvent,
    suggestDescription,
    suggestSource,
    suggestEmail,
    suggestSending,
    suggestToast,
    setSuggestEvent,
    setSuggestDescription,
    setSuggestSource,
    setSuggestEmail,
    openSuggestModal,
    closeSuggestModal,
    submitSuggestion,
  };
}
