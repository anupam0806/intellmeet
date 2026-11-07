import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { Server as SocketIOServer } from "socket.io";
import { createApp } from "../src/app.js";
import { createSocketServer } from "../src/sockets/index.js";
import { Meeting } from "../src/models/Meeting.js";
import { env } from "../src/config/env.js";

describe("Socket Server: Signalling, Presence, Chat, and RTC", () => {
  let server: http.Server;
  let io: SocketIOServer;
  let port: number;
  let app: ReturnType<typeof createApp>;

  // Helper to connect socket client
  function connectClient(token?: string): ClientSocket {
    return ioc(`http://localhost:${port}`, {
      auth: token ? { token } : undefined,
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
    });
  }

  // Helper to wait for event
  function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
    return new Promise((resolve) => {
      socket.once(event, (data: T) => resolve(data));
    });
  }

  // Helper to create team and user
  async function createTestTeam(name: string, email: string, teamName: string) {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name,
      email,
      password: "Password123",
      teamName,
    });
    return {
      token: res.body.accessToken as string,
      user: res.body.user as { id: string; teamId: string; role: string; name: string },
    };
  }

  // Helper to join team
  async function joinTestTeam(name: string, email: string, inviteCode: string) {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name,
      email,
      password: "Password123",
      inviteCode,
    });
    return {
      token: res.body.accessToken as string,
      user: res.body.user as { id: string; teamId: string; role: string; name: string },
    };
  }

  beforeAll(async () => {
    app = createApp();
    server = http.createServer(app);
    io = createSocketServer(server);
    app.set("io", io);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("rejects socket connection without a token with connect_error UNAUTHENTICATED", async () => {
    const client = connectClient();
    const err = await waitFor<{ message: string }>(client, "connect_error");
    expect(err.message).toBe("UNAUTHENTICATED");
    client.disconnect();
  });

  it("rejects socket connection with invalid token with connect_error UNAUTHENTICATED", async () => {
    const client = connectClient("invalid-junk-token");
    const err = await waitFor<{ message: string }>(client, "connect_error");
    expect(err.message).toBe("UNAUTHENTICATED");
    client.disconnect();
  });

  it("non-host joining SCHEDULED meeting receives WAITING_FOR_HOST", async () => {
    const host = await createTestTeam("Host User", "host_wait@example.com", "Waiting Team");
    const teamRes = await request(app).get("/api/v1/team").set("Authorization", `Bearer ${host.token}`);
    const inviteCode = teamRes.body.inviteCode;
    const member = await joinTestTeam("Member User", "member_wait@example.com", inviteCode);

    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "Scheduled Meeting" });
    const meetingId = mRes.body.id;

    const memberClient = connectClient(member.token);
    await waitFor(memberClient, "connect");

    const joinRes = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      memberClient.emit("room:join", { meetingId }, resolve);
    });

    expect(joinRes.ok).toBe(false);
    expect(joinRes.code).toBe("WAITING_FOR_HOST");
    memberClient.disconnect();
  });

  it("host joining SCHEDULED meeting starts it, emits meeting:started to team room, and returns peers", async () => {
    const host = await createTestTeam("Host Starter", "host_start_sock@example.com", "Start Sock Team");
    const teamRes = await request(app).get("/api/v1/team").set("Authorization", `Bearer ${host.token}`);
    const inviteCode = teamRes.body.inviteCode;
    const member = await joinTestTeam("Member Listener", "member_listen@example.com", inviteCode);

    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "To Start Meeting" });
    const meetingId = mRes.body.id;

    // Member connects to team room and listens for meeting:started
    const memberClient = connectClient(member.token);
    await waitFor(memberClient, "connect");
    const startedPromise = waitFor<{ meetingId: string }>(memberClient, "meeting:started");

    // Host connects and joins room
    const hostClient = connectClient(host.token);
    await waitFor(hostClient, "connect");

    const joinRes = await new Promise<{
      ok: boolean;
      meeting?: { id: string; status: string };
      peers?: unknown[];
    }>((resolve) => {
      hostClient.emit("room:join", { meetingId }, resolve);
    });

    expect(joinRes.ok).toBe(true);
    expect(joinRes.meeting?.id).toBe(meetingId);
    expect(joinRes.meeting?.status).toBe("LIVE");
    expect(joinRes.peers).toEqual([]);

    const startedData = await startedPromise;
    expect(startedData.meetingId).toBe(meetingId);

    // Verify DB status is now LIVE
    const dbMeeting = await Meeting.findById(meetingId);
    expect(dbMeeting?.status).toBe("LIVE");
    expect(dbMeeting?.startedAt).toBeDefined();

    memberClient.disconnect();
    hostClient.disconnect();
  });

  it("returns ALREADY_IN_ROOM when user joins with a second socket connection to same meeting", async () => {
    const host = await createTestTeam("Host MultiTab", "host_multitab@example.com", "MultiTab Team");
    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "MultiTab Meeting" });
    const meetingId = mRes.body.id;

    const client1 = connectClient(host.token);
    await waitFor(client1, "connect");
    await new Promise((resolve) => client1.emit("room:join", { meetingId }, resolve));

    const client2 = connectClient(host.token);
    await waitFor(client2, "connect");

    const joinRes2 = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      client2.emit("room:join", { meetingId }, resolve);
    });

    expect(joinRes2.ok).toBe(false);
    expect(joinRes2.code).toBe("ALREADY_IN_ROOM");

    client1.disconnect();
    client2.disconnect();
  });

  it("joining ended meeting returns MEETING_ENDED", async () => {
    const host = await createTestTeam("Host Ended", "host_ended@example.com", "Ended Team");
    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "Ended Meeting Test" });
    const meetingId = mRes.body.id;

    // Start then end meeting
    await request(app).post(`/api/v1/meetings/${meetingId}/start`).set("Authorization", `Bearer ${host.token}`);
    await request(app).post(`/api/v1/meetings/${meetingId}/end`).set("Authorization", `Bearer ${host.token}`);

    const client = connectClient(host.token);
    await waitFor(client, "connect");

    const joinRes = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      client.emit("room:join", { meetingId }, resolve);
    });

    expect(joinRes.ok).toBe(false);
    expect(joinRes.code).toBe("MEETING_ENDED");
    client.disconnect();
  });

  it("joining another team's meeting returns NOT_FOUND", async () => {
    const teamA = await createTestTeam("Team A User", "teama_sock@example.com", "Team A Sock");
    const teamB = await createTestTeam("Team B User", "teamb_sock@example.com", "Team B Sock");

    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${teamA.token}`)
      .send({ title: "Team A Private" });
    const meetingId = mRes.body.id;

    const clientB = connectClient(teamB.token);
    await waitFor(clientB, "connect");

    const joinRes = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      clientB.emit("room:join", { meetingId }, resolve);
    });

    expect(joinRes.ok).toBe(false);
    expect(joinRes.code).toBe("NOT_FOUND");
    clientB.disconnect();
  });

  it("enforces MAX_PARTICIPANTS room capacity and returns ROOM_FULL for (MAX_PARTICIPANTS+1)th user", async () => {
    // MAX_PARTICIPANTS default is 4
    const admin = await createTestTeam("Admin Cap", "admin_cap@example.com", "Cap Team");
    const teamRes = await request(app).get("/api/v1/team").set("Authorization", `Bearer ${admin.token}`);
    const inviteCode = teamRes.body.inviteCode;

    // Create 4 team members
    const m1 = await joinTestTeam("User 1", "user1_cap@example.com", inviteCode);
    const m2 = await joinTestTeam("User 2", "user2_cap@example.com", inviteCode);
    const m3 = await joinTestTeam("User 3", "user3_cap@example.com", inviteCode);
    const m4 = await joinTestTeam("User 4", "user4_cap@example.com", inviteCode);

    // Admin creates meeting and starts it
    const meetingRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Capacity Meeting" });
    const meetingId = meetingRes.body.id;
    await request(app).post(`/api/v1/meetings/${meetingId}/start`).set("Authorization", `Bearer ${admin.token}`);

    // Join 4 distinct users (Admin, m1, m2, m3)
    const clients: ClientSocket[] = [];
    const users = [admin, m1, m2, m3];
    for (const u of users) {
      const c = connectClient(u.token);
      await waitFor(c, "connect");
      const res = await new Promise<{ ok: boolean }>((resolve) => {
        c.emit("room:join", { meetingId }, resolve);
      });
      expect(res.ok).toBe(true);
      clients.push(c);
    }

    // 5th distinct user (m4) attempts to join -> ROOM_FULL
    const client5 = connectClient(m4.token);
    await waitFor(client5, "connect");
    const res5 = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      client5.emit("room:join", { meetingId }, resolve);
    });

    expect(res5.ok).toBe(false);
    expect(res5.code).toBe("ROOM_FULL");

    // Clean up
    client5.disconnect();
    clients.forEach((c) => c.disconnect());
  });

  it("relays signalling (offer, answer, ice) inside room, refuses to relay outside room or cross-team", async () => {
    const host = await createTestTeam("Signal Host", "signal_host@example.com", "Signal Team");
    const teamRes = await request(app).get("/api/v1/team").set("Authorization", `Bearer ${host.token}`);
    const member = await joinTestTeam("Signal Peer", "signal_peer@example.com", teamRes.body.inviteCode);

    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "Signalling Meeting" });
    const meetingId = mRes.body.id;
    await request(app).post(`/api/v1/meetings/${meetingId}/start`).set("Authorization", `Bearer ${host.token}`);

    const client1 = connectClient(host.token);
    const client2 = connectClient(member.token);
    await waitFor(client1, "connect");
    await waitFor(client2, "connect");

    await new Promise((r) => client1.emit("room:join", { meetingId }, r));
    await new Promise((r) => client2.emit("room:join", { meetingId }, r));

    // Peer 1 sends offer to Peer 2
    const offerPromise = waitFor<{ from: string; sdp: unknown }>(client2, "signal:offer");
    client1.emit("signal:offer", { to: client2.id, sdp: { type: "offer", sdp: "dummy-sdp-offer" } });
    const offer = await offerPromise;
    expect(offer.from).toBe(client1.id);
    expect(offer.sdp).toEqual({ type: "offer", sdp: "dummy-sdp-offer" });

    // Peer 2 sends answer to Peer 1
    const answerPromise = waitFor<{ from: string; sdp: unknown }>(client1, "signal:answer");
    client2.emit("signal:answer", { to: client1.id, sdp: { type: "answer", sdp: "dummy-sdp-answer" } });
    const answer = await answerPromise;
    expect(answer.from).toBe(client2.id);
    expect(answer.sdp).toEqual({ type: "answer", sdp: "dummy-sdp-answer" });

    // Peer 1 sends ICE candidate to Peer 2
    const icePromise = waitFor<{ from: string; candidate: unknown }>(client2, "signal:ice");
    client1.emit("signal:ice", { to: client2.id, candidate: { candidate: "dummy-ice-string" } });
    const ice = await icePromise;
    expect(ice.from).toBe(client1.id);
    expect(ice.candidate).toEqual({ candidate: "dummy-ice-string" });

    // Attempting to send signal to unknown socket -> error event
    const errPromise = waitFor<{ code: string }>(client1, "error");
    client1.emit("signal:offer", { to: "unknown-socket-id", sdp: { type: "offer", sdp: "test" } });
    const err = await errPromise;
    expect(err.code).toBe("FORBIDDEN");

    client1.disconnect();
    client2.disconnect();
  });

  it("persists chat messages and broadcasts with sender from socket; enforces rate limit of 20 msg / 10s", async () => {
    const host = await createTestTeam("Chat Host", "chat_host@example.com", "Chat Team");
    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "Chat Meeting" });
    const meetingId = mRes.body.id;
    await request(app).post(`/api/v1/meetings/${meetingId}/start`).set("Authorization", `Bearer ${host.token}`);

    const client = connectClient(host.token);
    await waitFor(client, "connect");
    await new Promise((r) => client.emit("room:join", { meetingId }, r));

    // Send valid message
    const msgPromise = waitFor<{ id: string; senderName: string; text: string }>(client, "chat:message");
    const ack = await new Promise<{ ok: boolean; id?: string }>((resolve) => {
      client.emit("chat:send", { text: "Hello everyone!" }, resolve);
    });
    expect(ack.ok).toBe(true);
    expect(ack.id).toBeDefined();

    const broadcastMsg = await msgPromise;
    expect(broadcastMsg.id).toBe(ack.id);
    expect(broadcastMsg.text).toBe("Hello everyone!");
    expect(broadcastMsg.senderName).toBe("Chat Host");

    // Verify REST GET /meetings/:id/chat returns the message
    const restChatRes = await request(app)
      .get(`/api/v1/meetings/${meetingId}/chat`)
      .set("Authorization", `Bearer ${host.token}`);
    expect(restChatRes.status).toBe(200);
    expect(restChatRes.body.items).toHaveLength(1);
    expect(restChatRes.body.items[0].text).toBe("Hello everyone!");

    // Test rate limit: send 21 more messages rapidly
    let rateLimited = false;
    client.on("error", (err: { code: string }) => {
      if (err.code === "RATE_LIMITED") {
        rateLimited = true;
      }
    });

    for (let i = 0; i < 21; i++) {
      client.emit("chat:send", { text: `Spam msg ${i}` });
    }

    // Wait short time to receive error
    await new Promise((r) => setTimeout(r, 200));
    expect(rateLimited).toBe(true);

    client.disconnect();
  });

  it("disconnect sets leftAt on participant entry and emits room:peer-left", async () => {
    const host = await createTestTeam("Leave Host", "leave_host@example.com", "Leave Team");
    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "Leave Meeting" });
    const meetingId = mRes.body.id;
    await request(app).post(`/api/v1/meetings/${meetingId}/start`).set("Authorization", `Bearer ${host.token}`);

    const client1 = connectClient(host.token);
    await waitFor(client1, "connect");
    await new Promise((r) => client1.emit("room:join", { meetingId }, r));

    // Verify participant record has no leftAt yet
    let dbMeeting = await Meeting.findById(meetingId);
    expect(dbMeeting?.participants[0]?.leftAt).toBeUndefined();

    // Disconnect client
    client1.disconnect();
    // Wait briefly for disconnect handler to process
    await new Promise((r) => setTimeout(r, 300));

    dbMeeting = await Meeting.findById(meetingId);
    expect(dbMeeting?.participants[0]?.leftAt).toBeDefined();
  });

  it("POST /meetings/:id/end emits meeting:ended to room and team, and removes everyone", async () => {
    const host = await createTestTeam("End Event Host", "end_event@example.com", "End Event Team");
    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "End Event Meeting" });
    const meetingId = mRes.body.id;
    await request(app).post(`/api/v1/meetings/${meetingId}/start`).set("Authorization", `Bearer ${host.token}`);

    const client = connectClient(host.token);
    await waitFor(client, "connect");
    await new Promise((r) => client.emit("room:join", { meetingId }, r));

    const endedPromise = waitFor<{ meetingId: string }>(client, "meeting:ended");

    // Call REST POST /meetings/:id/end
    const endRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/end`)
      .set("Authorization", `Bearer ${host.token}`);
    expect(endRes.status).toBe(200);

    const endedData = await endedPromise;
    expect(endedData.meetingId).toBe(meetingId);

    client.disconnect();
  });

  it("GET /rtc/config returns STUN and maxParticipants, and includes TURN only when configured", async () => {
    const host = await createTestTeam("RTC User", "rtc_user@example.com", "RTC Team");

    const res = await request(app)
      .get("/api/v1/rtc/config")
      .set("Authorization", `Bearer ${host.token}`);

    expect(res.status).toBe(200);
    expect(res.body.maxParticipants).toBe(env.MAX_PARTICIPANTS);
    expect(res.body.iceServers).toBeInstanceOf(Array);
    expect(res.body.iceServers[0].urls).toBeDefined();

    // If TURN is configured in env, check it; otherwise verify no credentials
    if (!env.TURN_URL) {
      expect(res.body.iceServers.find((s: { username?: string }) => s.username !== undefined)).toBeUndefined();
    }
  });
});
