import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import { getSocket } from "../lib/socket.js";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem,
} from "../lib/notifications.js";
import { Bell, LogOut, Menu, X, CheckSquare, FileText } from "lucide-react";

function formatRelativeTime(dateString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function AppLayout(): React.JSX.Element {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(typeof data?.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // Non-blocking error for notification loading
    }
  }, []);

  // Initial load and socket listeners
  useEffect(() => {
    if (!user) return;

    loadNotifications();

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const handleNewNotification = (item: NotificationItem) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === item.id)) return prev;
        if (!item.read) {
          setUnreadCount((c) => c + 1);
        }
        return [item, ...prev.slice(0, 49)];
      });
      setLiveAnnouncement(`New notification: ${item.message}`);
    };

    const handleReconnect = () => {
      loadNotifications();
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("connect", handleReconnect);
    };
  }, [user, loadNotifications]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!notifDropdownOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotifDropdownOpen(false);
        bellButtonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(target)
      ) {
        setNotifDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notifDropdownOpen]);

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  const handleToggleNotifications = () => {
    setNotifDropdownOpen((prev) => !prev);
  };

  const handleItemClick = (item: NotificationItem) => {
    setNotifDropdownOpen(false);
    if (!item.read) {
      setNotifications((prev) =>
        (Array.isArray(prev) ? prev : []).map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationAsRead(item.id).catch(() => {});
    }
    navigate(item.link);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => (Array.isArray(prev) ? prev : []).map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsAsRead();
    } catch {
      // optimistic update retained
    }
  };

  const navLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/meetings", label: "Meetings" },
    { to: "/tasks", label: "Tasks" },
    { to: "/analytics", label: "Analytics" },
    { to: "/settings", label: "Settings" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--ground)" }}>
      {/* Polite live region for screen readers */}
      <div aria-live="polite" className="sr-only" role="status">
        {liveAnnouncement}
      </div>

      {/* Top frame bar */}
      <header
        style={{
          height: "48px",
          borderBottom: "1px solid var(--rule)",
          backgroundColor: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <Link
            to="/dashboard"
            style={{
              fontWeight: 700,
              fontSize: "17px",
              color: "var(--ink)",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            IntellMeet
          </Link>

          {/* Desktop Navigation */}
          <nav className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                style={({ isActive }) => ({
                  color: isActive ? "var(--ink)" : "var(--ink-soft)",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "15px",
                  textDecoration: "none",
                  borderBottom: isActive ? "2px solid var(--ink)" : "2px solid transparent",
                  padding: "12px 0 10px 0",
                  transition: "color 120ms ease",
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right side controls: Notification bell & Account menu */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative" }}>
          {/* Notification bell */}
          <div style={{ position: "relative" }}>
            <button
              ref={bellButtonRef}
              type="button"
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
              aria-expanded={notifDropdownOpen}
              aria-haspopup="true"
              onClick={handleToggleNotifications}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px",
                borderRadius: "var(--radius)",
                position: "relative",
              }}
              title={unreadCount > 0 ? `${unreadCount} unread notifications` : "No unread notifications"}
            >
              <Bell size={18} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span
                  data-testid="notification-badge"
                  style={{
                    position: "absolute",
                    top: "0px",
                    right: "-2px",
                    minWidth: "16px",
                    height: "16px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: "var(--signal)",
                    color: "var(--on-signal)",
                    fontSize: "10px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {notifDropdownOpen && (
              <div
                ref={dropdownRef}
                role="menu"
                aria-label="Notifications list"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "360px",
                  maxHeight: "440px",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius)",
                  boxShadow: "var(--shadow-menu)",
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--rule)",
                    backgroundColor: "var(--ground)",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        fontSize: "12px",
                        color: "var(--ink-soft)",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div style={{ overflowY: "auto", flex: 1, maxHeight: "380px" }}>
                  {notifications.length === 0 ? (
                    <div
                      style={{
                        padding: "36px 16px",
                        textAlign: "center",
                        fontSize: "13px",
                        color: "var(--ink-soft)",
                      }}
                    >
                      No notifications
                    </div>
                  ) : (
                    (Array.isArray(notifications) ? notifications : []).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleItemClick(item)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          backgroundColor: item.read ? "transparent" : "var(--ground)",
                          border: "none",
                          borderBottom: "1px solid var(--rule)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ marginTop: "2px", color: "var(--ink-soft)", flexShrink: 0 }}>
                          {item.type === "TASK_ASSIGNED" ? (
                            <CheckSquare size={16} strokeWidth={1.75} />
                          ) : (
                            <FileText size={16} strokeWidth={1.75} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              color: "var(--ink)",
                              fontWeight: item.read ? 400 : 600,
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                            }}
                          >
                            {item.message}
                          </p>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--ink-soft)",
                              marginTop: "3px",
                              display: "inline-block",
                            }}
                          >
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        {!item.read && (
                          <span
                            aria-label="Unread"
                            style={{
                              width: "7px",
                              height: "7px",
                              borderRadius: "var(--radius-full)",
                              backgroundColor: "var(--signal)",
                              marginTop: "6px",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Account & Sign out */}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: 500, color: "var(--ink)" }}>
                  {user.name}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-chip)",
                    backgroundColor: "var(--ground)",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  {user.role}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign out"
                style={{
                  background: "transparent",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius)",
                  padding: "4px 8px",
                  fontSize: "13px",
                  color: "var(--ink)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <LogOut size={14} strokeWidth={1.75} />
                <span>Sign out</span>
              </button>
            </div>
          )}

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-btn"
            style={{
              display: "none",
              background: "transparent",
              border: "none",
              color: "var(--ink)",
              cursor: "pointer",
              padding: "6px",
            }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderBottom: "1px solid var(--rule)",
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontSize: "15px",
                color: "var(--ink)",
                textDecoration: "none",
                padding: "8px 0",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      {/* Main content body */}
      <main style={{ flex: 1, padding: "24px", maxWidth: "1120px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <Outlet />
      </main>
    </div>
  );
}
