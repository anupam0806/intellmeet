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

  const allMeetings: MeetingSummary[] = meetingsQuery.data?.items || [];
  const allMyTasks: Task[] = tasksQuery.data?.items || [];

  // Filter open tasks assigned to me
  const openTasks = useMemo(() => {
    return allMyTasks.filter((t) => t.status !== "DONE");
  }, [allMyTasks]);

  // Group open tasks by status: IN_PROGRESS first, then TODO
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
          {/* Headline sentence with 44px style per docs/06 */}
          <h1
            style={{
              fontSize: "clamp(26px, 4vw, 44px)",
              fontWeight: 700,
              lineHeight: 1.15,
              color: "var(--ink)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            You have{" "}
            <Link
              to="/meetings"
              style={{
                color: "var(--signal)",
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
                color: "var(--signal)",
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
                color: "var(--signal)",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              fontSize: "14px",
              fontWeight: 500,
              borderRadius: "var(--radius)",
              border: "1px solid var(--rule)",
              backgroundColor: "var(--surface)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <Hash size={16} strokeWidth={1.75} />
            <span>Join with code</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "var(--radius)",
              border: "none",
              backgroundColor: "var(--signal)",
              color: "var(--on-signal)",
              cursor: "pointer",
            }}
          >
            <Plus size={16} strokeWidth={2} />
            <span>New meeting</span>
          </button>
        </div>
      </div>

      {/* Main 3 Sections Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Section 1: Live now */}
        <section
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            minHeight: "280px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--rule)",
              paddingBottom: "12px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Radio size={16} strokeWidth={2} style={{ color: "var(--signal)" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
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

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {meetingsQuery.isLoading ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
                Loading live rooms...
              </div>
            ) : meetingsQuery.isError ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--error)",
                  color: "var(--error)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
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
                  margin: "auto",
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--ink-soft)",
                }}
              >
                <Video size={28} strokeWidth={1.5} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>No meetings live right now</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                  Start one from Upcoming or create a new room.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {liveMeetings.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "var(--ground)",
                      border: "1px solid var(--rule)",
                      borderLeftWidth: "6px",
                      borderLeftColor: getMeetingColor(m.colorIndex),
                      borderRadius: "var(--radius)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
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

                    <button
                      type="button"
                      onClick={() => navigate(`/meetings/${m.id}`)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: "var(--signal)",
                        color: "var(--on-signal)",
                        border: "none",
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

          <div style={{ borderTop: "1px solid var(--rule)", paddingTop: "12px", marginTop: "16px" }}>
            <Link
              to="/meetings?status=LIVE"
              style={{
                fontSize: "12px",
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
            backgroundColor: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            minHeight: "280px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--rule)",
              paddingBottom: "12px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={16} strokeWidth={1.75} style={{ color: "var(--ink-soft)" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
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

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {meetingsQuery.isLoading ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
                Loading scheduled meetings...
              </div>
            ) : meetingsQuery.isError ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--error)",
                  color: "var(--error)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
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
                  margin: "auto",
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--ink-soft)",
                }}
              >
                <Clock size={28} strokeWidth={1.5} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>No scheduled meetings</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                  Schedule a session for your team.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {upcomingMeetings.slice(0, 4).map((m) => (
                  <Link
                    key={m.id}
                    to={`/meetings/${m.id}`}
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "var(--ground)",
                      border: "1px solid var(--rule)",
                      borderLeftWidth: "6px",
                      borderLeftColor: getMeetingColor(m.colorIndex),
                      borderRadius: "var(--radius)",
                      textDecoration: "none",
                      display: "block",
                    }}
                  >
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        color: "var(--ink-soft)",
                        marginTop: "4px",
                      }}
                    >
                      <span>Host: {m.hostName}</span>
                      <span>
                        {m.scheduledAt
                          ? new Date(m.scheduledAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Scheduled"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--rule)", paddingTop: "12px", marginTop: "16px" }}>
            <Link
              to="/meetings?status=SCHEDULED"
              style={{
                fontSize: "12px",
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
            backgroundColor: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            minHeight: "280px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--rule)",
              paddingBottom: "12px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={16} strokeWidth={1.75} style={{ color: "var(--ink-soft)" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                My tasks
              </h2>
            </div>
            {openTasks.length > 0 && (
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
                {openTasks.length} open
              </span>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {tasksQuery.isLoading ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
                Loading your tasks...
              </div>
            ) : tasksQuery.isError ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--error)",
                  color: "var(--error)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
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
                  margin: "auto",
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--ink-soft)",
                }}
              >
                <CheckCircle2 size={28} strokeWidth={1.5} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>No tasks assigned yet</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                  Action items converted from meeting write-ups will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* In progress group */}
                {inProgressTasks.length > 0 && (
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--signal)",
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
                              backgroundColor: "var(--ground)",
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
                              backgroundColor: "var(--ground)",
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

          <div style={{ borderTop: "1px solid var(--rule)", paddingTop: "12px", marginTop: "16px" }}>
            <Link
              to="/tasks"
              style={{
                fontSize: "12px",
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
