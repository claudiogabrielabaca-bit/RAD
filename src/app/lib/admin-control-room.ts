export type AdminReportType = "review" | "reply";

export type AdminReportStatus = "pending" | "resolved" | "dismissed";

export type AdminNullableString = string | null;

export type AdminReportItem = {
  id: string;
  reportType: AdminReportType;
  status: AdminReportStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
  day: string;
  ratingId: string;
  replyId: string | null;
  reviewStars: number | null;
  reviewText: string | null;
  replyText: string | null;
  reportedBy: AdminNullableString;
  reportedByEmail: AdminNullableString;
  targetAuthor: AdminNullableString;
  targetAuthorEmail: AdminNullableString;
  parentReviewAuthor: AdminNullableString;
  parentReviewAuthorEmail: AdminNullableString;
};

export type AdminRecentReviewItem = {
  id: string;
  day: string;
  stars: number;
  review: string;
  authorLabel: string;
  createdAt: string;
  reportsCount: number;
  pendingReportsCount: number;
  repliesCount: number;
  likesCount: number;
};

export type AdminStatsPayload = {
  generatedAt: string;

  usersCount: number;
  reviewsCount: number;
  repliesCount: number;

  reviewReportsCount: number;
  replyReportsCount: number;
  totalReportsCount: number;

  pendingReviewReportsCount: number;
  pendingReplyReportsCount: number;
  totalPendingReportsCount: number;

  resolvedReviewReportsCount: number;
  resolvedReplyReportsCount: number;
  totalResolvedReportsCount: number;

  dismissedReviewReportsCount: number;
  dismissedReplyReportsCount: number;
  totalDismissedReportsCount: number;

  reviewsToday: number;
  reportsToday: number;

  // Legacy aliases kept intentionally so older admin UI builds do not break.
  totalUsers: number;
  totalReviews: number;
  totalReplies: number;
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  dismissedReports: number;
  ignoredReports: number;
  reportsCount: number;
  pendingReportsCount: number;
  resolvedReportsCount: number;
};

const ADMIN_REPORT_STATUSES: AdminReportStatus[] = [
  "pending",
  "resolved",
  "dismissed",
];

export const LEGACY_DISMISSED_REPORT_STATUSES = ["dismissed", "ignored"];

export function normalizeAdminReportStatus(value: unknown): AdminReportStatus {
  if (typeof value !== "string") return "pending";

  const normalized = value.trim().toLowerCase();

  // Older UI code used "ignored". The canonical persisted/display value is now
  // "dismissed", but accepting the old value prevents silent admin failures.
  if (normalized === "ignored") return "dismissed";

  if (ADMIN_REPORT_STATUSES.includes(normalized as AdminReportStatus)) {
    return normalized as AdminReportStatus;
  }

  return "pending";
}

export function isAdminReportStatus(value: unknown): value is AdminReportStatus {
  if (typeof value !== "string") return false;
  return ADMIN_REPORT_STATUSES.includes(normalizeAdminReportStatus(value));
}

export function parseAdminReportType(value: unknown): AdminReportType | null {
  return value === "review" || value === "reply" ? value : null;
}

export function formatAdminUserLabel(input: {
  username?: string | null;
  email?: string | null;
  fallback?: string | null;
}) {
  const username = input.username?.trim();
  const email = input.email?.trim();

  if (username) return `@${username}`;
  if (email) return email;
  return input.fallback ?? "Unknown";
}
