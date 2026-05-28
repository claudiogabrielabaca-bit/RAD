import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTIFICATIONS_MUTED_STORAGE_KEY,
  NOTIFICATIONS_POLL_INTERVAL_MS,
  buildNotificationHref,
  clearNotificationsClientCache,
  fetchNotificationsClientCached,
  type HeaderNotification,
} from "@/app/components/rad/site-header-notifications";

type NotificationUser = {
  id: string;
} | null;

export function useSiteHeaderNotifications({
  currentUser,
  onNavigate,
  onCloseMenu,
}: {
  currentUser: NotificationUser;
  onNavigate: (href: string) => void;
  onCloseMenu: () => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [clearingNotifications, setClearingNotifications] = useState(false);

  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousUnreadCountRef = useRef(0);
  const notificationsBootedRef = useRef(false);

  const resetNotifications = useCallback(() => {
    setNotificationsOpen(false);
    setNotifications([]);
    setUnreadNotifications(0);
    previousUnreadCountRef.current = 0;
    notificationsBootedRef.current = false;
  }, []);

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

    if (hasNewNotifications && !notificationsMuted && currentUser?.id) {
      const audio = notificationAudioRef.current;

      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }

    previousUnreadCountRef.current = unreadNotifications;
  }, [unreadNotifications, notificationsMuted, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) return;

    resetNotifications();
  }, [currentUser?.id, resetNotifications]);

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

  const toggleNotificationsMuted = useCallback(() => {
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
  }, []);

  const handleOpenNotifications = useCallback(async () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    onCloseMenu();

    if (!nextOpen || !currentUser) return;

    await loadNotifications({ force: true });
  }, [notificationsOpen, currentUser, loadNotifications, onCloseMenu]);

  const handleNotificationClick = useCallback(
    async (item: HeaderNotification) => {
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

      onNavigate(buildNotificationHref(item));
    },
    [onNavigate]
  );

  const handleClearNotifications = useCallback(async () => {
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
  }, []);

  return {
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    unreadNotifications,
    loadingNotifications,
    notificationsMuted,
    clearingNotifications,
    notificationsRef,
    resetNotifications,
    toggleNotificationsMuted,
    handleOpenNotifications,
    handleNotificationClick,
    handleClearNotifications,
  };
}
