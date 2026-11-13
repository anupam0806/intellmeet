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
import { IntellMeetGlyph } from "./IntellMeetGlyph.js";

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

  // Desktop media query check (>= 1024px)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(min-width: 1024px)").matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      if (e.matches) {
        setMobileMenuOpen(false);
      }
    };
    setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobilePanelRef = useRef<HTMLDialogElement | null>(null);
  const prevMenuOpenRef = useRef(mobileMenuOpen);

  // Return focus to menu button on close
  useEffect(() => {
    if (prevMenuOpenRef.current && !mobileMenuOpen) {
      menuButtonRef.current?.focus();
    }
    prevMenuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  // Focus trap, escape key, and scroll lock for mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus to first focusable element inside mobile menu panel
    const panel = mobilePanelRef.current;
    if (panel) {
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length > 0) {
        focusable[0]?.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && panel) {
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable.at(-1);

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

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

    void loadNotifications();

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
      void loadNotifications();
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
    void navigate("/login");
  };

  const handleToggleNotifications = () => {
    setNotifDropdownOpen((prev) => {
      const next = !prev;
      if (next) {
        setMobileMenuOpen(false);
      }
      return next;
    });
  };

  const handleToggleMobileMenu = () => {
    setMobileMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setNotifDropdownOpen(false);
      }
      return next;
    });
  };

  const handleItemClick = (item: NotificationItem) => {
    setNotifDropdownOpen(false);
    if (!item.read) {
      setNotifications((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((n) => (n.id === item.id ? { ...n, read: true } : n));
      });
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationAsRead(item.id).catch(() => {});
    }
    void navigate(item.link);
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

  const notificationList = Array.isArray(notifications) ? notifications : [];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--ground)", position: "relative" }}>
      <div className="ambient-top-glow" aria-hidden="true" />
      {/* Skip to main content link for keyboard & screen reader accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only"
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 100,
          backgroundColor: "var(--surface)",
          color: "var(--ink)",
          padding: "8px 16px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--rule)",
          fontWeight: 600,
          fontSize: "13px",
          textDecoration: "none",
        }}
      >
        Skip to content
      </a>

      {/* Polite live region for screen readers */}
      <div aria-live="polite" className="sr-only" role="status">
        {liveAnnouncement}
      </div>

      {/* Top frame bar */}
      <header
        style={{
          height: "56px",
          borderBottom: "1px solid var(--rule)",
          backgroundColor: "rgba(14, 15, 19, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
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
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontWeight: 700,
              fontSize: "17px",
              color: "var(--ink)",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            <IntellMeetGlyph size={26} />
            <span>IntellMeet</span>
          </Link>

          {/* Desktop Navigation */}
          {isDesktop && (
            <nav className="desktop-nav" aria-label="Main navigation" style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  style={({ isActive }) => ({
                    color: isActive ? "var(--ink)" : "var(--ink-soft)",
                    fontWeight: isActive ? 600 : 400,
                    fontSize: "14px",
                    textDecoration: "none",
                    borderBottom: isActive ? "2px solid var(--signal)" : "2px solid transparent",
                    padding: "16px 0 14px 0",
                    transition: "color 120ms ease, border-color 120ms ease",
                  })}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        {/* Right side controls: Notification bell & Account menu */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
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
                width: "44px",
                height: "44px",
                minWidth: "44px",
                minHeight: "44px",
                padding: 0,
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
                    top: "6px",
                    right: "6px",
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
                  width: "min(360px, calc(100vw - 32px))",
                  maxHeight: "440px",
                  backgroundColor: "rgba(14, 15, 19, 0.96)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius-card)",
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
                  {notificationList.length === 0 ? (
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
                    notificationList.map((item) => (
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

          {/* Account & Sign out on desktop only */}
          {isDesktop && user && (
            <div className="desktop-account" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          {!isDesktop && (
            <button
              ref={menuButtonRef}
              type="button"
              onClick={handleToggleMobileMenu}
              className="mobile-menu-btn"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ink)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                minWidth: "44px",
                minHeight: "44px",
                padding: 0,
                borderRadius: "var(--radius)",
              }}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu-panel"
            >
              {mobileMenuOpen ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
            </button>
          )}
        </div>
      </header>

      {/* Mobile nav panel and flat scrim */}
      {!isDesktop && mobileMenuOpen && (
        <>
          {/* Flat scrim behind drawer (no blur, no gradient) */}
          <div
            data-testid="mobile-menu-scrim"
            className="mobile-nav-scrim"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              zIndex: 45,
            }}
          />

          {/* Right drawer panel */}
          <dialog
            open
            id="mobile-menu-panel"
            ref={mobilePanelRef}
            aria-modal="true"
            aria-label="Navigation menu"
            className="mobile-menu-panel"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              height: "100%",
              width: "85%",
              maxWidth: "360px",
              backgroundColor: "var(--surface)",
              border: "none",
              borderLeft: "1px solid var(--rule)",
              boxShadow: "var(--shadow-menu)",
              display: "flex",
              flexDirection: "column",
              zIndex: 50,
              overflowY: "auto",
              margin: 0,
              padding: 0,
            }}
          >
            {/* Row 1: Account name and role (at least 44px tall, keyboard operable) */}
            {user && (
              <section
                aria-label="Account details"
                style={{
                  minHeight: "44px",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid var(--rule)",
                  backgroundColor: "var(--ground)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--ink)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {user.name}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--ink-soft)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {user.email}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-chip)",
                    backgroundColor: "var(--surface)",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--rule)",
                    flexShrink: 0,
                  }}
                >
                  {user.role}
                </span>
              </section>
            )}

            {/* Rows 2..6: Navigation Links (each at least 44px tall) */}
            <nav
              aria-label="Mobile navigation links"
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "8px 0",
              }}
            >
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  style={({ isActive }) => ({
                    minHeight: "44px",
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "15px",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--ink)" : "var(--ink-soft)",
                    backgroundColor: isActive ? "var(--ground)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--signal)" : "3px solid transparent",
                    textDecoration: "none",
                  })}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* Last row: Sign out (at least 44px tall) */}
            {user && (
              <div style={{ borderTop: "1px solid var(--rule)", padding: "12px 16px 20px 16px" }}>
                <button
                  type="button"
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await handleSignOut();
                  }}
                  style={{
                    minHeight: "44px",
                    width: "100%",
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "var(--error)",
                    backgroundColor: "transparent",
                    border: "1px solid var(--rule)",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <LogOut size={16} strokeWidth={1.75} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </dialog>
        </>
      )}

      {/* Main content body */}
      <main id="main-content" style={{ flex: 1, padding: "24px", maxWidth: "1120px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <Outlet />
      </main>
    </div>
  );
}
