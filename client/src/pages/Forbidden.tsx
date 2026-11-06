import React from "react";
import { Link } from "react-router-dom";

export function Forbidden(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "48px 24px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "30px",
          fontWeight: 700,
          color: "var(--ink)",
          marginBottom: "12px",
          letterSpacing: "-0.01em",
        }}
      >
        403 — Access Denied
      </h1>
      <p style={{ color: "var(--ink-soft)", fontSize: "16px", marginBottom: "24px" }}>
        You do not have permission to view or manage this resource.
      </p>
      <Link
        to="/dashboard"
        style={{
          display: "inline-block",
          padding: "8px 16px",
          backgroundColor: "var(--ink)",
          color: "var(--ground)",
          borderRadius: "var(--radius)",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "14px",
        }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
