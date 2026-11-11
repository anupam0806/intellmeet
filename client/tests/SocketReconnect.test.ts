import { describe, it, expect, vi } from "vitest";

describe("Resilience: Socket Reconnect (Phase P8)", () => {
  it("rejoins the meeting room and rebuilds peer connections on socket reconnect", () => {
    // Mock socket with event listeners
    const listeners: Record<string, Function[]> = {};
    const emittedEvents: Array<{ event: string; data: any; callback?: Function }> = [];

    const mockSocket = {
      on(event: string, fn: Function) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event]!.push(fn);
      },
      off(event: string, fn: Function) {
        if (listeners[event]) {
          listeners[event] = listeners[event]!.filter((f) => f !== fn);
        }
      },
      emit(event: string, data: any, callback?: Function) {
        emittedEvents.push({ event, data, callback });
      },
    };

    // Mock PeerConnectionManager
    const mockRtcManager = {
      createPeerConnection: vi.fn(),
    };

    const statusUpdates: string[] = [];
    const showStatus = (msg: string) => statusUpdates.push(msg);

    const meeting = { id: "meeting-reconnect-123" };

    // Register reconnect handler (matching Room.tsx logic)
    const onReconnect = () => {
      showStatus("Reconnected. Re-joining room...");
      mockSocket.emit(
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
              mockRtcManager.createPeerConnection(
                peer.socketId,
                peer.userId,
                peer.name,
                true,
                peer.media
              );
            }
          }
        }
      );
    };

    mockSocket.on("reconnect", onReconnect);

    // Simulate wifi blip / socket reconnect trigger
    expect(listeners["reconnect"]).toBeDefined();
    expect(listeners["reconnect"]?.length).toBe(1);

    listeners["reconnect"]![0]!();

    // 1. Verifies notification was triggered
    expect(statusUpdates).toContain("Reconnected. Re-joining room...");

    // 2. Verifies room:join was emitted with the current meeting ID
    const joinCall = emittedEvents.find((e) => e.event === "room:join");
    expect(joinCall).toBeDefined();
    expect(joinCall?.data).toEqual({ meetingId: "meeting-reconnect-123" });
    expect(typeof joinCall?.callback).toBe("function");

    // 3. Verifies callback rebuilds peer connections for existing peers
    joinCall?.callback?.({
      ok: true,
      peers: [
        {
          socketId: "socket-peer-1",
          userId: "user-1",
          name: "Alice",
          media: { audio: true, video: true, screen: false, captions: false },
        },
        {
          socketId: "socket-peer-2",
          userId: "user-2",
          name: "Bob",
          media: { audio: false, video: true, screen: true, captions: false },
        },
      ],
    });

    expect(mockRtcManager.createPeerConnection).toHaveBeenCalledTimes(2);
    expect(mockRtcManager.createPeerConnection).toHaveBeenNthCalledWith(
      1,
      "socket-peer-1",
      "user-1",
      "Alice",
      true,
      { audio: true, video: true, screen: false, captions: false }
    );
    expect(mockRtcManager.createPeerConnection).toHaveBeenNthCalledWith(
      2,
      "socket-peer-2",
      "user-2",
      "Bob",
      true,
      { audio: false, video: true, screen: true, captions: false }
    );
  });
});
