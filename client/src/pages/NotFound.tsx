import React from "react";

export function NotFound(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "600px" }}>
      <h1 style={{ fontSize: "30px", fontWeight: 700, margin: "0 0 16px 0" }}>404 — Not Found</h1>
      <p style={{ color: "var(--ink-soft)" }}>The page or resource you requested does not exist.</p>
    </div>
  );
}

