import React from "react";

export function Dashboard(): React.JSX.Element {
  return (
    <div style={{ padding: "32px", maxWidth: "1120px" }}>
      <h1 style={{ fontSize: "44px", fontWeight: 700, margin: "0 0 24px 0", letterSpacing: "-0.02em" }}>
        Good morning. You have 0 live meetings and 0 open tasks.
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
        <section style={{ backgroundColor: "var(--surface)", padding: "24px", borderRadius: "var(--radius)" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 16px 0" }}>Live now</h2>
          <p style={{ color: "var(--ink-soft)" }}>No meetings live right now.</p>
        </section>
        <section style={{ backgroundColor: "var(--surface)", padding: "24px", borderRadius: "var(--radius)" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 16px 0" }}>Upcoming</h2>
          <p style={{ color: "var(--ink-soft)" }}>No scheduled meetings.</p>
        </section>
        <section style={{ backgroundColor: "var(--surface)", padding: "24px", borderRadius: "var(--radius)" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 16px 0" }}>My tasks</h2>
          <p style={{ color: "var(--ink-soft)" }}>No tasks assigned.</p>
        </section>
      </div>
    </div>
  );
}

