import React from "react";

export function Login(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "480px" }}>
      <h1 style={{ fontSize: "30px", fontWeight: 700, margin: "0 0 16px 0" }}>Log in</h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 0 24px 0" }}>
        Enter your team account credentials.
      </p>
    </div>
  );
}

