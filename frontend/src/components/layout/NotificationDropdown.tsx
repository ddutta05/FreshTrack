import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/services';
import type { Notification } from '@/types';
import { connectSocket, disconnectSocket, onNewNotification } from '@/services/socket';

export default function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const data = await notificationService.getAll();
        setNotifications(data);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    const token = localStorage.getItem('freshtrack_token');
    if (!token) return;

    connectSocket(token);
    const unsubscribe = onNewNotification((notification) => {
      setNotifications((prev) => {
        if (prev.some((item) => item.id === notification.id)) {
          return prev;
        }
        return [notification, ...prev];
      });
    });

    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, [user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 animate-slide-down overflow-hidden z-50">
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
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
