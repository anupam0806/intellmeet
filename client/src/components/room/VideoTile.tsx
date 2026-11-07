import React, { useEffect, useRef } from "react";
import { MicOff, VideoOff, RefreshCw } from "lucide-react";
import { getMeetingColor } from "../../lib/meetings.js";

interface VideoTileProps {
  stream?: MediaStream | null;
  name: string;
  isSelf?: boolean;
  isHost?: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  isActiveSpeaker?: boolean;
  colorIndex?: number;
  isFailed?: boolean;
  onRetryConnection?: () => void;
}

export function VideoTile({
  stream,
  name,
  isSelf = false,
  isHost = false,
  audioEnabled = true,
  videoEnabled = true,
  isActiveSpeaker = false,
  colorIndex = 0,
  isFailed = false,
  onRetryConnection,
}: VideoTileProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const color = getMeetingColor(colorIndex);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "var(--ink-soft, #1c1c1f)",
        borderRadius: "var(--radius, 8px)",
        overflow: "hidden",
        border: isActiveSpeaker ? `3px solid ${color}` : "1px solid var(--rule, #2d2d31)",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Video Element */}
      {videoEnabled && stream && stream.getVideoTracks().length > 0 ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: isSelf ? "scaleX(-1)" : "none",
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            color: "var(--paper, #f7f7f8)",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 600,
              color: "#fff",
            }}
          >
            {initials}
          </div>
          <span style={{ fontSize: "14px", color: "var(--ink-soft, #8e8e93)" }}>
            Camera off
          </span>
        </div>
      )}

      {/* Name Tab at Bottom Left */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          backgroundColor: "rgba(18, 18, 20, 0.85)",
          backdropFilter: "blur(4px)",
          padding: "4px 8px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--paper, #f7f7f8)",
          fontSize: "12px",
          fontWeight: 500,
          border: "1px solid var(--rule, #2d2d31)",
        }}
      >
        <span>
          {isSelf ? "You" : name}
          {isHost ? " (Host)" : ""}
        </span>
        {!audioEnabled && (
          <MicOff size={13} style={{ color: "var(--accent-red, #e5484d)" }} aria-label="Microphone muted" />
        )}
        {!videoEnabled && (
          <VideoOff size={13} style={{ color: "var(--ink-soft, #8e8e93)" }} aria-label="Camera off" />
        )}
      </div>

      {/* Connection Failure Overlay */}
      {isFailed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            color: "#fff",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "13px" }}>Connection lost with {name}</span>
          {onRetryConnection && (
            <button
              onClick={onRetryConnection}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: "var(--surface, #232326)",
                border: "1px solid var(--rule, #3a3a3e)",
                borderRadius: "4px",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={13} />
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
