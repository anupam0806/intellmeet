import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { Server as SocketIOServer } from "socket.io";
import { createApp } from "../src/app.js";
import { createSocketServer } from "../src/sockets/index.js";
import { Meeting } from "../src/models/Meeting.js";
import {
  authRateLimiter,
  demoRateLimiter,
  aiGenerateRateLimiter,
  generalRateLimiter,
} from "../src/middleware/rateLimit.js";

describe("Security Audit: Rate Limits Enforcement (docs/02 section 12)", () => {
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

  beforeAll(async () => {
    process.env.TEST_RATE_LIMIT = "true";
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
    delete process.env.TEST_RATE_LIMIT;
    await new Promise<void>((resolve) => {
      io.close(() => {
        server.close(() => resolve());
      });
    });
  });

  it("auth endpoints rate limiter enforces 10 requests per 15 minutes", async () => {
    const limiterApp = express();
    limiterApp.use(authRateLimiter);
    limiterApp.get("/auth-test", (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 10; i++) {
      const res = await request(limiterApp).get("/auth-test");
      expect(res.status).toBe(200);
    }

    const blockedRes = await request(limiterApp).get("/auth-test");
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe("RATE_LIMITED");
  });

  it("demo login rate limiter enforces 30 requests per 15 minutes", async () => {
    const limiterApp = express();
    limiterApp.use(demoRateLimiter);
    limiterApp.get("/demo-test", (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 30; i++) {
      const res = await request(limiterApp).get("/demo-test");
      expect(res.status).toBe(200);
    }

    const blockedRes = await request(limiterApp).get("/demo-test");
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe("RATE_LIMITED");
  });

  it("AI generation rate limiter enforces 5 requests per 10 minutes per user", async () => {
    const limiterApp = express();
    limiterApp.use((req, _res, next) => {
      req.user = { id: "user-ai-1", email: "ai@test.com", teamId: "t1", role: "MEMBER" };
      next();
    });
    limiterApp.use(aiGenerateRateLimiter);
    limiterApp.get("/ai-test", (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 5; i++) {
      const res = await request(limiterApp).get("/ai-test");
      expect(res.status).toBe(200);
    }

    const blockedRes = await request(limiterApp).get("/ai-test");
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe("RATE_LIMITED");
  });

  it("general API rate limiter enforces 300 requests per 15 minutes per IP", async () => {
    const limiterApp = express();
    limiterApp.use(generalRateLimiter);
    limiterApp.get("/general-test", (_req, res) => res.json({ ok: true }));

    // Send 300 concurrent requests in batches of 50
    for (let b = 0; b < 6; b++) {
      await Promise.all(
        Array.from({ length: 50 }, () => request(limiterApp).get("/general-test"))
      );
    }

    const blockedRes = await request(limiterApp).get("/general-test");
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe("RATE_LIMITED");
  });

  it("socket chat enforces 20 messages per 10 seconds per socket", async () => {
    delete process.env.TEST_RATE_LIMIT;
    const signupRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Socket User",
      email: "socket-rate@example.com",
      password: "Password123",
      teamName: "Socket Team",
    });
    process.env.TEST_RATE_LIMIT = "true";

    const token = signupRes.body.accessToken;
    const meeting = await Meeting.create({
      teamId: signupRes.body.user.teamId,
      hostId: signupRes.body.user.id,
      title: "Chat Rate Meeting",
      roomCode: "chat-rate-01",
      colorIndex: 0,
      status: "LIVE",
    });

    const client = connectClient(token);
    await new Promise((resolve) => client.once("connect", resolve));

    await new Promise((resolve) => {
      client.emit("room:join", { meetingId: meeting.id }, resolve);
    });

    let rateLimitedError: { code?: string; message?: string } | null = null;
    client.on("error", (err: unknown) => {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === "RATE_LIMITED") {
        rateLimitedError = errorObj;
      }
    });

    for (let i = 0; i < 21; i++) {
      client.emit("chat:send", { text: `Message ${i}` });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    client.disconnect();

    expect(rateLimitedError).not.toBeNull();
    expect(rateLimitedError?.code).toBe("RATE_LIMITED");
  });

  it("socket transcript enforces 30 segments per 10 seconds per socket", async () => {
    delete process.env.TEST_RATE_LIMIT;
    const signupRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Transcript User",
      email: "transcript-rate@example.com",
      password: "Password123",
      teamName: "Transcript Team",
    });
    process.env.TEST_RATE_LIMIT = "true";

    const token = signupRes.body.accessToken;
    const meeting = await Meeting.create({
      teamId: signupRes.body.user.teamId,
      hostId: signupRes.body.user.id,
      title: "Transcript Rate Meeting",
      roomCode: "tx-rate-01",
      colorIndex: 0,
      status: "LIVE",
    });

    const client = connectClient(token);
    await new Promise((resolve) => client.once("connect", resolve));

    await new Promise((resolve) => {
      client.emit("room:join", { meetingId: meeting.id }, resolve);
    });

    let rateLimitedError: { code?: string; message?: string } | null = null;
    client.on("error", (err: unknown) => {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === "RATE_LIMITED") {
        rateLimitedError = errorObj;
      }
    });

    for (let i = 0; i < 31; i++) {
      client.emit("transcript:segment", { text: `Segment ${i}`, ts: Date.now() });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    client.disconnect();

    expect(rateLimitedError).not.toBeNull();
    expect(rateLimitedError?.code).toBe("RATE_LIMITED");
  });
});
