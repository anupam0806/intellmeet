import React from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import type { PeerStreamInfo } from "../../lib/rtc.js";

interface ParticipantItem {
  id: string;
  name: string;
  isSelf?: boolean;
  isHost?: boolean;
  audio: boolean;
  video: boolean;
}

interface ParticipantsPanelProps {
  selfName: string;
  selfAudio: boolean;
  selfVideo: boolean;
  isHost: boolean;
  peers: PeerStreamInfo[];
  hostId?: string;
}

export function ParticipantsPanel({
  selfName,
  selfAudio,
  selfVideo,
  isHost,
  peers,
  hostId,
}: ParticipantsPanelProps): React.JSX.Element {
  const participants: ParticipantItem[] = [
    {
      id: "self",
      name: `${selfName} (You)`,
      isSelf: true,
      isHost,
      audio: selfAudio,
      video: selfVideo,
    },
    ...peers.map((p) => ({
      id: p.socketId,
      name: p.name,
      isSelf: false,
      isHost: p.userId === hostId,
      audio: p.media.audio,
      video: p.media.video,
    })),
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--surface, #18181b)",
        borderLeft: "1px solid var(--rule, #27272a)",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--ink-soft, #a1a1aa)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "12px",
        }}
      >
        In this call ({participants.length})
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
        {participants.map((p) => {
          const initials = p.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: "var(--radius, 6px)",
                backgroundColor: "var(--ink, #09090b)",
                border: "1px solid var(--rule, #27272a)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "var(--rule, #3f3f46)",
                    color: "var(--paper, #f4f4f5)",
                    fontSize: "11px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {initials}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--paper, #f4f4f5)",
                    }}
                  >
                    {p.name}
                  </span>
                  {p.isHost && (
                    <span style={{ fontSize: "10px", color: "var(--ink-soft, #a1a1aa)" }}>
                      Host
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {p.audio ? (
                  <Mic size={14} style={{ color: "var(--paper, #f4f4f5)" }} />
                ) : (
                  <MicOff size={14} style={{ color: "var(--accent-red, #e5484d)" }} />
                )}
                {p.video ? (
                  <Video size={14} style={{ color: "var(--paper, #f4f4f5)" }} />
                ) : (
                  <VideoOff size={14} style={{ color: "var(--ink-soft, #71717a)" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
