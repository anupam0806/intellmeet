import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PeerConnectionManager } from "../src/lib/rtc.js";

// Mock WebRTC browser globals
class MockRTCPeerConnection {
  iceServers: unknown[];
  signalingState = "stable";
  iceConnectionState = "new";
  connectionState: RTCPeerConnectionState = "new";
  localDescription: unknown = null;
  remoteDescription: unknown = null;
  senders: Array<{ track: { kind: string }; replaceTrack: ReturnType<typeof vi.fn> }> = [];
  onicecandidate: ((event: { candidate: { toJSON: () => unknown } | null }) => void) | null = null;
  ontrack: ((event: { track: unknown; streams: Array<{ getTracks: () => unknown[] }> }) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  constructor(config?: { iceServers?: unknown[] }) {
    this.iceServers = config?.iceServers || [];
  }

  addTrack(track: { kind: string }) {
    this.senders.push({ track, replaceTrack: vi.fn() });
  }

  getSenders() {
    return this.senders;
  }

  createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "mock-sdp-offer" });
  createAnswer = vi.fn().mockResolvedValue({ type: "answer", sdp: "mock-sdp-answer" });
  setLocalDescription = vi.fn().mockImplementation((desc: unknown) => {
    this.localDescription = desc;
    return Promise.resolve();
  });
  setRemoteDescription = vi.fn().mockImplementation((desc: unknown) => {
    this.remoteDescription = desc;
    return Promise.resolve();
  });
  addIceCandidate = vi.fn().mockResolvedValue(undefined);
  restartIce = vi.fn();
  close = vi.fn();
}

class MockRTCSessionDescription {
  type: string;
  sdp: string;
  constructor(init: { type: string; sdp: string }) {
    this.type = init.type;
    this.sdp = init.sdp;
  }
}

class MockRTCIceCandidate {
  candidate: string;
  constructor(init: { candidate: string }) {
    this.candidate = init.candidate;
  }
}

class MockMediaStream {
  tracks: Array<{ id: string; kind: string; stop: ReturnType<typeof vi.fn> }> = [];
  constructor(tracks: Array<{ id: string; kind: string; stop: ReturnType<typeof vi.fn> }> = []) {
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
  addTrack(t: { id: string; kind: string; stop: ReturnType<typeof vi.fn> }) {
    this.tracks.push(t);
  }
}

describe("PeerConnectionManager", () => {
  const originalRTCPeerConnection = globalThis.RTCPeerConnection;
  const originalRTCSessionDescription = globalThis.RTCSessionDescription;
  const originalRTCIceCandidate = globalThis.RTCIceCandidate;
  const originalMediaStream = globalThis.MediaStream;

  beforeEach(() => {
    (globalThis as unknown as { RTCPeerConnection: typeof MockRTCPeerConnection }).RTCPeerConnection = MockRTCPeerConnection;
    (globalThis as unknown as { RTCSessionDescription: typeof MockRTCSessionDescription }).RTCSessionDescription = MockRTCSessionDescription;
    (globalThis as unknown as { RTCIceCandidate: typeof MockRTCIceCandidate }).RTCIceCandidate = MockRTCIceCandidate;
    (globalThis as unknown as { MediaStream: typeof MockMediaStream }).MediaStream = MockMediaStream;
  });

  afterEach(() => {
    globalThis.RTCPeerConnection = originalRTCPeerConnection;
    globalThis.RTCSessionDescription = originalRTCSessionDescription;
    globalThis.RTCIceCandidate = originalRTCIceCandidate;
    globalThis.MediaStream = originalMediaStream;
  });

  it("creates peer connection as initiator, creates and sends offer to peer", async () => {
    const socket = { emit: vi.fn() } as unknown as import("socket.io-client").Socket;
    const onPeersChange = vi.fn();
    const manager = new PeerConnectionManager(socket, onPeersChange);

    const mockTrack = { id: "track-1", kind: "video", stop: vi.fn() };
    const localStream = new MockMediaStream([mockTrack]) as unknown as MediaStream;
    manager.setLocalStream(localStream);

    const pc = manager.createPeerConnection("socket-peer-1", "user-1", "Alice", true);
    expect(pc).toBeDefined();

    // Allow promise resolution inside initiator async block
    await new Promise((r) => setTimeout(r, 10));

    expect(socket.emit).toHaveBeenCalledWith("signal:offer", {
      to: "socket-peer-1",
      sdp: { type: "offer", sdp: "mock-sdp-offer" },
    });
    expect(onPeersChange).toHaveBeenCalled();
  });

  it("queues ICE candidates received before remoteDescription and drains them once remote description is set", async () => {
    const socket = { emit: vi.fn() } as unknown as import("socket.io-client").Socket;
    const onPeersChange = vi.fn();
    const manager = new PeerConnectionManager(socket, onPeersChange);

    manager.createPeerConnection("socket-peer-2", "user-2", "Bob", false);

    // Receive ICE candidate while remoteDescription is NOT set yet
    await manager.handleIceCandidate("socket-peer-2", { candidate: "candidate-1" } as RTCIceCandidateInit);

    // Handle offer which sets remoteDescription and drains queue
    await manager.handleOffer("socket-peer-2", { type: "offer", sdp: "offer-sdp" } as RTCSessionDescriptionInit);

    expect(socket.emit).toHaveBeenCalledWith("signal:answer", expect.objectContaining({ to: "socket-peer-2" }));
    expect(onPeersChange).toHaveBeenCalled();
  });

  it("updates peer media state and notifies subscribers", () => {
    const socket = { emit: vi.fn() } as unknown as import("socket.io-client").Socket;
    const onPeersChange = vi.fn();
    const manager = new PeerConnectionManager(socket, onPeersChange);

    manager.createPeerConnection("socket-peer-3", "user-3", "Charlie", false);

    manager.updatePeerMedia("socket-peer-3", {
      audio: true,
      video: false,
      screen: false,
      captions: true,
    });

    const latestPeers = onPeersChange.mock.calls[onPeersChange.mock.calls.length - 1]?.[0] as Array<{ media: { captions: boolean } }>;
    expect(latestPeers[0]?.media.captions).toBe(true);
  });

  it("cleanup destroys all peer connections and stops all local tracks", () => {
    const socket = { emit: vi.fn() } as unknown as import("socket.io-client").Socket;
    const onPeersChange = vi.fn();
    const manager = new PeerConnectionManager(socket, onPeersChange);

    const stopFn = vi.fn();
    const localStream = new MockMediaStream([{ id: "t1", kind: "audio", stop: stopFn }]) as unknown as MediaStream;
    manager.setLocalStream(localStream);

    manager.createPeerConnection("peer-x", "user-x", "David", false);
    manager.destroy();

    expect(stopFn).toHaveBeenCalledTimes(1);
    const latestPeers = onPeersChange.mock.calls[onPeersChange.mock.calls.length - 1]?.[0];
    expect(latestPeers).toEqual([]);
  });
});
