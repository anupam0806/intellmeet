import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinMeetingByCode } from "../lib/meetings.js";
import { ApiClientError } from "../lib/api.js";
import { X, Hash, ArrowRight } from "lucide-react";

interface JoinMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinMeetingDialog({
  isOpen,
  onClose,
}: JoinMeetingDialogProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = roomCode.trim().toLowerCase();
    if (!cleanCode) {
      setError("Please enter a room code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { meeting } = await joinMeetingByCode(cleanCode);
      onClose();
      if (meeting.status === "LIVE") {
        navigate(`/room/${meeting.roomCode}`);
      } else {
        navigate(`/meetings/${meeting.id}`);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === "MEETING_ENDED") {
          setError("This meeting has already ended.");
        } else if (err.code === "NOT_FOUND") {
          setError("No meeting found with this code in your team.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to join meeting. Please check the code and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-meeting-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto rounded-lg border p-6 transition-all"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--rule)",
          color: "var(--ink)",
          boxShadow: "var(--shadow-menu)",
        }}
      >
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--rule)" }}>
          <h2 id="join-meeting-title" className="text-xl font-bold tracking-tight">
            Join with code
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
            <label htmlFor="join-code" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>
              Room code *
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 w-4 h-4" style={{ color: "var(--ink-soft)" }} />
              <input
                id="join-code"
                type="text"
                required
                maxLength={20}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="e.g. 7k3m9p2x4q"
                className="w-full pl-9 pr-3 py-2 text-sm font-mono tracking-wider rounded-lg border transition-colors"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              />
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
              Enter the 10-character code shared by your teammate.
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
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: "var(--signal)",
                color: "var(--on-signal)",
              }}
            >
              <span>{loading ? "Joining..." : "Join"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

