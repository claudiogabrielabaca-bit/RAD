import { useCallback, useState } from "react";

export function useSiteHeaderBugReport({
  pathname,
  onCloseMenu,
}: {
  pathname: string | null;
  onCloseMenu: () => void;
}) {
  const [reportBugOpen, setReportBugOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const [bugScreenshot, setBugScreenshot] = useState<File | null>(null);
  const [reportBugSubmitting, setReportBugSubmitting] = useState(false);
  const [reportBugError, setReportBugError] = useState("");
  const [reportBugSuccess, setReportBugSuccess] = useState("");

  const openBugReport = useCallback(() => {
    onCloseMenu();
    setReportBugError("");
    setReportBugSuccess("");
    setBugDescription("");
    setBugScreenshot(null);
    setReportBugOpen(true);
  }, [onCloseMenu]);

  const closeBugReport = useCallback(() => {
    if (reportBugSubmitting) return;

    setReportBugOpen(false);
    setReportBugError("");
    setReportBugSuccess("");
  }, [reportBugSubmitting]);

  const submitBugReport = useCallback(async () => {
    const trimmed = bugDescription.trim();

    if (trimmed.length < 10) {
      setReportBugError("Bug description must be at least 10 characters.");
      return;
    }

    setReportBugSubmitting(true);
    setReportBugError("");
    setReportBugSuccess("");

    try {
      const formData = new FormData();
      formData.append("description", trimmed);
      formData.append("pagePath", pathname || "");
      formData.append("pageUrl", window.location.href);
      formData.append("userAgent", navigator.userAgent);

      if (bugScreenshot) {
        formData.append("screenshot", bugScreenshot);
      }

      const res = await fetch("/api/report-bug", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setReportBugError(json?.error ?? "Could not send bug report.");
        return;
      }

      setReportBugSuccess("Bug report sent.");
      setBugDescription("");
      setBugScreenshot(null);

      window.setTimeout(() => {
        setReportBugOpen(false);
        setReportBugSuccess("");
      }, 900);
    } catch {
      setReportBugError("Could not send bug report.");
    } finally {
      setReportBugSubmitting(false);
    }
  }, [bugDescription, bugScreenshot, pathname]);

  return {
    reportBugOpen,
    bugDescription,
    setBugDescription,
    bugScreenshot,
    setBugScreenshot,
    reportBugSubmitting,
    reportBugError,
    reportBugSuccess,
    openBugReport,
    closeBugReport,
    submitBugReport,
  };
}
