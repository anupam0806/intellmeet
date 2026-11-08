import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { VideoTile } from "../src/components/room/VideoTile.js";
import { DebugPanel } from "../src/components/room/DebugPanel.js";
import { PeerConnectionManager, type PeerDebugStats } from "../src/lib/rtc.js";

// Mock WebRTC globals
class MockTrack {
  id: string;
  kind: string;
  enabled = true;
  readyState = "live";
  stop = vi.fn();

  constructor(id: string, kind: string) {
    this.id = id;
    this.kind = kind;
  }
}

class MockMediaStream {
  tracks: MockTrack[] = [];
  constructor(tracks: MockTrack[] = []) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  addTrack(t: MockTrack) {
    this.tracks.push(t);
  }
  removeTrack(t: MockTrack) {
    this.tracks = this.tracks.filter((track) => track.id !== t.id);
  }
}

class MockRTCPeerConnection {
  senders: Array<{ track: MockTrack; replaceTrack: ReturnType<typeof vi.fn> }> = [];
  iceConnectionState = "connected";
  connectionState: RTCPeerConnectionState = "connected";

  addTrack(track: MockTrack) {
    this.senders.push({ track, replaceTrack: vi.fn() });
  }

  getSenders() {
    return this.senders;
  }

  close = vi.fn();
  createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" });
  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  getStats = vi.fn().mockResolvedValue(
    new Map([
      ["1", { type: "inbound-rtp", kind: "audio", bytesReceived: 1048576 }],
      ["2", { type: "inbound-rtp", kind: "video", bytesReceived: 5242880 }],
    ]),
  );
}

describe("Camera Toggle & Media Handling", () => {
  const originalRTCPeerConnection = globalThis.RTCPeerConnection;
  const originalMediaStream = globalThis.MediaStream;
  const originalPlay = HTMLMediaElement.prototype.play;

  beforeEach(() => {
    (globalThis as unknown as { RTCPeerConnection: typeof MockRTCPeerConnection }).RTCPeerConnection =
      MockRTCPeerConnection;
    (globalThis as unknown as { MediaStream: typeof MockMediaStream }).MediaStream = MockMediaStream;
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.RTCPeerConnection = originalRTCPeerConnection;
    globalThis.MediaStream = originalMediaStream;
    HTMLMediaElement.prototype.play = originalPlay;
    vi.restoreAllMocks();
  });

  it("toggles camera enabled state at least 10 times in a row without stopping or breaking tracks", () => {
    const socket = { emit: vi.fn() } as unknown as import("socket.io-client").Socket;
    const onPeersChange = vi.fn();
    const manager = new PeerConnectionManager(socket, onPeersChange);

    const videoTrack = new MockTrack("vid-1", "video");
    const audioTrack = new MockTrack("aud-1", "audio");
    const localStream = new MockMediaStream([videoTrack, audioTrack]) as unknown as MediaStream;

    manager.setLocalStream(localStream);
    manager.createPeerConnection("socket-remote-1", "user-remote-1", "Remote Peer", false);

    // Toggle 10 times off and on (20 transitions total)
    for (let i = 0; i < 10; i++) {
      // Camera off
      manager.setTrackEnabled("video", false);
      expect(videoTrack.enabled).toBe(false);
      expect(videoTrack.stop).not.toHaveBeenCalled();

      // Camera on
      manager.setTrackEnabled("video", true);
      expect(videoTrack.enabled).toBe(true);
      expect(videoTrack.stop).not.toHaveBeenCalled();
    }

    // Verify tracks are still alive
    expect(videoTrack.readyState).toBe("live");
    expect(audioTrack.enabled).toBe(true);
  });

  it("keeps <video> mounted and switches display/placeholder on toggle", () => {
    const videoTrack = new MockTrack("vid-1", "video");
    const stream = new MockMediaStream([videoTrack]) as unknown as MediaStream;

    // Render VideoTile with video on
    const { rerender } = render(
      <VideoTile
        stream={stream}
        name="Alice Tester"
        isSelf={true}
        videoEnabled={true}
        audioEnabled={true}
      />,
    );

    // <video> should be in document with display: block
    const videoElement = document.querySelector("video") as HTMLVideoElement;
    expect(videoElement).not.toBeNull();
    expect(videoElement.style.display).toBe("block");
    expect(screen.queryByTestId("camera-off-placeholder")).toBeNull();

    // Toggle camera off and on 10 times, verifying <video> stays mounted
    for (let i = 0; i < 10; i++) {
      rerender(
        <VideoTile
          stream={stream}
          name="Alice Tester"
          isSelf={true}
          videoEnabled={false}
          audioEnabled={true}
        />,
      );
      expect(videoElement.style.display).toBe("none");
      expect(screen.getByTestId("camera-off-placeholder")).toBeInTheDocument();

      rerender(
        <VideoTile
          stream={stream}
          name="Alice Tester"
          isSelf={true}
          videoEnabled={true}
          audioEnabled={true}
        />,
      );
      expect(videoElement.style.display).toBe("block");
      expect(screen.queryByTestId("camera-off-placeholder")).toBeNull();
    }
  });

  it("mutes only self preview; remote stream <video> is unmuted and handles autoplay blocks", async () => {
    const videoTrack = new MockTrack("vid-remote", "video");
    const stream = new MockMediaStream([videoTrack]) as unknown as MediaStream;

    // Mock play rejection for autoplay block
    const originalPlay = HTMLMediaElement.prototype.play;
    const playMock = vi.fn().mockRejectedValue(new Error("NotAllowedError: play() failed"));
    HTMLMediaElement.prototype.play = playMock;

    try {
      // 1. Self tile should have muted=true
      const { unmount } = render(
        <VideoTile stream={stream} name="Self Preview" isSelf={true} />,
      );
      const selfVideo = document.querySelector("video") as HTMLVideoElement;
      expect(selfVideo.muted).toBe(true);
      expect(screen.queryByRole("button", { name: /Click to enable audio/i })).toBeNull();
      unmount();

      // 2. Remote tile should have muted=false
      render(
        <VideoTile
          stream={stream}
          name="Remote Speaker"
          isSelf={false}
          peerId="peer-123"
        />,
      );
      const remoteVideo = document.querySelector("video") as HTMLVideoElement;
      expect(remoteVideo.muted).toBe(false);

      // Autoplay error shows fallback button
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Click to enable audio/i }),
        ).toBeInTheDocument();
      });

      // Clicking fallback calls play()
      playMock.mockResolvedValueOnce(undefined);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Click to enable audio/i }));
      });
      expect(playMock).toHaveBeenCalled();
    } finally {
      HTMLMediaElement.prototype.play = originalPlay;
    }
  });

  it("renders WebRTC Debug panel showing connection stats, inbound bytes, and audio state without secrets", async () => {
    const mockStats: PeerDebugStats[] = [
      {
        socketId: "socket-peer-abc",
        name: "Remote Engineer",
        connectionState: "connected",
        iceConnectionState: "connected",
        audioBytesReceived: 1048576,
        videoBytesReceived: 5242880,
      },
    ];

    const getDebugStats = vi.fn().mockResolvedValue(mockStats);
    const audioPlaybackStates = {
      "socket-peer-abc": { muted: false, playing: true },
    };

    render(
      <DebugPanel
        getDebugStats={getDebugStats}
        audioPlaybackStates={audioPlaybackStates}
      />,
    );

    // Open debug panel
    const openBtn = screen.getByRole("button", { name: /Open WebRTC Debug Panel/i });
    expect(openBtn).toBeInTheDocument();
    fireEvent.click(openBtn);

    // Wait for stats to load
    await waitFor(() => {
      expect(screen.getByText(/Remote Engineer/i)).toBeInTheDocument();
      expect(screen.getAllByText("connected").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("1.00 MB")).toBeInTheDocument(); // 1048576 B
      expect(screen.getByText("5.00 MB")).toBeInTheDocument(); // 5242880 B
      expect(screen.getByText("Playing")).toBeInTheDocument();
    });

    // Ensure no SDP or secrets are displayed
    expect(screen.queryByText(/sdp/i)).toBeNull();
    expect(screen.queryByText(/token/i)).toBeNull();
    expect(screen.queryByText(/secret/i)).toBeNull();
  });
});

