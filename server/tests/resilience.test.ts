import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";

describe("Resilience: Database Failure & Process Stability (Phase P8)", () => {
  const app = createApp();

  it("returns 500 in standard error format on DB connection loss and stays running", async () => {
    // Spy on User.findOne to simulate MongoDB connection loss / driver disconnection error
    const findSpy = vi.spyOn(User, "findOne").mockReturnValue({
      select: () => Promise.reject(new Error("MongoNetworkError: connection 1 to cluster-lost closed")),
    } as unknown as ReturnType<typeof User.findOne>);

    const res = await request(app).post("/api/v1/auth/login").send({
      email: "resilience@example.com",
      password: "Password123",
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        details: [],
      },
    });

    findSpy.mockRestore();

    // Verify the server process is still alive and responds to health checks
    const healthRes = await request(app).get("/api/v1/health");
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe("ok");
  });

  it("handles malformed JSON payloads gracefully without crashing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"badJson": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    // Server process continues running
    const healthRes = await request(app).get("/api/v1/health");
    expect(healthRes.status).toBe(200);
  });
});
