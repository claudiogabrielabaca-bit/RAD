"use client";

import Link from "next/link";

export default function AuthRequiredModal({
  open,
  onClose,
  title = "Create an account to continue",
  description = "You need to log in or register to save favorite days, rate, reply, and make your activity count in the stats.",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Account required
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            Close
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <div className="text-sm font-medium text-amber-200">
            Without logging in:
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-100/85">
            <li>• You can explore days freely</li>
            <li>• You cannot save favorites</li>
            <li>• You cannot rate or reply</li>
            <li>• Your actions will not affect stats</li>
          </ul>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Create account
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}