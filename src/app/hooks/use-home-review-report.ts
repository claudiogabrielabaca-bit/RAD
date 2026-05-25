import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";

const DEFAULT_REVIEW_REPORT_REASON = "Spam or abusive content";

export function useHomeReviewReport({
  currentUser,
  openAuthModal,
  requireVerifiedEmail,
  handleProtectedActionStatus,
  setToast,
  showToast,
}: {
  currentUser: unknown;
  openAuthModal: (view: "login") => void;
  requireVerifiedEmail: () => boolean;
  handleProtectedActionStatus: (status: number) => boolean;
  setToast: Dispatch<SetStateAction<string>>;
  showToast: (message: string) => void;
}) {
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(
    null
  );
  const [reportReviewModalOpen, setReportReviewModalOpen] = useState(false);
  const [reportReviewTargetId, setReportReviewTargetId] = useState<
    string | null
  >(null);
  const [reportReviewReason, setReportReviewReason] = useState(
    DEFAULT_REVIEW_REPORT_REASON
  );
  const [reportReviewError, setReportReviewError] = useState("");

  const reportReview = useCallback(
    (ratingId: string) => {
      if (!currentUser) {
        openAuthModal("login");
        return;
      }

      if (requireVerifiedEmail()) return;

      setReportReviewTargetId(ratingId);
      setReportReviewReason(DEFAULT_REVIEW_REPORT_REASON);
      setReportReviewError("");
      setReportReviewModalOpen(true);
    },
    [currentUser, openAuthModal, requireVerifiedEmail]
  );

  const closeReviewReportModal = useCallback(() => {
    if (reportingReviewId) return;

    setReportReviewModalOpen(false);
    setReportReviewTargetId(null);
    setReportReviewError("");
  }, [reportingReviewId]);

  const submitReviewReport = useCallback(async () => {
    if (!reportReviewTargetId) return;

    const reason = reportReviewReason.trim();

    if (reason.length < 3) {
      setReportReviewError("Report reason must be at least 3 characters.");
      return;
    }

    setReportingReviewId(reportReviewTargetId);
    setReportReviewError("");
    setToast("");

    try {
      const res = await fetch("/api/review-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingId: reportReviewTargetId,
          reason,
        }),
      });

      const json = await res.json().catch(() => null);

      if (handleProtectedActionStatus(res.status)) {
        setReportReviewModalOpen(false);
        return;
      }

      if (!res.ok) {
        setReportReviewError(json?.error ?? "Could not report review.");
        return;
      }

      setReportReviewModalOpen(false);
      setReportReviewTargetId(null);
      setReportReviewReason(DEFAULT_REVIEW_REPORT_REASON);
      showToast("Review reported.");
    } catch {
      setReportReviewError("Could not report review.");
    } finally {
      setReportingReviewId(null);
    }
  }, [
    handleProtectedActionStatus,
    reportReviewReason,
    reportReviewTargetId,
    setToast,
    showToast,
  ]);

  return {
    reportingReviewId,
    reportReviewModalOpen,
    reportReviewReason,
    reportReviewError,
    setReportReviewReason,
    reportReview,
    closeReviewReportModal,
    submitReviewReport,
  };
}
