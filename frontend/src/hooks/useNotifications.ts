import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceId?: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

interface UseNotificationsReturn {
  unreadCount: number;
  notifications: Notification[];
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.getUnreadNotificationCount();
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect to SSE for real-time notifications using fetch (supports Authorization header)
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const url = `${api.getBaseUrl()}/notifications/stream`;
    const controller = new AbortController();

    const connectSSE = async () => {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                setUnreadCount((prev) => prev + 1);
                setNotifications((prev) => [
                  {
                    id: data.id || data.notificationId,
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    data: data.data,
                    referenceId: data.referenceId,
                    isRead: false,
                    createdAt: data.createdAt || new Date().toISOString(),
                  },
                  ...prev,
                ]);
              } catch {
                // skip malformed events
              }
            }
          }
        }
      } catch {
        // Fallback to polling when SSE fails
      }
    };

    connectSSE();

    return () => {
      controller.abort();
      eventSourceRef.current = null;
    };
  }, []);

  // Fetch full notifications list & unread count on mount and interval
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => {
        const removed = prev.find((n) => n.id === id);
        if (removed && !removed.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch {
      // ignore
    }
  }, []);

  return {
    unreadCount,
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  };
}
