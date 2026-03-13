"use client";

const REPLY_MAX_LENGTH = 220;
const REVIEW_MAX_LENGTH = 280;

export default function ReplyComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  sending,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  sending?: boolean;
}) {
  const count = value.length;
  const nearLimit = count >= REPLY_MAX_LENGTH - 30;
  const atLimit = count >= REPLY_MAX_LENGTH;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, REPLY_MAX_LENGTH))}
        maxLength={REPLY_MAX_LENGTH}
        placeholder="Write a reply..."
        className="h-24 w-full resize-none rounded-xl border border-white/10 bg-[#07101f]/75 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <div
          className={`text-xs ${
            atLimit
              ? "text-red-400"
              : nearLimit
                ? "text-amber-300"
                : "text-zinc-500"
          }`}
        >
          {count} / {REPLY_MAX_LENGTH}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={sending || count === 0}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending..." : "Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}