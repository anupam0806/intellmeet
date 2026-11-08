import React, { useEffect, useState } from "react";
import { Bug, X } from "lucide-react";
import type { PeerDebugStats } from "../../lib/rtc.js";

interface DebugPanelProps {
  getDebugStats: () => Promise<PeerDebugStats[]>;
  audioPlaybackStates: Record<string, { muted: boolean; playing: boolean }>;
}

export function DebugPanel({
  getDebugStats,
  audioPlaybackStates,
}: DebugPanelProps): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<PeerDebugStats[]>([]);

  // Check if debug panel is allowed: DEV mode or ?debug=1 in dev build
  const isDev = Boolean(import.meta.env.DEV);
  const hasDebugQuery =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  const isAllowed = isDev || (isDev && hasDebugQuery);

  useEffect(() => {
    if (!isAllowed || !isOpen) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const data = await getDebugStats();
        if (isMounted) {
          setStats(data);
        }
      } catch {
        // Ignore stats polling error
      }
    }, 1000);

    // Initial fetch
    void getDebugStats().then((data) => {
      if (isMounted) setStats(data);
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAllowed, isOpen, getDebugStats]);

  if (!isAllowed) return null;

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        zIndex: 9999,
        fontFamily: "monospace",
      }}
    >
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "3px",
            color: "var(--ink)",
            padding: "6px 10px",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            boxShadow: "var(--shadow-menu)",
          }}
          aria-label="Open WebRTC Debug Panel"
        >
          <Bug size={14} />
          <span>WebRTC Debug</span>
        </button>
      ) : (
        <div
          style={{
            width: "360px",
            maxHeight: "420px",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-menu)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            color: "var(--ink)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "var(--ground)",
              borderBottom: "1px solid var(--rule)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Bug size={14} />
              <span>WebRTC Peer Diagnostics</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "var(--ink-soft)",
                cursor: "pointer",
                padding: "2px",
              }}
              aria-label="Close Debug Panel"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            {stats.length === 0 ? (
              <div style={{ color: "var(--ink-soft)", textAlign: "center", padding: "16px 0" }}>
                No active remote peers
              </div>
            ) : (
              stats.map((peer) => {
                const audioState = audioPlaybackStates[peer.socketId] || {
                  muted: false,
                  playing: false,
                };

                return (
                  <div
                    key={peer.socketId}
                    style={{
                      backgroundColor: "var(--ground)",
                      borderRadius: "3px",
                      padding: "8px",
                      border: "1px solid var(--rule)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "var(--meeting-1)" }}>
                      {peer.name} ({peer.socketId.slice(0, 6)}...)
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft)" }}>Connection: </span>
                      <span
                        style={{
                          color:
                            peer.connectionState === "connected"
                              ? "var(--success)"
                              : peer.connectionState === "failed"
                              ? "var(--error)"
                              : "var(--signal)",
                        }}
                      >
                        {peer.connectionState}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft)" }}>ICE state: </span>
                      <span
                        style={{
                          color:
                            peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed"
                              ? "var(--success)"
                              : peer.iceConnectionState === "failed"
                              ? "var(--error)"
                              : "var(--signal)",
                        }}
                      >
                        {peer.iceConnectionState}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft)" }}>Inbound audio: </span>
                      <span>{formatBytes(peer.audioBytesReceived)}</span>
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft)" }}>Inbound video: </span>
                      <span>{formatBytes(peer.videoBytesReceived)}</span>
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft)" }}>Remote audio element: </span>
                      <span>
                        {audioState.muted ? "Muted" : "Unmuted"} |{" "}
                        {audioState.playing ? (
                          <span style={{ color: "var(--success)" }}>Playing</span>
                        ) : (
                          <span style={{ color: "var(--signal)" }}>Paused/Waiting</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

