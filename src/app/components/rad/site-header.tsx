"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthModal, { type AuthView } from "@/app/components/rad/auth-modal";
import ReportBugModal from "@/app/components/rad/report-bug-modal";
import {
  BellIcon,
  BugIcon,
  FeedIcon,
  HeaderNavButton,
  HeaderNavLink,
  ImportantDaysIcon,
  LockIcon,
  LogoutIcon,
  MenuIconBadge,
  NotificationSoundIcon,
  PencilIcon,
  RankedDaysIcon,
  SearchIcon,
} from "@/app/components/rad/site-header-parts";
import {
  NOTIFICATIONS_MUTED_STORAGE_KEY,
  NOTIFICATIONS_POLL_INTERVAL_MS,
  buildNotificationHref,
  clearNotificationsClientCache,
  fetchNotificationsClientCached,
  formatNotificationTime,
  type HeaderNotification,
} from "@/app/components/rad/site-header-notifications";
import { fetchCurrentUserClientCached } from "@/app/lib/current-user-client";

type HeaderUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
} | null;

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

  const loadNotifications = useCallback(
    async (options: { force?: boolean } = {}) => {
      const userId = currentUser?.id;

      if (!userId) return;

      try {
        setLoadingNotifications(true);

        const data = await fetchNotificationsClientCached(userId, {
          force: options.force,
        });

        if (!data) {
          return;
        }

        setNotifications(data.items);
        setUnreadNotifications(data.unreadCount);
      } catch {
        // Notification refresh failures are intentionally silent.
      } finally {
        setLoadingNotifications(false);
      }
    },
    [currentUser?.id]
  );

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

    async function loadMe(options: { force?: boolean } = {}) {
      try {
        setIsLoadingUser(true);

        const user = await fetchCurrentUserClientCached({
          force: options.force,
        });

        if (!cancelled) {
          setCurrentUser(user);

          if (!user) {
            setNotifications([]);
            setUnreadNotifications(0);
          }
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
      void loadMe({ force: true });
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
    if (currentUser?.id) return;

    setNotifications([]);
    setUnreadNotifications(0);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    void loadNotifications({ force: true });

    const interval = window.setInterval(() => {
      void loadNotifications({ force: true });
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
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

    await loadNotifications({ force: true });
  }

  async function handleNotificationClick(item: HeaderNotification) {
    setNotificationsOpen(false);

    if (!item.isRead) {
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, isRead: true } : entry
        )
      );

      clearNotificationsClientCache();

      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notificationId: item.id,
          }),
        });
      } catch {
        //
      }
    }

    router.push(buildNotificationHref(item));
  }

  async function handleClearNotifications() {
    try {
      setClearingNotifications(true);
      clearNotificationsClientCache();

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
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void handleNotificationClick(item)}
                            className={`block w-full rounded-[14px] border px-3 py-3 text-left transition ${
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
                          </button>
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
