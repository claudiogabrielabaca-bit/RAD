"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthModal, { type AuthView } from "@/app/components/rad/auth-modal";
import ReportBugModal from "@/app/components/rad/report-bug-modal";

type HeaderUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
} | null;

type HeaderNotification = {
  id: string;
  type: "review_liked" | "review_replied" | "reply_liked";
  day: string | null;
  isRead: boolean;
  createdAt: string;
  actorUsername: string;
  message: string;
};

type NotificationsResponse = {
  items: HeaderNotification[];
  unreadCount: number;
};

const NOTIFICATIONS_MUTED_STORAGE_KEY = "rad:notifications-muted";

function formatNotificationTime(value: string) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function SearchIcon() {
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

function FeedIcon() {
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

function ImportantDaysIcon() {
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

function RankedDaysIcon() {
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

function LockIcon() {
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

function PencilIcon() {
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

function BellIcon() {
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

function NotificationSoundIcon({ muted }: { muted: boolean }) {
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

function BugIcon() {
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

function LogoutIcon() {
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

function HeaderNavLink({
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

function HeaderNavButton({
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

function MenuIconBadge({
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

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [authView, setAuthView] = useState<AuthView>("login");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<HeaderUser>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [clearingNotifications, setClearingNotifications] = useState(false);

  const [reportBugOpen, setReportBugOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const [bugScreenshot, setBugScreenshot] = useState<File | null>(null);
  const [reportBugSubmitting, setReportBugSubmitting] = useState(false);
  const [reportBugError, setReportBugError] = useState("");
  const [reportBugSuccess, setReportBugSuccess] = useState("");

  const menuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousUnreadCountRef = useRef(0);
  const notificationsBootedRef = useRef(false);

  const isDiscoverActive = pathname === "/";
  const isFeedActive = pathname === "/feed";
  const isImportantDaysActive = pathname === "/important-days";
  const isRankedActive = pathname === "/ranked-days";

  const loadNotifications = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      setLoadingNotifications(true);

      const res = await fetch("/api/notifications", {
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as
        | NotificationsResponse
        | null;

      if (!res.ok) {
        return;
      }

      setNotifications(data?.items ?? []);
      setUnreadNotifications(data?.unreadCount ?? 0);
    } catch {
      //
    } finally {
      setLoadingNotifications(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTIFICATIONS_MUTED_STORAGE_KEY);
      setNotificationsMuted(raw === "1");
    } catch {
      setNotificationsMuted(false);
    }
  }, []);

  useEffect(() => {
    const audio = new Audio("/sounds/notification.mp3");
    audio.preload = "auto";
    notificationAudioRef.current = audio;

    return () => {
      notificationAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const previousUnread = previousUnreadCountRef.current;

    if (!notificationsBootedRef.current) {
      previousUnreadCountRef.current = unreadNotifications;
      notificationsBootedRef.current = true;
      return;
    }

    const hasNewNotifications = unreadNotifications > previousUnread;

    if (hasNewNotifications && !notificationsMuted && currentUser) {
      const audio = notificationAudioRef.current;

      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }

    previousUnreadCountRef.current = unreadNotifications;
  }, [unreadNotifications, notificationsMuted, currentUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      try {
        setIsLoadingUser(true);

        const res = await fetch("/api/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          if (!cancelled) {
            setCurrentUser(null);
            setNotifications([]);
            setUnreadNotifications(0);
          }
          return;
        }

        const data = await res.json();

        const user =
          data && typeof data === "object" && "user" in data
            ? (data.user ?? null)
            : (data ?? null);

        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setNotifications([]);
          setUnreadNotifications(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUser(false);
        }
      }
    }

    void loadMe();

    const handleAuthChanged = () => {
      void loadMe();
    };

    window.addEventListener("rad-auth-changed", handleAuthChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("rad-auth-changed", handleAuthChanged);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!currentUser?.id) return;

    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser?.id, loadNotifications]);

  useEffect(() => {
    if (!menuOpen && !notificationsOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      const clickedInsideMenu = menuRef.current?.contains(target);
      const clickedInsideNotifications =
        notificationsRef.current?.contains(target);

      if (clickedInsideMenu || clickedInsideNotifications) {
        return;
      }

      setMenuOpen(false);
      setNotificationsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, notificationsOpen]);

  const openLogin = () => {
    setAuthView("login");
    setIsAuthOpen(true);
  };

  const openRegister = () => {
    setAuthView("register");
    setIsAuthOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthOpen(false);
  };

  function toggleNotificationsMuted() {
    setNotificationsMuted((prev) => {
      const next = !prev;

      try {
        window.localStorage.setItem(
          NOTIFICATIONS_MUTED_STORAGE_KEY,
          next ? "1" : "0"
        );
      } catch {
        //
      }

      return next;
    });
  }

  async function handleOpenNotifications() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    setMenuOpen(false);

    if (!nextOpen || !currentUser) return;

    await loadNotifications();

    if (unreadNotifications > 0) {
      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        //
      } finally {
        setUnreadNotifications(0);
        setNotifications((prev) =>
          prev.map((item) => ({ ...item, isRead: true }))
        );
      }
    }
  }

  async function handleClearNotifications() {
    try {
      setClearingNotifications(true);

      const res = await fetch("/api/notifications/clear", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        return;
      }

      setNotifications([]);
      setUnreadNotifications(0);
      previousUnreadCountRef.current = 0;
    } catch {
      //
    } finally {
      setClearingNotifications(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      //
    } finally {
      setMenuOpen(false);
      setNotificationsOpen(false);
      setCurrentUser(null);
      setNotifications([]);
      setUnreadNotifications(0);
      previousUnreadCountRef.current = 0;
      notificationsBootedRef.current = false;
      window.dispatchEvent(new Event("rad-auth-changed"));
      router.push("/");
      router.refresh();
    }
  }

  function openBugReport() {
    setMenuOpen(false);
    setReportBugError("");
    setReportBugSuccess("");
    setBugDescription("");
    setBugScreenshot(null);
    setReportBugOpen(true);
  }

  async function submitBugReport() {
    const trimmed = bugDescription.trim();

    if (trimmed.length < 10) {
      setReportBugError("Bug description must be at least 10 characters.");
      return;
    }

    setReportBugSubmitting(true);
    setReportBugError("");
    setReportBugSuccess("");

    try {
      const formData = new FormData();
      formData.append("description", trimmed);
      formData.append("pagePath", pathname || "");
      formData.append("pageUrl", window.location.href);
      formData.append("userAgent", navigator.userAgent);

      if (bugScreenshot) {
        formData.append("screenshot", bugScreenshot);
      }

      const res = await fetch("/api/report-bug", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setReportBugError(json?.error ?? "Could not send bug report.");
        return;
      }

      setReportBugSuccess("Bug report sent.");
      setBugDescription("");
      setBugScreenshot(null);

      window.setTimeout(() => {
        setReportBugOpen(false);
        setReportBugSuccess("");
      }, 900);
    } catch {
      setReportBugError("Could not send bug report.");
    } finally {
      setReportBugSubmitting(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-black/78 backdrop-blur-xl">
        <div className="relative flex h-20 w-full items-center justify-center px-5 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            <HeaderNavLink
              href="/"
              active={isDiscoverActive}
              icon={<SearchIcon />}
            >
              Discover
            </HeaderNavLink>

            <HeaderNavLink
              href="/feed"
              active={isFeedActive}
              icon={<FeedIcon />}
            >
              Feed
            </HeaderNavLink>

            <HeaderNavLink
              href="/important-days"
              active={isImportantDaysActive}
              icon={<ImportantDaysIcon />}
            >
              Important Days
            </HeaderNavLink>

            <HeaderNavLink
              href="/ranked-days"
              active={isRankedActive}
              icon={<RankedDaysIcon />}
            >
              Ranked Days
            </HeaderNavLink>

            {!isLoadingUser && !currentUser ? (
              <>
                <HeaderNavButton onClick={openLogin} icon={<LockIcon />}>
                  Log in
                </HeaderNavButton>

                <HeaderNavButton
                  onClick={openRegister}
                  icon={<PencilIcon />}
                  strong
                >
                  Register
                </HeaderNavButton>
              </>
            ) : null}
          </nav>

          {isLoadingUser ? null : currentUser ? (
            <div className="absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-5 sm:right-6 lg:right-8">
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={handleOpenNotifications}
                  aria-label="Open notifications"
                  aria-expanded={notificationsOpen}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-white/88 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <BellIcon />

                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-black">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="absolute right-0 top-[calc(100%+10px)] w-[360px] overflow-hidden rounded-[20px] border border-white/10 bg-[#111111]/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <div className="border-b border-white/6 px-3 pb-3 pt-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                            Notifications
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">
                            {unreadNotifications} unread
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={toggleNotificationsMuted}
                            title={
                              notificationsMuted
                                ? "Activar sonido"
                                : "Silenciar sonido"
                            }
                            aria-label={
                              notificationsMuted
                                ? "Activar sonido"
                                : "Silenciar sonido"
                            }
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] border transition ${
                              notificationsMuted
                                ? "border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
                                : "border-white/8 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
                            }`}
                          >
                            <NotificationSoundIcon muted={notificationsMuted} />
                          </button>

                          <button
                            type="button"
                            onClick={handleClearNotifications}
                            disabled={
                              clearingNotifications ||
                              notifications.length === 0
                            }
                            className="inline-flex rounded-[10px] border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {clearingNotifications ? "Clearing..." : "Clear"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {loadingNotifications ? (
                      <div className="space-y-2 p-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-16 animate-pulse rounded-[14px] bg-white/[0.05]"
                          />
                        ))}
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="rounded-[14px] px-4 py-5 text-sm text-zinc-400">
                        No notifications yet.
                      </div>
                    ) : (
                      <div className="max-h-[380px] space-y-2 overflow-y-auto p-2">
                        {notifications.map((item) => (
                          <Link
                            key={item.id}
                            href={
                              item.day
                                ? `/?day=${encodeURIComponent(item.day)}`
                                : "/"
                            }
                            onClick={() => setNotificationsOpen(false)}
                            className={`block rounded-[14px] border px-3 py-3 transition ${
                              item.isRead
                                ? "border-white/6 bg-white/[0.03] hover:bg-white/[0.05]"
                                : "border-white/10 bg-white/[0.06] hover:bg-white/[0.08]"
                            }`}
                          >
                            <div className="text-sm font-medium text-white">
                              {item.message}
                            </div>

                            <div className="mt-1 text-xs text-zinc-400">
                              {item.day ? item.day : "Unknown day"} •{" "}
                              {formatNotificationTime(item.createdAt)}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <Link
                href="/profile"
                className="inline-flex h-10 items-center text-[14px] font-semibold text-white transition hover:text-white/80"
              >
                @{currentUser.username}
              </Link>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((prev) => !prev);
                    setNotificationsOpen(false);
                  }}
                  aria-label="Open account menu"
                  aria-expanded={menuOpen}
                  className="inline-flex h-10 items-center text-[20px] leading-none text-white/88 transition hover:text-white"
                >
                  <span className="relative -top-[3px] tracking-[0.08em]">
                    …
                  </span>
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+10px)] min-w-[220px] overflow-hidden rounded-[18px] border border-white/10 bg-[#111111]/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={openBugReport}
                      className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-sm text-amber-100 transition hover:bg-amber-500/10 hover:text-amber-50"
                    >
                      <MenuIconBadge icon={<BugIcon />} tone="bug" />
                      <span>Report bug</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-500/10 hover:text-red-100"
                    >
                      <MenuIconBadge icon={<LogoutIcon />} tone="danger" />
                      <span>Log out</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <AuthModal
        open={isAuthOpen}
        view={authView}
        initialEmail={undefined}
        onClose={closeAuthModal}
        onChangeView={(view) => {
          setAuthView(view);
        }}
        onAuthSuccess={() => {
          closeAuthModal();
          window.dispatchEvent(new Event("rad-auth-changed"));
        }}
      />

      <ReportBugModal
        open={reportBugOpen}
        description={bugDescription}
        onDescriptionChange={setBugDescription}
        screenshot={bugScreenshot}
        onScreenshotChange={setBugScreenshot}
        onClose={() => {
          if (reportBugSubmitting) return;
          setReportBugOpen(false);
          setReportBugError("");
          setReportBugSuccess("");
        }}
        onSubmit={submitBugReport}
        submitting={reportBugSubmitting}
        error={reportBugError}
        success={reportBugSuccess}
      />
    </>
  );
}