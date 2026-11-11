import React, { useEffect, useRef, useState } from "react";
import { MicOff, VideoOff, RefreshCw, Volume2 } from "lucide-react";
import { getMeetingColor } from "../../lib/meetings.js";

interface VideoTileProps {
  stream?: MediaStream | null;
  name: string;
  isSelf?: boolean;
  isHost?: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  isScreenSharing?: boolean;
  captionsEnabled?: boolean;
  isActiveSpeaker?: boolean;
  colorIndex?: number;
  isFailed?: boolean;
  peerId?: string;
  onRetryConnection?: () => void;
  onMediaStateChange?: (id: string, state: { muted: boolean; playing: boolean }) => void;
}

export function VideoTile({
  stream,
  name,
  isSelf = false,
  isHost = false,
  audioEnabled = true,
  videoEnabled = true,
  isScreenSharing = false,
  captionsEnabled = true,
  isActiveSpeaker = false,
  colorIndex = 0,
  isFailed = false,
  peerId = "",
  onRetryConnection,
  onMediaStateChange,
}: VideoTileProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const color = getMeetingColor(colorIndex);

  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // 1. Permanent video and audio playback handling
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setAutoplayBlocked(false);
          if (peerId) {
            onMediaStateChange?.(peerId, { muted: el.muted, playing: true });
          }
        })
        .catch(() => {
          if (!isSelf) {
            setAutoplayBlocked(true);
            if (peerId) {
              onMediaStateChange?.(peerId, { muted: el.muted, playing: false });
            }
          }
        });
    }
  }, [stream, videoEnabled, isSelf, peerId, onMediaStateChange]);

  // 2. Audio-level indicator via Web Audio AnalyserNode
  useEffect(() => {
    if (!stream || !audioEnabled) {
      setAudioLevel(0);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setAudioLevel(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let animationId: number | null = null;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      audioContext = new AudioCtx();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] ?? 0;
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch {
      // AudioContext unavailable in mock/test
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, [stream, audioEnabled]);

  const handleEnableAudio = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => {
          setAutoplayBlocked(false);
          if (peerId) {
            onMediaStateChange?.(peerId, { muted: videoRef.current!.muted, playing: true });
          }
        })
        .catch(console.error);
    }
  };

  const initials = (name || "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isVideoVisible =
    (videoEnabled || isScreenSharing) && Boolean(stream && stream.getVideoTracks().length > 0);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "var(--ink)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        border: isActiveSpeaker || audioLevel > 20 ? `3px solid ${color}` : "1px solid var(--rule)",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Presenting Badge */}
      {isScreenSharing && (
        <div
          data-testid="presenting-badge"
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            backgroundColor: "var(--signal)",
            color: "var(--on-signal)",
            fontSize: "11px",
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: "3px",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>Presenting</span>
        </div>
      )}

      {/* Video Element - kept permanently mounted to avoid tearing down stream/audio */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        style={{
          width: "100%",
          height: "100%",
          objectFit: isScreenSharing ? "contain" : "cover",
          transform: isSelf && !isScreenSharing ? "scaleX(-1)" : "none",
          display: isVideoVisible ? "block" : "none",
        }}
      />

      {/* Camera-off placeholder */}
      {!isVideoVisible && (
        <div
          data-testid="camera-off-placeholder"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            color: "var(--surface)",
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
              color: "var(--on-signal)",
            }}
          >
            {initials}
          </div>
          <span style={{ fontSize: "14px", color: "var(--ink-soft)" }}>
            Camera off
          </span>
        </div>
      )}

      {/* Autoplay blocked overlay for remote peer */}
      {!isSelf && autoplayBlocked && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={handleEnableAudio}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: "var(--error)",
              color: "var(--on-signal)",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              boxShadow: "var(--shadow-menu)",
            }}
            aria-label="Click to enable audio"
          >
            <Volume2 size={14} />
            Click to enable audio
          </button>
        </div>
      )}

      {/* Name Tab at Bottom Left */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          backgroundColor: "var(--ground)",
          padding: "4px 8px",
          borderRadius: "3px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--ink)",
          fontSize: "12px",
          fontWeight: 500,
          border: "1px solid var(--rule)",
        }}
      >
        <span>
          {isSelf ? "You" : name}
          {isHost ? " (Host)" : ""}
        </span>

        {/* Captions Off Marker */}
        {!captionsEnabled && (
          <span
            data-testid="captions-off-marker"
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

        {/* Audio status & Live Audio Level Indicator */}
        {audioEnabled ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "1.5px",
              height: "12px",
              width: "10px",
            }}
            title={`Audio level: ${audioLevel}%`}
            aria-label={`Audio level: ${audioLevel}%`}
          >
            <div
              style={{
                width: "2px",
                height: `${Math.max(2, (audioLevel / 100) * 12)}px`,
                backgroundColor: audioLevel > 10 ? "var(--success)" : "var(--ink-soft)",
                borderRadius: "3px",
                transition: "height 60ms ease-out",
              }}
            />
            <div
              style={{
                width: "2px",
                height: `${Math.max(2, (audioLevel / 100) * 12 * 0.8)}px`,
                backgroundColor: audioLevel > 20 ? "var(--success)" : "var(--ink-soft)",
                borderRadius: "3px",
                transition: "height 60ms ease-out",
              }}
            />
            <div
              style={{
                width: "2px",
                height: `${Math.max(2, (audioLevel / 100) * 12 * 0.6)}px`,
                backgroundColor: audioLevel > 40 ? "var(--success)" : "var(--ink-soft)",
                borderRadius: "3px",
                transition: "height 60ms ease-out",
              }}
            />
          </div>
        ) : (
          <MicOff size={13} style={{ color: "var(--error)" }} aria-label="Microphone muted" />
        )}

        {!videoEnabled && (
          <VideoOff size={13} style={{ color: "var(--ink-soft)" }} aria-label="Camera off" />
        )}
      </div>

      {/* Connection Failure Overlay */}
      {isFailed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "var(--ink)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            color: "var(--surface)",
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
                backgroundColor: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: "3px",
                color: "var(--ink)",
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
