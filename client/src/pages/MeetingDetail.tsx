import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore.js";
import { apiFetch } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import {
  fetchMeeting,
  startMeeting,
  endMeeting,
  deleteMeeting,
  updateMeeting,
  getMeetingColor,
  formatDuration,
  getMeetingTranscript,
  postMeetingTranscript,
  getMeetingChat,
  generateAiWriteup,
  updateActionItem,
  convertActionItemToTask,
  downloadMeetingExport,
  type Meeting,
  type MeetingActionItem,
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
  Info,
  X,
  FileText,
  Upload,
  Download,
  RefreshCw,
  MessageSquare,
  Clock3,
  Loader2,
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
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");

  // Action item inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemTitle, setEditItemTitle] = useState("");
  const [editItemAssigneeId, setEditItemAssigneeId] = useState<string | null>(null);
  const [editItemDueDate, setEditItemDueDate] = useState<string>("");

  // Export progress
  const [isExporting, setIsExporting] = useState<"md" | "json" | null>(null);

  // Polling fallback state for PENDING write-up (up to 3 minutes)
  const [pollStartTime, setPollStartTime] = useState<number | null>(null);

  const {
    data: meeting,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => fetchMeeting(id!),
    enabled: Boolean(id),
    refetchInterval:
      pollStartTime !== null && Date.now() - pollStartTime < 180000 ? 5000 : false,
  });

  useEffect(() => {
    if (meeting?.status === "ENDED" && meeting.ai.status === "PENDING") {
      if (pollStartTime === null) {
        setPollStartTime(Date.now());
      }
    } else {
      setPollStartTime(null);
    }
  }, [meeting?.status, meeting?.ai.status, pollStartTime]);

  // Socket listener for meeting:ai-ready
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
    const handleAiReady = (data: { meetingId: string; status: string }) => {
      if (data.meetingId === id) {
        void queryClient.invalidateQueries({ queryKey: ["meeting", id] });
      }
    };
    socket.on("meeting:ai-ready", handleAiReady);
    return () => {
      socket.off("meeting:ai-ready", handleAiReady);
    };
  }, [id, queryClient]);

  // Team query for assignee options
  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: () =>
      apiFetch<{
        id: string;
        name: string;
        members: Array<{ id: string; name: string; email: string; role: string }>;
      }>("/api/v1/team"),
  });
  const teamMembers = teamQuery.data?.members || [];

  // Chat query for Chat Log section
  const chatQuery = useQuery({
    queryKey: ["meeting-chat", id],
    queryFn: () => getMeetingChat(id!),
    enabled: Boolean(id && meeting?.status === "ENDED"),
  });

  const isHost = meeting?.hostId === currentUser?.id;
  const isAdmin = currentUser?.role === "ADMIN";
  const canManage = isHost || isAdmin;

  // AI write-up generation mutation
  const generateAiMutation = useMutation({
    mutationFn: () => generateAiWriteup(id!),
    onSuccess: () => {
      setRegenerateConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["meeting", id] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to generate AI write-up");
      setRegenerateConfirmOpen(false);
    },
  });

  // Action item update mutation
  const updateActionItemMutation = useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: string;
      data: { title?: string; assigneeId?: string | null; dueDate?: string | null };
    }) => updateActionItem(id!, itemId, data),
    onSuccess: (res) => {
      setEditingItemId(null);
      queryClient.setQueryData(["meeting", id], (old: Meeting | undefined) => {
        if (!old) return old;
        return {
          ...old,
          ai: {
            ...old.ai,
            actionItems: old.ai.actionItems.map((item) =>
              item.id === res.item.id ? res.item : item,
            ),
          },
        };
      });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to update action item");
    },
  });

  async function handleExport(format: "md" | "json") {
    if (!meeting) return;
    try {
      setIsExporting(format);
      await downloadMeetingExport(meeting.id, format);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(null);
    }
  }

  function startEditingItem(item: { id: string; title: string; assigneeId?: string; dueDate?: string }) {
    setEditingItemId(item.id);
    setEditItemTitle(item.title);
    setEditItemAssigneeId(item.assigneeId || null);
    setEditItemDueDate(item.dueDate ? item.dueDate.slice(0, 10) : "");
  }

  function handleSaveItemEdit(itemId: string) {
    if (!editItemTitle.trim()) return;
    updateActionItemMutation.mutate({
      itemId,
      data: {
        title: editItemTitle.trim(),
        assigneeId: editItemAssigneeId,
        dueDate: editItemDueDate ? editItemDueDate : null,
      },
    });
  }

  // Convert action item to task
  const [convertItem, setConvertItem] = useState<MeetingActionItem | null>(null);
  const [convertAssigneeId, setConvertAssigneeId] = useState<string | null>(null);
  const [convertDueDate, setConvertDueDate] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  function openConvertDialog(item: MeetingActionItem) {
    setConvertItem(item);
    setConvertAssigneeId(item.assigneeId || null);
    setConvertDueDate(item.dueDate ? item.dueDate.slice(0, 10) : "");
  }

  const convertActionItemMutation = useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: string;
      data: { assigneeId?: string | null; dueDate?: string | null };
    }) => convertActionItemToTask(id!, itemId, data),
    onSuccess: (res, variables) => {
      setToastMessage("Task created");
      setConvertItem(null);
      queryClient.setQueryData(["meeting", id], (old: Meeting | undefined) => {
        if (!old) return old;
        return {
          ...old,
          ai: {
            ...old.ai,
            actionItems: old.ai.actionItems.map((item) =>
              item.id === variables.itemId ? { ...item, taskId: res.task.id } : item,
            ),
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to convert action item to task");
    },
  });

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

  // Transcript query & paste mutation
  const transcriptQuery = useQuery({
    queryKey: ["meeting-transcript", id],
    queryFn: () => getMeetingTranscript(id!),
    enabled: Boolean(id && meeting?.status === "ENDED"),
  });

  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [pasteSuccess, setPasteSuccess] = useState(false);

  const pasteTranscriptMutation = useMutation({
    mutationFn: (text: string) => postMeetingTranscript(id!, text),
    onSuccess: () => {
      setPasteText("");
      setPasteError("");
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 3000);
      void queryClient.invalidateQueries({ queryKey: ["meeting-transcript", id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to paste transcript";
      setPasteError(msg);
    },
  });

  const missingSpeechParticipants = (meeting?.participants || [])
    .filter((p) => !p.captionsOn)
    .map((p) => p.name)
    .filter((name, idx, arr) => arr.indexOf(name) === idx);

  const isTranscriptEmpty = (transcriptQuery.data?.total ?? 0) === 0;
  const showPastePanel =
    canManage && (isTranscriptEmpty || missingSpeechParticipants.length > 0);

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
          className="p-4 rounded-lg border flex items-center justify-between"
          style={{
            backgroundColor: "var(--ground)",
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
        className="rounded-lg border p-6 shadow-xs relative overflow-hidden"
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
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-lg animate-pulse"
                  style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
                >
                  <Radio className="w-3 h-3" />
                  <span>LIVE NOW</span>
                </span>
              )}
              {meeting.status === "SCHEDULED" && (
                <span
                  className="px-2.5 py-0.5 text-xs font-semibold rounded-lg border"
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
                  className="px-2.5 py-0.5 text-xs font-medium rounded-lg"
                  style={{ color: "var(--ink-soft)" }}
                >
                  ENDED
                </span>
              )}

              {/* AI Status */}
              {meeting.ai.status === "READY" && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold rounded-lg"
                  style={{ backgroundColor: "var(--ground)", color: "var(--success)" }}
                >
                  <FileText className="w-3 h-3" />
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
                {(meeting.participants || []).length} participant
                {(meeting.participants || []).length === 1 ? "" : "s"}
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
                    backgroundColor: "var(--ground)",
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors hover:opacity-80"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" style={{ color: "var(--success)" }} /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? "Copied" : "Copy code"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors hover:opacity-80"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" style={{ color: "var(--success)" }} /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Copied" : "Copy link"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* STATE-SPECIFIC SECTIONS */}

      {/* State 1: SCHEDULED */}
      {meeting.status === "SCHEDULED" && (
        <div
          className="rounded-lg border p-8 text-center space-y-4"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--rule)",
          }}
        >
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: "var(--ground)" }}>
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
          className="rounded-lg border p-8 text-center space-y-6"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--rule)",
          }}
        >
          <div className="space-y-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg animate-pulse"
              style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
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
                  backgroundColor: "var(--ground)",
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
          {/* AI Write-up Section */}
          {meeting.ai.status === "PENDING" && (
            <div
              data-testid="ai-status-pending"
              className="rounded-lg border p-6 space-y-3"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
              }}
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--signal)" }} />
                <h3 className="text-base font-bold" style={{ color: "var(--ink)" }}>
                  AI write-up in progress
                </h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Generating summary, key points, decisions, and action items from the transcript and chat log. This page updates automatically when ready.
              </p>
            </div>
          )}

          {meeting.ai.status === "INSUFFICIENT" && (
            <div
              data-testid="ai-status-insufficient"
              className="rounded-lg border p-6 space-y-3"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" style={{ color: "var(--ink-soft)" }} />
                <h3 className="text-base font-bold" style={{ color: "var(--ink)" }}>
                  Not enough content for write-up
                </h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                There was not enough speech recorded (at least 5 transcript segments and 40 spoken words are required) to generate an accurate summary. You can paste a transcript or external notes below to generate the write-up.
              </p>
              {canManage && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setRegenerateConfirmOpen(true)}
                    disabled={generateAiMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: "var(--ground)",
                      borderColor: "var(--rule)",
                      color: "var(--ink)",
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{generateAiMutation.isPending ? "Generating..." : "Generate write-up"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {meeting.ai.status === "FAILED" && (
            <div
              data-testid="ai-status-failed"
              className="rounded-lg border p-6 space-y-3"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--error)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" style={{ color: "var(--error)" }} />
                  <h3 className="text-base font-bold" style={{ color: "var(--error)" }}>
                    AI write-up failed
                  </h3>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setRegenerateConfirmOpen(true)}
                    disabled={generateAiMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs"
                    style={{
                      backgroundColor: "var(--signal)",
                      color: "var(--on-signal)",
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{generateAiMutation.isPending ? "Regenerating..." : "Regenerate"}</span>
                  </button>
                )}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {meeting.ai.error || "The AI write-up could not be generated. Please try again."}
              </p>
            </div>
          )}

          {meeting.ai.status === "READY" && (
            <div data-testid="ai-writeup-ready" className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Document column: Summary, Key Points, Decisions */}
              <div className="lg:col-span-2 space-y-6">
                {/* Summary Card */}
                <div
                  className="rounded-lg border p-6 space-y-3"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--rule)",
                  }}
                >
                  <div>
                    <h3 className="text-xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                      Summary
                    </h3>
                    <p className="text-2xs font-medium" style={{ color: "var(--ink-soft)" }}>
                      Generated from the transcript and chat.
                    </p>
                  </div>
                  <p
                    data-testid="ai-summary"
                    className="text-base leading-relaxed"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "Newsreader, Georgia, serif",
                    }}
                  >
                    {meeting.ai.summary || "No summary available."}
                  </p>
                </div>

                {/* Key points Card */}
                <div
                  className="rounded-lg border p-6 space-y-3"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--rule)",
                  }}
                >
                  <h3 className="text-lg font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                    Key points
                  </h3>
                  {meeting.ai.keyPoints && meeting.ai.keyPoints.length > 0 ? (
                    <ul
                      data-testid="ai-key-points"
                      className="space-y-2 list-disc list-inside text-sm leading-relaxed"
                      style={{
                        color: "var(--ink)",
                        fontFamily: "Newsreader, Georgia, serif",
                      }}
                    >
                      {meeting.ai.keyPoints.map((kp, idx) => (
                        <li key={idx}>{kp}</li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className="text-sm italic"
                      style={{ color: "var(--ink-soft)", fontFamily: "Newsreader, Georgia, serif" }}
                    >
                      No key points identified.
                    </p>
                  )}
                </div>

                {/* Decisions Card */}
                <div
                  className="rounded-lg border p-6 space-y-3"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--rule)",
                  }}
                >
                  <h3 className="text-lg font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                    Decisions
                  </h3>
                  {meeting.ai.decisions && meeting.ai.decisions.length > 0 ? (
                    <ul
                      data-testid="ai-decisions"
                      className="space-y-2 list-disc list-inside text-sm leading-relaxed"
                      style={{
                        color: "var(--ink)",
                        fontFamily: "Newsreader, Georgia, serif",
                      }}
                    >
                      {meeting.ai.decisions.map((decision, idx) => (
                        <li key={idx}>{decision}</li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className="text-sm italic"
                      style={{ color: "var(--ink-soft)", fontFamily: "Newsreader, Georgia, serif" }}
                    >
                      No decisions recorded.
                    </p>
                  )}
                </div>
              </div>

              {/* Sticky Right Margin: Action items, Export, Regenerate */}
              <div className="lg:col-span-1 lg:sticky lg:top-6 self-start space-y-6">
                {/* Action items card */}
                <div
                  className="rounded-lg border p-5 space-y-4 shadow-2xs"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--rule)",
                  }}
                >
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--rule)" }}>
                    <h3 className="text-base font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                      Action items
                    </h3>
                    <span
                      className="px-2 py-0.5 text-2xs font-semibold rounded-md border"
                      style={{
                        backgroundColor: "var(--ground)",
                        borderColor: "var(--rule)",
                        color: "var(--ink)",
                      }}
                    >
                      {meeting.ai.actionItems?.length || 0}
                    </span>
                  </div>

                  {meeting.ai.actionItems && meeting.ai.actionItems.length > 0 ? (
                    <div data-testid="ai-action-items-list" className="space-y-3">
                      {meeting.ai.actionItems.map((item, index) => {
                        const isEditing = editingItemId === item.id;

                        return (
                          <div
                            key={item.id}
                            data-testid={`action-item-${item.id}`}
                            className="action-item-staged p-3 rounded-lg border space-y-2.5"
                            style={{
                              backgroundColor: "var(--ground)",
                              borderColor: "var(--rule)",
                              borderLeft: `3px solid ${getMeetingColor(meeting.colorIndex)}`,
                              animationDelay: `${index * 70}ms`,
                            }}
                          >
                            {isEditing ? (
                              <div className="space-y-2.5 pt-1">
                                <div>
                                  <label className="block text-2xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
                                    Title
                                  </label>
                                  <input
                                    type="text"
                                    value={editItemTitle}
                                    onChange={(e) => setEditItemTitle(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs rounded-md border"
                                    style={{
                                      backgroundColor: "var(--surface)",
                                      borderColor: "var(--rule)",
                                      color: "var(--ink)",
                                    }}
                                  />
                                </div>

                                <div>
                                  <label className="block text-2xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
                                    Assignee
                                  </label>
                                  <select
                                    value={editItemAssigneeId || ""}
                                    onChange={(e) => setEditItemAssigneeId(e.target.value || null)}
                                    className="w-full px-2.5 py-1.5 text-xs rounded-md border"
                                    style={{
                                      backgroundColor: "var(--surface)",
                                      borderColor: "var(--rule)",
                                      color: "var(--ink)",
                                    }}
                                  >
                                    <option value="">Unassigned</option>
                                    {teamMembers.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-2xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
                                    Due Date
                                  </label>
                                  <input
                                    type="date"
                                    value={editItemDueDate}
                                    onChange={(e) => setEditItemDueDate(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs rounded-md border"
                                    style={{
                                      backgroundColor: "var(--surface)",
                                      borderColor: "var(--rule)",
                                      color: "var(--ink)",
                                    }}
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingItemId(null)}
                                    className="px-2.5 py-1 text-2xs font-medium rounded-md border"
                                    style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveItemEdit(item.id)}
                                    disabled={updateActionItemMutation.isPending}
                                    className="px-2.5 py-1 text-2xs font-semibold rounded-md"
                                    style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
                                  >
                                    {updateActionItemMutation.isPending ? "Saving..." : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-semibold leading-snug" style={{ color: "var(--ink)" }}>
                                    {item.title}
                                  </p>
                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={() => startEditingItem(item)}
                                      aria-label="Edit action item"
                                      className="p-1 rounded hover:opacity-80 shrink-0"
                                      style={{ color: "var(--ink-soft)" }}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-2xs pt-0.5" style={{ color: "var(--ink-soft)" }}>
                                  {item.assigneeName ? (
                                    <span
                                      className="px-2 py-0.5 rounded-full border font-medium"
                                      style={{
                                        backgroundColor: "var(--surface)",
                                        borderColor: "var(--rule)",
                                        color: "var(--ink)",
                                      }}
                                    >
                                      {item.assigneeName}
                                    </span>
                                  ) : (
                                    <span className="italic">Unassigned</span>
                                  )}

                                  {item.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <Clock3 className="w-3 h-3" />
                                      <span>{new Date(item.dueDate).toLocaleDateString()}</span>
                                    </span>
                                  )}
                                </div>

                                {/* Convert to task / View task */}
                                <div className="pt-2 border-t" style={{ borderColor: "var(--rule)" }}>
                                  {item.taskId ? (
                                    <div className="flex items-center justify-between text-xs">
                                      <span
                                        className="px-2 py-0.5 text-2xs font-medium rounded border opacity-70"
                                        style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
                                      >
                                        Converted
                                      </span>
                                      <Link
                                        to={`/tasks?highlight=${item.taskId}`}
                                        className="text-xs font-semibold underline decoration-1 underline-offset-2 hover:opacity-80 transition-opacity"
                                        style={{ color: "var(--signal)" }}
                                      >
                                        View task
                                      </Link>
                                    </div>
                                  ) : canManage ? (
                                    <button
                                      type="button"
                                      onClick={() => openConvertDialog(item)}
                                      className="w-full py-1.5 px-3 text-xs font-semibold rounded-md border hover:opacity-80 transition-opacity"
                                      style={{
                                        backgroundColor: "var(--surface)",
                                        borderColor: "var(--rule)",
                                        color: "var(--ink)",
                                      }}
                                    >
                                      Convert to task
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled
                                      aria-disabled="true"
                                      className="w-full py-1.5 px-3 text-xs font-semibold rounded-md border opacity-50 cursor-not-allowed"
                                      style={{
                                        backgroundColor: "var(--surface)",
                                        borderColor: "var(--rule)",
                                        color: "var(--ink-soft)",
                                      }}
                                    >
                                      Convert to task
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs italic py-2" style={{ color: "var(--ink-soft)" }}>
                      No action items identified.
                    </p>
                  )}
                </div>

                {/* Actions card: Export & Regenerate */}
                <div
                  className="rounded-lg border p-5 space-y-3.5 shadow-2xs"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--rule)",
                  }}
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
                    Actions & Export
                  </h4>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleExport("md")}
                      disabled={isExporting !== null}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--ground)",
                        borderColor: "var(--rule)",
                        color: "var(--ink)",
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isExporting === "md" ? "Exporting Markdown..." : "Export as Markdown (.md)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExport("json")}
                      disabled={isExporting !== null}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--ground)",
                        borderColor: "var(--rule)",
                        color: "var(--ink)",
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isExporting === "json" ? "Exporting JSON..." : "Export as JSON (.json)"}</span>
                    </button>

                    {canManage && (
                      <div className="pt-2 border-t" style={{ borderColor: "var(--rule)" }}>
                        <button
                          type="button"
                          onClick={() => setRegenerateConfirmOpen(true)}
                          disabled={generateAiMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-90"
                          style={{
                            backgroundColor: "var(--surface)",
                            borderColor: "var(--rule)",
                            color: "var(--ink)",
                          }}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${generateAiMutation.isPending ? "animate-spin" : ""}`} />
                          <span>{generateAiMutation.isPending ? "Regenerating..." : "Regenerate write-up"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Missing Speech Notice */}
          {missingSpeechParticipants.length > 0 && (
            <div
              data-testid="missing-speech-notice"
              className="rounded-lg border p-4 flex items-start gap-3"
              style={{
                backgroundColor: "var(--ground)",
                borderColor: "var(--meeting-3)",
                color: "var(--ink)",
              }}
            >
              <Info className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--meeting-3)" }} />
              <div className="text-sm">
                <strong>Incomplete transcript notice: </strong>
                <span>
                  Speech from {missingSpeechParticipants.join(", ")} is not in this transcript.
                </span>
              </div>
            </div>
          )}

          {/* Prominent Paste Panel */}
          {showPastePanel && (
            <div
              data-testid="paste-transcript-panel"
              className="rounded-lg border p-6 space-y-4"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5" style={{ color: "var(--signal)" }} />
                  <h3 className="text-base font-bold" style={{ color: "var(--ink)" }}>
                    Paste Transcript
                  </h3>
                </div>
                <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
                  Host / Admin action
                </span>
              </div>

              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                You can paste meeting notes or an external transcript. It will be split into segments
                and added to the meeting transcript.
              </p>

              {pasteError && (
                <div
                  className="p-3 text-xs rounded-lg border"
                  style={{
                    backgroundColor: "var(--ground)",
                    borderColor: "var(--error)",
                    color: "var(--error)",
                  }}
                >
                  {pasteError}
                </div>
              )}

              {pasteSuccess && (
                <div
                  className="p-3 text-xs rounded-lg border"
                  style={{
                    backgroundColor: "var(--ground)",
                    borderColor: "var(--success)",
                    color: "var(--success)",
                  }}
                >
                  Transcript successfully saved and added to the meeting.
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!pasteText.trim()) return;
                  pasteTranscriptMutation.mutate(pasteText);
                }}
                className="space-y-3"
              >
                <textarea
                  data-testid="paste-transcript-textarea"
                  rows={4}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  maxLength={50000}
                  placeholder="Paste transcript text here (up to 50,000 characters)..."
                  className="w-full rounded-lg border p-3 text-sm focus:outline-hidden"
                  style={{
                    backgroundColor: "var(--ground)",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                    fontFamily: "Newsreader, Georgia, serif",
                  }}
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
                    {pasteText.length.toLocaleString()} / 50,000 characters
                  </span>
                  <button
                    type="submit"
                    disabled={!pasteText.trim() || pasteTranscriptMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--signal)",
                      color: "var(--on-signal)",
                    }}
                  >
                    <span>
                      {pasteTranscriptMutation.isPending ? "Saving transcript..." : "Save transcript"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Transcript Section */}
          <div
            className="rounded-xl border p-8 space-y-6"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
            }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--rule)" }}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: "var(--ink)" }} />
                <h3 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
                  Meeting Transcript
                </h3>
              </div>
              <span
                className="px-2.5 py-0.5 text-xs font-semibold rounded-full border"
                style={{
                  backgroundColor: "var(--ground)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              >
                {transcriptQuery.data?.total ?? 0} segments
              </span>
            </div>

            {transcriptQuery.isLoading ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--ink-soft)" }}>
                Loading transcript...
              </div>
            ) : isTranscriptEmpty ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--ink-soft)" }}>
                No transcript segments recorded for this meeting.
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl">
                {transcriptQuery.data?.items.map((segment) => {
                  const timeStr = new Date(segment.ts).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <div
                      key={segment.id}
                      className="p-3.5 rounded-lg border space-y-1.5"
                      style={{
                        backgroundColor: "var(--ground)",
                        borderColor: "var(--rule)",
                      }}
                    >
                      <div className="flex items-center justify-between text-xs" style={{ color: "var(--ink-soft)" }}>
                        <span className="font-semibold" style={{ color: "var(--ink)" }}>
                          {segment.speakerName}
                        </span>
                        <span className="tabular-nums">{timeStr}</span>
                      </div>
                      <p
                        className="text-sm leading-relaxed"
                        style={{
                          color: "var(--ink)",
                          fontFamily: "Newsreader, Georgia, serif",
                        }}
                      >
                        {segment.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat Log Section */}
          <div
            data-testid="meeting-chat-section"
            className="rounded-xl border p-8 space-y-6"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
            }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--rule)" }}>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" style={{ color: "var(--ink)" }} />
                <h3 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
                  Meeting Chat Log
                </h3>
              </div>
              <span
                className="px-2.5 py-0.5 text-xs font-semibold rounded-full border"
                style={{
                  backgroundColor: "var(--ground)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              >
                {chatQuery.data?.items.length ?? 0} messages
              </span>
            </div>

            {chatQuery.isLoading ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--ink-soft)" }}>
                Loading chat log...
              </div>
            ) : (chatQuery.data?.items.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--ink-soft)" }}>
                No in-meeting chat messages were sent during this session.
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl">
                {chatQuery.data?.items.map((msg) => {
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={msg.id}
                      className="p-3 rounded-lg border space-y-1"
                      style={{
                        backgroundColor: "var(--ground)",
                        borderColor: "var(--rule)",
                      }}
                    >
                      <div className="flex items-center justify-between text-xs" style={{ color: "var(--ink-soft)" }}>
                        <span className="font-semibold" style={{ color: "var(--ink)" }}>
                          {msg.senderName}
                        </span>
                        <span className="tabular-nums">{timeStr}</span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
                        {msg.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Meeting Modal */}
      {editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        >
          <div
            className="w-full max-w-lg rounded-lg border p-6 shadow-xl"
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
                className="p-1 rounded-lg hover:opacity-75"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        >
          <div
            className="w-full max-w-md rounded-lg border p-6 shadow-xl space-y-4"
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
                className="px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ backgroundColor: "var(--error)", color: "var(--on-signal)" }}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate AI Confirmation Modal */}
      {regenerateConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        >
          <div
            className="w-full max-w-md rounded-lg border p-6 shadow-xl space-y-4"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
            }}
          >
            <h2 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
              Regenerate Write-up
            </h2>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Are you sure you want to regenerate the AI write-up? This will re-analyze the meeting transcript and chat to produce new summary notes, decisions, and action items.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--rule)" }}>
              <button
                type="button"
                onClick={() => setRegenerateConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border"
                style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => generateAiMutation.mutate()}
                disabled={generateAiMutation.isPending}
                className="px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
              >
                {generateAiMutation.isPending ? "Generating..." : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Action Item to Task Dialog */}
      {convertItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="convert-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        >
          <div
            className="w-full max-w-md rounded-lg border p-6 space-y-4 shadow-xl"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
            }}
          >
            <div className="flex items-center justify-between">
              <h2 id="convert-dialog-title" className="text-base font-bold" style={{ color: "var(--ink)" }}>
                Convert to task
              </h2>
              <button
                type="button"
                onClick={() => setConvertItem(null)}
                aria-label="Close"
                className="p-1 rounded hover:opacity-80"
                style={{ color: "var(--ink-soft)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
                  Title
                </label>
                <div
                  className="p-2.5 rounded-md border text-xs font-medium"
                  style={{
                    backgroundColor: "var(--smoke)",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                  }}
                >
                  {convertItem.title}
                </div>
              </div>

              <div>
                <label htmlFor="convert-assignee" className="block text-2xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
                  Assignee
                </label>
                <select
                  id="convert-assignee"
                  value={convertAssigneeId || ""}
                  onChange={(e) => setConvertAssigneeId(e.target.value ? e.target.value : null)}
                  className="w-full px-2.5 py-1.5 rounded-md border text-xs outline-none"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                  }}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="convert-due-date" className="block text-2xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
                  Due date
                </label>
                <input
                  id="convert-due-date"
                  type="date"
                  value={convertDueDate}
                  onChange={(e) => setConvertDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border text-xs outline-none"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--rule)",
                    color: "var(--ink)",
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--rule)" }}>
              <button
                type="button"
                onClick={() => setConvertItem(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border hover:opacity-80"
                style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={convertActionItemMutation.isPending}
                onClick={() => {
                  convertActionItemMutation.mutate({
                    itemId: convertItem.id,
                    data: {
                      assigneeId: convertAssigneeId,
                      dueDate: convertDueDate || null,
                    },
                  });
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-md hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
              >
                {convertActionItemMutation.isPending ? "Converting..." : "Convert to task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-6 z-50 px-4 py-2.5 rounded-lg border shadow-lg text-xs font-semibold flex items-center gap-2"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--rule)",
            color: "var(--ink)",
          }}
        >
          <Check className="w-3.5 h-3.5" style={{ color: "var(--signal)" }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
