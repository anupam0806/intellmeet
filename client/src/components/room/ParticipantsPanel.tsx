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
  captions: boolean;
}

interface ParticipantsPanelProps {
  selfName: string;
  selfAudio: boolean;
  selfVideo: boolean;
  selfCaptions?: boolean;
  isHost: boolean;
  peers: PeerStreamInfo[];
  hostId?: string;
}

export function ParticipantsPanel({
  selfName,
  selfAudio,
  selfVideo,
  selfCaptions = false,
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
      captions: selfCaptions,
    },
    ...(peers || []).map((p) => ({
      id: p.socketId,
      name: p.name,
      isSelf: false,
      isHost: p.userId === hostId,
      audio: p.media.audio,
      video: p.media.video,
      captions: Boolean(p.media.captions),
    })),
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--surface)",
        borderLeft: "1px solid var(--rule)",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--ink-soft)",
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
                borderRadius: "var(--radius)",
                backgroundColor: "var(--ground)",
                border: "1px solid var(--rule)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "var(--rule)",
                    color: "var(--ink)",
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
                      color: "var(--ink)",
                    }}
                  >
                    {p.name}
                  </span>
                  {p.isHost && (
                    <span style={{ fontSize: "10px", color: "var(--ink-soft)" }}>
                      Host
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {!p.captions && (
                  <span
                    data-testid="participant-captions-off"
                    style={{
                      fontSize: "10px",
                      color: "var(--ink-soft)",
                      backgroundColor: "var(--surface)",
                      padding: "1px 5px",
                      borderRadius: "3px",
                      border: "1px solid var(--rule)",
                    }}
                    title="Captions off"
                  >
                    captions off
                  </span>
                )}
                {p.audio ? (
                  <Mic size={14} style={{ color: "var(--ink)" }} />
                ) : (
                  <MicOff size={14} style={{ color: "var(--error)" }} />
                )}
                {p.video ? (
                  <Video size={14} style={{ color: "var(--ink)" }} />
                ) : (
                  <VideoOff size={14} style={{ color: "var(--ink-soft)" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

