import React from "react";

export function MeetingDetail(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "1120px" }}>
      <h1 style={{ fontSize: "30px", fontWeight: 700, margin: "0 0 16px 0" }}>Meeting Detail</h1>
      <p style={{ color: "var(--ink-soft)" }}>Select or join a meeting to view its live session or generated notes.</p>
    </div>
  );
}

