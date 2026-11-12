import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMeetings,
  getMeetingColor,
  formatDuration,
  type MeetingSummary,
  type MeetingQueryParams,
} from "../lib/meetings.js";
import { CreateMeetingDialog } from "../components/CreateMeetingDialog.js";
import { JoinMeetingDialog } from "../components/JoinMeetingDialog.js";
import {
  Plus,
  Hash,
  Search,
  Calendar,
  Users,
  Clock,
  FileText,
  Radio,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function Meetings(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  // Search & filter states synced with URL search params
  const initialQ = searchParams.get("q") || "";
  const initialStatus = (searchParams.get("status") as MeetingQueryParams["status"]) || "ALL";
  const initialFrom = searchParams.get("from") || "";
  const initialTo = searchParams.get("to") || "";
  const initialPage = Number.parseInt(searchParams.get("page") || "1", 10);

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<MeetingQueryParams["status"]>(initialStatus);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [page, setPage] = useState(initialPage);

  // TanStack Query
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["meetings", { q, status, from, to, page }],
    queryFn: () =>
      fetchMeetings({
        q: q.trim() || undefined,
        status: status === "ALL" ? undefined : status,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        page,
        limit: 10,
      }),
  });

  const meetings: MeetingSummary[] = Array.isArray(data?.items) ? data.items : [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  function updateFilter(newStatus: MeetingQueryParams["status"]) {
    setStatus(newStatus);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (newStatus && newStatus !== "ALL") {
      params.set("status", newStatus);
    } else {
      params.delete("status");
    }
    params.set("page", "1");
    setSearchParams(params);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    setSearchParams(params);
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    setSearchParams(params);
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header with Title and Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--rule)" }}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            Meetings
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            Review past transcripts, manage scheduled sessions, or start live rooms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-lg border transition-colors hover:opacity-80"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
              minHeight: "44px",
            }}
          >
            <Hash className="w-4 h-4" />
            <span>Join with code</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--signal)",
              color: "var(--on-signal)",
              minHeight: "44px",
            }}
          >
            <Plus className="w-4 h-4" />
            <span>New meeting</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        {/* Status filter tabs */}
        <div className="flex items-center gap-2 border-b overflow-x-auto pb-1" style={{ borderColor: "var(--rule)" }}>
          {(["ALL", "LIVE", "SCHEDULED", "ENDED"] as const).map((tab) => {
            const isActive = (status || "ALL") === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => updateFilter(tab)}
                className="px-3 py-2 text-xs font-semibold rounded-lg transition-colors hover:opacity-75"
                style={{
                  minHeight: "44px",
                  backgroundColor: isActive ? "var(--surface)" : "transparent",
                  color: isActive ? "var(--signal)" : "var(--ink-soft)",
                  borderBottom: isActive ? "2px solid var(--signal)" : "2px solid transparent",
                }}
              >
                {tab === "ALL" && "All Meetings"}
                {tab === "LIVE" && "Live Now"}
                {tab === "SCHEDULED" && "Upcoming"}
                {tab === "ENDED" && "Ended"}
              </button>
            );
          })}
        </div>

        {/* Search and Date filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4" style={{ color: "var(--ink-soft)" }} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search meetings by title, description, or summary..."
              className="w-full pl-9 pr-3 py-2 text-base sm:text-sm rounded-lg border transition-colors"
              style={{
                minHeight: "44px",
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              aria-label="From date"
              className="px-2.5 py-2 text-base sm:text-xs rounded-lg border transition-colors"
              style={{
                minHeight: "44px",
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
              to
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              aria-label="To date"
              className="px-2.5 py-2 text-base sm:text-xs rounded-lg border transition-colors"
              style={{
                minHeight: "44px",
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Main List Container */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--rule)",
        }}
      >
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="divide-y" style={{ borderColor: "var(--rule)" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="p-4 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: "var(--rule)" }} />
                  <div>
                    <div className="w-48 h-4 rounded-lg mb-2" style={{ backgroundColor: "var(--rule)" }} />
                    <div className="w-32 h-3 rounded-lg" style={{ backgroundColor: "var(--rule)" }} />
                  </div>
                </div>
                <div className="w-20 h-6 rounded-lg" style={{ backgroundColor: "var(--rule)" }} />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="p-8 text-center space-y-3" style={{ color: "var(--error)" }}>
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-semibold">
              {error instanceof Error ? error.message : "Failed to load meetings."}
            </p>
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

        {/* Empty State */}
        {!isLoading && !isError && meetings.length === 0 && (
          <div className="p-12 text-center space-y-3" style={{ color: "var(--ink-soft)" }}>
            <Calendar className="w-10 h-10 mx-auto opacity-40" />
            <h3 className="text-base font-bold" style={{ color: "var(--ink)" }}>
              No meetings found
            </h3>
            <p className="text-xs max-w-sm mx-auto">
              {q || status !== "ALL" || from || to
                ? "Try adjusting your search query or filters to find what you're looking for."
                : "Schedule your team's first meeting or start one right away."}
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 mt-2"
              style={{
                backgroundColor: "var(--signal)",
                color: "var(--on-signal)",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create meeting</span>
            </button>
          </div>
        )}

        {/* Rows (hairline dividers per docs/06) */}
        {!isLoading && !isError && meetings.length > 0 && (
          <div className="divide-y" style={{ borderColor: "var(--rule)" }}>
            {meetings.map((m) => (
              <Link
                key={m.id}
                to={`/meetings/${m.id}`}
                className="group p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:opacity-90"
              >
                {/* Left side: color spine + title + host */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-1.5 self-stretch rounded-lg shrink-0"
                    style={{ backgroundColor: getMeetingColor(m.colorIndex) }}
                    title={`Meeting Color ${m.colorIndex + 1}`}
                  />
                  <div className="min-w-0">
                    <p
                      className="font-bold text-sm tracking-tight group-hover:underline"
                      style={{ color: "var(--ink)", overflowWrap: "anywhere" }}
                    >
                      {m.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)", overflowWrap: "anywhere" }}>
                      Host: {m.hostName} ·{" "}
                      {m.scheduledAt
                        ? new Date(m.scheduledAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : m.startedAt
                        ? new Date(m.startedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "Unscheduled"}
                    </p>
                  </div>
                </div>

                {/* Right side: metadata chips, status badge, AI status */}
                <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-center">
                  {/* Duration */}
                  <div
                    className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: "var(--ink-soft)" }}
                    title="Duration"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDuration(m.durationSeconds)}</span>
                  </div>

                  {/* Participant count */}
                  <div
                    className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: "var(--ink-soft)" }}
                    title="Participants"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{m.participantCount}</span>
                  </div>

                  {/* AI Status Badge */}
                  {m.aiStatus === "READY" && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold rounded-lg"
                      style={{ backgroundColor: "var(--ground)", color: "var(--success)" }}
                      title="AI Summary Ready"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Summary</span>
                    </span>
                  )}
                  {m.aiStatus === "PENDING" && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-medium rounded-lg animate-pulse"
                      style={{ backgroundColor: "var(--ground)", color: "var(--signal)" }}
                      title="AI Summary Generating"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Generating</span>
                    </span>
                  )}

                  {/* Meeting Status Badge */}
                  {m.status === "LIVE" && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold animate-pulse"
                      style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)", borderRadius: "var(--radius-chip)" }}
                    >
                      <Radio className="w-3 h-3" />
                      <span>Live</span>
                    </span>
                  )}
                  {m.status === "SCHEDULED" && (
                    <span
                      className="px-2 py-0.5 text-xs font-semibold border"
                      style={{
                        backgroundColor: "var(--ground)",
                        borderColor: "var(--rule)",
                        color: "var(--ink-soft)",
                        borderRadius: "var(--radius-chip)",
                      }}
                    >
                      Scheduled
                    </span>
                  )}
                  {m.status === "ENDED" && (
                    <span
                      className="px-2 py-0.5 text-xs font-medium"
                      style={{ color: "var(--ink-soft)", borderRadius: "var(--radius-chip)" }}
                    >
                      Ended
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && !isError && totalPages > 1 && (
          <div
            className="p-3 border-t flex items-center justify-between text-xs"
            style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
          >
            <span>
              Showing {meetings.length} of {total} meetings
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="p-1 rounded-lg border disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ borderColor: "var(--rule)" }}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium" style={{ color: "var(--ink)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-1 rounded-lg border disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ borderColor: "var(--rule)" }}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateMeetingDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["meetings"] });
        }}
      />

      <JoinMeetingDialog
        isOpen={joinOpen}
        onClose={() => setJoinOpen(false)}
      />
    </div>
  );
}
