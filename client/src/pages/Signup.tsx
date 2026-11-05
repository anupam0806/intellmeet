import React from "react";

export function Signup(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "480px" }}>
      <h1 style={{ fontSize: "30px", fontWeight: 700, margin: "0 0 16px 0" }}>Sign up</h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 0 24px 0" }}>
        Create a new team or enter an invite code to join one.
      </p>
    </div>
  );
}

