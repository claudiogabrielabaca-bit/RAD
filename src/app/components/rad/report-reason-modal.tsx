"use client";

import { useEffect, useRef } from "react";

type ReportReasonModalProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string;
  submitLabel?: string;
  placeholder?: string;
};

export default function ReportReasonModal({
  open,
  title = "Report content",
  subtitle = "Tell us briefly why you are reporting this.",
  value,
  onChange,
  onClose,
  onSubmit,
  submitting = false,
  error = "",
  submitLabel = "Send report",
  placeholder = "Spam, harassment, hate speech, abusive content...",
}: ReportReasonModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timeout = window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(value.length, value.length);
    }, 10);

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, submitting, value.length]);

  if (!open) return null;

  const trimmedLength = value.trim().length;
  const canSubmit = trimmedLength >= 3 && !submitting;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/72 px-4 backdrop-blur-md">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div className="relative z-[141] w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0f0f10]/98 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_30%)]" />

        <div className="relative p-6 sm:p-7">
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Report
            </div>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{subtitle}</p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Reason
            </label>

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={5}
              maxLength={280}
              placeholder={placeholder}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">{trimmedLength} / 280</div>
              {error ? (
                <div className="text-xs text-amber-300">{error}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending..." : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}