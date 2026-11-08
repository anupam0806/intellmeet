import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PeerConnectionManager } from "../src/lib/rtc.js";
import {
  CaptionController,
  getDefaultCaptionLanguage,
  saveCaptionLanguage,
  CAPTION_LANGUAGES,
  CAPTION_LANGUAGE_STORAGE_KEY,
} from "../src/lib/captions.js";
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

    it("starts continuous recognition with interimResults true and emits final segments", () => {
      const onSegment = vi.fn();
      const onError = vi.fn();
      const onCaptionsOff = vi.fn();

      const controller = new CaptionController({ onSegment, onError, onCaptionsOff });
      controller.setCaptionsEnabled(true);

      expect(mockSpeechInstances.length).toBe(1);
      const instance = mockSpeechInstances[0];
      expect(instance?.continuous).toBe(true);
      expect(instance?.interimResults).toBe(true);
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

    it("handles interim results for speaker-local preview and clears on final result, mute, or off", () => {
      const onSegment = vi.fn();
      const onInterim = vi.fn();
      const onError = vi.fn();
      const onCaptionsOff = vi.fn();

      const controller = new CaptionController({
        onSegment,
        onInterim,
        onError,
        onCaptionsOff,
      });
      controller.setCaptionsEnabled(true);

      const instance = mockSpeechInstances[0];

      // 1. Interim speech arriving
      instance?.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: false,
            0: { transcript: "We need to fix" },
          },
        ],
      });

      expect(onInterim).toHaveBeenCalledWith("We need to fix");
      expect(onSegment).not.toHaveBeenCalled();

      // 2. Further interim speech
      instance?.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: false,
            0: { transcript: "We need to fix the database issue" },
          },
        ],
      });
      expect(onInterim).toHaveBeenCalledWith("We need to fix the database issue");
      expect(onSegment).not.toHaveBeenCalled();

      // 3. Final result arriving clears interim and emits onSegment
      instance?.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: true,
            0: { transcript: "We need to fix the database issue immediately." },
          },
        ],
      });
      expect(onSegment).toHaveBeenCalledWith({
        text: "We need to fix the database issue immediately.",
        ts: expect.any(Number),
      });
      expect(onInterim).toHaveBeenLastCalledWith("");

      // 4. Test clearing on mute
      instance?.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: false,
            0: { transcript: "Speaking while" },
          },
        ],
      });
      expect(onInterim).toHaveBeenCalledWith("Speaking while");

      controller.setMuted(true);
      expect(onInterim).toHaveBeenLastCalledWith("");
    });

    it("applies and persists selected language to SpeechRecognition.lang", () => {
      const controller = new CaptionController({
        initialLanguage: "en-GB",
        onSegment: vi.fn(),
        onError: vi.fn(),
        onCaptionsOff: vi.fn(),
      });

      expect(controller.getLanguage()).toBe("en-GB");
      controller.setCaptionsEnabled(true);

      const instance1 = mockSpeechInstances[0];
      expect(instance1?.lang).toBe("en-GB");

      // Switch language to Hindi
      controller.setLanguage("hi-IN");
      expect(controller.getLanguage()).toBe("hi-IN");
      expect(localStorage.getItem(CAPTION_LANGUAGE_STORAGE_KEY)).toBe("hi-IN");

      // Stops previous instance and starts new one with hi-IN
      expect(instance1?.stop).toHaveBeenCalled();
      expect(mockSpeechInstances.length).toBe(2);
      expect(mockSpeechInstances[1]?.lang).toBe("hi-IN");
    });

    it("resolves default language from navigator.language or fallback", () => {
      localStorage.removeItem(CAPTION_LANGUAGE_STORAGE_KEY);

      // Save custom language
      saveCaptionLanguage("en-IN");
      expect(getDefaultCaptionLanguage()).toBe("en-IN");

      localStorage.removeItem(CAPTION_LANGUAGE_STORAGE_KEY);
      // Fallback
      expect(CAPTION_LANGUAGES.map((l) => l.code)).toEqual([
        "en-IN",
        "en-US",
        "en-GB",
        "hi-IN",
      ]);
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

    it("renders language picker with all supported options and calls onLanguageChange", () => {
      const onLanguageChange = vi.fn();
      render(
        <CaptionsPanel
          captions={[]}
          isSupported={true}
          captionsEnabled={true}
          onToggleCaptions={vi.fn()}
          currentLanguage="en-IN"
          onLanguageChange={onLanguageChange}
        />,
      );

      const select = screen.getByTestId("caption-language-select") as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe("en-IN");

      // Check all 4 language options
      expect(screen.getByText("English (India)")).toBeInTheDocument();
      expect(screen.getByText("English (US)")).toBeInTheDocument();
      expect(screen.getByText("English (UK)")).toBeInTheDocument();
      expect(screen.getByText("Hindi")).toBeInTheDocument();

      // Change selection
      fireEvent.change(select, { target: { value: "hi-IN" } });
      expect(onLanguageChange).toHaveBeenCalledWith("hi-IN");
    });

    it("renders interim results in grey text for speaker", () => {
      render(
        <CaptionsPanel
          captions={[
            {
              id: "cap-1",
              speakerName: "Alice",
              text: "Previous complete sentence.",
              ts: Date.now() - 5000,
            },
          ]}
          isSupported={true}
          captionsEnabled={true}
          onToggleCaptions={vi.fn()}
          interimCaption="I am currently speaking right now..."
          speakerName="Dev Patel"
        />,
      );

      // Verify previous final caption is present
      expect(screen.getByText("Previous complete sentence.")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();

      // Verify interim caption is present with speaker name and grey text
      const interimEl = screen.getByTestId("interim-caption");
      expect(interimEl).toBeInTheDocument();
      expect(screen.getByText("Dev Patel")).toBeInTheDocument();
      expect(screen.getByText("transcribing...")).toBeInTheDocument();
      expect(screen.getByText("I am currently speaking right now...")).toBeInTheDocument();

      const interimText = screen.getByText("I am currently speaking right now...");
      expect(interimText.style.color).toBe("var(--ink-soft)");
    });
  });
});

