"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminReportItem, AdminReportStatus } from "@/app/lib/admin-control-room";
import {
  formatDateTime,
  isObject,
  normalizeDisplayText,
  reportTypeClassName,
  statusClassName,
  statusLabel,
  type StatusFilter,
} from "@/app/rad-control-room/control-room-utils";
import { useRadControlRoomData } from "@/app/hooks/use-rad-control-room-data";

export default function RadControlRoomPage() {
  const router = useRouter();

  const { reports, recentReviews, stats, loading, toast, setToast, loadAll } =
    useRadControlRoomData();
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);

  async function updateReportStatus(
    report: AdminReportItem,
    status: AdminReportStatus
  ) {
    const key = `report:${report.id}:${status}`;
    setActionKey(key);
    setToast("");

    try {
      const res = await fetch("/api/admin/report-resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId: report.id,
          reportType: report.reportType,
          status,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setToast(
          isObject(json) && typeof json.error === "string"
            ? json.error
            : "Could not update report"
        );
        return;
      }

      await loadAll();
      setToast(`Report marked as ${statusLabel(status).toLowerCase()}`);
    } catch {
      setToast("Could not update report");
    } finally {
      setActionKey(null);
    }
  }

  async function deleteReviewAsAdmin(ratingId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this review?"
    );

    if (!confirmed) return;

    const key = `delete:${ratingId}`;
    setActionKey(key);
    setToast("");

    try {
      const res = await fetch("/api/admin/delete-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ratingId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setToast(
          isObject(json) && typeof json.error === "string"
            ? json.error
            : "Could not delete review"
        );
        return;
      }

      await loadAll();
      setToast("Review deleted");
    } catch {
      setToast("Could not delete review");
    } finally {
      setActionKey(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesFilter = filter === "all" ? true : report.status === filter;

      const haystack = [
        report.id,
        report.reportType,
        report.ratingId,
        report.replyId ?? "",
        report.reason,
        report.status,
        report.day,
        report.reviewText ?? "",
        report.replyText ?? "",
        report.reportedBy ?? "",
        report.reportedByEmail ?? "",
        report.targetAuthor ?? "",
        report.targetAuthorEmail ?? "",
        report.parentReviewAuthor ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = q ? haystack.includes(q) : true;

      return matchesFilter && matchesSearch;
    });
  }, [reports, filter, search]);

  const filteredRecentReviews = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();

    return recentReviews.filter((review) => {
      if (!q) return true;

      const haystack = [
        review.id,
        review.day,
        review.authorLabel,
        review.review,
        String(review.stars),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [recentReviews, reviewSearch]);

  function statCard(
    title: string,
    value: number,
    accent:
      | "text-white"
      | "text-amber-300"
      | "text-emerald-300"
      | "text-zinc-300"
      | "text-sky-300"
      | "text-violet-300"
  ) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
          {title}
        </div>
        <div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1220] px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">RAD Control Room</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Review moderation, reply reports and live overview
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-black/30"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-black/30"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCard("Total reports", stats.totalReportsCount, "text-white")}
          {statCard(
            "Pending reports",
            stats.totalPendingReportsCount,
            "text-amber-300"
          )}
          {statCard("Resolved", stats.totalResolvedReportsCount, "text-emerald-300")}
          {statCard("Dismissed", stats.totalDismissedReportsCount, "text-zinc-300")}
          {statCard("Total users", stats.usersCount, "text-sky-300")}
          {statCard("Total reviews", stats.reviewsCount, "text-emerald-300")}
          {statCard("Replies", stats.repliesCount, "text-violet-300")}
          {statCard("Reports today", stats.reportsToday, "text-zinc-300")}
        </div>

        {toast ? (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
            {toast}
          </div>
        ) : null}

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Recent reviews</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Latest reviews with moderation context
              </p>
            </div>

            <input
              value={reviewSearch}
              onChange={(e) => setReviewSearch(e.target.value)}
              placeholder="Search reviews by day, author or text..."
              className="w-full rounded-xl border border-white/10 bg-[#101826] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10 lg:max-w-md"
            />
          </div>

          {loading ? (
            <div className="text-sm text-zinc-400">Loading recent reviews...</div>
          ) : filteredRecentReviews.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
              No recent reviews found.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredRecentReviews.map((review) => {
                const deleteKey = `delete:${review.id}`;
                const isDeleting = actionKey === deleteKey;

                return (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                        {review.day}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {review.stars}/5
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatDateTime(review.createdAt)}
                      </span>
                    </div>

                    <div className="mt-3 text-sm">
                      <span className="text-zinc-400">Author:</span>{" "}
                      <span className="text-white">{review.authorLabel}</span>
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-[#0d1420] p-4 text-sm text-zinc-200">
                      {review.review?.trim() ? review.review : "No written review"}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>Reports: {review.reportsCount}</span>
                      <span>Pending: {review.pendingReportsCount}</span>
                      <span>Replies: {review.repliesCount}</span>
                      <span>Likes: {review.likesCount}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href={`/?day=${encodeURIComponent(review.day)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-sky-500/20 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/30"
                      >
                        Open day
                      </a>

                      <button
                        type="button"
                        onClick={() => deleteReviewAsAdmin(review.id)}
                        disabled={!!actionKey}
                        className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Delete review"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Reports</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Moderation queue for reviews and replies
              </p>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by day, reason, author, text..."
              className="w-full rounded-xl border border-white/10 bg-[#101826] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10 lg:max-w-md"
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {(["all", "pending", "resolved", "dismissed"] as const).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`rounded-xl px-3 py-2 text-sm transition ${
                    filter === status
                      ? "bg-white text-black"
                      : "bg-black/20 text-zinc-300 hover:bg-black/30"
                  }`}
                >
                  {status === "all" ? "All" : statusLabel(status)}
                </button>
              )
            )}
          </div>

          {loading ? (
            <div className="text-sm text-zinc-400">Loading reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
              No reports found for this filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const deleteKey = `delete:${report.ratingId}`;
                const isDeleting = actionKey === deleteKey;
                const isResolving = actionKey === `report:${report.id}:resolved`;
                const isDismissing = actionKey === `report:${report.id}:dismissed`;
                const isPending = actionKey === `report:${report.id}:pending`;
                const reportedText =
                  report.reportType === "reply"
                    ? normalizeDisplayText(report.replyText)
                    : normalizeDisplayText(report.reviewText);

                return (
                  <div
                    key={`${report.reportType}:${report.id}`}
                    className="rounded-2xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-1 text-xs ${statusClassName(
                          report.status
                        )}`}
                      >
                        {statusLabel(report.status)}
                      </span>

                      <span
                        className={`rounded-md border px-2 py-1 text-xs ${reportTypeClassName(
                          report.reportType
                        )}`}
                      >
                        {report.reportType === "reply" ? "Reply" : "Review"}
                      </span>

                      <span className="text-xs text-zinc-400">
                        Reported: {formatDateTime(report.createdAt)}
                      </span>

                      <span className="text-xs text-zinc-500">
                        Updated: {formatDateTime(report.updatedAt)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-zinc-400">Day:</span>{" "}
                          <span className="text-white">{report.day}</span>
                        </div>

                        <div>
                          <span className="text-zinc-400">Reason:</span>{" "}
                          <span className="text-white">{report.reason}</span>
                        </div>

                        <div>
                          <span className="text-zinc-400">Rating ID:</span>{" "}
                          <span className="text-white">{report.ratingId}</span>
                        </div>

                        {report.replyId ? (
                          <div>
                            <span className="text-zinc-400">Reply ID:</span>{" "}
                            <span className="text-white">{report.replyId}</span>
                          </div>
                        ) : null}

                        <div>
                          <span className="text-zinc-400">Report ID:</span>{" "}
                          <span className="text-white">{report.id}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-zinc-400">Target author:</span>{" "}
                          <span className="text-white">
                            {report.targetAuthor ?? "-"}
                          </span>
                        </div>

                        {report.reportType === "reply" ? (
                          <div>
                            <span className="text-zinc-400">
                              Parent review author:
                            </span>{" "}
                            <span className="text-white">
                              {report.parentReviewAuthor ?? "-"}
                            </span>
                          </div>
                        ) : null}

                        <div>
                          <span className="text-zinc-400">Reported by:</span>{" "}
                          <span className="text-white">
                            {report.reportedBy ?? "-"}
                          </span>
                        </div>

                        <div>
                          <span className="text-zinc-400">Stars:</span>{" "}
                          <span className="text-white">
                            {typeof report.reviewStars === "number"
                              ? `${report.reviewStars}/5`
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {report.reportType === "reply" ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-[#101826] p-4 text-sm text-zinc-300">
                        <div className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Parent review
                        </div>
                        {normalizeDisplayText(report.reviewText)}
                      </div>
                    ) : null}

                    <div className="mt-4 rounded-xl border border-white/10 bg-[#0d1420] p-4 text-sm text-zinc-200">
                      <div className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Reported {report.reportType}
                      </div>
                      {reportedText}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href={`/?day=${encodeURIComponent(report.day)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-sky-500/20 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/30"
                      >
                        Open day
                      </a>

                      <button
                        type="button"
                        onClick={() => updateReportStatus(report, "resolved")}
                        disabled={!!actionKey}
                        className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        {isResolving ? "Updating..." : "Mark resolved"}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateReportStatus(report, "dismissed")}
                        disabled={!!actionKey}
                        className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
                      >
                        {isDismissing ? "Updating..." : "Dismiss"}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateReportStatus(report, "pending")}
                        disabled={!!actionKey}
                        className="rounded-lg bg-zinc-500/20 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-500/30 disabled:opacity-50"
                      >
                        {isPending ? "Updating..." : "Back to pending"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteReviewAsAdmin(report.ratingId)}
                        disabled={!!actionKey}
                        className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Delete review"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
