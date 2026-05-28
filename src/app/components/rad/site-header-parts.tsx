"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function FeedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h8" />
    </svg>
  );
}

export function ImportantDaysIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 13.9 8.1 19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
    </svg>
  );
}

export function RankedDaysIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H5a2 2 0 0 0 0 4h2" />
      <path d="M17 5h2a2 2 0 1 1 0 4h-2" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
      <path d="M12 15v2" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 17H5.5a1 1 0 0 1-.8-1.6L6 13.67V10a6 6 0 1 1 12 0v3.67l1.3 1.73a1 1 0 0 1-.8 1.6H15" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

export function NotificationSoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[16px] w-[16px]"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 8 8H5v8h3l3 3V5Z" />
      {!muted ? (
        <>
          <path d="M15.5 9.5a4 4 0 0 1 0 5" />
          <path d="M18 7a7.5 7.5 0 0 1 0 10" />
        </>
      ) : (
        <path d="M4 4 20 20" />
      )}
    </svg>
  );
}

export function BugIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
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

export function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h-5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
      <path d="M10 12h10" />
      <path d="m16 8 4 4-4 4" />
    </svg>
  );
}

export function HeaderNavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center gap-3 rounded-2xl px-2 text-[15px] font-semibold tracking-[-0.01em] transition ${
        active ? "text-white" : "text-white/78 hover:text-white"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </Link>
  );
}

export function HeaderNavButton({
  onClick,
  icon,
  children,
  strong = false,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-3 rounded-2xl px-2 text-[15px] tracking-[-0.01em] transition ${
        strong
          ? "font-semibold text-white hover:text-white/82"
          : "font-medium text-white/78 hover:text-white"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </button>
  );
}

export function MenuIconBadge({
  icon,
  tone = "default",
}: {
  icon: ReactNode;
  tone?: "default" | "danger" | "bug";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-500/10 text-red-200 border-red-400/15"
      : tone === "bug"
        ? "bg-amber-500/10 text-amber-200 border-amber-400/15"
        : "bg-white/[0.05] text-zinc-200 border-white/10";

  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${toneClass}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
