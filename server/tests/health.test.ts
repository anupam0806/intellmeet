import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { sanitizeInput } from "../src/utils/sanitize.js";

describe("Health and Security Endpoints", () => {
  const app = createApp();

  it("GET /api/v1/health returns ok with uptime and database status", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("uptime");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body).toHaveProperty("database", "not-configured");
  });

  it("GET /health utility endpoint returns ok with uptime", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("database", "not-configured");
  });

  it("returns 404 with standard error format for unknown API routes", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toEqual({
      code: "NOT_FOUND",
      message: "Endpoint not found",
      details: [],
    });
    expect(res.body).not.toHaveProperty("stack");
  });

  it("sanitizeInput strips keys beginning with $ or containing .", () => {
    const malicious = {
      safeField: "value",
      $where: "malicious code",
      "nested.injection": "bad",
      nestedObject: {
        normal: 123,
        $gt: 0,
        "deep.key": "val",
      },
      list: [{ $regex: ".*" }, { clean: "ok" }],
    };

    const cleaned = sanitizeInput(malicious);
    expect(cleaned).toEqual({
      safeField: "value",
      nestedObject: {
        normal: 123,
      },
      list: [{}, { clean: "ok" }],
    });
  });
});

