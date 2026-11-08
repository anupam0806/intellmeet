import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { runSeed } from "../src/seed.js";

describe("Auth Endpoints", () => {
  const app = createApp();

  it("POST /auth/signup creates a new team and Admin user", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        name: "Alice Admin",
        email: "alice@example.com",
        password: "Password123",
        teamName: "Acme Corp",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user).toMatchObject({
      name: "Alice Admin",
      email: "alice@example.com",
      role: "ADMIN",
    });
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user).toHaveProperty("teamId");
    expect(res.body.user).toHaveProperty("createdAt");
    // Ensure hashes are never exposed
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user).not.toHaveProperty("refreshTokenHash");

    // Cookie verification
    const cookies = res.headers["set-cookie"] as string[] | undefined;
    expect(cookies).toBeDefined();
    expect(cookies![0]).toContain("refreshToken=");
    expect(cookies![0]).toContain("HttpOnly");
  });

  it("POST /auth/signup joins an existing team using invite code as Member", async () => {
    // First create a team
    const adminRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        name: "Admin One",
        email: "admin1@example.com",
        password: "Password123",
        teamName: "Beta Team",
      });
    const adminToken = adminRes.body.accessToken;

    // Get team invite code
    const teamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${adminToken}`);
    const inviteCode = teamRes.body.inviteCode;
    expect(inviteCode).toBeDefined();

    // Signup member with invite code
    const memberRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        name: "Bob Member",
        email: "bob@example.com",
        password: "Password123",
        inviteCode,
      });

    expect(memberRes.status).toBe(201);
    expect(memberRes.body.user.role).toBe("MEMBER");
    expect(memberRes.body.user.teamId).toBe(adminRes.body.user.teamId);
    expect(memberRes.body.user).not.toHaveProperty("passwordHash");
    expect(memberRes.body.user).not.toHaveProperty("refreshTokenHash");
  });

  it("POST /auth/signup returns 409 EMAIL_TAKEN on duplicate email", async () => {
    await request(app).post("/api/v1/auth/signup").send({
      name: "First User",
      email: "duplicate@example.com",
      password: "Password123",
      teamName: "Dup Team",
    });

    const res = await request(app).post("/api/v1/auth/signup").send({
      name: "Second User",
      email: "duplicate@example.com",
      password: "Password123",
      teamName: "Another Team",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "EMAIL_TAKEN",
      message: "An account with this email already exists",
    });
  });

  it("POST /auth/signup returns 404 INVALID_INVITE_CODE for unknown code", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name: "Lost User",
      email: "lost@example.com",
      password: "Password123",
      inviteCode: "NOTEXIST",
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: "INVALID_INVITE_CODE",
      message: "Invalid team invite code",
    });
  });

  it("rejects unknown keys in request body with 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name: "Valid Name",
      email: "unknownkeys@example.com",
      password: "Password123",
      teamName: "Clean Team",
      maliciousField: "injection",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/login returns identical error for unknown email and wrong password", async () => {
    await request(app).post("/api/v1/auth/signup").send({
      name: "Valid Account",
      email: "known@example.com",
      password: "CorrectPassword123",
      teamName: "Known Team",
    });

    // Wrong password for existing user
    const resWrongPass = await request(app).post("/api/v1/auth/login").send({
      email: "known@example.com",
      password: "WrongPassword999",
    });
    expect(resWrongPass.status).toBe(401);
    expect(resWrongPass.body.error).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Invalid email or password",
    });

    // Unknown email
    const resUnknownUser = await request(app).post("/api/v1/auth/login").send({
      email: "ghost@example.com",
      password: "WrongPassword999",
    });
    expect(resUnknownUser.status).toBe(401);
    expect(resUnknownUser.body.error).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Invalid email or password",
    });
  });

  it("POST /auth/login succeeds with valid credentials", async () => {
    await request(app).post("/api/v1/auth/signup").send({
      name: "Login User",
      email: "login@example.com",
      password: "MySecretPassword123",
      teamName: "Login Team",
    });

    const res = await request(app).post("/api/v1/auth/login").send({
      email: "login@example.com",
      password: "MySecretPassword123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user).toMatchObject({
      name: "Login User",
      email: "login@example.com",
    });
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("POST /auth/refresh rotates token and revokes reused old tokens", async () => {
    const signupRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Refresh User",
      email: "refresh@example.com",
      password: "Password123",
      teamName: "Refresh Team",
    });

    const cookies = signupRes.headers["set-cookie"] as string[];
    const firstCookie = cookies.find((c) => c.startsWith("refreshToken="));
    expect(firstCookie).toBeDefined();

    // First refresh should succeed
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [firstCookie!]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty("accessToken");
    const rotatedCookies = refreshRes.headers["set-cookie"] as string[];
    const secondCookie = rotatedCookies.find((c) => c.startsWith("refreshToken="));
    expect(secondCookie).toBeDefined();

    // Reusing the first cookie must return 401 and revoke stored hash
    const reuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [firstCookie!]);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe("UNAUTHENTICATED");

    // Check that stored hash on user was wiped
    const userInDb = await User.findById(signupRes.body.user.id).select("+refreshTokenHash");
    expect(userInDb?.refreshTokenHash).toBeUndefined();
  });

  it("POST /auth/logout clears cookie and revokes stored hash", async () => {
    const signupRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Logout User",
      email: "logout@example.com",
      password: "Password123",
      teamName: "Logout Team",
    });

    const cookies = signupRes.headers["set-cookie"] as string[];
    const tokenCookie = cookies.find((c) => c.startsWith("refreshToken="));

    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", [tokenCookie!]);

    expect(logoutRes.status).toBe(204);

    const userInDb = await User.findById(signupRes.body.user.id).select("+refreshTokenHash");
    expect(userInDb?.refreshTokenHash).toBeUndefined();
  });

  it("GET /auth/me returns current user and rejects unauthenticated requests", async () => {
    // Without token: 401
    const unauthRes = await request(app).get("/api/v1/auth/me");
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error.code).toBe("UNAUTHENTICATED");

    // With token
    const signupRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Me User",
      email: "me@example.com",
      password: "Password123",
      teamName: "Me Team",
    });

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${signupRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user).toMatchObject({
      name: "Me User",
      email: "me@example.com",
    });
    expect(meRes.body.user).not.toHaveProperty("passwordHash");
  });

  it("PATCH /users/me updates name and avatarUrl", async () => {
    const signupRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Old Name",
      email: "patchme@example.com",
      password: "Password123",
      teamName: "Patch Team",
    });

    const updateRes = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${signupRes.body.accessToken}`)
      .send({
        name: "New Name",
        avatarUrl: "https://example.com/avatar.png",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.name).toBe("New Name");
    expect(updateRes.body.user.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("POST /auth/demo returns 404 when demo data is not seeded", async () => {
    const res = await request(app).post("/api/v1/auth/demo");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("POST /auth/demo returns 404 when DEMO_LOGIN_ENABLED is false", async () => {
    process.env.DEMO_LOGIN_ENABLED = "false";
    try {
      const res = await request(app).post("/api/v1/auth/demo");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    } finally {
      delete process.env.DEMO_LOGIN_ENABLED;
    }
  });

  it("POST /auth/demo rejects unknown persona with 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/v1/auth/demo")
      .send({ persona: "charlie" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/demo rejects extra keys with 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/v1/auth/demo")
      .send({ persona: "maya", extra: "hack" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/demo logs in as each persona when seeded", async () => {
    await runSeed({ silent: true });

    // 1. Default (no body) -> Maya Chen (ADMIN)
    const defaultRes = await request(app).post("/api/v1/auth/demo");
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body.user.email).toBe("maya@brightwell.test");
    expect(defaultRes.body.user.name).toBe("Maya Chen");
    expect(defaultRes.body.user.role).toBe("ADMIN");
    expect(defaultRes.body).toHaveProperty("accessToken");
    expect(defaultRes.headers["set-cookie"]).toBeDefined();

    // 2. Dev Patel (MEMBER)
    const devRes = await request(app)
      .post("/api/v1/auth/demo")
      .send({ persona: "dev" });
    expect(devRes.status).toBe(200);
    expect(devRes.body.user.email).toBe("dev@brightwell.test");
    expect(devRes.body.user.name).toBe("Dev Patel");
    expect(devRes.body.user.role).toBe("MEMBER");

    // 3. Lena Fischer (MEMBER)
    const lenaRes = await request(app)
      .post("/api/v1/auth/demo")
      .send({ persona: "lena" });
    expect(lenaRes.status).toBe(200);
    expect(lenaRes.body.user.email).toBe("lena@brightwell.test");
    expect(lenaRes.body.user.name).toBe("Lena Fischer");
    expect(lenaRes.body.user.role).toBe("MEMBER");

    // 4. Omar Haddad (MEMBER)
    const omarRes = await request(app)
      .post("/api/v1/auth/demo")
      .send({ persona: "omar" });
    expect(omarRes.status).toBe(200);
    expect(omarRes.body.user.email).toBe("omar@brightwell.test");
    expect(omarRes.body.user.name).toBe("Omar Haddad");
    expect(omarRes.body.user.role).toBe("MEMBER");

    // 5. Sofia Rossi (MEMBER)
    const sofiaRes = await request(app)
      .post("/api/v1/auth/demo")
      .send({ persona: "sofia" });
    expect(sofiaRes.status).toBe(200);
    expect(sofiaRes.body.user.email).toBe("sofia@brightwell.test");
    expect(sofiaRes.body.user.name).toBe("Sofia Rossi");
    expect(sofiaRes.body.user.role).toBe("MEMBER");
  });

  it("enforces auth rate limiting when enabled", async () => {
    process.env.TEST_RATE_LIMIT = "true";
    try {
      // Send 11 requests
      let lastRes;
      for (let i = 0; i < 11; i++) {
        lastRes = await request(app).post("/api/v1/auth/login").send({
          email: "ratelimit@example.com",
          password: "password123",
        });
      }
      expect(lastRes?.status).toBe(429);
      expect(lastRes?.body.error.code).toBe("RATE_LIMITED");
    } finally {
      delete process.env.TEST_RATE_LIMIT;
    }
  });

  it("enforces demo rate limiting of 30 requests when enabled", async () => {
    process.env.TEST_RATE_LIMIT = "true";
    try {
      let lastRes;
      for (let i = 0; i < 31; i++) {
        lastRes = await request(app).post("/api/v1/auth/demo");
      }
      expect(lastRes?.status).toBe(429);
      expect(lastRes?.body.error.code).toBe("RATE_LIMITED");
    } finally {
      delete process.env.TEST_RATE_LIMIT;
    }
  });
});
