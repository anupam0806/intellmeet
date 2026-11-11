import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("Production Static Serving, Fallback & Security Headers", () => {
  let tempDir: string;
  let assetsDir: string;

  beforeAll(() => {
    // Create temporary directory mimicking client/dist
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "intellmeet-dist-test-"));
    assetsDir = path.join(tempDir, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    // Create index.html and a hashed asset
    fs.writeFileSync(
      path.join(tempDir, "index.html"),
      "<!DOCTYPE html><html><head><title>IntellMeet</title></head><body><div id=\"root\">SPA Root</div></body></html>",
    );
    fs.writeFileSync(
      path.join(assetsDir, "index-B8c9F1a2.js"),
      "console.log('intellmeet asset');",
    );
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("has trust proxy set to 1 for reverse proxy compatibility", () => {
    const app = createApp(tempDir);
    expect(app.get("trust proxy")).toBe(1);
  });

  it("serves index.html at root (/) with no-cache and CSP headers", async () => {
    const app = createApp(tempDir);
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("SPA Root");
    expect(res.headers["cache-control"]).toMatch(/no-cache/);

    // Verify CSP directives
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).toContain("connect-src 'self' ws: wss:");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("serves index.html for SPA routes (/meetings and /room/ABC123) with no-cache", async () => {
    const app = createApp(tempDir);

    const resMeetings = await request(app).get("/meetings");
    expect(resMeetings.status).toBe(200);
    expect(resMeetings.headers["content-type"]).toMatch(/html/);
    expect(resMeetings.text).toContain("SPA Root");
    expect(resMeetings.headers["cache-control"]).toMatch(/no-cache/);

    const resRoom = await request(app).get("/room/ABC123");
    expect(resRoom.status).toBe(200);
    expect(resRoom.headers["content-type"]).toMatch(/html/);
    expect(resRoom.text).toContain("SPA Root");
    expect(resRoom.headers["cache-control"]).toMatch(/no-cache/);
  });

  it("serves hashed assets under /assets with 1-year immutable cache header", async () => {
    const app = createApp(tempDir);
    const res = await request(app).get("/assets/index-B8c9F1a2.js");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(res.text).toContain("intellmeet asset");
  });

  it("returns standard JSON 404 for unknown /api routes, never index.html", async () => {
    const app = createApp(tempDir);
    const res = await request(app).get("/api/v1/unknown");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
        details: [],
      },
    });
  });

  it("does not intercept /socket.io requests with index.html", async () => {
    const app = createApp(tempDir);
    const res = await request(app).get("/socket.io/?EIO=4&transport=polling");

    // Socket.io polling request not configured on raw express app should 404, not return HTML
    expect(res.status).toBe(404);
    expect(res.text).not.toContain("SPA Root");
  });

  it("does not intercept missing static files with extensions", async () => {
    const app = createApp(tempDir);
    const res = await request(app).get("/assets/missing-asset.js");

    expect(res.status).toBe(404);
    expect(res.text).not.toContain("SPA Root");
  });

  it("continues cleanly and still serves API when client dist folder does not exist", async () => {
    const nonExistentDir = path.join(os.tmpdir(), "non-existent-dist-intellmeet-999");
    const app = createApp(nonExistentDir);

    // Health API still functions 200
    const healthRes = await request(app).get("/api/v1/health");
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toHaveProperty("status", "ok");

    // Unknown API route still returns 404 JSON
    const unknownApiRes = await request(app).get("/api/v1/does-not-exist");
    expect(unknownApiRes.status).toBe(404);
    expect(unknownApiRes.body.error.code).toBe("NOT_FOUND");
  });
});
