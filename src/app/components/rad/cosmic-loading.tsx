"use client";

export default function CosmicLoading({
  open,
  label = "",
}: {
  open: boolean;
  label?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/78 backdrop-blur-md">
      <div className="relative flex flex-col items-center justify-center px-6 text-center">
        <div className="absolute left-[-22px] top-[52px] h-12 w-12 rounded-full bg-white/15 blur-2xl" />

        <div className="flex items-center gap-4">
          <span className="h-6 w-6 animate-[radDot_1.1s_ease-in-out_infinite] rounded-full bg-[#3b3b3b]" />
          <span className="h-7 w-7 animate-[radDot_1.1s_ease-in-out_0.12s_infinite] rounded-full bg-[#5a5a5a]" />
          <span className="h-6 w-6 animate-[radDot_1.1s_ease-in-out_0.24s_infinite] rounded-full bg-[#777777]" />
          <span className="h-5 w-5 animate-[radDot_1.1s_ease-in-out_0.36s_infinite] rounded-full bg-[#9a9a9a]" />
        </div>

        <div className="mt-7 text-lg font-semibold text-white">
          {label}
        </div>

        <div className="mt-2 max-w-md text-sm text-zinc-400">
          Looking for a meaningful moment in history...
        </div>
      </div>

      <style jsx global>{`
        @keyframes radDot {
          0%, 100% {
            transform: translateY(0) scale(0.92);
            opacity: 0.55;
          }
          50% {
            transform: translateY(-4px) scale(1.08);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}