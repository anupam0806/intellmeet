import React, { useState, useEffect, useCallback, useId } from "react";
import {
  fetchAnalyticsOverview,
  type AnalyticsOverview,
  type AnalyticsQueryInput,
} from "../lib/analytics.js";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Calendar, AlertCircle, RefreshCw } from "lucide-react";

function formatUtcYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPresetRange(days: number): { from: string; to: string } {
  const now = new Date();
  const to = formatUtcYmd(now);
  const fromDt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const from = formatUtcYmd(fromDt);
  return { from, to };
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0m";
  const total = Math.round(minutes);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatWeekLabel(weekStr: string): string {
  const parts = weekStr.split("-").map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return weekStr;
}

type PresetDays = 7 | 30 | 90 | "custom";

export function Analytics(): React.JSX.Element {
  const [selectedPreset, setSelectedPreset] = useState<PresetDays>(30);
  const default30 = getPresetRange(30);
  const [fromDate, setFromDate] = useState<string>(default30.from);
  const [toDate, setToDate] = useState<string>(default30.to);

  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fromInputId = useId();
  const toInputId = useId();

  const loadData = useCallback(async (query: AnalyticsQueryInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAnalyticsOverview(query);
      setData(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load analytics overview";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData({ from: fromDate, to: toDate });
  }, [fromDate, toDate, loadData]);

  const handleSelectPreset = (days: 7 | 30 | 90) => {
    setSelectedPreset(days);
    const range = getPresetRange(days);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const handleCustomDateChange = (from: string, to: string) => {
    setSelectedPreset("custom");
    setFromDate(from);
    setToDate(to);
  };

  const handleRetry = () => {
    loadData({ from: fromDate, to: toDate });
  };

  // Stacked tasks data
  const taskStackedData = data
    ? [
        {
          name: "Tasks",
          TODO: data.tasksByStatus.find((t) => t.status === "TODO")?.count || 0,
          IN_PROGRESS: data.tasksByStatus.find((t) => t.status === "IN_PROGRESS")?.count || 0,
          DONE: data.tasksByStatus.find((t) => t.status === "DONE")?.count || 0,
        },
      ]
    : [];

  const totalTasks = data
    ? data.tasksByStatus.reduce((sum, item) => sum + item.count, 0)
    : 0;

  return (
    <div style={{ padding: "32px 0", maxWidth: "1120px", margin: "0 auto", width: "100%" }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              margin: "0 0 6px 0",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Analytics
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--ink-soft)" }}>
            Team meeting activity, duration, participation, and task progress.
          </p>
        </div>

        {/* Range picker */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {/* Preset Buttons */}
          <div
            role="group"
            aria-label="Date range presets"
            style={{
              display: "flex",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--radius)",
              padding: "2px",
            }}
          >
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => handleSelectPreset(days)}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: selectedPreset === days ? 600 : 400,
                  backgroundColor: selectedPreset === days ? "var(--ground)" : "transparent",
                  color: selectedPreset === days ? "var(--ink)" : "var(--ink-soft)",
                  border: "none",
                  borderRadius: "var(--radius-chip)",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                Last {days} days
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--ink-soft)",
            }}
          >
            <Calendar size={14} style={{ color: "var(--ink-soft)" }} />
            <label htmlFor={fromInputId} className="sr-only">
              From date
            </label>
            <input
              id={fromInputId}
              type="date"
              value={fromDate}
              aria-label="From date"
              onChange={(e) => handleCustomDateChange(e.target.value, toDate)}
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius-chip)",
                padding: "3px 8px",
                fontSize: "12px",
                color: "var(--ink)",
                fontFamily: "var(--font-sans)",
              }}
            />
            <span>to</span>
            <label htmlFor={toInputId} className="sr-only">
              To date
            </label>
            <input
              id={toInputId}
              type="date"
              value={toDate}
              aria-label="To date"
              onChange={(e) => handleCustomDateChange(fromDate, e.target.value)}
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius-chip)",
                padding: "3px 8px",
                fontSize: "12px",
                color: "var(--ink)",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--error)",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--error)", fontSize: "13px" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "transparent",
              border: "1px solid var(--error)",
              color: "var(--error)",
              borderRadius: "var(--radius-chip)",
              padding: "4px 8px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div
          style={{
            padding: "48px 0",
            textAlign: "center",
            color: "var(--ink-soft)",
            fontSize: "14px",
          }}
        >
          Loading analytics...
        </div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Row of 4 Stat Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Total Meetings */}
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
                Total meetings
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: "8px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {data.totals.meetings}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "4px" }}>
                {data.totals.endedMeetings} ended of {data.totals.meetings} total
              </div>
            </div>

            {/* Avg Meeting Duration */}
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
                Avg meeting duration
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: "8px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatDuration(data.totals.avgDurationMinutes)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "4px" }}>
                Across {data.totals.endedMeetings} ended meetings
              </div>
            </div>

            {/* Action-Item Conversion Rate */}
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
                Action item conversion
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: "8px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {data.actionItemConversionRate > 0
                  ? `${Math.round(data.actionItemConversionRate * 100)}%`
                  : data.totals.endedMeetings === 0
                  ? "—"
                  : "0%"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "4px" }}>
                Converted to tasks
              </div>
            </div>

            {/* Tasks Summary */}
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
                Tasks completed
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: "8px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {data.totals.doneTasks}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "4px" }}>
                {data.totals.doneTasks} completed · {data.totals.openTasks} open
              </div>
            </div>
          </div>

          {/* Empty data note if zero meetings in range */}
          {data.totals.meetings === 0 && (
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                padding: "24px",
                textAlign: "center",
                color: "var(--ink-soft)",
                fontSize: "14px",
              }}
            >
              No meeting data in this range
            </div>
          )}

          {/* Chart 1: Meetings Per Week */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--radius)",
              padding: "20px",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px 0", color: "var(--ink)" }}>
                Meetings per week
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft)" }}>
                Weekly count of scheduled, live, and ended meetings.
              </p>
            </div>

            <div style={{ height: "240px", width: "100%", minHeight: "240px" }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <BarChart data={data.meetingsPerWeek} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                  <XAxis
                    dataKey="weekStart"
                    tickFormatter={formatWeekLabel}
                    stroke="var(--rule)"
                    tick={{ fill: "var(--ink-soft)", fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--rule)"
                    tick={{ fill: "var(--ink-soft)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--rule)",
                      borderRadius: "var(--radius-chip)",
                      fontSize: "12px",
                      color: "var(--ink)",
                    }}
                    labelFormatter={(label) => `Week of ${formatWeekLabel(String(label))}`}
                    formatter={(val) => [`${val} meetings`, "Meetings"]}
                  />
                  <Bar dataKey="count" fill="var(--signal)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Accessible table representation for screen readers */}
            <table className="sr-only" aria-label="Meetings per week data table">
              <caption>Weekly meetings count</caption>
              <thead>
                <tr>
                  <th scope="col">Week starting</th>
                  <th scope="col">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.meetingsPerWeek.map((w) => (
                  <tr key={w.weekStart}>
                    <td>{formatWeekLabel(w.weekStart)}</td>
                    <td>{w.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grid of Chart 2 & Chart 3 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Chart 2: Tasks by Status */}
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px 0", color: "var(--ink)" }}>
                  Tasks by status
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft)" }}>
                  Current team task distribution across To Do, In Progress, and Done.
                </p>
              </div>

              {/* Status legend tags */}
              <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", backgroundColor: "var(--ink-soft)", borderRadius: "2px" }} />
                  <span style={{ color: "var(--ink)" }}>
                    To do: {data.tasksByStatus.find((t) => t.status === "TODO")?.count || 0}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", backgroundColor: "var(--signal)", borderRadius: "2px" }} />
                  <span style={{ color: "var(--ink)" }}>
                    In progress: {data.tasksByStatus.find((t) => t.status === "IN_PROGRESS")?.count || 0}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", backgroundColor: "var(--meeting-1)", borderRadius: "2px" }} />
                  <span style={{ color: "var(--ink)" }}>
                    Done: {data.tasksByStatus.find((t) => t.status === "DONE")?.count || 0}
                  </span>
                </div>
              </div>

              <div style={{ height: "140px", width: "100%", minHeight: "140px" }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <BarChart
                    layout="vertical"
                    data={taskStackedData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" horizontal={false} opacity={0.5} />
                    <XAxis
                      type="number"
                      domain={[0, Math.max(totalTasks, 1)]}
                      allowDecimals={false}
                      stroke="var(--rule)"
                      tick={{ fill: "var(--ink-soft)", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      hide
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--surface)",
                        borderColor: "var(--rule)",
                        borderRadius: "var(--radius-chip)",
                        fontSize: "12px",
                        color: "var(--ink)",
                      }}
                    />
                    <Bar dataKey="TODO" stackId="a" fill="var(--ink-soft)" name="To do" radius={[3, 0, 0, 3]} />
                    <Bar dataKey="IN_PROGRESS" stackId="a" fill="var(--signal)" name="In progress" />
                    <Bar dataKey="DONE" stackId="a" fill="var(--meeting-1)" name="Done" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Accessible table */}
              <table className="sr-only" aria-label="Tasks by status data table">
                <caption>Tasks count by status</caption>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasksByStatus.map((t) => (
                    <tr key={t.status}>
                      <td>{t.status}</td>
                      <td>{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chart 3: Member Participation */}
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px 0", color: "var(--ink)" }}>
                  Participation by member
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft)" }}>
                  Total distinct meetings attended in this range.
                </p>
              </div>

              <div
                style={{
                  height: Math.max(160, data.participation.length * 36) + "px",
                  width: "100%",
                }}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <BarChart
                    layout="vertical"
                    data={data.participation}
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" horizontal={false} opacity={0.5} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      stroke="var(--rule)"
                      tick={{ fill: "var(--ink-soft)", fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--rule)"
                      tick={{ fill: "var(--ink)", fontSize: 12 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--surface)",
                        borderColor: "var(--rule)",
                        borderRadius: "var(--radius-chip)",
                        fontSize: "12px",
                        color: "var(--ink)",
                      }}
                      formatter={(val) => [`${val} meetings attended`, "Attendance"]}
                    />
                    <Bar dataKey="meetingsAttended" fill="var(--meeting-1)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Accessible table */}
              <table className="sr-only" aria-label="Member participation data table">
                <caption>Meetings attended per member</caption>
                <thead>
                  <tr>
                    <th scope="col">Member name</th>
                    <th scope="col">Meetings attended</th>
                  </tr>
                </thead>
                <tbody>
                  {data.participation.map((p) => (
                    <tr key={p.userId}>
                      <td>{p.name}</td>
                      <td>{p.meetingsAttended}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
