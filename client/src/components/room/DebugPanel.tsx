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
            backgroundColor: "rgba(24, 24, 27, 0.95)",
            border: "1px solid var(--rule, #3f3f46)",
            borderRadius: "6px",
            color: "var(--paper, #f4f4f5)",
            padding: "6px 10px",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
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
            backgroundColor: "rgba(18, 18, 20, 0.96)",
            border: "1px solid var(--rule, #3f3f46)",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            color: "var(--paper, #f4f4f5)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "var(--surface, #27272a)",
              borderBottom: "1px solid var(--rule, #3f3f46)",
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
                color: "var(--ink-soft, #a1a1aa)",
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
              <div style={{ color: "var(--ink-soft, #a1a1aa)", textAlign: "center", padding: "16px 0" }}>
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
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      borderRadius: "4px",
                      padding: "8px",
                      border: "1px solid var(--rule, #27272a)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "var(--accent-teal, #29a383)" }}>
                      {peer.name} ({peer.socketId.slice(0, 6)}...)
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft, #a1a1aa)" }}>Connection: </span>
                      <span
                        style={{
                          color:
                            peer.connectionState === "connected"
                              ? "#46a758"
                              : peer.connectionState === "failed"
                              ? "#e5484d"
                              : "#e5a000",
                        }}
                      >
                        {peer.connectionState}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft, #a1a1aa)" }}>ICE state: </span>
                      <span
                        style={{
                          color:
                            peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed"
                              ? "#46a758"
                              : peer.iceConnectionState === "failed"
                              ? "#e5484d"
                              : "#e5a000",
                        }}
                      >
                        {peer.iceConnectionState}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft, #a1a1aa)" }}>Inbound audio: </span>
                      <span>{formatBytes(peer.audioBytesReceived)}</span>
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft, #a1a1aa)" }}>Inbound video: </span>
                      <span>{formatBytes(peer.videoBytesReceived)}</span>
                    </div>

                    <div>
                      <span style={{ color: "var(--ink-soft, #a1a1aa)" }}>Remote audio element: </span>
                      <span>
                        {audioState.muted ? "Muted" : "Unmuted"} |{" "}
                        {audioState.playing ? (
                          <span style={{ color: "#46a758" }}>Playing</span>
                        ) : (
                          <span style={{ color: "#e5a000" }}>Paused/Waiting</span>
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

