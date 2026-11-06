import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore.js";
import {
  fetchMeeting,
  startMeeting,
  endMeeting,
  deleteMeeting,
  updateMeeting,
  getMeetingColor,
  formatDuration,
} from "../lib/meetings.js";
import {
  Copy,
  Check,
  Calendar,
  Clock,
  Users,
  Video,
  Radio,
  Edit2,
  Trash2,
  Play,
  Square,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Info,
  X,
} from "lucide-react";

export function MeetingDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");

  const {
    data: meeting,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => fetchMeeting(id!),
    enabled: Boolean(id),
  });

  const isHost = meeting?.hostId === currentUser?.id;
  const isAdmin = currentUser?.role === "ADMIN";
  const canManage = isHost || isAdmin;

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => startMeeting(id!),
    onSuccess: (data) => {
      queryClient.setQueryData(["meeting", id], data.meeting);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate(`/room/${data.meeting.roomCode}`);
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to start meeting");
    },
  });

  const endMutation = useMutation({
    mutationFn: () => endMeeting(id!),
    onSuccess: (data) => {
      queryClient.setQueryData(["meeting", id], data.meeting);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to end meeting");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMeeting(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate("/meetings");
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to delete meeting");
      setDeleteConfirmOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; scheduledAt?: string }) =>
      updateMeeting(id!, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["meeting", id], updated);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      setEditOpen(false);
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to update meeting");
    },
  });

  function handleCopyCode() {
    if (!meeting) return;
    navigator.clipboard.writeText(meeting.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleCopyLink() {
    if (!meeting) return;
    const roomUrl = `${window.location.origin}/room/${meeting.roomCode}`;
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  function openEditModal() {
    if (!meeting) return;
    setEditTitle(meeting.title);
    setEditDescription(meeting.description || "");
    setEditScheduledAt(
      meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString().slice(0, 16) : "",
    );
    setActionError(null);
    setEditOpen(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) return;
    updateMutation.mutate({
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="w-24 h-6 rounded-md" style={{ backgroundColor: "var(--surface)" }} />
        <div className="h-40 rounded-xl" style={{ backgroundColor: "var(--surface)" }} />
        <div className="h-64 rounded-xl" style={{ backgroundColor: "var(--surface)" }} />
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center py-16 space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto" style={{ color: "var(--error)" }} />
        <h2 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
          Meeting Not Found
        </h2>
        <p className="text-sm max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
          {error instanceof Error ? error.message : "The meeting could not be located in your team."}
        </p>
        <Link
          to="/meetings"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-opacity hover:opacity-80"
          style={{
            borderColor: "var(--rule)",
            color: "var(--ink)",
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Meetings</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/meetings"
          className="inline-flex items-center gap-2 text-xs font-semibold hover:underline"
          style={{ color: "var(--ink-soft)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All meetings</span>
        </Link>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div
          className="p-4 rounded-xl border flex items-center justify-between"
          style={{
            backgroundColor: "rgba(179, 38, 30, 0.08)",
            borderColor: "var(--error)",
            color: "var(--error)",
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Card Header */}
      <div
        className="rounded-xl border p-6 shadow-xs relative overflow-hidden"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--rule)",
        }}
      >
        {/* Color stripe banner */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: getMeetingColor(meeting.colorIndex) }}
        />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-1">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Badge */}
              {meeting.status === "LIVE" && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full animate-pulse text-white"
                  style={{ backgroundColor: "var(--meeting-1)" }}
                >
                  <Radio className="w-3 h-3" />
                  <span>LIVE NOW</span>
                </span>
              )}
              {meeting.status === "SCHEDULED" && (
                <span
                  className="px-2.5 py-0.5 text-xs font-semibold rounded-md border"
                  style={{
                    backgroundColor: "var(--ground)",
                    borderColor: "var(--rule)",
                    color: "var(--ink-soft)",
                  }}
                >
                  SCHEDULED
                </span>
              )}
              {meeting.status === "ENDED" && (
                <span
                  className="px-2.5 py-0.5 text-xs font-medium rounded-md"
                  style={{ color: "var(--ink-soft)" }}
                >
                  ENDED
                </span>
              )}

              {/* AI Status */}
              {meeting.ai.status === "READY" && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold rounded-full"
                  style={{ backgroundColor: "rgba(46, 107, 74, 0.12)", color: "var(--success)" }}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Summary Ready</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              {meeting.title}
            </h1>

            {meeting.description && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {meeting.description}
              </p>
            )}

            {/* Metadata bar */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-2" style={{ color: "var(--ink-soft)" }}>
              <span>
                Host: <strong style={{ color: "var(--ink)" }}>{meeting.hostName}</strong>
              </span>

              {meeting.scheduledAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(meeting.scheduledAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}

              {meeting.durationSeconds !== undefined && meeting.durationSeconds > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(meeting.durationSeconds)}
                </span>
              )}

              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {meeting.participants.length} participant
                {meeting.participants.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Action buttons (Edit / Delete for host or admin) */}
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              {meeting.status !== "LIVE" && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="p-2 rounded-lg border transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: "var(--ground)",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                  }}
                  title="Edit Meeting"
                  aria-label="Edit meeting"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}

              {meeting.status !== "LIVE" && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="p-2 rounded-lg border transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: "rgba(179, 38, 30, 0.08)",
                    borderColor: "var(--error)",
                    color: "var(--error)",
                  }}
                  title="Delete Meeting"
                  aria-label="Delete meeting"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Room code banner & Copy controls */}
        <div
          className="mt-6 p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{
            backgroundColor: "var(--ground)",
            borderColor: "var(--rule)",
          }}
        >
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider block" style={{ color: "var(--ink-soft)" }}>
              Room Code
            </span>
            <span className="text-lg font-mono font-bold tracking-wider" style={{ color: "var(--ink)" }}>
              {meeting.roomCode}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors hover:opacity-80"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? "Copied" : "Copy code"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors hover:opacity-80"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Copied" : "Copy link"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* STATE-SPECIFIC SECTIONS */}

      {/* State 1: SCHEDULED */}
      {meeting.status === "SCHEDULED" && (
        <div
          className="rounded-xl border p-8 text-center space-y-4"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--rule)",
          }}
        >
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-black/5 dark:bg-white/5">
            <Video className="w-6 h-6" style={{ color: "var(--ink-soft)" }} />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
              {isHost ? "Ready to start this meeting?" : "Meeting is scheduled"}
            </h3>
            <p className="text-xs max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
              {isHost
                ? "Opening the room will mark the session as LIVE and allow team members to connect."
                : "The host has not opened this room yet. When they start it, you will be able to join."}
            </p>
          </div>

          <div className="pt-2">
            {isHost ? (
              <button
                type="button"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-sm"
                style={{
                  backgroundColor: "var(--signal)",
                  color: "var(--on-signal)",
                }}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{startMutation.isPending ? "Starting room..." : "Open room"}</span>
              </button>
            ) : (
              <div
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border"
                style={{
                  backgroundColor: "var(--ground)",
                  borderColor: "var(--rule)",
                  color: "var(--ink-soft)",
                }}
              >
                <Info className="w-4 h-4" />
                <span>Waiting for host to start</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* State 2: LIVE */}
      {meeting.status === "LIVE" && (
        <div
          className="rounded-xl border p-8 text-center space-y-6"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--rule)",
          }}
        >
          <div className="space-y-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full animate-pulse text-white"
              style={{ backgroundColor: "var(--meeting-1)" }}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>LIVE NOW</span>
            </span>
            <h3 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              This meeting is currently in progress
            </h3>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              Participants can connect to the lobby and join video or live chat.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate(`/room/${meeting.roomCode}`)}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-sm"
              style={{
                backgroundColor: "var(--signal)",
                color: "var(--on-signal)",
              }}
            >
              <Video className="w-4 h-4" />
              <span>Join room</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => endMutation.mutate()}
                disabled={endMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: "rgba(179, 38, 30, 0.08)",
                  borderColor: "var(--error)",
                  color: "var(--error)",
                }}
              >
                <Square className="w-4 h-4 fill-current" />
                <span>{endMutation.isPending ? "Ending..." : "End meeting"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* State 3: ENDED */}
      {meeting.status === "ENDED" && (
        <div className="space-y-6">
          {/* Write-up placeholder (implemented in P5) */}
          <div
            className="rounded-xl border p-8 space-y-4"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
            }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--rule)" }}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
                  Meeting Notes & AI Write-up
                </h3>
              </div>
              <span
                className="px-2.5 py-0.5 text-xs font-semibold rounded-full"
                style={{
                  backgroundColor: "rgba(210, 74, 0, 0.12)",
                  color: "var(--signal)",
                }}
              >
                Phase P5 Preview
              </span>
            </div>

            <div className="py-6 text-center space-y-2" style={{ color: "var(--ink-soft)" }}>
              <p className="text-sm font-medium">This meeting has ended.</p>
              <p className="text-xs max-w-md mx-auto">
                AI summary generation, key takeaways, decisions, and action item tracking will be automatically generated and displayed here in Phase P5.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meeting Modal */}
      {editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-lg rounded-xl border p-6 shadow-xl"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--rule)" }}>
              <h2 className="text-lg font-bold">Edit Meeting</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="p-1 rounded-md hover:opacity-75"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-hidden"
                  style={{
                    backgroundColor: "var(--ground)",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-hidden"
                  style={{
                    backgroundColor: "var(--ground)",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
                  Scheduled Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-hidden"
                  style={{
                    backgroundColor: "var(--ground)",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--rule)" }}>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border"
                  style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold rounded-lg"
                  style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-md rounded-xl border p-6 shadow-xl space-y-4"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
            }}
          >
            <h2 className="text-lg font-bold" style={{ color: "var(--error)" }}>
              Delete Meeting
            </h2>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Are you sure you want to delete <strong>{meeting.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--rule)" }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border"
                style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white"
                style={{ backgroundColor: "var(--error)" }}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
