import React, { useEffect, useRef, useState } from "react";
import "./LobbyView.css";
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
      if (videoRef.current.srcObject !== localStream) {
        videoRef.current.srcObject = localStream;
      }
      void videoRef.current.play().catch(() => {});
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
        backgroundColor: "var(--ground)",
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
              color: "var(--ink-soft)",
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
              color: "var(--ink)",
            }}
          >
            {meetingTitle}
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--ink-soft)" }}>
            Joining as <strong style={{ color: "var(--ink)" }}>{userName}</strong>
          </p>
        </div>

        {/* Device Permission Banner if blocked */}
        {(audioBlocked || videoBlocked) && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--error)",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              color: "var(--error)",
              fontSize: "13px",
            }}
          >
            <AlertCircle size={18} style={{ color: "var(--error)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong>Camera or microphone access is blocked.</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--ink-soft)" }}>
                To enable video and voice, click the permissions icon in your browser address bar and choose &quot;Allow&quot;. You can still join the call without them.
              </p>
            </div>
          </div>
        )}

        {/* Main Preview & Controls Card */}
        <div className="lobby-card">
          {/* Left Column: Video Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                backgroundColor: "var(--ink)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
                border: "1px solid var(--rule)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
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
                  display:
                    videoEnabled && localStream && localStream.getVideoTracks().length > 0 ? "block" : "none",
                }}
              />
              {(!videoEnabled || !localStream || localStream.getVideoTracks().length === 0) && (
                <div style={{ color: "var(--ink-soft)", fontSize: "14px" }}>
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
                    width: "44px",
                    height: "44px",
                    minWidth: "44px",
                    minHeight: "44px",
                    padding: 0,
                    borderRadius: "50%",
                    backgroundColor: audioEnabled ? "var(--ground)" : "var(--error)",
                    color: audioEnabled ? "var(--ink)" : "var(--on-signal)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button
                  type="button"
                  onClick={onToggleVideo}
                  aria-label={videoEnabled ? "Turn off camera" : "Turn on camera"}
                  style={{
                    width: "44px",
                    height: "44px",
                    minWidth: "44px",
                    minHeight: "44px",
                    padding: 0,
                    borderRadius: "50%",
                    backgroundColor: videoEnabled ? "var(--ground)" : "var(--error)",
                    color: videoEnabled ? "var(--ink)" : "var(--on-signal)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
              </div>
            </div>

            {/* Mic Level Indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>Mic level</span>
              <div
                style={{
                  flex: 1,
                  height: "4px",
                  backgroundColor: "var(--rule)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${micVolume}%`,
                    height: "100%",
                    backgroundColor: "var(--success)",
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
                  <label htmlFor="audio-device-select" style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-soft)" }}>
                    Microphone
                  </label>
                  <select
                    id="audio-device-select"
                    value={selectedAudio}
                    onChange={(e) => {
                      setSelectedAudio(e.target.value);
                      onSelectAudioDevice(e.target.value);
                    }}
                    className="device-select"
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
                  <label htmlFor="video-device-select" style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-soft)" }}>
                    Camera
                  </label>
                  <select
                    id="video-device-select"
                    value={selectedVideo}
                    onChange={(e) => {
                      setSelectedVideo(e.target.value);
                      onSelectVideoDevice(e.target.value);
                    }}
                    className="device-select"
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
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--ground)",
                    border: "1px solid var(--rule)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--ink-soft)",
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
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--ground)",
                    border: "1px solid var(--error)",
                    color: "var(--error)",
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
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--ground)",
                    border: "1px solid var(--error)",
                    color: "var(--error)",
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
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--ground)",
                    border: "1px solid var(--error)",
                    color: "var(--error)",
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
className="join-button"
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

