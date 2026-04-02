"use client";

import React, { useEffect, useRef, useState } from "react";

type ReviewActionsMenuProps = {
  onEdit: () => void;
  onCreatePost: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

export default function ReviewActionsMenu({
  onEdit,
  onCreatePost,
  onDelete,
  disabled = false,
}: ReviewActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open review actions"
        title="Open review actions"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#121212]/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.025),transparent_24%)]" />

          <div className="relative p-2">
            <button
              type="button"
              onClick={() => runAction(onEdit)}
              className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
            >
              Edit review
            </button>

            <button
              type="button"
              onClick={() => runAction(onCreatePost)}
              className="mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
            >
              Create post
            </button>

            <div className="my-2 h-px bg-white/8" />

            <button
              type="button"
              onClick={() => runAction(onDelete)}
              className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
            >
              Delete review
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}