import React from "react";
import { Link, Outlet } from "react-router-dom";

export function AppLayout(): React.JSX.Element {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <Link
            to="/"
            style={{
              fontWeight: 700,
              fontSize: "17px",
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            IntellMeet
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              to="/"
              style={{ color: "var(--ink-soft)", textDecoration: "none", fontSize: "15px" }}
            >
              Dashboard
            </Link>
            <Link
              to="/meetings"
              style={{ color: "var(--ink-soft)", textDecoration: "none", fontSize: "15px" }}
            >
              Meetings
            </Link>
            <Link
              to="/tasks"
              style={{ color: "var(--ink-soft)", textDecoration: "none", fontSize: "15px" }}
            >
              Tasks
            </Link>
            <Link
              to="/analytics"
              style={{ color: "var(--ink-soft)", textDecoration: "none", fontSize: "15px" }}
            >
              Analytics
            </Link>
            <Link
              to="/settings"
              style={{ color: "var(--ink-soft)", textDecoration: "none", fontSize: "15px" }}
            >
              Settings
            </Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            to="/login"
            style={{ color: "var(--ink-soft)", textDecoration: "none", fontSize: "15px" }}
          >
            Log in
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: "24px" }}>
        <Outlet />
      </main>
    </div>
  );
}

