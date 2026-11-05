import React from "react";

export function Forbidden(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "600px" }}>
      <h1 style={{ fontSize: "30px", fontWeight: 700, margin: "0 0 16px 0" }}>403 — Access Denied</h1>
      <p style={{ color: "var(--ink-soft)" }}>You do not have permission to view this resource.</p>
    </div>
  );
}

