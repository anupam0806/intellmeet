import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import { Bell, LogOut, Menu, X } from "lucide-react";

export function AppLayout(): React.JSX.Element {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
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
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Notification bell */}
          <button
            type="button"
            aria-label="Notifications"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-soft)",
              display: "flex",
              alignItems: "center",
              padding: "6px",
              borderRadius: "var(--radius)",
            }}
            title="0 unread notifications"
          >
            <Bell size={18} strokeWidth={1.75} />
          </button>

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
