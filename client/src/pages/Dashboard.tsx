import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore.js";
import { fetchMeetings, getMeetingColor, type MeetingSummary } from "../lib/meetings.js";
import { CreateMeetingDialog } from "../components/CreateMeetingDialog.js";
import { JoinMeetingDialog } from "../components/JoinMeetingDialog.js";
import {
  Plus,
  Hash,
  Video,
  Clock,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Radio,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export function Dashboard(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["meetings", "dashboard"],
    queryFn: () => fetchMeetings({ limit: 50 }),
  });

  const allMeetings: MeetingSummary[] = data?.items || [];

  // 1. Calculate live now
  const liveMeetings = allMeetings.filter((m) => m.status === "LIVE");

  // 2. Calculate upcoming scheduled
  const upcomingMeetings = allMeetings
    .filter((m) => m.status === "SCHEDULED")
    .sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return aTime - bTime;
    });

  // 3. Calculate meetings this week (Monday 00:00 UTC to Sunday 23:59 UTC)
  const now = new Date();
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // Monday = 0
  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7);

  const meetingsThisWeekCount = allMeetings.filter((m) => {
    const targetDate = m.scheduledAt ? new Date(m.scheduledAt) : undefined;
    if (targetDate) {
      return targetDate >= startOfWeek && targetDate < endOfWeek;
    }
    return m.status === "LIVE" || m.status === "SCHEDULED";
  }).length;

  // 4. Calculate summaries ready to review
  const summariesReadyCount = allMeetings.filter((m) => m.aiStatus === "READY").length;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      {/* Top action header & headline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--rule)" }}>
        <div>
          <p className="text-xs uppercase font-semibold tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
            Welcome back, {user?.name || "there"}
          </p>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            You have{" "}
            <Link
              to="/meetings"
              className="underline decoration-2 underline-offset-4 hover:opacity-80 transition-opacity"
              style={{ color: "var(--signal)" }}
            >
              {meetingsThisWeekCount} {meetingsThisWeekCount === 1 ? "meeting" : "meetings"}
            </Link>{" "}
            this week,{" "}
            <Link
              to="/meetings?status=ENDED"
              className="underline decoration-2 underline-offset-4 hover:opacity-80 transition-opacity"
              style={{ color: "var(--signal)" }}
            >
              {summariesReadyCount} {summariesReadyCount === 1 ? "summary" : "summaries"}
            </Link>{" "}
            ready to review, and{" "}
            <Link
              to="/tasks"
              className="underline decoration-2 underline-offset-4 hover:opacity-80 transition-opacity"
              style={{ color: "var(--ink)" }}
            >
              0 open tasks
            </Link>
            .
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg border transition-colors hover:opacity-80"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
            }}
          >
            <Hash className="w-4 h-4" />
            <span>Join with code</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs"
            style={{
              backgroundColor: "var(--signal)",
              color: "var(--on-signal)",
            }}
          >
            <Plus className="w-4 h-4" />
            <span>New meeting</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-48 rounded-lg border animate-pulse"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--rule)" }}
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          className="p-4 rounded-lg border flex items-center justify-between"
          style={{
            backgroundColor: "var(--ground)",
            borderColor: "var(--error)",
            color: "var(--error)",
          }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">
              {error instanceof Error ? error.message : "Failed to load dashboard data."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-80"
            style={{ borderColor: "var(--error)", color: "var(--error)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Three-column Dashboard Sections */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Section 1: Live Now */}
          <section
            className="rounded-lg border p-5 flex flex-col justify-between"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--rule)" }}
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b mb-3" style={{ borderColor: "var(--rule)" }}>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 animate-pulse" style={{ color: "var(--signal)" }} />
                  <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                    Live now
                  </h2>
                </div>
                {liveMeetings.length > 0 && (
                  <span
                    className="px-2 py-0.5 text-xs font-semibold rounded-lg"
                    style={{ backgroundColor: "var(--meeting-1)", color: "var(--on-signal)" }}
                  >
                    {liveMeetings.length}
                  </span>
                )}
              </div>

              {liveMeetings.length === 0 ? (
                <div className="py-8 text-center" style={{ color: "var(--ink-soft)" }}>
                  <Video className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No meetings live right now</p>
                  <p className="text-xs mt-1">Start a meeting from Upcoming or create a new one.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {liveMeetings.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg border flex items-center justify-between transition-colors hover:opacity-95"
                      style={{
                        backgroundColor: "var(--ground)",
                        borderColor: "var(--rule)",
                        borderLeftWidth: "4px",
                        borderLeftColor: getMeetingColor(m.colorIndex),
                      }}
                    >
                      <div className="min-w-0 pr-3">
                        <Link
                          to={`/meetings/${m.id}`}
                          className="font-semibold text-sm truncate block hover:underline"
                          style={{ color: "var(--ink)" }}
                        >
                          {m.title}
                        </Link>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-soft)" }}>
                          Host: {m.hostName} · {m.participantCount} in room
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/meetings/${m.id}`)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 shrink-0"
                        style={{
                          backgroundColor: "var(--signal)",
                          color: "var(--on-signal)",
                        }}
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {liveMeetings.length > 0 && (
              <div className="pt-3 border-t mt-4" style={{ borderColor: "var(--rule)" }}>
                <Link
                  to="/meetings?status=LIVE"
                  className="text-xs font-semibold flex items-center justify-between transition-opacity hover:opacity-80"
                  style={{ color: "var(--signal)" }}
                >
                  <span>View all live rooms</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </section>

          {/* Section 2: Upcoming */}
          <section
            className="rounded-lg border p-5 flex flex-col justify-between"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--rule)" }}
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b mb-3" style={{ borderColor: "var(--rule)" }}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" style={{ color: "var(--ink-soft)" }} />
                  <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                    Upcoming
                  </h2>
                </div>
                {upcomingMeetings.length > 0 && (
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-lg border"
                    style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
                  >
                    {upcomingMeetings.length}
                  </span>
                )}
              </div>

              {upcomingMeetings.length === 0 ? (
                <div className="py-8 text-center" style={{ color: "var(--ink-soft)" }}>
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No scheduled meetings</p>
                  <p className="text-xs mt-1">Schedule a new session for your team.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingMeetings.slice(0, 4).map((m) => (
                    <Link
                      key={m.id}
                      to={`/meetings/${m.id}`}
                      className="p-3 rounded-lg border block transition-colors hover:opacity-90"
                      style={{
                        backgroundColor: "var(--ground)",
                        borderColor: "var(--rule)",
                        borderLeftWidth: "4px",
                        borderLeftColor: getMeetingColor(m.colorIndex),
                      }}
                    >
                      <p className="font-semibold text-sm truncate" style={{ color: "var(--ink)" }}>
                        {m.title}
                      </p>
                      <div className="flex items-center justify-between text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                        <span>Host: {m.hostName}</span>
                        <span>
                          {m.scheduledAt
                            ? new Date(m.scheduledAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Ready to start"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t mt-4" style={{ borderColor: "var(--rule)" }}>
              <Link
                to="/meetings?status=SCHEDULED"
                className="text-xs font-semibold flex items-center justify-between transition-opacity hover:opacity-80"
                style={{ color: "var(--signal)" }}
              >
                <span>View all upcoming</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* Section 3: My Tasks */}
          <section
            className="rounded-lg border p-5 flex flex-col justify-between"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--rule)" }}
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b mb-3" style={{ borderColor: "var(--rule)" }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: "var(--ink-soft)" }} />
                  <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                    My tasks
                  </h2>
                </div>
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-lg border"
                  style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
                >
                  0 open
                </span>
              </div>

              <div className="py-8 text-center" style={{ color: "var(--ink-soft)" }}>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No tasks assigned yet</p>
                <p className="text-xs mt-1">
                  Action items converted from meeting write-ups will populate here.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t mt-4" style={{ borderColor: "var(--rule)" }}>
              <Link
                to="/tasks"
                className="text-xs font-semibold flex items-center justify-between transition-opacity hover:opacity-80"
                style={{ color: "var(--signal)" }}
              >
                <span>Open task board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        </div>
      )}

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
