"use client";

export function renderStars(stars: number) {
  const safeStars = Math.max(0, Math.min(5, stars));

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${safeStars} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={index < safeStars ? "text-yellow-400" : "text-zinc-700"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}
