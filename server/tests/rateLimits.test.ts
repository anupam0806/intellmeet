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

  it("11 failed logins in a row return 429", async () => {
    const limiterApp = express();
    limiterApp.set("trust proxy", 1);
    limiterApp.use(authRateLimiter);
    limiterApp.post("/login-fail", (_req, res) => {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
    });

    for (let i = 0; i < 10; i++) {
      const res = await request(limiterApp)
        .post("/login-fail")
        .set("X-Forwarded-For", "203.0.113.1");
      expect(res.status).toBe(401);
    }

    const blockedRes = await request(limiterApp)
      .post("/login-fail")
      .set("X-Forwarded-For", "203.0.113.1");
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe("RATE_LIMITED");
  });

  it("30 successful logins in a row do not return 429", async () => {
    const limiterApp = express();
    limiterApp.set("trust proxy", 1);
    limiterApp.use(authRateLimiter);
    limiterApp.post("/login-success", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    for (let i = 0; i < 30; i++) {
      const res = await request(limiterApp)
        .post("/login-success")
        .set("X-Forwarded-For", "203.0.113.2");
      expect(res.status).toBe(200);
    }
  });

  it("31 failed demo logins return 429", async () => {
    const limiterApp = express();
    limiterApp.set("trust proxy", 1);
    limiterApp.use(demoRateLimiter);
    limiterApp.post("/demo-fail", (_req, res) => {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid persona" } });
    });

    for (let i = 0; i < 30; i++) {
      const res = await request(limiterApp)
        .post("/demo-fail")
        .set("X-Forwarded-For", "203.0.113.3");
      expect(res.status).toBe(400);
    }

    const blockedRes = await request(limiterApp)
      .post("/demo-fail")
      .set("X-Forwarded-For", "203.0.113.3");
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe("RATE_LIMITED");
  });

  it("31 successful demo logins do not return 429", async () => {
    const limiterApp = express();
    limiterApp.set("trust proxy", 1);
    limiterApp.use(demoRateLimiter);
    limiterApp.post("/demo-success", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    for (let i = 0; i < 31; i++) {
      const res = await request(limiterApp)
        .post("/demo-success")
        .set("X-Forwarded-For", "203.0.113.4");
      expect(res.status).toBe(200);
    }
  });

  it("the health endpoint is never limited", async () => {
    for (let i = 0; i < 50; i++) {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    }
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

  it("general API rate limiter enforces 1000 requests per 15 minutes per IP", async () => {
    const limiterApp = express();
    limiterApp.set("trust proxy", 1);
    limiterApp.use(generalRateLimiter);
    limiterApp.get("/general-test", (_req, res) => res.json({ ok: true }));

    // Send 1000 requests in 10 concurrent batches of 100
    for (let b = 0; b < 10; b++) {
      await Promise.all(
        Array.from({ length: 100 }, () =>
          request(limiterApp)
            .get("/general-test")
            .set("X-Forwarded-For", "203.0.113.5")
        )
      );
    }

    const blockedRes = await request(limiterApp)
      .get("/general-test")
      .set("X-Forwarded-For", "203.0.113.5");
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
