"use client";

import { useEffect, useMemo, useRef } from "react";

function BugIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[16px] w-[16px]"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 9.5V7a3 3 0 1 1 6 0v2.5" />
      <path d="M7.5 10.5h9l1 2.5-1 5a2 2 0 0 1-2 1.5h-5a2 2 0 0 1-2-1.5l-1-5 1-2.5Z" />
      <path d="M4 13h3" />
      <path d="M17 13h3" />
      <path d="M5 8.5 7.5 10" />
      <path d="M19 8.5 16.5 10" />
      <path d="M6 17.5 8.5 16" />
      <path d="M18 17.5 15.5 16" />
    </svg>
  );
}

type ReportBugModalProps = {
  open: boolean;
  description: string;
  onDescriptionChange: (value: string) => void;
  screenshot: File | null;
  onScreenshotChange: (file: File | null) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string;
  success?: string;
};

export default function ReportBugModal({
  open,
  description,
  onDescriptionChange,
  screenshot,
  onScreenshotChange,
  onClose,
  onSubmit,
  submitting = false,
  error = "",
  success = "",
}: ReportBugModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previewUrl = useMemo(() => {
    if (!screenshot) return "";
    return URL.createObjectURL(screenshot);
  }, [screenshot]);

  useEffect(() => {
    if (!previewUrl) return;

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timeout = window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        description.length,
        description.length
      );
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
  }, [open, onClose, submitting, description.length]);

  if (!open) return null;

  const trimmedLength = description.trim().length;
  const canSubmit = trimmedLength >= 10 && !submitting;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/72 px-4 backdrop-blur-md">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div className="relative z-[161] w-full max-w-[620px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0f0f10]/98 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_30%)]" />

        <div className="relative p-6 sm:p-7">
          <div className="mb-5">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/15 bg-amber-500/10 text-amber-200">
                <BugIcon />
              </span>
              <span>Bug report</span>
            </div>

            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-white">
              Report a bug
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Describe what happened, what you expected, and optionally attach a
              screenshot.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              What happened?
            </label>

            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={6}
              maxLength={1000}
              placeholder="Example: I clicked Report bug, but the menu closed and nothing happened. I expected a confirmation message."
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">{trimmedLength} / 1000</div>
              {error ? <div className="text-xs text-amber-300">{error}</div> : null}
              {!error && success ? (
                <div className="text-xs text-emerald-300">{success}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Screenshot (optional)
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                onScreenshotChange(file);
              }}
            />

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {screenshot ? "Change image" : "Upload image"}
                </button>

                {screenshot ? (
                  <button
                    type="button"
                    onClick={() => {
                      onScreenshotChange(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    disabled={submitting}
                    className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </button>
                ) : null}

                <div className="text-xs text-zinc-500">
                  PNG, JPG, WEBP, GIF, AVIF up to 5 MB
                </div>
              </div>

              {screenshot ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Bug screenshot preview"
                      className="max-h-[260px] w-full object-contain"
                    />
                  ) : null}

                  <div className="border-t border-white/10 px-3 py-2 text-xs text-zinc-400">
                    {screenshot.name}
                  </div>
                </div>
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
              {submitting ? "Sending..." : "Send bug report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}