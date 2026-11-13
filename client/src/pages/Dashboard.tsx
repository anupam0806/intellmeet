import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore.js";
import { fetchMeetings, getMeetingColor, type MeetingSummary } from "../lib/meetings.js";
import { fetchTasks, type Task } from "../lib/tasks.js";
import { CreateMeetingDialog } from "../components/CreateMeetingDialog.js";
import { JoinMeetingDialog } from "../components/JoinMeetingDialog.js";
import {
  Plus,
  Hash,
  Video,
  Clock,
  CheckCircle2,
  Calendar,
  Radio,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

function isOverdue(dueDateStr?: string, status?: string): boolean {
  if (!dueDateStr || status === "DONE") return false;
  const due = new Date(dueDateStr);
  const now = new Date();
  // Strip time for clean date comparison
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return due < todayStart;
}

function formatDueDate(dueDateStr?: string): string {
  if (!dueDateStr) return "";
  const d = new Date(dueDateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function Dashboard(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  // 1. Fetch team meetings
  const meetingsQuery = useQuery({
    queryKey: ["meetings", "dashboard"],
    queryFn: () => fetchMeetings({ limit: 50 }),
  });

  // 2. Fetch my tasks
  const tasksQuery = useQuery({
    queryKey: ["tasks", "dashboard", user?.id],
    queryFn: () => fetchTasks({ assigneeId: user?.id }),
    enabled: Boolean(user?.id),
  });

  const allMeetings: MeetingSummary[] = Array.isArray(meetingsQuery.data?.items)
    ? meetingsQuery.data.items
    : [];
  const allMyTasks: Task[] = Array.isArray(tasksQuery.data?.items)
    ? tasksQuery.data.items
    : [];

  // Filter open tasks assigned to me
  const openTasks = useMemo(() => {
    return allMyTasks.filter((t) => t.status !== "DONE");
  }, [allMyTasks]);

  // Group open tasks by status: IN_PROGRESS first, then To-do
  const inProgressTasks = useMemo(() => {
    return openTasks.filter((t) => t.status === "IN_PROGRESS");
  }, [openTasks]);

  const todoTasks = useMemo(() => {
    return openTasks.filter((t) => t.status === "TODO");
  }, [openTasks]);

  // Live now meetings
  const liveMeetings = useMemo(() => {
    return allMeetings.filter((m) => m.status === "LIVE");
  }, [allMeetings]);

  // Upcoming scheduled meetings
  const upcomingMeetings = useMemo(() => {
    return allMeetings
      .filter((m) => m.status === "SCHEDULED")
      .sort((a, b) => {
        const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return aTime - bTime;
      });
  }, [allMeetings]);

  // Calculate meetings this week (Monday 00:00 UTC to Sunday 23:59:59 UTC)
  const meetingsThisWeekCount = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getUTCDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek, 0, 0, 0));
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

    return allMeetings.filter((m) => {
      if (m.scheduledAt) {
        const s = new Date(m.scheduledAt);
        return s >= startOfWeek && s < endOfWeek;
      }
      if (m.startedAt) {
        const s = new Date(m.startedAt);
        return s >= startOfWeek && s < endOfWeek;
      }
      return m.status === "LIVE" || m.status === "SCHEDULED";
    }).length;
  }, [allMeetings]);

  // Write-ups ready to review (ended meetings with ai.status READY)
  const summariesReadyCount = useMemo(() => {
    return allMeetings.filter((m) => m.aiStatus === "READY").length;
  }, [allMeetings]);

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto", padding: "32px 0", width: "100%" }}>
      {/* Top action header & headline */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "16px",
          borderBottom: "1px solid var(--rule)",
          paddingBottom: "24px",
          marginBottom: "32px",
        }}
      >
        <div style={{ maxWidth: "780px" }}>
          {/* Headline sentence with 44px style per docs/06, scaling down to ~28px on small screens */}
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 700,
              lineHeight: 1.15,
              color: "var(--ink)",
              margin: 0,
              letterSpacing: "-0.02em",
              overflowWrap: "anywhere",
            }}
          >
            You have{" "}
            <Link
              to="/meetings"
              style={{
                color: "var(--ink)",
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              {meetingsThisWeekCount} {meetingsThisWeekCount === 1 ? "meeting" : "meetings"}
            </Link>{" "}
            this week,{" "}
            <Link
              to="/tasks?assigneeId=me"
              style={{
                color: "var(--ink)",
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              {openTasks.length} open {openTasks.length === 1 ? "task" : "tasks"}
            </Link>
            , and{" "}
            <Link
              to="/meetings?status=ENDED"
              style={{
                color: "var(--ink)",
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              {summariesReadyCount} {summariesReadyCount === 1 ? "write-up" : "write-ups"}
            </Link>{" "}
            ready to review.
          </h1>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="btn-obsidian-glass"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              minHeight: "44px",
              fontSize: "14px",
              fontWeight: 500,
              borderRadius: "var(--radius)",
              cursor: "pointer",
            }}
          >
            <Hash size={16} strokeWidth={1.75} />
            <span>Join with code</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-warm-gradient"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              minHeight: "44px",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "var(--radius)",
              cursor: "pointer",
            }}
          >
            <Plus size={16} strokeWidth={2} />
            <span>New meeting</span>
          </button>
        </div>
      </div>

      {/* 3-Column horizontal dashboard grid layout on desktop (stacks on mobile) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "24px",
        }}
      >
        {/* Section 1: Live now */}
        <section
          style={{
            backgroundColor: "rgba(14, 15, 19, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-card)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "340px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--rule)",
                paddingBottom: "12px",
                marginBottom: "8px",
              }}
            >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Radio size={16} strokeWidth={2} style={{ color: "var(--signal)" }} />
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                Live now
              </h2>
            </div>
            {liveMeetings.length > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  backgroundColor: "var(--signal)",
                  color: "var(--on-signal)",
                  borderRadius: "var(--radius-chip)",
                  padding: "1px 6px",
                }}
              >
                {liveMeetings.length}
              </span>
            )}
          </div>

          <div>
            {meetingsQuery.isLoading ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
                Loading live rooms...
              </div>
            ) : meetingsQuery.isError ? (
              <div
                style={{
                  padding: "14px 0",
                  color: "var(--error)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertCircle size={14} />
                  <span>Failed to load live meetings.</span>
                </div>
                <button
                  type="button"
                  onClick={() => meetingsQuery.refetch()}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--error)",
                    borderRadius: "var(--radius-chip)",
                    color: "var(--error)",
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  <RefreshCw size={10} style={{ display: "inline", marginRight: "4px" }} />
                  Retry
                </button>
              </div>
            ) : liveMeetings.length === 0 ? (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: "var(--ink-soft)",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <Video size={24} strokeWidth={1.5} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>No meetings live right now</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                  Start one from Upcoming or create a new room.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {liveMeetings.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "10px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "4px",
                          height: "32px",
                          borderRadius: "2px",
                          backgroundColor: getMeetingColor(m.colorIndex),
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <Link
                          to={`/meetings/${m.id}`}
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "var(--ink)",
                            textDecoration: "none",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.title}
                        </Link>
                        <span style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px", display: "block" }}>
                          Host: {m.hostName} · {m.participantCount} in room
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/meetings/${m.id}`)}
                      className="btn-warm-gradient"
                      style={{
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "var(--radius-chip)",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: "12px", marginTop: "16px" }}>
            <Link
              to="/meetings?status=LIVE"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--signal)",
                textDecoration: "none",
              }}
            >
              View all live rooms
            </Link>
          </div>
        </section>

        {/* Section 2: Upcoming */}
        <section
          style={{
            backgroundColor: "rgba(14, 15, 19, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-card)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "340px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--rule)",
                paddingBottom: "12px",
                marginBottom: "8px",
              }}
            >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={16} strokeWidth={1.75} style={{ color: "var(--ink-soft)" }} />
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                Upcoming
              </h2>
            </div>
            {upcomingMeetings.length > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  border: "1px solid var(--rule)",
                  color: "var(--ink-soft)",
                  borderRadius: "var(--radius-chip)",
                  padding: "1px 6px",
                }}
              >
                {upcomingMeetings.length}
              </span>
            )}
          </div>

          <div>
            {meetingsQuery.isLoading ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
                Loading scheduled meetings...
              </div>
            ) : meetingsQuery.isError ? (
              <div
                style={{
                  padding: "14px 0",
                  color: "var(--error)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertCircle size={14} />
                  <span>Failed to load upcoming meetings.</span>
                </div>
                <button
                  type="button"
                  onClick={() => meetingsQuery.refetch()}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--error)",
                    borderRadius: "var(--radius-chip)",
                    color: "var(--error)",
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  <RefreshCw size={10} style={{ display: "inline", marginRight: "4px" }} />
                  Retry
                </button>
              </div>
            ) : upcomingMeetings.length === 0 ? (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: "var(--ink-soft)",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <Clock size={24} strokeWidth={1.5} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>No scheduled meetings</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                  Schedule a session for your team.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {upcomingMeetings.slice(0, 4).map((m) => (
                  <Link
                    key={m.id}
                    to={`/meetings/${m.id}`}
                    style={{
                      padding: "10px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      textDecoration: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "4px",
                          height: "32px",
                          borderRadius: "2px",
                          backgroundColor: getMeetingColor(m.colorIndex),
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "var(--ink)",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.title}
                        </p>
                        <span style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px", display: "block" }}>
                          Host: {m.hostName}
                        </span>
                      </div>
                    </div>

                    <span style={{ fontSize: "11px", color: "var(--ink-soft)", flexShrink: 0 }}>
                      {m.scheduledAt
                        ? new Date(m.scheduledAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Scheduled"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: "12px", marginTop: "16px" }}>
            <Link
              to="/meetings?status=SCHEDULED"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--signal)",
                textDecoration: "none",
              }}
            >
              View all upcoming
            </Link>
          </div>
        </section>

        {/* Section 3: My Tasks */}
        <section
          style={{
            backgroundColor: "rgba(14, 15, 19, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-card)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "340px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--rule)",
                paddingBottom: "12px",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle2 size={16} strokeWidth={1.75} style={{ color: "var(--signal)" }} />
                <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                  My tasks
                </h2>
              </div>
              {openTasks.length > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    backgroundColor: "rgba(255, 107, 74, 0.15)",
                    color: "var(--signal)",
                    border: "1px solid rgba(255, 107, 74, 0.3)",
                    borderRadius: "var(--radius-chip)",
                    padding: "1px 6px",
                  }}
                >
                  {openTasks.length} open
                </span>
              )}
            </div>

          <div>
            {tasksQuery.isLoading ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
                Loading your tasks...
              </div>
            ) : tasksQuery.isError ? (
              <div
                style={{
                  padding: "14px 0",
                  color: "var(--error)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertCircle size={14} />
                  <span>Failed to load tasks.</span>
                </div>
                <button
                  type="button"
                  onClick={() => tasksQuery.refetch()}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--error)",
                    borderRadius: "var(--radius-chip)",
                    color: "var(--error)",
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  <RefreshCw size={10} style={{ display: "inline", marginRight: "4px" }} />
                  Retry
                </button>
              </div>
            ) : openTasks.length === 0 ? (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: "var(--ink-soft)",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <CheckCircle2 size={24} strokeWidth={1.5} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>No tasks assigned yet</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                  Action items converted from meeting write-ups will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* In progress group */}
                {inProgressTasks.length > 0 && (
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-soft)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        display: "block",
                        marginBottom: "6px",
                      }}
                    >
                      In progress ({inProgressTasks.length})
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {inProgressTasks.map((t) => {
                        const overdue = isOverdue(t.dueDate, t.status);
                        return (
                          <Link
                            key={t.id}
                            to={`/tasks?highlight=${t.id}`}
                            style={{
                              padding: "8px 12px",
                              backgroundColor: "rgba(255, 255, 255, 0.03)",
                              border: "1px solid var(--rule)",
                              borderLeftWidth: "4px",
                              borderLeftColor:
                                t.sourceMeetingColorIndex !== undefined
                                  ? getMeetingColor(t.sourceMeetingColorIndex)
                                  : "var(--rule)",
                              borderRadius: "var(--radius-chip)",
                              textDecoration: "none",
                              display: "block",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "var(--ink)",
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.title}
                            </p>
                            {t.dueDate && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", fontSize: "11px" }}>
                                <span style={{ color: "var(--ink-soft)" }}>Due {formatDueDate(t.dueDate)}</span>
                                {overdue && (
                                  <span style={{ color: "var(--error)", fontWeight: 600 }}>Overdue</span>
                                )}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* To do group */}
                {todoTasks.length > 0 && (
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-soft)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        display: "block",
                        marginBottom: "6px",
                      }}
                    >
                      To do ({todoTasks.length})
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {todoTasks.map((t) => {
                        const overdue = isOverdue(t.dueDate, t.status);
                        return (
                          <Link
                            key={t.id}
                            to={`/tasks?highlight=${t.id}`}
                            style={{
                              padding: "8px 12px",
                              backgroundColor: "rgba(255, 255, 255, 0.03)",
                              border: "1px solid var(--rule)",
                              borderLeftWidth: "4px",
                              borderLeftColor:
                                t.sourceMeetingColorIndex !== undefined
                                  ? getMeetingColor(t.sourceMeetingColorIndex)
                                  : "var(--rule)",
                              borderRadius: "var(--radius-chip)",
                              textDecoration: "none",
                              display: "block",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "var(--ink)",
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.title}
                            </p>
                            {t.dueDate && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", fontSize: "11px" }}>
                                <span style={{ color: "var(--ink-soft)" }}>Due {formatDueDate(t.dueDate)}</span>
                                {overdue && (
                                  <span style={{ color: "var(--error)", fontWeight: 600 }}>Overdue</span>
                                )}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: "12px", marginTop: "16px" }}>
            <Link
              to="/tasks"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--signal)",
                textDecoration: "none",
              }}
            >
              Open task board
            </Link>
          </div>
        </section>
      </div>

      {/* Dialogs */}
      <CreateMeetingDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(newMeeting) => {
          queryClient.invalidateQueries({ queryKey: ["meetings"] });
          navigate(`/meetings/${newMeeting.id}`);
        }}
      />

      <JoinMeetingDialog
        isOpen={joinOpen}
        onClose={() => setJoinOpen(false)}
      />
    </div>
  );
}
