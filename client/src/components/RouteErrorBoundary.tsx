import React, { useEffect } from "react";
import { useRouteError, Link } from "react-router-dom";

export function RouteErrorBoundary(): React.JSX.Element {
  const error = useRouteError();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error("Route error boundary caught render error:", error);
    }
  }, [error]);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--ground)",
        color: "var(--ink)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--radius)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            lineHeight: 1.25,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Something went wrong on this page.
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "var(--ink-soft)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          An unexpected error occurred while rendering this view. You can reload the page or return to the dashboard.
        </p>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={handleReload}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--signal)",
              color: "var(--on-signal)",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "var(--radius)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <Link
            to="/dashboard"
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--surface)",
              color: "var(--ink)",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "var(--radius)",
              border: "1px solid var(--rule)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

