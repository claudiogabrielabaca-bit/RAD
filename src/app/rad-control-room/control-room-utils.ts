import type {
  AdminRecentReviewItem,
  AdminReportItem,
  AdminReportStatus,
  AdminStatsPayload,
} from "@/app/lib/admin-control-room";

export type StatusFilter = "all" | AdminReportStatus;

export const emptyStats: AdminStatsPayload = {
  generatedAt: "",

  usersCount: 0,
  reviewsCount: 0,
  repliesCount: 0,

  reviewReportsCount: 0,
  replyReportsCount: 0,
  totalReportsCount: 0,

  pendingReviewReportsCount: 0,
  pendingReplyReportsCount: 0,
  totalPendingReportsCount: 0,

  resolvedReviewReportsCount: 0,
  resolvedReplyReportsCount: 0,
  totalResolvedReportsCount: 0,

  dismissedReviewReportsCount: 0,
  dismissedReplyReportsCount: 0,
  totalDismissedReportsCount: 0,

  reviewsToday: 0,
  reportsToday: 0,

  totalUsers: 0,
  totalReviews: 0,
  totalReplies: 0,
  totalReports: 0,
  pendingReports: 0,
  resolvedReports: 0,
  dismissedReports: 0,
  ignoredReports: 0,
  reportsCount: 0,
  pendingReportsCount: 0,
  resolvedReportsCount: 0,
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readReportsPayload(value: unknown): AdminReportItem[] {
  if (!isObject(value)) return [];

  const reports = Array.isArray(value.reports)
    ? value.reports
    : Array.isArray(value.items)
      ? value.items
      : [];

  return reports as AdminReportItem[];
}

export function readReviewsPayload(value: unknown): AdminRecentReviewItem[] {
  if (!isObject(value)) return [];

  const reviews = Array.isArray(value.reviews)
    ? value.reviews
    : Array.isArray(value.items)
      ? value.items
      : [];

  return reviews as AdminRecentReviewItem[];
}

export function readStatsPayload(value: unknown): AdminStatsPayload {
  if (!isObject(value)) return emptyStats;

  const maybeStats = isObject(value.stats) ? value.stats : value;

  return {
    ...emptyStats,
    ...maybeStats,
  } as AdminStatsPayload;
}

export function formatDateTime(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
}

export function statusLabel(status: AdminReportStatus) {
  if (status === "dismissed") return "Dismissed";
  return status[0].toUpperCase() + status.slice(1);
}

export function statusClassName(status: AdminReportStatus) {
  if (status === "pending") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-300";
  }

  if (status === "resolved") {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border-zinc-400/20 bg-zinc-500/10 text-zinc-300";
}

export function reportTypeClassName(reportType: AdminReportItem["reportType"]) {
  if (reportType === "reply") {
    return "border-violet-400/20 bg-violet-500/10 text-violet-300";
  }

  return "border-sky-400/20 bg-sky-500/10 text-sky-300";
}

export function normalizeDisplayText(value: string | null) {
  const text = value?.trim();
  return text ? text : "No written text";
}
