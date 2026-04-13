import type { ReactNode } from "react";

export default function AuthModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-[91] w-full max-w-[560px] overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_26%)]" />

        <div className="relative p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                RAD Account
              </div>
              <h2 className="mt-2 text-[2.1rem] font-semibold tracking-tight text-white leading-none">
                {title}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
                {subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
