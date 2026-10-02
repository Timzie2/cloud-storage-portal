import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";

import { useAuth } from "../context/AuthContext";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notifications";

function formatNotificationTime(date) {
  const notificationDate = new Date(date);
  const now = new Date();

  const difference = Math.floor(
    (now - notificationDate) / 1000
  );

  if (difference < 60) {
    return "Just now";
  }

  if (difference < 3600) {
    return `${Math.floor(difference / 60)}m ago`;
  }

  if (difference < 86400) {
    return `${Math.floor(difference / 3600)}h ago`;
  }

  if (difference < 604800) {
    return `${Math.floor(difference / 86400)}d ago`;
  }

  return notificationDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function NotificationBell() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    loadNotifications();
  }, [user]);

  async function loadNotifications() {
    try {
      setLoading(true);

      const [notificationData, unread] = await Promise.all([
        getNotifications(user.id),
        getUnreadNotificationCount(user.id),
      ]);

      setNotifications(notificationData);
      setUnreadCount(unread);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  if (!open) return;

  function handleOutsideClick(event) {
    if (!notificationRef.current?.contains(event.target)) {
      setOpen(false);
    }
  }

  document.addEventListener("mousedown", handleOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
  };
}, [open]);

  async function handleNotificationClick(notification) {
    if (notification.is_read) return;

    try {
      await markNotificationAsRead(notification.id);

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item
        )
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  async function handleMarkAllAsRead() {
    if (!user || unreadCount === 0) return;

    try {
      await markAllNotificationsAsRead(user.id);

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  }

  return (
    <div className="notification-wrapper" ref={notificationRef}>
      <button
        className="notification-bell"
        onClick={() => setOpen((current) => !current)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <div>
              <h3>Notifications</h3>
              <span>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </span>
            </div>

            {unreadCount > 0 && (
              <button
                className="notification-mark-all"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
              >
                <CheckCheck size={16} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-empty">
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <div className="notification-empty-icon">
                  <Bell size={20} />
                </div>
                <strong>No notifications</strong>
                <p>
                  Activity and updates from your account will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={`notification-item ${
                    !notification.is_read
                      ? "unread"
                      : ""
                  }`}
                  onClick={() =>
                    handleNotificationClick(notification)
                  }
                >
                  <span className="notification-item-dot" />

                  <span className="notification-item-content">
                    <strong>{notification.title}</strong>

                    <span>{notification.message}</span>

                    <small>
                      {formatNotificationTime(
                        notification.created_at
                      )}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;