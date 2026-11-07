import type { Socket } from "socket.io-client";

export interface PeerMediaState {
  audio: boolean;
  video: boolean;
  screen: boolean;
  captions: boolean;
}

export interface PeerStreamInfo {
  socketId: string;
  userId: string;
  name: string;
  stream: MediaStream;
  media: PeerMediaState;
  connectionState: RTCPeerConnectionState;
  isFailed?: boolean;
}

interface PeerRecord {
  pc: RTCPeerConnection;
  info: PeerStreamInfo;
  queuedCandidates: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
  restartedIce?: boolean;
}

export class PeerConnectionManager {
  private peers = new Map<string, PeerRecord>();
  private localStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [];
  private socket: Socket;
  private onPeersChange: (peers: PeerStreamInfo[]) => void;
  private onStatusMessage?: (msg: string) => void;

  constructor(
    socket: Socket,
    onPeersChange: (peers: PeerStreamInfo[]) => void,
    onStatusMessage?: (msg: string) => void,
  ) {
    this.socket = socket;
    this.onPeersChange = onPeersChange;
    this.onStatusMessage = onStatusMessage;
  }

  setIceServers(servers: RTCIceServer[]) {
    this.iceServers = servers;
  }

  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    // If we already have open connections, update local tracks
    if (stream) {
      for (const [, peer] of this.peers) {
        const senders = peer.pc.getSenders();
        for (const track of stream.getTracks()) {
          const sender = senders.find((s) => s.track?.kind === track.kind);
          if (sender) {
            void sender.replaceTrack(track);
          } else {
            peer.pc.addTrack(track, stream);
          }
        }
      }
    }
  }

  private notify() {
    const list: PeerStreamInfo[] = [];
    for (const [, peer] of this.peers) {
      list.push({ ...peer.info });
    }
    this.onPeersChange(list);
  }

  createPeerConnection(
    socketId: string,
    userId: string,
    name: string,
    isInitiator: boolean,
    initialMedia?: Partial<PeerMediaState>,
  ): RTCPeerConnection {
    // If existing connection exists, close it first
    if (this.peers.has(socketId)) {
      this.removePeer(socketId);
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers.length > 0 ? this.iceServers : [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const remoteStream = new MediaStream();

    const info: PeerStreamInfo = {
      socketId,
      userId,
      name,
      stream: remoteStream,
      media: {
        audio: initialMedia?.audio ?? false,
        video: initialMedia?.video ?? false,
        screen: initialMedia?.screen ?? false,
        captions: initialMedia?.captions ?? false,
      },
      connectionState: "new",
    };

    const record: PeerRecord = {
      pc,
      info,
      queuedCandidates: [],
      hasRemoteDescription: false,
    };
    this.peers.set(socketId, record);

    // Add local tracks if available
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    // ICE candidate relay
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("signal:ice", {
          to: socketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Remote track arrival
    pc.ontrack = (event) => {
      for (const track of event.streams[0]?.getTracks() || [event.track]) {
        if (!remoteStream.getTracks().find((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      }
      this.notify();
    };

    // Connection state changes
    pc.oniceconnectionstatechange = async () => {
      info.connectionState = pc.connectionState;

      if (pc.iceConnectionState === "failed") {
        if (!record.restartedIce) {
          record.restartedIce = true;
          try {
            if (typeof pc.restartIce === "function") {
              pc.restartIce();
            }
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            this.socket.emit("signal:offer", { to: socketId, sdp: offer });
          } catch {
            info.isFailed = true;
            this.onStatusMessage?.(`Connection lost with ${name}`);
          }
        } else {
          info.isFailed = true;
          this.onStatusMessage?.(`Connection lost with ${name}`);
        }
      } else if (pc.iceConnectionState === "connected") {
        info.isFailed = false;
      }
      this.notify();
    };

    pc.onconnectionstatechange = () => {
      info.connectionState = pc.connectionState;
      if (pc.connectionState === "failed") {
        info.isFailed = true;
        this.onStatusMessage?.(`Connection lost with ${name}`);
      }
      this.notify();
    };

    // If initiator, send offer
    if (isInitiator) {
      void (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.socket.emit("signal:offer", { to: socketId, sdp: offer });
        } catch (err) {
          console.error("Failed to create offer for peer:", socketId, err);
        }
      })();
    }

    this.notify();
    return pc;
  }

  async handleOffer(from: string, sdp: RTCSessionDescriptionInit, peerName = "Participant", userId = "") {
    let peer = this.peers.get(from);
    if (!peer) {
      this.createPeerConnection(from, userId, peerName, false);
      peer = this.peers.get(from);
    }
    if (!peer) return;

    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      peer.hasRemoteDescription = true;

      // Drain queued ICE candidates
      while (peer.queuedCandidates.length > 0) {
        const candidate = peer.queuedCandidates.shift();
        if (candidate) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }

      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this.socket.emit("signal:answer", { to: from, sdp: answer });
      this.notify();
    } catch (err) {
      console.error("Failed to handle offer from:", from, err);
    }
  }

  async handleAnswer(from: string, sdp: RTCSessionDescriptionInit) {
    const peer = this.peers.get(from);
    if (!peer) return;

    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      peer.hasRemoteDescription = true;

      // Drain queued ICE candidates
      while (peer.queuedCandidates.length > 0) {
        const candidate = peer.queuedCandidates.shift();
        if (candidate) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
      this.notify();
    } catch (err) {
      console.error("Failed to handle answer from:", from, err);
    }
  }

  async handleIceCandidate(from: string, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(from);
    if (!peer) return;

    try {
      if (peer.hasRemoteDescription) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        peer.queuedCandidates.push(candidate);
      }
    } catch (err) {
      console.error("Failed to add ICE candidate from:", from, err);
    }
  }

  updatePeerMedia(socketId: string, media: PeerMediaState) {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.info.media = { ...media };
      this.notify();
    }
  }

  async restartPeer(socketId: string) {
    const peer = this.peers.get(socketId);
    if (!peer) return;

    try {
      peer.info.isFailed = false;
      if (typeof peer.pc.restartIce === "function") {
        peer.pc.restartIce();
      }
      const offer = await peer.pc.createOffer({ iceRestart: true });
      await peer.pc.setLocalDescription(offer);
      this.socket.emit("signal:offer", { to: socketId, sdp: offer });
      this.notify();
    } catch (err) {
      console.error("Failed to retry peer connection:", socketId, err);
    }
  }

  removePeer(socketId: string) {
    const peer = this.peers.get(socketId);
    if (peer) {
      try {
        peer.pc.close();
      } catch {
        // Ignore close error
      }
      this.peers.delete(socketId);
      this.notify();
    }
  }

  destroy() {
    for (const [, peer] of this.peers) {
      try {
        peer.pc.close();
      } catch {
        // Ignore close error
      }
    }
    this.peers.clear();

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop error
        }
      }
      this.localStream = null;
    }
    this.notify();
  }
}

export async function captureMedia(
  audioDeviceId?: string,
  videoDeviceId?: string,
): Promise<{ stream: MediaStream; audioBlocked: boolean; videoBlocked: boolean }> {
  let stream: MediaStream;
  let audioBlocked = false;
  let videoBlocked = false;

  const constraints: MediaStreamConstraints = {
    audio: {
      deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: {
      deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { max: 24 },
    },
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, audioBlocked: false, videoBlocked: false };
  } catch {
    // Attempt audio only if video failed
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: constraints.audio,
        video: false,
      });
      return { stream, audioBlocked: false, videoBlocked: true };
    } catch {
      // Attempt video only if audio failed
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: constraints.video,
        });
        return { stream, audioBlocked: true, videoBlocked: false };
      } catch {
        // Both blocked or unavailable; create empty stream
        audioBlocked = true;
        videoBlocked = true;
        stream = new MediaStream();
        return { stream, audioBlocked, videoBlocked };
      }
    }
  }
}
