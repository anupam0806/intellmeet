import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { PeerConnectionManager } from "../src/lib/rtc.js";
import { CaptionController } from "../src/lib/captions.js";
import { CaptionsPanel } from "../src/components/room/CaptionsPanel.js";
import { VideoTile } from "../src/components/room/VideoTile.js";

// Mock WebRTC tracks and streams
class MockTrack {
  id: string;
  kind: string;
  enabled = true;
  readyState = "live";
  stop = vi.fn();
  onended: (() => void) | null = null;

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

class MockRTCRtpSender {
  track: MockTrack | null;
  replaceTrack = vi.fn().mockImplementation((newTrack: MockTrack | null) => {
    this.track = newTrack;
    return Promise.resolve();
  });
  constructor(track: MockTrack | null) {
    this.track = track;
  }
}

class MockRTCRtpTransceiver {
  sender: MockRTCRtpSender;
  receiver: { track: MockTrack };
  constructor(kind: string, track: MockTrack | null = null) {
    this.sender = new MockRTCRtpSender(track);
    this.receiver = { track: new MockTrack(`recv-${kind}`, kind) };
  }
}

class MockRTCPeerConnection {
  transceivers: MockRTCRtpTransceiver[] = [];
  senders: MockRTCRtpSender[] = [];
  iceConnectionState = "connected";
  connectionState: RTCPeerConnectionState = "connected";

  addTransceiver(kind: string) {
    const t = new MockRTCRtpTransceiver(kind, null);
    this.transceivers.push(t);
    this.senders.push(t.sender);
    return t;
  }

  addTrack(track: MockTrack) {
    const sender = new MockRTCRtpSender(track);
    this.senders.push(sender);
    const t = new MockRTCRtpTransceiver(track.kind, track);
    t.sender = sender;
    this.transceivers.push(t);
    return sender;
  }

  getTransceivers() {
    return this.transceivers;
  }

  getSenders() {
    return this.senders;
  }

  close = vi.fn();
}

describe("Phase P4: Screen Sharing & Captions Client Logic", () => {
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

  describe("Screen Sharing Logic (RTC Track Swapping)", () => {
    it("ensures transceivers exist from creation even without camera, and swaps track on screen share and restore", async () => {
      const socket = { emit: vi.fn() } as unknown as import("socket.io-client").Socket;
      const onPeersChange = vi.fn();
      const manager = new PeerConnectionManager(socket, onPeersChange);

      // Create connection with audio only (no camera)
      const audioTrack = new MockTrack("mic-1", "audio");
      const localStream = new MockMediaStream([audioTrack]) as unknown as MediaStream;
      manager.setLocalStream(localStream);

      const pc = manager.createPeerConnection("peer-socket-1", "user-1", "Remote User", false);

      // Verify audio and video transceivers exist from creation
      const transceivers = (pc as unknown as MockRTCPeerConnection).getTransceivers();
      expect(transceivers.some((t) => t.receiver.track.kind === "audio")).toBe(true);
      expect(transceivers.some((t) => t.receiver.track.kind === "video")).toBe(true);

      // 1. Start screen sharing: swap video sender with screenTrack
      const screenTrack = new MockTrack("screen-track-1", "video");
      await manager.replaceVideoTrack(screenTrack as unknown as MediaStreamTrack);

      const videoSender = (pc as unknown as MockRTCPeerConnection)
        .getSenders()
        .find((s) => s.track?.kind === "video" || s.track?.id === "screen-track-1");

      expect(videoSender).toBeDefined();
      expect(videoSender?.replaceTrack).toHaveBeenCalledWith(screenTrack);

      // 2. Stop screen sharing: restore to camera track (or null if no camera)
      const cameraTrack = new MockTrack("camera-track-1", "video");
      await manager.replaceVideoTrack(cameraTrack as unknown as MediaStreamTrack);
      expect(videoSender?.replaceTrack).toHaveBeenCalledWith(cameraTrack);

      // 3. Stop screen sharing when camera is off: replace with null
      await manager.replaceVideoTrack(null);
      expect(videoSender?.replaceTrack).toHaveBeenCalledWith(null);
    });

    it("renders presenting badge and object-fit contain on VideoTile when presenting", () => {
      const videoTrack = new MockTrack("screen-vid", "video");
      const stream = new MockMediaStream([videoTrack]) as unknown as MediaStream;

      render(
        <VideoTile
          stream={stream}
          name="Presenter Jane"
          isSelf={false}
          isScreenSharing={true}
          videoEnabled={true}
        />,
      );

      expect(screen.getByTestId("presenting-badge")).toBeInTheDocument();
      expect(screen.getByText("Presenting")).toBeInTheDocument();

      const videoEl = document.querySelector("video");
      expect(videoEl?.style.objectFit).toBe("contain");
    });
  });

  describe("Caption Controller Logic", () => {
    let mockSpeechInstances: Array<{
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      onresult: ((e: unknown) => void) | null;
      onerror: ((e: unknown) => void) | null;
      onend: (() => void) | null;
    }> = [];

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      start = vi.fn();
      stop = vi.fn();
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;

      constructor() {
        mockSpeechInstances.push(this);
      }
    }

    beforeEach(() => {
      mockSpeechInstances = [];
      (globalThis as unknown as { SpeechRecognition?: typeof MockSpeechRecognition }).SpeechRecognition =
        MockSpeechRecognition;
    });

    afterEach(() => {
      delete (globalThis as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    });

    it("starts continuous recognition and emits final segments", () => {
      const onSegment = vi.fn();
      const onError = vi.fn();
      const onCaptionsOff = vi.fn();

      const controller = new CaptionController({ onSegment, onError, onCaptionsOff });
      controller.setCaptionsEnabled(true);

      expect(mockSpeechInstances.length).toBe(1);
      const instance = mockSpeechInstances[0];
      expect(instance?.continuous).toBe(true);
      expect(instance?.interimResults).toBe(false);
      expect(instance?.start).toHaveBeenCalled();

      // Simulate recognition final result
      instance?.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: true,
            0: { transcript: "Hello team, let us begin." },
          },
        ],
      });

      expect(onSegment).toHaveBeenCalledWith({
        text: "Hello team, let us begin.",
        ts: expect.any(Number),
      });
    });

    it("stops recognition immediately when microphone is muted and resumes when unmuted", () => {
      const controller = new CaptionController({
        onSegment: vi.fn(),
        onError: vi.fn(),
        onCaptionsOff: vi.fn(),
      });
      controller.setCaptionsEnabled(true);

      const instance1 = mockSpeechInstances[0];
      expect(instance1?.start).toHaveBeenCalled();

      // Mute microphone
      controller.setMuted(true);
      expect(instance1?.stop).toHaveBeenCalled();

      // Unmute microphone
      controller.setMuted(false);
      expect(mockSpeechInstances.length).toBe(2);
      expect(mockSpeechInstances[1]?.start).toHaveBeenCalled();
    });

    it("ignores no-speech and aborted errors; turns off captions on not-allowed", () => {
      const onError = vi.fn();
      const onCaptionsOff = vi.fn();

      const controller = new CaptionController({
        onSegment: vi.fn(),
        onError,
        onCaptionsOff,
      });
      controller.setCaptionsEnabled(true);

      const instance = mockSpeechInstances[0];

      // Ignore no-speech and aborted
      instance?.onerror?.({ error: "no-speech" });
      instance?.onerror?.({ error: "aborted" });
      expect(onError).not.toHaveBeenCalled();
      expect(onCaptionsOff).not.toHaveBeenCalled();

      // not-allowed triggers error and turns off captions
      instance?.onerror?.({ error: "not-allowed" });
      expect(onCaptionsOff).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/access for live captions was denied/i),
      );
    });

    it("restarts automatically after onend while captions are on", async () => {
      vi.useFakeTimers();
      try {
        const controller = new CaptionController({
          onSegment: vi.fn(),
          onError: vi.fn(),
          onCaptionsOff: vi.fn(),
        });
        controller.setCaptionsEnabled(true);

        const instance = mockSpeechInstances[0];
        expect(mockSpeechInstances.length).toBe(1);

        // Speech engine ends after silence
        instance?.onend?.();

        // Advance 300 ms restart timer
        act(() => {
          vi.advanceTimersByTime(350);
        });

        // A new recognition instance has been started
        expect(mockSpeechInstances.length).toBe(2);
        expect(mockSpeechInstances[1]?.start).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops immediately on leave / destroy", () => {
      const controller = new CaptionController({
        onSegment: vi.fn(),
        onError: vi.fn(),
        onCaptionsOff: vi.fn(),
      });
      controller.setCaptionsEnabled(true);

      const instance = mockSpeechInstances[0];
      controller.setInRoom(false);

      expect(instance?.stop).toHaveBeenCalled();
    });
  });

  describe("UI Notices & Markers", () => {
    it("renders unsupported browser notice in CaptionsPanel when not supported", () => {
      render(
        <CaptionsPanel
          captions={[]}
          isSupported={false}
          captionsEnabled={false}
          onToggleCaptions={vi.fn()}
        />,
      );

      expect(screen.getByTestId("unsupported-browser-notice")).toBeInTheDocument();
      expect(
        screen.getByText(/Live captions need Chrome or Edge/i),
      ).toBeInTheDocument();
    });

    it("renders captions off marker on VideoTile when captions are disabled", () => {
      render(
        <VideoTile
          name="Bob User"
          isSelf={false}
          captionsEnabled={false}
        />,
      );

      expect(screen.getByTestId("captions-off-marker")).toBeInTheDocument();
      expect(screen.getByText("captions off")).toBeInTheDocument();
    });
  });
});

