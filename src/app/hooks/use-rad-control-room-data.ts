import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminRecentReviewItem,
  AdminReportItem,
  AdminStatsPayload,
} from "@/app/lib/admin-control-room";
import {
  emptyStats,
  isObject,
  readReportsPayload,
  readReviewsPayload,
  readStatsPayload,
} from "@/app/rad-control-room/control-room-utils";

export function useRadControlRoomData() {
  const router = useRouter();

  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [recentReviews, setRecentReviews] = useState<AdminRecentReviewItem[]>([]);
  const [stats, setStats] = useState<AdminStatsPayload>(emptyStats);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const loadAll = useCallback(async () => {
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
        setToast(
          isObject(reportsJson) && typeof reportsJson.error === "string"
            ? reportsJson.error
            : "Could not load reports"
        );
        return;
      }

      if (!statsRes.ok) {
        setToast(
          isObject(statsJson) && typeof statsJson.error === "string"
            ? statsJson.error
            : "Could not load stats"
        );
        return;
      }

      if (!recentReviewsRes.ok) {
        setToast(
          isObject(recentReviewsJson) &&
            typeof recentReviewsJson.error === "string"
            ? recentReviewsJson.error
            : "Could not load recent reviews"
        );
        return;
      }

      setReports(readReportsPayload(reportsJson));
      setStats(readStatsPayload(statsJson));
      setRecentReviews(readReviewsPayload(recentReviewsJson));
    } catch {
      setToast("Could not load admin data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return {
    reports,
    recentReviews,
    stats,
    loading,
    toast,
    setToast,
    loadAll,
  };
}
