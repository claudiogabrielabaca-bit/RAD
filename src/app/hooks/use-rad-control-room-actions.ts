import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminReportItem,
  AdminReportStatus,
} from "@/app/lib/admin-control-room";
import {
  isObject,
  statusLabel,
} from "@/app/rad-control-room/control-room-utils";

export function useRadControlRoomActions({
  loadAll,
  setToast,
}: {
  loadAll: () => Promise<void>;
  setToast: (message: string) => void;
}) {
  const router = useRouter();
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

  return {
    actionKey,
    updateReportStatus,
    deleteReviewAsAdmin,
    logout,
  };
}
