import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { Server as SocketIOServer } from "socket.io";
import { createApp } from "../src/app.js";
import { createSocketServer } from "../src/sockets/index.js";
import { Meeting } from "../src/models/Meeting.js";
import { TranscriptSegment } from "../src/models/TranscriptSegment.js";

describe("Phase P4: Transcript & Screen Share", () => {
  let server: http.Server;
  let io: SocketIOServer;
  let port: number;
  let app: ReturnType<typeof createApp>;

  function connectClient(token?: string): ClientSocket {
    return ioc(`http://localhost:${port}`, {
      auth: token ? { token } : undefined,
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
    });
  }

  function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
    return new Promise((resolve) => {
      socket.once(event, (data: T) => resolve(data));
    });
  }

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

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      io.close(() => {
        server.close(() => resolve());
      });
    });
  });

  describe("Screen share: Single participant enforcement and cleanup", () => {
    it("rejects second simultaneous screen share with SCREEN_SHARE_ACTIVE and clears when sharer disconnects", async () => {
      const host = await createTestTeam("Screen Host", "screenhost@example.com", "Screen Team");
      const teamRes = await request(app)
        .get("/api/v1/team")
        .set("Authorization", `Bearer ${host.token}`);
      const inviteCode = teamRes.body.inviteCode as string;
      const member = await joinTestTeam("Screen Member", "screenmember@example.com", inviteCode);

      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Screen Share Test" });
      const meetingId = meetingRes.body.id as string;

      const hostSocket = connectClient(host.token);
      const memberSocket = connectClient(member.token);

      await new Promise<void>((resolve) => {
        let connected = 0;
        const check = () => {
          connected++;
          if (connected === 2) resolve();
        };
        hostSocket.on("connect", check);
        memberSocket.on("connect", check);
      });

      // Host joins (starts meeting LIVE)
      await new Promise<void>((resolve) => {
        hostSocket.emit("room:join", { meetingId }, () => resolve());
      });

      // Member joins
      await new Promise<void>((resolve) => {
        memberSocket.emit("room:join", { meetingId }, () => resolve());
      });

      // 1. Host begins screen sharing
      hostSocket.emit("media:state", {
        audio: true,
        video: true,
        screen: true,
        captions: false,
      });

      // Wait a moment for server state to record host sharing
      await new Promise((r) => setTimeout(r, 50));

      // 2. Member attempts to screen share simultaneously
      const memberErrorPromise = waitFor<{ code: string; message: string }>(memberSocket, "error");
      memberSocket.emit("media:state", {
        audio: true,
        video: true,
        screen: true,
        captions: false,
      });

      const err = await memberErrorPromise;
      expect(err.code).toBe("SCREEN_SHARE_ACTIVE");
      expect(err.message).toMatch(/already sharing/i);

      // 3. Host disconnects; share state clears for room
      hostSocket.disconnect();
      await new Promise((r) => setTimeout(r, 100));

      // 4. Now member can screen share without rejection
      let memberReceivedError = false;
      memberSocket.on("error", (e: { code: string }) => {
        if (e.code === "SCREEN_SHARE_ACTIVE") memberReceivedError = true;
      });

      memberSocket.emit("media:state", {
        audio: true,
        video: true,
        screen: true,
        captions: false,
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(memberReceivedError).toBe(false);

      memberSocket.disconnect();
    });
  });

  describe("Socket: transcript:segment", () => {
    it("stores segment with speaker from socket and broadcasts to room; ignores payload speaker", async () => {
      const host = await createTestTeam("Alice Voice", "alicevoice@example.com", "Voice Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Live Captions Meeting" });
      const meetingId = meetingRes.body.id as string;

      const hostSocket = connectClient(host.token);
      await new Promise<void>((resolve) => hostSocket.on("connect", resolve));

      // Host joins
      await new Promise<void>((resolve) => {
        hostSocket.emit("room:join", { meetingId }, () => resolve());
      });

      const broadcastPromise = waitFor<{
        id: string;
        speakerId: string;
        speakerName: string;
        text: string;
        ts: number;
      }>(hostSocket, "transcript:segment");

      const sentTs = Date.now();
      // Attempt to spoof speakerId and speakerName in payload
      hostSocket.emit("transcript:segment", {
        text: "Hello everyone, welcome to the sprint planning.",
        ts: sentTs,
        speakerId: "fake-spoofed-id",
        speakerName: "Imposter",
      });

      const broadcast = await broadcastPromise;
      expect(broadcast.id).toBeDefined();
      expect(broadcast.speakerId).toBe(host.user.id);
      expect(broadcast.speakerName).toBe("Alice Voice"); // Strictly from socket
      expect(broadcast.text).toBe("Hello everyone, welcome to the sprint planning.");
      expect(broadcast.ts).toBe(sentTs);

      // Confirm DB record
      const dbRecord = await TranscriptSegment.findById(broadcast.id);
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.speakerId?.toString()).toBe(host.user.id);
      expect(dbRecord?.speakerName).toBe("Alice Voice");

      hostSocket.disconnect();
    });

    it("rejects when socket is not in the meeting room or when meeting is not LIVE", async () => {
      const host = await createTestTeam("Bob Voice", "bobvoice@example.com", "Bob Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Not Live Meeting" });
      const meetingId = meetingRes.body.id as string;

      const hostSocket = connectClient(host.token);
      await new Promise<void>((resolve) => hostSocket.on("connect", resolve));

      // 1. Emit when not joined in any room
      const errNotJoined = waitFor<{ code: string }>(hostSocket, "error");
      hostSocket.emit("transcript:segment", {
        text: "Speaking before joining",
        ts: Date.now(),
      });
      const res1 = await errNotJoined;
      expect(res1.code).toBe("FORBIDDEN");

      // 2. Join a meeting, then end it
      await new Promise<void>((resolve) => {
        hostSocket.emit("room:join", { meetingId }, () => resolve());
      });
      await request(app)
        .post(`/api/v1/meetings/${meetingId}/start`)
        .set("Authorization", `Bearer ${host.token}`);
      await request(app)
        .post(`/api/v1/meetings/${meetingId}/end`)
        .set("Authorization", `Bearer ${host.token}`);

      // Emit on ENDED meeting
      const errNotLive = waitFor<{ code: string }>(hostSocket, "error");
      hostSocket.emit("transcript:segment", {
        text: "Speaking after meeting ended",
        ts: Date.now(),
      });
      const res2 = await errNotLive;
      expect(res2.code).toBe("MEETING_NOT_LIVE");

      hostSocket.disconnect();
    });

    it("rejects empty text or text exceeding 1000 characters", async () => {
      const host = await createTestTeam("Charlie Voice", "charlievoice@example.com", "Charlie Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Validation Test" });
      const meetingId = meetingRes.body.id as string;

      const hostSocket = connectClient(host.token);
      await new Promise<void>((resolve) => hostSocket.on("connect", resolve));
      await new Promise<void>((resolve) => {
        hostSocket.emit("room:join", { meetingId }, () => resolve());
      });

      // Empty text
      const errEmpty = waitFor<{ code: string }>(hostSocket, "error");
      hostSocket.emit("transcript:segment", {
        text: "   ",
        ts: Date.now(),
      });
      const resEmpty = await errEmpty;
      expect(resEmpty.code).toBe("VALIDATION_ERROR");

      // Exceeding 1000 characters
      const errTooLong = waitFor<{ code: string }>(hostSocket, "error");
      hostSocket.emit("transcript:segment", {
        text: "a".repeat(1001),
        ts: Date.now(),
      });
      const resTooLong = await errTooLong;
      expect(resTooLong.code).toBe("VALIDATION_ERROR");

      hostSocket.disconnect();
    });

    it("replaces ts with server time when payload ts is > 60 seconds off", async () => {
      const host = await createTestTeam("Dave Time", "davetime@example.com", "Time Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Timestamp Correction Test" });
      const meetingId = meetingRes.body.id as string;

      const hostSocket = connectClient(host.token);
      await new Promise<void>((resolve) => hostSocket.on("connect", resolve));
      await new Promise<void>((resolve) => {
        hostSocket.emit("room:join", { meetingId }, () => resolve());
      });

      const broadcastPromise = waitFor<{ ts: number }>(hostSocket, "transcript:segment");
      const skewedTs = Date.now() - 120_000; // 2 minutes in the past
      const beforeServerMs = Date.now();

      hostSocket.emit("transcript:segment", {
        text: "Old timestamp message",
        ts: skewedTs,
      });

      const broadcast = await broadcastPromise;
      // ts should have been corrected close to server time
      expect(broadcast.ts).toBeGreaterThanOrEqual(beforeServerMs);
      expect(Math.abs(broadcast.ts - skewedTs)).toBeGreaterThan(50_000);

      hostSocket.disconnect();
    });

    it("enforces rate limit of 30 segments per 10 seconds per socket", async () => {
      const host = await createTestTeam("Rate Limit Host", "ratehost@example.com", "Rate Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Rate Limit Test" });
      const meetingId = meetingRes.body.id as string;

      const hostSocket = connectClient(host.token);
      await new Promise<void>((resolve) => hostSocket.on("connect", resolve));
      await new Promise<void>((resolve) => {
        hostSocket.emit("room:join", { meetingId }, () => resolve());
      });

      let rateLimited = false;
      hostSocket.on("error", (e: { code: string }) => {
        if (e.code === "RATE_LIMITED") {
          rateLimited = true;
        }
      });

      // Send 35 segments rapidly
      for (let i = 0; i < 35; i++) {
        hostSocket.emit("transcript:segment", {
          text: `Rapid speech segment ${i}`,
          ts: Date.now(),
        });
      }

      await new Promise((r) => setTimeout(r, 200));
      expect(rateLimited).toBe(true);

      hostSocket.disconnect();
    });

    it("updates captionsOn in DB when media:state is emitted", async () => {
      const host = await createTestTeam("Captions State Host", "captionshost@example.com", "Captions Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Captions State Test" });
      const meetingId = meetingRes.body.id as string;

      const hostSocket = connectClient(host.token);
      await new Promise<void>((resolve) => hostSocket.on("connect", resolve));
      await new Promise<void>((resolve) => {
        hostSocket.emit("room:join", { meetingId }, () => resolve());
      });

      hostSocket.emit("media:state", {
        audio: true,
        video: true,
        screen: false,
        captions: true,
      });

      await new Promise((r) => setTimeout(r, 100));

      const updatedMeeting = await Meeting.findById(meetingId);
      const participant = updatedMeeting?.participants.find(
        (p) => p.userId.toString() === host.user.id && !p.leftAt,
      );
      expect(participant?.captionsOn).toBe(true);

      hostSocket.disconnect();
    });
  });

  describe("REST Endpoints: GET and POST /meetings/:id/transcript", () => {
    it("GET /meetings/:id/transcript returns items ordered by ts, with pagination and total", async () => {
      const host = await createTestTeam("Rest Host", "resthost@example.com", "Rest Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Transcript REST Test" });
      const meetingId = meetingRes.body.id as string;

      // Seed 3 segments
      const now = Date.now();
      await TranscriptSegment.create([
        {
          meetingId,
          teamId: host.user.teamId,
          speakerName: "Host",
          text: "First spoken line",
          ts: new Date(now),
        },
        {
          meetingId,
          teamId: host.user.teamId,
          speakerName: "Host",
          text: "Second spoken line",
          ts: new Date(now + 2000),
        },
        {
          meetingId,
          teamId: host.user.teamId,
          speakerName: "Host",
          text: "Third spoken line",
          ts: new Date(now + 4000),
        },
      ]);

      const res = await request(app)
        .get(`/api/v1/meetings/${meetingId}/transcript?limit=2&offset=1`)
        .set("Authorization", `Bearer ${host.token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].text).toBe("Second spoken line");
      expect(res.body.items[1].text).toBe("Third spoken line");
    });

    it("GET /meetings/:id/transcript returns 404 for cross-team meeting", async () => {
      const teamA = await createTestTeam("Team A User", "teama@example.com", "Team A");
      const teamB = await createTestTeam("Team B User", "teamb@example.com", "Team B");

      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${teamA.token}`)
        .send({ title: "Team A Private Meeting" });
      const meetingId = meetingRes.body.id as string;

      const res = await request(app)
        .get(`/api/v1/meetings/${meetingId}/transcript`)
        .set("Authorization", `Bearer ${teamB.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("POST /meetings/:id/transcript rejects when meeting is not ENDED with 409 MEETING_NOT_ENDED", async () => {
      const host = await createTestTeam("Post Host", "posthost@example.com", "Post Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Scheduled Meeting" });
      const meetingId = meetingRes.body.id as string;

      const res = await request(app)
        .post(`/api/v1/meetings/${meetingId}/transcript`)
        .set("Authorization", `Bearer ${host.token}`)
        .send({ text: "Pasted transcript line" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("MEETING_NOT_ENDED");
    });

    it("POST /meetings/:id/transcript rejects Member who is not host with 403 FORBIDDEN", async () => {
      const host = await createTestTeam("Owner Host", "ownerhost@example.com", "Perm Team");
      const teamRes = await request(app)
        .get("/api/v1/team")
        .set("Authorization", `Bearer ${host.token}`);
      const inviteCode = teamRes.body.inviteCode as string;
      const member = await joinTestTeam("Perm Member", "permmember@example.com", inviteCode);

      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Ended Perm Meeting" });
      const meetingId = meetingRes.body.id as string;

      // Start and End meeting
      await request(app)
        .post(`/api/v1/meetings/${meetingId}/start`)
        .set("Authorization", `Bearer ${host.token}`);
      await request(app)
        .post(`/api/v1/meetings/${meetingId}/start`)
        .set("Authorization", `Bearer ${host.token}`);
      await request(app)
        .post(`/api/v1/meetings/${meetingId}/end`)
        .set("Authorization", `Bearer ${host.token}`);

      const res = await request(app)
        .post(`/api/v1/meetings/${meetingId}/transcript`)
        .set("Authorization", `Bearer ${member.token}`)
        .send({ text: "Member trying to paste transcript" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("POST /meetings/:id/transcript splits non-empty lines, splits lines > 1000 chars at word boundary, attributes to 'Pasted transcript', and enforces 50k limit", async () => {
      const host = await createTestTeam("Split Host", "splithost@example.com", "Split Team");
      const meetingRes = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${host.token}`)
        .send({ title: "Ended Splitting Meeting" });
      const meetingId = meetingRes.body.id as string;

      await request(app)
        .post(`/api/v1/meetings/${meetingId}/start`)
        .set("Authorization", `Bearer ${host.token}`);
      await request(app)
        .post(`/api/v1/meetings/${meetingId}/end`)
        .set("Authorization", `Bearer ${host.token}`);

      // 1. Check 50,000 char limit rejection
      const hugeText = "a".repeat(50001);
      const resTooBig = await request(app)
        .post(`/api/v1/meetings/${meetingId}/transcript`)
        .set("Authorization", `Bearer ${host.token}`)
        .send({ text: hugeText });

      expect(resTooBig.status).toBe(400);
      expect(resTooBig.body.error.code).toBe("VALIDATION_ERROR");

      // 2. Normal text with short lines, empty lines, and one line > 1000 characters
      const longSentence = "word ".repeat(250); // ~1250 characters
      const pasteText = `
        Line 1: Meeting kick-off.

        Line 2: Reviewing progress.

        ${longSentence}

        Line 4: Closing remarks.
      `;

      const res = await request(app)
        .post(`/api/v1/meetings/${meetingId}/transcript`)
        .set("Authorization", `Bearer ${host.token}`)
        .send({ text: pasteText });

      expect(res.status).toBe(201);
      expect(res.body.created).toBeGreaterThanOrEqual(4);

      // Verify created segments
      const segmentsRes = await request(app)
        .get(`/api/v1/meetings/${meetingId}/transcript?limit=100`)
        .set("Authorization", `Bearer ${host.token}`);

      expect(segmentsRes.body.total).toBe(res.body.created);
      for (const item of segmentsRes.body.items) {
        expect(item.speakerName).toBe("Pasted transcript");
        expect(item.speakerId).toBeUndefined();
        expect(item.text.length).toBeLessThanOrEqual(1000);
      }

      // Verify timestamps step 1 second each
      const items = segmentsRes.body.items;
      const t0 = new Date(items[0].ts).getTime();
      const t1 = new Date(items[1].ts).getTime();
      expect(t1 - t0).toBe(1000);
    });
  });
});

