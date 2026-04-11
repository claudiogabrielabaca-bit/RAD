"use client";

import React, { useEffect } from "react";

export default function ConfirmModal({
  open,
  eyebrow = "Confirm action",
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!loading) onClose();
        }}
        aria-hidden="true"
      />

      <div className="relative z-[96] w-full max-w-[560px] overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_26%)]" />

        <div className="relative p-7">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              {eyebrow}
            </div>

            <h2 className="mt-2 text-[2rem] font-semibold leading-none tracking-tight text-white">
              {title}
            </h2>

            <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
              {description}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={loading}
              className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Eliminando..." : confirmLabel}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}