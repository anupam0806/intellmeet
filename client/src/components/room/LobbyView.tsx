import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface LobbyViewProps {
  meetingTitle: string;
  userName: string;
  localStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioBlocked: boolean;
  videoBlocked: boolean;
  lobbyState: "ready" | "waiting_for_host" | "room_full" | "meeting_ended" | "already_in_room";
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onSelectAudioDevice: (deviceId: string) => void;
  onSelectVideoDevice: (deviceId: string) => void;
  onJoinRoom: () => void;
  isJoining: boolean;
}

export function LobbyView({
  meetingTitle,
  userName,
  localStream,
  audioEnabled,
  videoEnabled,
  audioBlocked,
  videoBlocked,
  lobbyState,
  onToggleAudio,
  onToggleVideo,
  onSelectAudioDevice,
  onSelectVideoDevice,
  onJoinRoom,
  isJoining,
}: LobbyViewProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [micVolume, setMicVolume] = useState<number>(0);

  // Bind video element to local stream
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, videoEnabled]);

  // Enumerate input devices
  useEffect(() => {
    async function getDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audios = devices.filter((d) => d.kind === "audioinput");
        const videos = devices.filter((d) => d.kind === "videoinput");
        setAudioDevices(audios);
        setVideoDevices(videos);
        if (audios[0] && !selectedAudio) setSelectedAudio(audios[0].deviceId);
        if (videos[0] && !selectedVideo) setSelectedVideo(videos[0].deviceId);
      } catch {
        // Device listing restricted before permission
      }
    }
    void getDevices();
  }, [selectedAudio, selectedVideo]);

  // Audio analyser for mic level
  useEffect(() => {
    if (!localStream || !audioEnabled) {
      setMicVolume(0);
      return;
    }

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      setMicVolume(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let animationId: number | null = null;

    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] ?? 0;
        }
        const avg = sum / dataArray.length;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animationId = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch {
      // AudioContext unavailable in test or mock environment
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, [localStream, audioEnabled]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--ink, #0c0c0e)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "840px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Back Link & Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            to="/meetings"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              color: "var(--ink-soft, #8e8e93)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={16} />
            Back to meetings
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--paper, #f7f7f8)",
            }}
          >
            {meetingTitle}
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--ink-soft, #8e8e93)" }}>
            Joining as <strong style={{ color: "var(--paper, #f7f7f8)" }}>{userName}</strong>
          </p>
        </div>

        {/* Device Permission Banner if blocked */}
        {(audioBlocked || videoBlocked) && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius, 8px)",
              backgroundColor: "rgba(229, 72, 77, 0.1)",
              border: "1px solid var(--accent-red, #e5484d)",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              color: "var(--paper, #f7f7f8)",
              fontSize: "13px",
            }}
          >
            <AlertCircle size={18} style={{ color: "var(--accent-red, #e5484d)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong>Camera or microphone access is blocked.</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--ink-soft, #c1c1c6)" }}>
                To enable video and voice, click the permissions icon in your browser address bar and choose &quot;Allow&quot;. You can still join the call without them.
              </p>
            </div>
          </div>
        )}

        {/* Main Preview & Controls Card */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: "24px",
            backgroundColor: "var(--surface, #18181b)",
            border: "1px solid var(--rule, #27272a)",
            borderRadius: "var(--radius, 8px)",
            padding: "24px",
          }}
        >
          {/* Left Column: Video Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                backgroundColor: "#09090b",
                borderRadius: "var(--radius, 8px)",
                overflow: "hidden",
                border: "1px solid var(--rule, #27272a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {videoEnabled && localStream && localStream.getVideoTracks().length > 0 ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />
              ) : (
                <div style={{ color: "var(--ink-soft, #71717a)", fontSize: "14px" }}>
                  Camera is turned off
                </div>
              )}

              {/* Toggles on preview */}
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  display: "flex",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={onToggleAudio}
                  aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
                  style={{
                    padding: "8px",
                    borderRadius: "50%",
                    backgroundColor: audioEnabled ? "rgba(255, 255, 255, 0.2)" : "var(--accent-red, #e5484d)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  type="button"
                  onClick={onToggleVideo}
                  aria-label={videoEnabled ? "Turn off camera" : "Turn on camera"}
                  style={{
                    padding: "8px",
                    borderRadius: "50%",
                    backgroundColor: videoEnabled ? "rgba(255, 255, 255, 0.2)" : "var(--accent-red, #e5484d)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>

            {/* Mic Level Indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--ink-soft, #71717a)" }}>Mic level</span>
              <div
                style={{
                  flex: 1,
                  height: "4px",
                  backgroundColor: "var(--rule, #27272a)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${micVolume}%`,
                    height: "100%",
                    backgroundColor: "var(--paper, #f4f4f5)",
                    transition: "width 80ms ease-out",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Settings and Join action */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Audio input picker */}
              {audioDevices.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="audio-device-select" style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-soft, #a1a1aa)" }}>
                    Microphone
                  </label>
                  <select
                    id="audio-device-select"
                    value={selectedAudio}
                    onChange={(e) => {
                      setSelectedAudio(e.target.value);
                      onSelectAudioDevice(e.target.value);
                    }}
                    style={{
                      backgroundColor: "var(--ink, #09090b)",
                      border: "1px solid var(--rule, #27272a)",
                      borderRadius: "var(--radius, 6px)",
                      padding: "8px 10px",
                      color: "var(--paper, #f4f4f5)",
                      fontSize: "13px",
                    }}
                  >
                    {audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Video input picker */}
              {videoDevices.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="video-device-select" style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-soft, #a1a1aa)" }}>
                    Camera
                  </label>
                  <select
                    id="video-device-select"
                    value={selectedVideo}
                    onChange={(e) => {
                      setSelectedVideo(e.target.value);
                      onSelectVideoDevice(e.target.value);
                    }}
                    style={{
                      backgroundColor: "var(--ink, #09090b)",
                      border: "1px solid var(--rule, #27272a)",
                      borderRadius: "var(--radius, 6px)",
                      padding: "8px 10px",
                      color: "var(--paper, #f4f4f5)",
                      fontSize: "13px",
                    }}
                  >
                    {videoDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* State Handling and Action Button */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "24px" }}>
              {lobbyState === "waiting_for_host" && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius, 6px)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--rule, #27272a)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--ink-soft, #a1a1aa)",
                    fontSize: "13px",
                  }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  <span>Waiting for the host to start the meeting... You will enter automatically.</span>
                </div>
              )}

              {lobbyState === "room_full" && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius, 6px)",
                    backgroundColor: "rgba(229, 72, 77, 0.1)",
                    border: "1px solid var(--accent-red, #e5484d)",
                    color: "var(--paper, #f4f4f5)",
                    fontSize: "13px",
                  }}
                >
                  This room has reached its maximum capacity of 4 participants.
                </div>
              )}

              {lobbyState === "meeting_ended" && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius, 6px)",
                    backgroundColor: "rgba(229, 72, 77, 0.1)",
                    border: "1px solid var(--accent-red, #e5484d)",
                    color: "var(--paper, #f4f4f5)",
                    fontSize: "13px",
                  }}
                >
                  This meeting has already ended.
                </div>
              )}

              {lobbyState === "already_in_room" && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius, 6px)",
                    backgroundColor: "rgba(229, 72, 77, 0.1)",
                    border: "1px solid var(--accent-red, #e5484d)",
                    color: "var(--paper, #f4f4f5)",
                    fontSize: "13px",
                  }}
                >
                  You are already in this room from another window or tab.
                </div>
              )}

              <button
                type="button"
                onClick={onJoinRoom}
                disabled={isJoining || lobbyState === "meeting_ended" || lobbyState === "room_full" || lobbyState === "already_in_room"}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "var(--paper, #f4f4f5)",
                  color: "var(--ink, #09090b)",
                  border: "none",
                  borderRadius: "var(--radius, 6px)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: isJoining ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  opacity:
                    isJoining || lobbyState === "meeting_ended" || lobbyState === "room_full" || lobbyState === "already_in_room"
                      ? 0.5
                      : 1,
                }}
              >
                {isJoining && <Loader2 size={16} className="animate-spin" />}
                {lobbyState === "waiting_for_host" ? "Join when ready" : "Join now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
