import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { notificationService } from '@/services/services';
import { normalizeApiErrorMessage } from '@/services/api';
import type { Notification } from '@/types';
import { connectSocket, disconnectSocket, onNewNotification } from '@/services/socket';

export default function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notificationIds = useRef(new Set<string>());
  const hasLoadedHistory = useRef(false);
  const refreshNotifications = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let active = true;

    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setLoadError(false);
      notificationIds.current.clear();
      hasLoadedHistory.current = false;
      refreshNotifications.current = null;
      return () => {
        active = false;
      };
    }

    setNotifications([]);
    setUnreadCount(0);
    setLoading(true);
    setLoadError(false);
    notificationIds.current.clear();
    hasLoadedHistory.current = false;

    const loadNotifications = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      try {
        const [data, count] = await Promise.all([
          notificationService.getAll(),
          notificationService.getUnreadCount(),
        ]);
        if (!active) return;

        setNotifications((current) => {
          const merged = new Map<string, Notification>();
          for (const notification of [...data, ...current]) {
            merged.set(notification.id, notification);
          }
          const latest = [...merged.values()]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 10);
          notificationIds.current = new Set(latest.map((notification) => notification.id));
          return latest;
        });
        setUnreadCount(count);
        setLoadError(false);
        hasLoadedHistory.current = true;
      } catch (err) {
        if (!active) return;
        setLoadError(true);
        toast(normalizeApiErrorMessage(err), 'error');
      } finally {
        if (active && showLoading) setLoading(false);
      }
    };

    refreshNotifications.current = () => loadNotifications(!hasLoadedHistory.current);
    void loadNotifications(true);

    const token = localStorage.getItem('freshtrack_token') || sessionStorage.getItem('freshtrack_token');
    if (!token) {
      return () => {
        active = false;
        refreshNotifications.current = null;
      };
    }

    const socket = connectSocket(token);
    let hasConnected = socket.connected;
    const handleConnect = () => {
      if (!hasConnected) {
        hasConnected = true;
        return;
      }
      void loadNotifications(false);
    };
    socket.on('connect', handleConnect);
    const unsubscribe = onNewNotification((notification) => {
      if (notificationIds.current.has(notification.id)) return;
      notificationIds.current.add(notification.id);
      setNotifications((prev) => [notification, ...prev].slice(0, 10));
      if (!notification.read) setUnreadCount((count) => count + 1);
    });

    return () => {
      active = false;
      socket.off('connect', handleConnect);
      unsubscribe();
      disconnectSocket();
      refreshNotifications.current = null;
    };
  }, [user, toast]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const resolveNotificationTarget = (notification: Notification) => {
    if (!notification) return null;

    const isDirectOffer =
      (notification.requestId && notification.donationId && notification.requestId === notification.donationId) ||
      /offer(ed|s)?|direct offer/i.test(notification.message);

    if (isDirectOffer) {
      return notification.requestId ? `/offers/${notification.requestId}` : notification.donationId ? `/offers/${notification.donationId}` : null;
    }

    if (notification.requestId && notification.donationId) {
      return user?.role === 'ngo' ? `/food/${notification.donationId}` : `/donations/${notification.donationId}`;
    }

    if (notification.donationId) {
      return `/donations/${notification.donationId}`;
    }

    if (notification.requestId) {
      return `/donations/${notification.requestId}`;
    }

    return null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.read) {
        await notificationService.markRead(notification.id);
        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch {
      // Navigation should still work even if marking as read fails.
    } finally {
      setOpen(false);
    }

    if (!user) {
      return;
    }

    const target = resolveNotificationTarget(notification);
    if (!target) {
      return;
    }

    navigate(target);
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-16 right-4 mt-2 w-[calc(100vw-2rem)] max-w-80 md:absolute md:top-auto md:right-0 md:mt-2 md:w-80 bg-white rounded-xl shadow-lg border border-gray-200 animate-slide-down overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {!!notifications.length && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll || unreadCount === 0}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                >
                  {markingAll ? 'Updating...' : 'Mark all read'}
                </button>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
            ) : loadError && notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-600" role="alert">
                <p>Could not load notifications.</p>
                <button type="button" onClick={() => void refreshNotifications.current?.()} className="mt-2 font-medium text-primary-600 hover:text-primary-700">
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet.</div>
            ) : (
              <>
                {loadError && (
                  <div className="px-4 py-3 text-center text-xs text-red-700 bg-red-50" role="alert">
                    <p>Could not refresh notifications. Your loaded notifications are still shown.</p>
                    <button type="button" onClick={() => void refreshNotifications.current?.()} className="mt-1 font-medium underline">
                      Try again
                    </button>
                  </div>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? 'bg-primary-50/40' : ''}`}
                  >
                    <p className="text-sm text-gray-700">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
