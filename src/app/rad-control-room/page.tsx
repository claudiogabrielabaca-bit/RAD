"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminReport = {
  id: string;
  ratingId: string;
  anonId: string;
  reason: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  rating: {
    id: string;
    day: string;
    stars: number;
    review: string;
    anonId: string;
    createdAt: string;
  } | null;
};

export default function RadControlRoomPage() {
  const router = useRouter();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null);

  async function loadReports() {
    setLoading(true);
    setToast("");

    try {
      const res = await fetch("/api/admin/reports", {
        cache: "no-store",
      });

      if (res.status === 404) {
        router.push("/");
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        setToast(json?.error ?? "Could not load reports");
        return;
      }

      setReports(json.reports ?? []);
    } catch {
      setToast("Could not load reports");
    } finally {
      setLoading(false);
    }
  }

  async function updateReportStatus(reportId: string, status: string) {
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

      await loadReports();
      setToast(`Report marked as ${status}`);
    } catch {
      setToast("Could not update report");
    }
  }

  async function deleteReviewAsAdmin(ratingId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this review?"
    );

    if (!confirmed) return;

    setDeletingRatingId(ratingId);
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

      await loadReports();
      setToast("Review deleted");
    } catch {
      setToast("Could not delete review");
    } finally {
      setDeletingRatingId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <main className="min-h-screen bg-[#0b1220] text-zinc-100 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">RAD Control Room</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Review moderation and report handling
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-black/30"
          >
            Logout
          </button>
        </div>

        {toast ? (
          <div className="mb-4 text-sm text-zinc-300">{toast}</div>
        ) : null}

        {loading ? (
          <div className="text-sm text-zinc-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
            No reports found.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300">
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
                        {report.rating?.anonId ?? "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Reported by:</span>{" "}
                      <span className="text-white">{report.anonId}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Stars:</span>{" "}
                      <span className="text-white">
                        {report.rating ? `${report.rating.stars}/5` : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-200">
                  {report.rating?.review?.trim()
                    ? report.rating.review
                    : "No written review"}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateReportStatus(report.id, "resolved")}
                    className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30"
                  >
                    Mark resolved
                  </button>

                  <button
                    type="button"
                    onClick={() => updateReportStatus(report.id, "ignored")}
                    className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/30"
                  >
                    Ignore
                  </button>

                  <button
                    type="button"
                    onClick={() => updateReportStatus(report.id, "pending")}
                    className="rounded-lg bg-sky-500/20 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/30"
                  >
                    Back to pending
                  </button>

                  {report.rating ? (
                    <button
                      type="button"
                      onClick={() => deleteReviewAsAdmin(report.rating!.id)}
                      disabled={deletingRatingId === report.rating.id}
                      className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {deletingRatingId === report.rating.id
                        ? "Deleting..."
                        : "Delete review"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}