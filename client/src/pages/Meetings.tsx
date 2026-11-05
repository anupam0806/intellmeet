import React from "react";

export function Meetings(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "1120px" }}>
      <h1 style={{ fontSize: "30px", fontWeight: 700, margin: "0 0 16px 0" }}>Meetings</h1>
      <p style={{ color: "var(--ink-soft)" }}>No meetings yet. Start one and the notes will land here.</p>
    </div>
  );
}

