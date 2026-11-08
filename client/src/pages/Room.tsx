import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import {
  joinMeetingByCode,
  getRtcConfig,
  getMeetingChat,
  endMeeting,
  type Meeting,
  type ChatMessageItem,
  type RtcConfig,
} from "../lib/meetings.js";
import { getSocket } from "../lib/socket.js";
import {
  PeerConnectionManager,
  captureMedia,
  type PeerStreamInfo,
} from "../lib/rtc.js";
import { CaptionController, isSpeechRecognitionSupported } from "../lib/captions.js";
import type { LiveCaptionSegment } from "../components/room/CaptionsPanel.js";
import { LobbyView } from "../components/room/LobbyView.js";
import { LiveRoomView } from "../components/room/LiveRoomView.js";
import { Loader2, AlertCircle } from "lucide-react";
import type { Socket } from "socket.io-client";

export function Room(): React.JSX.Element {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [rtcConfig, setRtcConfig] = useState<RtcConfig | null>(null);

  // Local media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [videoBlocked, setVideoBlocked] = useState(false);

  // Room view states
  const [isInLiveRoom, setIsInLiveRoom] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [lobbyState, setLobbyState] = useState<
    "ready" | "waiting_for_host" | "room_full" | "meeting_ended" | "already_in_room"
  >("ready");

  // In-call state
  const [peers, setPeers] = useState<PeerStreamInfo[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);

  // Screen share and Captions state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [liveCaptions, setLiveCaptions] = useState<LiveCaptionSegment[]>([]);
  const isCaptionsSupported = isSpeechRecognitionSupported();

  // Refs for WebRTC and socket management
  const rtcManagerRef = useRef<PeerConnectionManager | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isJoinedRef = useRef(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  screenStreamRef.current = screenStream;
  const captionControllerRef = useRef<CaptionController | null>(null);

  // Clear transient status message
  const showStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((current) => (current === msg ? undefined : current));
    }, 4000);
  }, []);

  // 1. Initial resolution of roomCode, RTC config, and initial media preview
  useEffect(() => {
    let isCancelled = false;

    async function initRoom() {
      if (!roomCode) {
        setError("Invalid meeting code");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Resolve code and get meeting info
        const meetingRes = await joinMeetingByCode(roomCode);
        if (isCancelled) return;
        setMeeting(meetingRes.meeting);

        if (meetingRes.meeting.status === "ENDED") {
          setLobbyState("meeting_ended");
        }

        // Fetch RTC config
        const config = await getRtcConfig();
        if (isCancelled) return;
        setRtcConfig(config);

        // Capture local camera & microphone preview
        const media = await captureMedia();
        if (isCancelled) {
          media.stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setLocalStream(media.stream);
        setAudioBlocked(media.audioBlocked);
        setVideoBlocked(media.videoBlocked);
        if (media.audioBlocked) setAudioEnabled(false);
        if (media.videoBlocked) setVideoEnabled(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to enter meeting room";
        setError(msg);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void initRoom();

    return () => {
      isCancelled = true;
    };
  }, [roomCode]);

  // 2. Setup socket instance and listen for meeting-level events
  useEffect(() => {
    if (!meeting) return;

    const socket = getSocket();
    socketRef.current = socket;
    if (!socket.connected) {
      socket.connect();
    }

    // Meeting started listener
    const onMeetingStarted = (data: { meetingId: string }) => {
      if (data.meetingId === meeting.id) {
        setMeeting((prev) => (prev ? { ...prev, status: "LIVE" } : prev));
        setLobbyState("ready");
        showStatus("The host has started the meeting. You can join now.");
      }
    };

    // Meeting ended listener
    const onMeetingEnded = (data: { meetingId: string }) => {
      if (data.meetingId === meeting.id) {
        showStatus("This meeting has ended.");
        navigate(`/meetings/${meeting.id}`, { replace: true });
      }
    };

    socket.on("meeting:started", onMeetingStarted);
    socket.on("meeting:ended", onMeetingEnded);

    return () => {
      socket.off("meeting:started", onMeetingStarted);
      socket.off("meeting:ended", onMeetingEnded);
    };
  }, [meeting, navigate, showStatus]);

  // 3. Media toggle controls
  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      if (localStream) {
        localStream.getAudioTracks().forEach((t) => {
          t.enabled = next;
        });
      }
      rtcManagerRef.current?.setTrackEnabled("audio", next);

      // Privacy: pause speech recognition immediately when muted
      captionControllerRef.current?.setMuted(!next);

      if (socketRef.current?.connected && isJoinedRef.current) {
        socketRef.current.emit("media:state", {
          audio: next,
          video: videoEnabled,
          screen: isScreenSharing,
          captions: captionsEnabled,
        });
      }
      return next;
    });
  }, [localStream, videoEnabled, isScreenSharing, captionsEnabled]);

  const handleToggleVideo = useCallback(() => {
    setVideoEnabled((prev) => {
      const next = !prev;
      if (localStream) {
        localStream.getVideoTracks().forEach((t) => {
          t.enabled = next;
        });
      }
      if (!isScreenSharing) {
        rtcManagerRef.current?.setTrackEnabled("video", next);
      }
      if (socketRef.current?.connected && isJoinedRef.current) {
        socketRef.current.emit("media:state", {
          audio: audioEnabled,
          video: next,
          screen: isScreenSharing,
          captions: captionsEnabled,
        });
      }
      return next;
    });
  }, [localStream, audioEnabled, isScreenSharing, captionsEnabled]);

  // Screen share handling
  const handleStopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    // Restore camera track if camera is enabled
    if (localStream && videoEnabled) {
      const cameraTrack = localStream.getVideoTracks()[0] || null;
      void rtcManagerRef.current?.replaceVideoTrack(cameraTrack);
    } else {
      void rtcManagerRef.current?.replaceVideoTrack(null);
    }

    if (socketRef.current?.connected && isJoinedRef.current) {
      socketRef.current.emit("media:state", {
        audio: audioEnabled,
        video: videoEnabled,
        screen: false,
        captions: captionsEnabled,
      });
    }
  }, [localStream, videoEnabled, audioEnabled, captionsEnabled]);

  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      handleStopScreenShare();
      return;
    }

    // Reject locally if another participant is already sharing
    const isSomeoneElseSharing = peers.some((p) => p.media.screen);
    if (isSomeoneElseSharing) {
      showStatus("Someone else is currently sharing their screen");
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        showStatus("Screen sharing is not supported in this browser");
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenTrack.onended = () => {
        handleStopScreenShare();
      };

      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setIsScreenSharing(true);

      await rtcManagerRef.current?.replaceVideoTrack(screenTrack);

      if (socketRef.current?.connected && isJoinedRef.current) {
        socketRef.current.emit("media:state", {
          audio: audioEnabled,
          video: videoEnabled,
          screen: true,
          captions: captionsEnabled,
        });
      }
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "AbortError") {
        showStatus("Screen sharing was cancelled or denied");
      } else {
        showStatus("Unable to share screen");
      }
    }
  }, [
    isScreenSharing,
    peers,
    audioEnabled,
    videoEnabled,
    captionsEnabled,
    showStatus,
    handleStopScreenShare,
  ]);

  // Captions handling
  useEffect(() => {
    if (!isCaptionsSupported) return;

    const controller = new CaptionController({
      onSegment: (segment) => {
        if (socketRef.current?.connected && isJoinedRef.current) {
          socketRef.current.emit("transcript:segment", segment);
        }
      },
      onError: (msg) => {
        showStatus(msg);
      },
      onCaptionsOff: () => {
        setCaptionsEnabled(false);
        if (socketRef.current?.connected && isJoinedRef.current) {
          socketRef.current.emit("media:state", {
            audio: audioEnabled,
            video: videoEnabled,
            screen: isScreenSharing,
            captions: false,
          });
        }
      },
    });

    captionControllerRef.current = controller;

    return () => {
      controller.destroy();
      captionControllerRef.current = null;
    };
  }, [isCaptionsSupported, audioEnabled, videoEnabled, isScreenSharing, showStatus]);

  const handleToggleCaptions = useCallback(() => {
    if (!isCaptionsSupported) {
      showStatus("Live captions need Chrome or Edge.");
      return;
    }

    setCaptionsEnabled((prev) => {
      const next = !prev;
      captionControllerRef.current?.setCaptionsEnabled(next);

      if (socketRef.current?.connected && isJoinedRef.current) {
        socketRef.current.emit("media:state", {
          audio: audioEnabled,
          video: videoEnabled,
          screen: isScreenSharing,
          captions: next,
        });
      }
      return next;
    });
  }, [isCaptionsSupported, audioEnabled, videoEnabled, isScreenSharing, showStatus]);

  const handleSelectAudioDevice = useCallback(
    async (deviceId: string) => {
      try {
        const currentVideoTrack = localStream?.getVideoTracks()[0];
        const res = await captureMedia(deviceId, currentVideoTrack?.getSettings()?.deviceId);
        setLocalStream(res.stream);
        rtcManagerRef.current?.setLocalStream(res.stream);
      } catch {
        // Device switch fallback
      }
    },
    [localStream],
  );

  const handleSelectVideoDevice = useCallback(
    async (deviceId: string) => {
      try {
        const currentAudioTrack = localStream?.getAudioTracks()[0];
        const res = await captureMedia(currentAudioTrack?.getSettings()?.deviceId, deviceId);
        setLocalStream(res.stream);
        rtcManagerRef.current?.setLocalStream(res.stream);
      } catch {
        // Device switch fallback
      }
    },
    [localStream],
  );

  // 4. Join room handler
  const handleJoinRoom = useCallback(async () => {
    if (!meeting || isJoining) return;
    setIsJoining(true);

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit(
      "room:join",
      { meetingId: meeting.id },
      async (res: {
        ok: boolean;
        code?: string;
        meeting?: { id: string; status: string };
        peers?: Array<{
          socketId: string;
          userId: string;
          name: string;
          media?: { audio: boolean; video: boolean; screen: boolean; captions: boolean };
        }>;
      }) => {
        setIsJoining(false);

        if (!res.ok) {
          if (res.code === "WAITING_FOR_HOST") {
            setLobbyState("waiting_for_host");
          } else if (res.code === "ROOM_FULL") {
            setLobbyState("room_full");
          } else if (res.code === "MEETING_ENDED") {
            setLobbyState("meeting_ended");
          } else if (res.code === "ALREADY_IN_ROOM") {
            setLobbyState("already_in_room");
          } else {
            setError(res.code || "Failed to join room");
          }
          return;
        }

        // Successfully joined
        isJoinedRef.current = true;
        setIsInLiveRoom(true);

        // Initialize WebRTC Manager
        const manager = new PeerConnectionManager(socket, setPeers, showStatus);
        if (rtcConfig?.iceServers) {
          manager.setIceServers(rtcConfig.iceServers);
        }
        manager.setLocalStream(localStream);
        rtcManagerRef.current = manager;

        // Existing peers in join acknowledgement: initiate offer to each
        if (res.peers && res.peers.length > 0) {
          for (const peer of res.peers) {
            manager.createPeerConnection(peer.socketId, peer.userId, peer.name, true, peer.media);
          }
        }

        // Broadcast current media state
        socket.emit("media:state", {
          audio: audioEnabled,
          video: videoEnabled,
          screen: false,
          captions: false,
        });

        // Load chat history
        try {
          const chat = await getMeetingChat(meeting.id);
          setChatMessages(chat.items);
        } catch {
          // Chat loading error ignored
        }
      },
    );
  }, [meeting, isJoining, localStream, audioEnabled, videoEnabled, rtcConfig, showStatus]);

  // 5. In-call WebRTC and Chat Socket Listeners
  useEffect(() => {
    if (!isInLiveRoom || !meeting) return;

    const socket = getSocket();

    const onPeerJoined = (data: {
      socketId: string;
      userId: string;
      name: string;
      media: { audio: boolean; video: boolean; screen: boolean; captions: boolean };
    }) => {
      showStatus(`${data.name} joined the meeting`);
      // New joiner creates the connection and will send offer to us; we wait for offer or prepare connection
      rtcManagerRef.current?.createPeerConnection(data.socketId, data.userId, data.name, false, data.media);
    };

    const onPeerLeft = (data: { socketId: string; userId: string }) => {
      showStatus("A participant left the call");
      rtcManagerRef.current?.removePeer(data.socketId);
    };

    const onSignalOffer = (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      void rtcManagerRef.current?.handleOffer(data.from, data.sdp);
    };

    const onSignalAnswer = (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      void rtcManagerRef.current?.handleAnswer(data.from, data.sdp);
    };

    const onSignalIce = (data: { from: string; candidate: RTCIceCandidateInit }) => {
      void rtcManagerRef.current?.handleIceCandidate(data.from, data.candidate);
    };

    const onMediaState = (data: {
      socketId: string;
      audio: boolean;
      video: boolean;
      screen: boolean;
      captions: boolean;
    }) => {
      rtcManagerRef.current?.updatePeerMedia(data.socketId, data);
    };

    const onChatMessage = (data: ChatMessageItem) => {
      setChatMessages((prev) => [...prev, data]);
    };

    const onChatTyping = (data: { userId: string; name: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        if (data.isTyping) {
          if (!prev.includes(data.name)) return [...prev, data.name];
          return prev;
        } else {
          return prev.filter((name) => name !== data.name);
        }
      });
    };

    // Reconnection handling: re-emit room:join and rebuild connections
    const onReconnect = () => {
      showStatus("Reconnected. Re-joining room...");
      socket.emit(
        "room:join",
        { meetingId: meeting.id },
        (res: {
          ok: boolean;
          peers?: Array<{
            socketId: string;
            userId: string;
            name: string;
            media?: { audio: boolean; video: boolean; screen: boolean; captions: boolean };
          }>;
        }) => {
          if (res.ok && res.peers) {
            for (const peer of res.peers) {
              rtcManagerRef.current?.createPeerConnection(peer.socketId, peer.userId, peer.name, true, peer.media);
            }
          }
        },
      );
    };

    const onTranscriptSegment = (data: LiveCaptionSegment) => {
      setLiveCaptions((prev) => [...prev, data]);
    };

    const onSocketError = (err: { code?: string; message?: string }) => {
      if (err.code === "SCREEN_SHARE_ACTIVE") {
        handleStopScreenShare();
        showStatus("Another participant is already sharing their screen.");
      } else if (err.code === "RATE_LIMITED") {
        showStatus("Too many requests sent. Please wait a moment.");
      }
    };

    socket.on("room:peer-joined", onPeerJoined);
    socket.on("room:peer-left", onPeerLeft);
    socket.on("signal:offer", onSignalOffer);
    socket.on("signal:answer", onSignalAnswer);
    socket.on("signal:ice", onSignalIce);
    socket.on("media:state", onMediaState);
    socket.on("chat:message", onChatMessage);
    socket.on("chat:typing", onChatTyping);
    socket.on("transcript:segment", onTranscriptSegment);
    socket.on("error", onSocketError);
    socket.on("reconnect", onReconnect);

    return () => {
      socket.off("room:peer-joined", onPeerJoined);
      socket.off("room:peer-left", onPeerLeft);
      socket.off("signal:offer", onSignalOffer);
      socket.off("signal:answer", onSignalAnswer);
      socket.off("signal:ice", onSignalIce);
      socket.off("media:state", onMediaState);
      socket.off("chat:message", onChatMessage);
      socket.off("chat:typing", onChatTyping);
      socket.off("transcript:segment", onTranscriptSegment);
      socket.off("error", onSocketError);
      socket.off("reconnect", onReconnect);
    };
  }, [isInLiveRoom, meeting, showStatus, handleStopScreenShare]);

  // 6. Chat actions
  const handleSendMessage = useCallback(
    (text: string) => {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit("chat:send", { text }, (res: { ok: boolean }) => {
        if (!res.ok) {
          showStatus("Failed to send message");
        }
      });
    },
    [showStatus],
  );

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("chat:typing", { isTyping });
  }, []);

  // 7. Leave and End meeting actions
  const handleLeaveMeeting = useCallback(() => {
    if (meeting && socketRef.current) {
      socketRef.current.emit("room:leave", { meetingId: meeting.id });
    }
    rtcManagerRef.current?.destroy();
    isJoinedRef.current = false;
    navigate(`/meetings/${meeting?.id || ""}`);
  }, [meeting, navigate]);

  const handleEndMeeting = useCallback(async () => {
    if (!meeting) return;
    try {
      await endMeeting(meeting.id);
      rtcManagerRef.current?.destroy();
      isJoinedRef.current = false;
      navigate(`/meetings/${meeting.id}`);
    } catch {
      showStatus("Failed to end meeting");
    }
  }, [meeting, navigate, showStatus]);

  const handleRetryPeerConnection = useCallback((socketId: string) => {
    void rtcManagerRef.current?.restartPeer(socketId);
  }, []);

  const handleGetDebugStats = useCallback(async () => {
    return (await rtcManagerRef.current?.getPeerDebugStats()) || [];
  }, []);

  // 8. General cleanup on component unmount
  useEffect(() => {
    return () => {
      if (meeting && isJoinedRef.current && socketRef.current) {
        socketRef.current.emit("room:leave", { meetingId: meeting.id });
      }
      rtcManagerRef.current?.destroy();
      captionControllerRef.current?.destroy();
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [meeting, localStream]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--ink, #09090b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          color: "var(--paper, #f4f4f5)",
          fontSize: "14px",
        }}
      >
        <Loader2 size={18} className="animate-spin" />
        <span>Preparing meeting room...</span>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--ink, #09090b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <AlertCircle size={32} style={{ color: "var(--accent-red, #e5484d)" }} />
          <h2 style={{ margin: 0, fontSize: "18px", color: "var(--paper, #f4f4f5)" }}>Unable to enter room</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft, #a1a1aa)" }}>{error || "Meeting not found"}</p>
          <button
            type="button"
            onClick={() => navigate("/meetings")}
            style={{
              marginTop: "8px",
              padding: "8px 16px",
              backgroundColor: "var(--surface, #18181b)",
              border: "1px solid var(--rule, #27272a)",
              color: "var(--paper, #f4f4f5)",
              borderRadius: "var(--radius, 6px)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Back to meetings
          </button>
        </div>
      </div>
    );
  }

  if (isInLiveRoom) {
    return (
      <LiveRoomView
        selfStream={localStream}
        selfName={user?.name || "You"}
        selfAudio={audioEnabled}
        selfVideo={videoEnabled}
        isScreenSharing={isScreenSharing}
        screenStream={screenStream}
        captions={liveCaptions}
        captionsEnabled={captionsEnabled}
        isCaptionsSupported={isCaptionsSupported}
        isHost={meeting.hostId === user?.id}
        isAdmin={user?.role === "ADMIN"}
        hostId={meeting.hostId}
        colorIndex={meeting.colorIndex}
        peers={peers}
        chatMessages={chatMessages}
        typingUsers={typingUsers}
        statusMessage={statusMessage}
        getDebugStats={handleGetDebugStats}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleCaptions={handleToggleCaptions}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onLeaveMeeting={handleLeaveMeeting}
        onEndMeeting={handleEndMeeting}
        onRetryPeerConnection={handleRetryPeerConnection}
      />
    );
  }

  return (
    <LobbyView
      meetingTitle={meeting.title}
      userName={user?.name || "Participant"}
      localStream={localStream}
      audioEnabled={audioEnabled}
      videoEnabled={videoEnabled}
      audioBlocked={audioBlocked}
      videoBlocked={videoBlocked}
      lobbyState={lobbyState}
      onToggleAudio={handleToggleAudio}
      onToggleVideo={handleToggleVideo}
      onSelectAudioDevice={handleSelectAudioDevice}
      onSelectVideoDevice={handleSelectVideoDevice}
      onJoinRoom={handleJoinRoom}
      isJoining={isJoining}
    />
  );
}
