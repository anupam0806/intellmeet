import React, { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  Users,
  LogOut,
  PhoneOff,
  Subtitles,
  Monitor,
  X,
} from "lucide-react";
import { VideoTile } from "./VideoTile.js";
import { ChatPanel } from "./ChatPanel.js";
import { ParticipantsPanel } from "./ParticipantsPanel.js";
import { CaptionsPanel, type LiveCaptionSegment } from "./CaptionsPanel.js";
import { DebugPanel } from "./DebugPanel.js";
import "./LiveRoomView.css";
import type { PeerStreamInfo, PeerDebugStats } from "../../lib/rtc.js";
import type { ChatMessageItem } from "../../lib/meetings.js";

interface LiveRoomViewProps {
  readonly selfStream: MediaStream | null;
  readonly selfName: string;
  readonly selfAudio: boolean;
  readonly selfVideo: boolean;
  readonly isScreenSharing?: boolean;
  readonly screenStream?: MediaStream | null;
  readonly captions?: LiveCaptionSegment[];
  readonly captionsEnabled?: boolean;
  readonly isCaptionsSupported?: boolean;
  readonly captionLanguage?: string;
  readonly onCaptionLanguageChange?: (lang: string) => void;
  readonly interimCaption?: string;
  readonly isCaptionListening?: boolean;
  readonly captionError?: string | null;
  readonly isHost: boolean;
  readonly isAdmin: boolean;
  readonly hostId: string;
  readonly colorIndex: number;
  readonly peers: PeerStreamInfo[];
  readonly chatMessages: ChatMessageItem[];
  readonly typingUsers: string[];
  readonly statusMessage?: string;
  readonly getDebugStats?: () => Promise<PeerDebugStats[]>;
  readonly onToggleAudio: () => void;
  readonly onToggleVideo: () => void;
  readonly onToggleScreenShare?: () => void;
  readonly onToggleCaptions?: () => void;
  readonly onSendMessage: (text: string) => void;
  readonly onTyping: (isTyping: boolean) => void;
  readonly onLeaveMeeting: () => void;
  readonly onEndMeeting: () => void;
  readonly onRetryPeerConnection: (socketId: string) => void;
}

interface LiveRoomControlBarProps {
  readonly selfAudio: boolean;
  readonly selfVideo: boolean;
  readonly isScreenSharing: boolean;
  readonly isSomeoneElseSharing: boolean;
  readonly screenShareLabel: string;
  readonly screenShareColor: string;
  readonly captionsEnabled: boolean;
  readonly isCaptionsSupported: boolean;
  readonly activeSideTab: "chat" | "participants" | "captions" | null;
  readonly canEndMeeting: boolean;
  readonly onToggleAudio: () => void;
  readonly onToggleVideo: () => void;
  readonly onToggleScreenShare?: () => void;
  readonly onToggleCaptions?: () => void;
  readonly onSelectSideTab: (tab: "chat" | "participants" | "captions") => void;
  readonly onLeaveMeeting: () => void;
  readonly onRequestEndMeeting: () => void;
}

function LiveRoomControlBar({
  selfAudio,
  selfVideo,
  isScreenSharing,
  isSomeoneElseSharing,
  screenShareLabel,
  screenShareColor,
  captionsEnabled,
  isCaptionsSupported,
  activeSideTab,
  canEndMeeting,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleCaptions,
  onSelectSideTab,
  onLeaveMeeting,
  onRequestEndMeeting,
}: LiveRoomControlBarProps): React.JSX.Element {
  return (
    <aside className="live-room-controls" aria-label="Room controls">
      <div className="live-room-controls-group">
        {/* Audio */}
        <button
          type="button"
          onClick={onToggleAudio}
          aria-label={selfAudio ? "Mute microphone" : "Unmute microphone"}
          className="live-room-control-btn"
          style={{
            backgroundColor: selfAudio ? "var(--ground)" : "var(--error)",
            color: selfAudio ? "var(--ink)" : "var(--on-signal)",
            border: "1px solid var(--rule)",
            cursor: "pointer",
          }}
        >
          {selfAudio ? <Mic size={18} /> : <MicOff size={18} />}
        </button>

        {/* Video */}
        <button
          type="button"
          onClick={onToggleVideo}
          aria-label={selfVideo ? "Turn off camera" : "Turn on camera"}
          className="live-room-control-btn"
          style={{
            backgroundColor: selfVideo ? "var(--ground)" : "var(--error)",
            color: selfVideo ? "var(--ink)" : "var(--on-signal)",
            border: "1px solid var(--rule)",
            cursor: "pointer",
          }}
        >
          {selfVideo ? <Video size={18} /> : <VideoOff size={18} />}
        </button>

        {/* Screen Share */}
        <button
          type="button"
          onClick={isSomeoneElseSharing ? undefined : onToggleScreenShare}
          disabled={isSomeoneElseSharing}
          aria-label={screenShareLabel}
          title={screenShareLabel}
          className="live-room-control-btn"
          style={{
            backgroundColor: isScreenSharing ? "var(--signal)" : "var(--ground)",
            color: screenShareColor,
            border: "1px solid var(--rule)",
            cursor: isSomeoneElseSharing ? "not-allowed" : "pointer",
            opacity: isSomeoneElseSharing ? 0.6 : 1,
          }}
        >
          <Monitor size={18} />
        </button>

        {/* Captions Toggle */}
        {isCaptionsSupported ? (
          <button
            type="button"
            onClick={() => {
              onToggleCaptions?.();
              if (!captionsEnabled) {
                onSelectSideTab("captions");
              }
            }}
            aria-label={captionsEnabled ? "Turn off live captions" : "Turn on live captions"}
            title={captionsEnabled ? "Turn off live captions" : "Turn on live captions"}
            className="live-room-control-btn"
            style={{
              backgroundColor: captionsEnabled ? "var(--signal)" : "var(--ground)",
              color: captionsEnabled ? "var(--on-signal)" : "var(--ink)",
              border: "1px solid var(--rule)",
              cursor: "pointer",
            }}
          >
            <Subtitles size={18} />
          </button>
        ) : (
          <div
            title={
              typeof window !== "undefined" && window.isSecureContext === false
                ? "Live captions require HTTPS or localhost (insecure HTTP blocked by browser)."
                : "Live captions need Chrome or Edge."
            }
            aria-label="Live captions need Chrome or Edge."
            className="live-room-control-btn"
            style={{
              color: "var(--ink-soft)",
              cursor: "not-allowed",
            }}
          >
            <Subtitles size={18} opacity={0.3} />
          </div>
        )}

        {/* Chat Panel Toggle */}
        <button
          type="button"
          onClick={() => onSelectSideTab("chat")}
          aria-label="Toggle chat"
          className="live-room-control-btn"
          style={{
            backgroundColor: activeSideTab === "chat" ? "var(--ground)" : "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--rule)",
            cursor: "pointer",
          }}
        >
          <MessageSquare size={18} />
        </button>

        {/* Participants Toggle */}
        <button
          type="button"
          onClick={() => onSelectSideTab("participants")}
          aria-label="Toggle participants list"
          className="live-room-control-btn"
          style={{
            backgroundColor: activeSideTab === "participants" ? "var(--ground)" : "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--rule)",
            cursor: "pointer",
          }}
        >
          <Users size={18} />
        </button>

        {/* Captions placeholder tab */}
        <button
          type="button"
          onClick={() => onSelectSideTab("captions")}
          aria-label="Toggle captions panel"
          className="live-room-control-btn"
          style={{
            backgroundColor: activeSideTab === "captions" ? "var(--ground)" : "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--rule)",
            cursor: "pointer",
          }}
        >
          <Subtitles size={18} />
        </button>
      </div>

      {/* Leave & End Call Buttons */}
      <div className="live-room-controls-group live-room-controls-exit">
        <button
          type="button"
          onClick={onLeaveMeeting}
          aria-label="Leave meeting"
          title="Leave call"
          className="live-room-control-btn live-room-btn-leave"
          style={{
            cursor: "pointer",
          }}
        >
          <LogOut size={18} />
        </button>

        {canEndMeeting && (
          <button
            type="button"
            onClick={onRequestEndMeeting}
            aria-label="End meeting for all"
            title="End meeting for all"
            className="live-room-control-btn"
            style={{
              backgroundColor: "var(--error)",
              color: "var(--on-signal)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <PhoneOff size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}

interface LiveRoomSidePanelProps {
  readonly activeSideTab: "chat" | "participants" | "captions";
  readonly onClose: () => void;
  readonly chatMessages: ChatMessageItem[];
  readonly typingUsers: string[];
  readonly onSendMessage: (text: string) => void;
  readonly onTyping: (isTyping: boolean) => void;
  readonly selfName: string;
  readonly selfAudio: boolean;
  readonly selfVideo: boolean;
  readonly captionsEnabled: boolean;
  readonly isHost: boolean;
  readonly peers: PeerStreamInfo[];
  readonly hostId: string;
  readonly captions: LiveCaptionSegment[];
  readonly isCaptionsSupported: boolean;
  readonly onToggleCaptions?: () => void;
  readonly captionLanguage?: string;
  readonly onCaptionLanguageChange?: (lang: string) => void;
  readonly interimCaption?: string;
  readonly isCaptionListening?: boolean;
  readonly captionError?: string | null;
}

function getSidePanelTitle(tab: "chat" | "participants" | "captions"): string {
  if (tab === "chat") {
    return "In-call messages";
  }
  if (tab === "participants") {
    return "Participants";
  }
  return "Live captions";
}

function LiveRoomSidePanel({
  activeSideTab,
  onClose,
  chatMessages,
  typingUsers,
  onSendMessage,
  onTyping,
  selfName,
  selfAudio,
  selfVideo,
  captionsEnabled,
  isHost,
  peers,
  hostId,
  captions,
  isCaptionsSupported,
  onToggleCaptions,
  captionLanguage,
  onCaptionLanguageChange,
  interimCaption,
  isCaptionListening,
  captionError,
}: LiveRoomSidePanelProps): React.JSX.Element {
  return (
    <div className="live-room-side-panel">
      <div
        style={{
          padding: "12px 16px",
          backgroundColor: "var(--surface)",
          borderLeft: "1px solid var(--rule)",
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "var(--ink)",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        <span>{getSidePanelTitle(activeSideTab)}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          style={{
            background: "none",
            border: "none",
            color: "var(--ink-soft)",
            cursor: "pointer",
            padding: "2px",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeSideTab === "chat" && (
          <ChatPanel
            messages={chatMessages}
            typingUsers={typingUsers}
            onSendMessage={onSendMessage}
            onTyping={onTyping}
          />
        )}
        {activeSideTab === "participants" && (
          <ParticipantsPanel
            selfName={selfName}
            selfAudio={selfAudio}
            selfVideo={selfVideo}
            selfCaptions={captionsEnabled}
            isHost={isHost}
            peers={peers}
            hostId={hostId}
          />
        )}
        {activeSideTab === "captions" && (
          <CaptionsPanel
            captions={captions}
            isSupported={isCaptionsSupported}
            captionsEnabled={captionsEnabled}
            onToggleCaptions={onToggleCaptions || (() => {})}
            currentLanguage={captionLanguage}
            onLanguageChange={onCaptionLanguageChange}
            interimCaption={interimCaption}
            speakerName={selfName}
            isMuted={!selfAudio}
            isListening={isCaptionListening}
            errorMessage={captionError}
          />
        )}
      </div>
    </div>
  );
}

interface EndMeetingConfirmDialogProps {
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function EndMeetingConfirmDialog({
  onCancel,
  onConfirm,
}: EndMeetingConfirmDialogProps): React.JSX.Element {
  return (
    <dialog
      open
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "16px",
        border: "none",
        width: "100%",
        height: "100%",
        maxWidth: "none",
        maxHeight: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--radius)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          End meeting for all?
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "var(--ink-soft)",
            lineHeight: "1.4",
          }}
        >
          Ending the meeting will disconnect all participants and queue the AI notes write-up.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 14px",
              backgroundColor: "transparent",
              border: "1px solid var(--rule)",
              color: "var(--ink)",
              borderRadius: "var(--radius)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "8px 14px",
              backgroundColor: "var(--error)",
              border: "none",
              color: "var(--on-signal)",
              borderRadius: "var(--radius)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            End meeting
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function LiveRoomView({
  selfStream,
  selfName,
  selfAudio,
  selfVideo,
  isScreenSharing = false,
  screenStream = null,
  captions = [],
  captionsEnabled = false,
  isCaptionsSupported = true,
  captionLanguage,
  onCaptionLanguageChange,
  interimCaption,
  isCaptionListening,
  captionError,
  isHost,
  isAdmin,
  hostId,
  colorIndex,
  peers,
  chatMessages,
  typingUsers,
  statusMessage,
  getDebugStats,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleCaptions,
  onSendMessage,
  onTyping,
  onLeaveMeeting,
  onEndMeeting,
  onRetryPeerConnection,
}: Readonly<LiveRoomViewProps>): React.JSX.Element {
  const [activeSideTab, setActiveSideTab] = useState<"chat" | "participants" | "captions" | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [audioPlaybackStates, setAudioPlaybackStates] = useState<
    Record<string, { muted: boolean; playing: boolean }>
  >({});

  const handleMediaStateChange = (id: string, state: { muted: boolean; playing: boolean }) => {
    setAudioPlaybackStates((prev) => ({
      ...prev,
      [id]: state,
    }));
  };

  const isSomeoneElseSharing = peers.some((p) => p.media.screen);
  const canEndMeeting = isHost || isAdmin;
  const totalTiles = 1 + peers.length;

  let screenShareLabel = "Share screen";
  let screenShareColor = "var(--ink)";
  if (isSomeoneElseSharing) {
    screenShareLabel = "Someone else is currently sharing their screen";
    screenShareColor = "var(--ink-soft)";
  } else if (isScreenSharing) {
    screenShareLabel = "Stop sharing screen";
    screenShareColor = "var(--on-signal)";
  }

  const handleSelectSideTab = (tab: "chat" | "participants" | "captions") => {
    setActiveSideTab((prev) => (prev === tab ? null : tab));
  };

  return (
    <div className="live-room-container">
      {/* Status Notice Toast / Banner */}
      {statusMessage && (
        <output
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius)",
            padding: "8px 16px",
            color: "var(--ink)",
            fontSize: "13px",
            zIndex: 50,
            boxShadow: "var(--shadow-menu)",
          }}
        >
          {statusMessage}
        </output>
      )}

      {/* Control Rail */}
      <LiveRoomControlBar
        selfAudio={selfAudio}
        selfVideo={selfVideo}
        isScreenSharing={isScreenSharing}
        isSomeoneElseSharing={isSomeoneElseSharing}
        screenShareLabel={screenShareLabel}
        screenShareColor={screenShareColor}
        captionsEnabled={captionsEnabled}
        isCaptionsSupported={isCaptionsSupported}
        activeSideTab={activeSideTab}
        canEndMeeting={canEndMeeting}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onToggleScreenShare={onToggleScreenShare}
        onToggleCaptions={onToggleCaptions}
        onSelectSideTab={handleSelectSideTab}
        onLeaveMeeting={onLeaveMeeting}
        onRequestEndMeeting={() => setShowEndConfirm(true)}
      />

      {/* Main Video Stage */}
      <main className="live-room-stage">
        <div
          className="live-room-tiles-grid"
          style={{
            "--grid-cols": totalTiles <= 1 ? "1fr" : "1fr 1fr",
            "--grid-rows": totalTiles > 2 ? "1fr 1fr" : "1fr",
          } as React.CSSProperties}
        >
          {/* Self Tile */}
          <VideoTile
            stream={isScreenSharing && screenStream ? screenStream : selfStream}
            name={selfName}
            isSelf
            isHost={isHost}
            audioEnabled={selfAudio}
            videoEnabled={selfVideo}
            isScreenSharing={isScreenSharing}
            captionsEnabled={captionsEnabled}
            colorIndex={colorIndex}
          />

          {/* Remote Peer Tiles */}
          {peers.map((peer) => (
            <VideoTile
              key={peer.socketId}
              peerId={peer.socketId}
              stream={peer.stream}
              name={peer.name}
              isSelf={false}
              isHost={peer.userId === hostId}
              audioEnabled={peer.media.audio}
              videoEnabled={peer.media.video}
              isScreenSharing={peer.media.screen}
              captionsEnabled={peer.media.captions}
              colorIndex={colorIndex}
              isFailed={peer.isFailed}
              onRetryConnection={() => onRetryPeerConnection(peer.socketId)}
              onMediaStateChange={handleMediaStateChange}
            />
          ))}
        </div>
      </main>

      {/* Right Side Panel: Chat / Participants / Captions */}
      {activeSideTab && (
        <LiveRoomSidePanel
          activeSideTab={activeSideTab}
          onClose={() => setActiveSideTab(null)}
          chatMessages={chatMessages}
          typingUsers={typingUsers}
          onSendMessage={onSendMessage}
          onTyping={onTyping}
          selfName={selfName}
          selfAudio={selfAudio}
          selfVideo={selfVideo}
          captionsEnabled={captionsEnabled}
          isHost={isHost}
          peers={peers}
          hostId={hostId}
          captions={captions}
          isCaptionsSupported={isCaptionsSupported}
          onToggleCaptions={onToggleCaptions}
          captionLanguage={captionLanguage}
          onCaptionLanguageChange={onCaptionLanguageChange}
          interimCaption={interimCaption}
          isCaptionListening={isCaptionListening}
          captionError={captionError}
        />
      )}

      {/* End Meeting Confirmation Dialog */}
      {showEndConfirm && (
        <EndMeetingConfirmDialog
          onCancel={() => setShowEndConfirm(false)}
          onConfirm={() => {
            setShowEndConfirm(false);
            onEndMeeting();
          }}
        />
      )}

      {/* WebRTC Diagnostics Debug Panel in Development */}
      {getDebugStats && (
        <DebugPanel
          getDebugStats={getDebugStats}
          audioPlaybackStates={audioPlaybackStates}
        />
      )}
    </div>
  );
}

