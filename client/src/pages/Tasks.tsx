import React from "react";

export function Tasks(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "1120px" }}>
      <h1 style={{ fontSize: "30px", fontWeight: 700, margin: "0 0 16px 0" }}>Tasks Board</h1>
      <p style={{ color: "var(--ink-soft)" }}>Track converted action items across TODO, IN_PROGRESS, and DONE.</p>
    </div>
  );
}

