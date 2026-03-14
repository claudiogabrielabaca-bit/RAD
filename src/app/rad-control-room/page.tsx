"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AdminReport = {
  id: string;
  ratingId: string;
  reason: string;
  status: "pending" | "resolved" | "ignored";
  createdAt: string;
  updatedAt: string;
  reportAuthorLabel: string;
  rating: {
    id: string;
    day: string;
    stars: number;
    review: string;
    authorLabel: string;
    createdAt: string;
  } | null;
};

type AdminStats = {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  ignoredReports: number;
  totalUsers: number;
  totalReviews: number;
  reviewsToday: number;
  reportsToday: number;
};

type RecentReview = {
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

type StatusFilter = "all" | "pending" | "resolved" | "ignored";

const emptyStats: AdminStats = {
  totalReports: 0,
  pendingReports: 0,
  resolvedReports: 0,
  ignoredReports: 0,
  totalUsers: 0,
  totalReviews: 0,
  reviewsToday: 0,
  reportsToday: 0,
};

export default function RadControlRoomPage() {
  const router = useRouter();

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [stats, setStats] = useState<AdminStats>(emptyStats);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setToast("");

    try {
      const [reportsRes, statsRes, recentReviewsRes] = await Promise.all([
        fetch("/api/admin/reports", { cache: "no-store" }),
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/recent-reviews", { cache: "no-store" }),
      ]);

      if (
        reportsRes.status === 404 ||
        statsRes.status === 404 ||
        recentReviewsRes.status === 404
      ) {
        router.push("/");
        return;
      }

      const [reportsJson, statsJson, recentReviewsJson] = await Promise.all([
        reportsRes.json().catch(() => null),
        statsRes.json().catch(() => null),
        recentReviewsRes.json().catch(() => null),
      ]);

      if (!reportsRes.ok) {
        setToast(reportsJson?.error ?? "Could not load reports");
        return;
      }

      if (!statsRes.ok) {
        setToast(statsJson?.error ?? "Could not load stats");
        return;
      }

      if (!recentReviewsRes.ok) {
        setToast(recentReviewsJson?.error ?? "Could not load recent reviews");
        return;
      }

      setReports(reportsJson?.reports ?? []);
      setStats(statsJson?.stats ?? emptyStats);
      setRecentReviews(recentReviewsJson?.reviews ?? []);
    } catch {
      setToast("Could not load admin data");
    } finally {
      setLoading(false);
    }
  }

  async function updateReportStatus(
    reportId: string,
    status: "pending" | "resolved" | "ignored"
  ) {
    const key = `report:${reportId}:${status}`;
    setActionKey(key);
    setToast("");

    try {
      const res = await fetch("/api/admin/report-resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportId, status }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setToast(json?.error ?? "Could not update report");
        return;
      }

      await loadAll();
      setToast(`Report marked as ${status}`);
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
        setToast(json?.error ?? "Could not delete review");
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

  useEffect(() => {
    loadAll();
  }, []);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesFilter = filter === "all" ? true : report.status === filter;

      const haystack = [
        report.id,
        report.ratingId,
        report.reason,
        report.status,
        report.reportAuthorLabel,
        report.rating?.day ?? "",
        report.rating?.authorLabel ?? "",
        report.rating?.review ?? "",
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
              Review moderation, reports and live overview
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
          {statCard("Total reports", stats.totalReports, "text-white")}
          {statCard("Pending reports", stats.pendingReports, "text-amber-300")}
          {statCard("Total users", stats.totalUsers, "text-sky-300")}
          {statCard("Total reviews", stats.totalReviews, "text-emerald-300")}
          {statCard("Reports today", stats.reportsToday, "text-zinc-300")}
          {statCard("Reviews today", stats.reviewsToday, "text-zinc-300")}
          {statCard("Resolved", stats.resolvedReports, "text-emerald-300")}
          {statCard("Ignored", stats.ignoredReports, "text-zinc-300")}
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
                        {new Date(review.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-3 text-sm">
                      <div>
                        <span className="text-zinc-400">Author:</span>{" "}
                        <span className="text-white">{review.authorLabel}</span>
                      </div>
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
                Moderation queue with filters and review context
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
            {(["all", "pending", "resolved", "ignored"] as const).map(
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
                  {status[0].toUpperCase() + status.slice(1)}
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
                const deleteKey = report.rating ? `delete:${report.rating.id}` : "";
                const isDeleting = actionKey === deleteKey;
                const isResolving = actionKey === `report:${report.id}:resolved`;
                const isIgnoring = actionKey === `report:${report.id}:ignored`;
                const isPending = actionKey === `report:${report.id}:pending`;

                return (
                  <div
                    key={report.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-1 text-xs ${
                          report.status === "pending"
                            ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
                            : report.status === "resolved"
                            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-400/20 bg-zinc-500/10 text-zinc-300"
                        }`}
                      >
                        {report.status}
                      </span>

                      <span className="text-xs text-zinc-400">
                        Reported: {new Date(report.createdAt).toLocaleString()}
                      </span>

                      <span className="text-xs text-zinc-500">
                        Updated: {new Date(report.updatedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-zinc-400">Day:</span>{" "}
                          <span className="text-white">
                            {report.rating?.day ?? "-"}
                          </span>
                        </div>

                        <div>
                          <span className="text-zinc-400">Reason:</span>{" "}
                          <span className="text-white">{report.reason}</span>
                        </div>

                        <div>
                          <span className="text-zinc-400">Rating ID:</span>{" "}
                          <span className="text-white">{report.ratingId}</span>
                        </div>

                        <div>
                          <span className="text-zinc-400">Report ID:</span>{" "}
                          <span className="text-white">{report.id}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-zinc-400">Review author:</span>{" "}
                          <span className="text-white">
                            {report.rating?.authorLabel ?? "-"}
                          </span>
                        </div>

                        <div>
                          <span className="text-zinc-400">Reported by:</span>{" "}
                          <span className="text-white">
                            {report.reportAuthorLabel}
                          </span>
                        </div>

                        <div>
                          <span className="text-zinc-400">Stars:</span>{" "}
                          <span className="text-white">
                            {report.rating ? `${report.rating.stars}/5` : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-[#0d1420] p-4 text-sm text-zinc-200">
                      {report.rating?.review?.trim()
                        ? report.rating.review
                        : "No written review"}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {report.rating?.day ? (
                        <a
                          href={`/?day=${encodeURIComponent(report.rating.day)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-sky-500/20 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/30"
                        >
                          Open day
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => updateReportStatus(report.id, "resolved")}
                        disabled={!!actionKey}
                        className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        {isResolving ? "Updating..." : "Mark resolved"}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateReportStatus(report.id, "ignored")}
                        disabled={!!actionKey}
                        className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
                      >
                        {isIgnoring ? "Updating..." : "Ignore"}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateReportStatus(report.id, "pending")}
                        disabled={!!actionKey}
                        className="rounded-lg bg-zinc-500/20 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-500/30 disabled:opacity-50"
                      >
                        {isPending ? "Updating..." : "Back to pending"}
                      </button>

                      {report.rating ? (
                        <button
                          type="button"
                          onClick={() => deleteReviewAsAdmin(report.rating!.id)}
                          disabled={!!actionKey}
                          className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting..." : "Delete review"}
                        </button>
                      ) : null}
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


