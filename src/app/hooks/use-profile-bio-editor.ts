import { useState, type Dispatch, type SetStateAction } from "react";
import {
  BIO_MAX_LENGTH,
  type ProfilePayload,
} from "@/app/profile/profile-page-utils";

export function useProfileBioEditor({
  data,
  setData,
}: {
  data: ProfilePayload | null;
  setData: Dispatch<SetStateAction<ProfilePayload | null>>;
}) {
  const [bioModalOpen, setBioModalOpen] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState("");

  const displayedBio = (() => {
    const raw = data?.user?.bio?.trim();

    if (raw) return raw;

    return `@${data?.user.username ?? "user"} is building a personal archive of favorite moments in history.`;
  })();

  function openBioModal() {
    setBioDraft(data?.user?.bio ?? "");
    setBioError("");
    setBioModalOpen(true);
  }

  function closeBioModal() {
    if (bioSaving) return;

    setBioModalOpen(false);
    setBioError("");
  }

  function updateBioDraft(value: string) {
    setBioDraft(value.slice(0, BIO_MAX_LENGTH));
  }

  async function saveBio() {
    setBioSaving(true);
    setBioError("");

    try {
      const res = await fetch("/api/profile/bio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bio: bioDraft,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setBioError(json?.error ?? "Could not save bio.");
        return;
      }

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          user: {
            ...prev.user,
            bio: json?.bio ?? "",
          },
        };
      });

      setBioModalOpen(false);
    } catch {
      setBioError("Could not save bio.");
    } finally {
      setBioSaving(false);
    }
  }

  return {
    bioModalOpen,
    bioDraft,
    bioSaving,
    bioError,
    displayedBio,
    openBioModal,
    closeBioModal,
    updateBioDraft,
    saveBio,
  };
}
