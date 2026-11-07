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
  X,
} from "lucide-react";
import { VideoTile } from "./VideoTile.js";
import { ChatPanel } from "./ChatPanel.js";
import { ParticipantsPanel } from "./ParticipantsPanel.js";
import type { PeerStreamInfo } from "../../lib/rtc.js";
import type { ChatMessageItem } from "../../lib/meetings.js";

interface LiveRoomViewProps {
  selfStream: MediaStream | null;
  selfName: string;
  selfAudio: boolean;
  selfVideo: boolean;
  isHost: boolean;
  isAdmin: boolean;
  hostId: string;
  colorIndex: number;
  peers: PeerStreamInfo[];
  chatMessages: ChatMessageItem[];
  typingUsers: string[];
  statusMessage?: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onLeaveMeeting: () => void;
  onEndMeeting: () => void;
  onRetryPeerConnection: (socketId: string) => void;
}

export function LiveRoomView({
  selfStream,
  selfName,
  selfAudio,
  selfVideo,
  isHost,
  isAdmin,
  hostId,
  colorIndex,
  peers,
  chatMessages,
  typingUsers,
  statusMessage,
  onToggleAudio,
  onToggleVideo,
  onSendMessage,
  onTyping,
  onLeaveMeeting,
  onEndMeeting,
  onRetryPeerConnection,
}: LiveRoomViewProps): React.JSX.Element {
  const [activeSideTab, setActiveSideTab] = useState<"chat" | "participants" | "captions" | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const canEndMeeting = isHost || isAdmin;
  const totalTiles = 1 + peers.length;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "var(--ink, #09090b)",
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Status Notice Toast / Banner */}
      {statusMessage && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(24, 24, 27, 0.9)",
            border: "1px solid var(--rule, #27272a)",
            borderRadius: "var(--radius, 6px)",
            padding: "8px 16px",
            color: "var(--paper, #f4f4f5)",
            fontSize: "13px",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Left Control Rail on Desktop */}
      <aside
        style={{
          width: "64px",
          backgroundColor: "var(--surface, #121214)",
          borderRight: "1px solid var(--rule, #27272a)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 0",
          zIndex: 20,
        }}
        aria-label="Room controls"
      >
        {/* Media & Utility Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
          {/* Audio */}
          <button
            type="button"
            onClick={onToggleAudio}
            aria-label={selfAudio ? "Mute microphone" : "Unmute microphone"}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius, 8px)",
              backgroundColor: selfAudio ? "var(--ink, #1c1c1f)" : "var(--accent-red, #e5484d)",
              color: "#fff",
              border: "1px solid var(--rule, #2d2d31)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius, 8px)",
              backgroundColor: selfVideo ? "var(--ink, #1c1c1f)" : "var(--accent-red, #e5484d)",
              color: "#fff",
              border: "1px solid var(--rule, #2d2d31)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {selfVideo ? <Video size={18} /> : <VideoOff size={18} />}
          </button>

          {/* Chat Panel Toggle */}
          <button
            type="button"
            onClick={() => setActiveSideTab(activeSideTab === "chat" ? null : "chat")}
            aria-label="Toggle chat"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius, 8px)",
              backgroundColor: activeSideTab === "chat" ? "var(--paper, #f4f4f5)" : "var(--ink, #1c1c1f)",
              color: activeSideTab === "chat" ? "var(--ink, #09090b)" : "#fff",
              border: "1px solid var(--rule, #2d2d31)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <MessageSquare size={18} />
          </button>

          {/* Participants Toggle */}
          <button
            type="button"
            onClick={() => setActiveSideTab(activeSideTab === "participants" ? null : "participants")}
            aria-label="Toggle participants list"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius, 8px)",
              backgroundColor: activeSideTab === "participants" ? "var(--paper, #f4f4f5)" : "var(--ink, #1c1c1f)",
              color: activeSideTab === "participants" ? "var(--ink, #09090b)" : "#fff",
              border: "1px solid var(--rule, #2d2d31)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Users size={18} />
          </button>

          {/* Captions placeholder tab */}
          <button
            type="button"
            onClick={() => setActiveSideTab(activeSideTab === "captions" ? null : "captions")}
            aria-label="Toggle captions panel"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius, 8px)",
              backgroundColor: activeSideTab === "captions" ? "var(--paper, #f4f4f5)" : "var(--ink, #1c1c1f)",
              color: activeSideTab === "captions" ? "var(--ink, #09090b)" : "#fff",
              border: "1px solid var(--rule, #2d2d31)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Subtitles size={18} />
          </button>
        </div>

        {/* Leave & End Call Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={onLeaveMeeting}
            aria-label="Leave meeting"
            title="Leave call"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius, 8px)",
              backgroundColor: "var(--ink, #1c1c1f)",
              color: "var(--ink-soft, #8e8e93)",
              border: "1px solid var(--rule, #2d2d31)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <LogOut size={18} />
          </button>

          {canEndMeeting && (
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              aria-label="End meeting for all"
              title="End meeting for all"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius, 8px)",
                backgroundColor: "var(--accent-red, #e5484d)",
                color: "#fff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <PhoneOff size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Video Stage */}
      <main
        style={{
          flex: 1,
          height: "100%",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--ink, #09090b)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            gap: "12px",
            gridTemplateColumns:
              totalTiles === 1
                ? "1fr"
                : totalTiles === 2
                ? "1fr 1fr"
                : "1fr 1fr",
            gridTemplateRows: totalTiles > 2 ? "1fr 1fr" : "1fr",
            maxHeight: "90vh",
          }}
        >
          {/* Self Tile */}
          <VideoTile
            stream={selfStream}
            name={selfName}
            isSelf
            isHost={isHost}
            audioEnabled={selfAudio}
            videoEnabled={selfVideo}
            colorIndex={colorIndex}
          />

          {/* Remote Peer Tiles */}
          {peers.map((peer) => (
            <VideoTile
              key={peer.socketId}
              stream={peer.stream}
              name={peer.name}
              isSelf={false}
              isHost={peer.userId === hostId}
              audioEnabled={peer.media.audio}
              videoEnabled={peer.media.video}
              colorIndex={colorIndex}
              isFailed={peer.isFailed}
              onRetryConnection={() => onRetryPeerConnection(peer.socketId)}
            />
          ))}
        </div>
      </main>

      {/* Right Side Panel: Chat / Participants / Captions */}
      {activeSideTab && (
        <div
          style={{
            width: "320px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            zIndex: 30,
          }}
        >
          {/* Header with Close */}
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--surface, #18181b)",
              borderLeft: "1px solid var(--rule, #27272a)",
              borderBottom: "1px solid var(--rule, #27272a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "var(--paper, #f4f4f5)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <span>
              {activeSideTab === "chat"
                ? "In-call messages"
                : activeSideTab === "participants"
                ? "Participants"
                : "Live captions"}
            </span>
            <button
              type="button"
              onClick={() => setActiveSideTab(null)}
              aria-label="Close panel"
              style={{
                background: "none",
                border: "none",
                color: "var(--ink-soft, #71717a)",
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
                isHost={isHost}
                peers={peers}
                hostId={hostId}
              />
            )}
            {activeSideTab === "captions" && (
              <div
                style={{
                  height: "100%",
                  backgroundColor: "var(--surface, #18181b)",
                  borderLeft: "1px solid var(--rule, #27272a)",
                  padding: "24px",
                  color: "var(--ink-soft, #71717a)",
                  fontSize: "13px",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Live speech captions will be activated in Phase 4.
              </div>
            )}
          </div>
        </div>
      )}

      {/* End Meeting Confirmation Dialog */}
      {showEndConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              backgroundColor: "var(--surface, #18181b)",
              border: "1px solid var(--rule, #27272a)",
              borderRadius: "var(--radius, 8px)",
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
                color: "var(--paper, #f4f4f5)",
              }}
            >
              End meeting for all?
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--ink-soft, #a1a1aa)",
                lineHeight: "1.4",
              }}
            >
              Ending the meeting will disconnect all participants and queue the AI notes write-up.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--rule, #27272a)",
                  color: "var(--paper, #f4f4f5)",
                  borderRadius: "var(--radius, 6px)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndMeeting();
                }}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "var(--accent-red, #e5484d)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "var(--radius, 6px)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                End meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
