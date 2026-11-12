import React, { useState } from "react";
import { createMeeting, type Meeting } from "../lib/meetings.js";
import { ApiClientError } from "../lib/api.js";
import { X, Calendar, FileText, Type } from "lucide-react";

interface CreateMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (meeting: Meeting) => void;
}

export function CreateMeetingDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateMeetingDialogProps): React.JSX.Element | null {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 2) {
      setError("Title must be at least 2 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: { title: string; description?: string; scheduledAt?: string } = {
        title: title.trim(),
      };
      if (description.trim()) {
        payload.description = description.trim();
      }
      if (scheduledAt) {
        payload.scheduledAt = new Date(scheduledAt).toISOString();
      }

      const meeting = await createMeeting(payload);
      setTitle("");
      setDescription("");
      setScheduledAt("");
      onClose();
      if (onSuccess) {
        onSuccess(meeting);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to create meeting. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-meeting-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-lg max-h-[calc(100dvh-32px)] overflow-y-auto rounded-lg border p-6 transition-all"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--rule)",
          color: "var(--ink)",
          boxShadow: "var(--shadow-menu)",
        }}
      >
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--rule)" }}>
          <h2 id="create-meeting-title" className="text-xl font-bold tracking-tight">
            New Meeting
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-11 h-11 flex items-center justify-center rounded-lg transition-colors hover:opacity-75"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            className="mt-4 p-3 rounded-lg text-sm border font-medium"
            style={{
              backgroundColor: "var(--ground)",
              borderColor: "var(--error)",
              color: "var(--error)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="meeting-title" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>
              Meeting title *
            </label>
            <div className="relative">
              <Type className="absolute left-3 top-3 w-4 h-4" style={{ color: "var(--ink-soft)" }} />
              <input
                id="meeting-title"
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q4 Roadmap Sync"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-colors"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="meeting-desc" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>
              Description (optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4" style={{ color: "var(--ink-soft)" }} />
              <textarea
                id="meeting-desc"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief agenda or context..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-colors"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="meeting-time" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>
              Schedule time (optional)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-4 h-4" style={{ color: "var(--ink-soft)" }} />
              <input
                id="meeting-time"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-colors"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              />
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
              Leave blank to create a meeting ready to start anytime.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--rule)" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg border transition-colors hover:opacity-80"
              style={{
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: "var(--signal)",
                color: "var(--on-signal)",
              }}
            >
              {loading ? "Creating..." : "Create Meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

