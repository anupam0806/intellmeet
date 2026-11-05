import React from "react";

export function Settings(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "1120px" }}>
      <h1 style={{ fontSize: "30px", fontWeight: 700, margin: "0 0 16px 0" }}>Settings</h1>
      <p style={{ color: "var(--ink-soft)" }}>Manage your profile, team settings, and member roles.</p>
    </div>
  );
}

