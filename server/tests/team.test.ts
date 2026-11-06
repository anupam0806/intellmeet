import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("Team Endpoints and Tenancy", () => {
  const app = createApp();

  it("GET /team returns inviteCode only to Admins, not Members", async () => {
    // 1. Admin creates Team A
    const adminRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Team Admin",
      email: "tadmin@example.com",
      password: "Password123",
      teamName: "Alpha Team",
    });
    const adminToken = adminRes.body.accessToken;

    const adminTeamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminTeamRes.status).toBe(200);
    expect(adminTeamRes.body).toHaveProperty("inviteCode");
    expect(adminTeamRes.body.members).toHaveLength(1);
    const inviteCode = adminTeamRes.body.inviteCode;

    // 2. Member joins Team A
    const memberRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Team Member",
      email: "tmember@example.com",
      password: "Password123",
      inviteCode,
    });
    const memberToken = memberRes.body.accessToken;

    const memberTeamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(memberTeamRes.status).toBe(200);
    expect(memberTeamRes.body).not.toHaveProperty("inviteCode");
    expect(memberTeamRes.body.members).toHaveLength(2);
  });

  it("Member calling an Admin-only endpoint returns 403 FORBIDDEN", async () => {
    const adminRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Adm",
      email: "adm@example.com",
      password: "Password123",
      teamName: "Beta Team",
    });

    const teamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${adminRes.body.accessToken}`);

    const memberRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Mem",
      email: "mem@example.com",
      password: "Password123",
      inviteCode: teamRes.body.inviteCode,
    });

    // Member attempts to regenerate invite code
    const regenRes = await request(app)
      .post("/api/v1/team/invite-code/regenerate")
      .set("Authorization", `Bearer ${memberRes.body.accessToken}`);

    expect(regenRes.status).toBe(403);
    expect(regenRes.body.error).toMatchObject({
      code: "FORBIDDEN",
    });

    // Member attempts to change roles
    const roleRes = await request(app)
      .patch(`/api/v1/team/members/${adminRes.body.user.id}/role`)
      .set("Authorization", `Bearer ${memberRes.body.accessToken}`)
      .send({ role: "MEMBER" });

    expect(roleRes.status).toBe(403);
    expect(roleRes.body.error.code).toBe("FORBIDDEN");
  });

  it("prevents demoting the last Admin (409 LAST_ADMIN)", async () => {
    const adminRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Sole Admin",
      email: "sole@example.com",
      password: "Password123",
      teamName: "Solo Team",
    });

    const demoteRes = await request(app)
      .patch(`/api/v1/team/members/${adminRes.body.user.id}/role`)
      .set("Authorization", `Bearer ${adminRes.body.accessToken}`)
      .send({ role: "MEMBER" });

    expect(demoteRes.status).toBe(409);
    expect(demoteRes.body.error).toMatchObject({
      code: "LAST_ADMIN",
      message: "Cannot demote the last administrator of a team",
    });
  });

  it("allows role promotion and demotion when multiple Admins exist", async () => {
    const admin1Res = await request(app).post("/api/v1/auth/signup").send({
      name: "Admin One",
      email: "one@example.com",
      password: "Password123",
      teamName: "Dual Team",
    });

    const teamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${admin1Res.body.accessToken}`);

    const memberRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Member Two",
      email: "two@example.com",
      password: "Password123",
      inviteCode: teamRes.body.inviteCode,
    });

    // Promote member to Admin
    const promoteRes = await request(app)
      .patch(`/api/v1/team/members/${memberRes.body.user.id}/role`)
      .set("Authorization", `Bearer ${admin1Res.body.accessToken}`)
      .send({ role: "ADMIN" });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.user.role).toBe("ADMIN");

    // Member logs in to get an updated token with ADMIN role
    const memberLogin = await request(app).post("/api/v1/auth/login").send({
      email: "two@example.com",
      password: "Password123",
    });
    expect(memberLogin.body.user.role).toBe("ADMIN");

    // Now demoting Admin One should succeed because Member Two is also Admin
    const demoteRes = await request(app)
      .patch(`/api/v1/team/members/${admin1Res.body.user.id}/role`)
      .set("Authorization", `Bearer ${memberLogin.body.accessToken}`)
      .send({ role: "MEMBER" });

    expect(demoteRes.status).toBe(200);
    expect(demoteRes.body.user.role).toBe("MEMBER");
  });

  it("enforces cross-team isolation: modifying a user from another team returns 404", async () => {
    // Team X
    const teamXAdmin = await request(app).post("/api/v1/auth/signup").send({
      name: "Admin X",
      email: "adminx@example.com",
      password: "Password123",
      teamName: "Team X",
    });

    // Team Y
    const teamYAdmin = await request(app).post("/api/v1/auth/signup").send({
      name: "Admin Y",
      email: "adminy@example.com",
      password: "Password123",
      teamName: "Team Y",
    });

    // Admin X attempts to modify role of Admin Y
    const res = await request(app)
      .patch(`/api/v1/team/members/${teamYAdmin.body.user.id}/role`)
      .set("Authorization", `Bearer ${teamXAdmin.body.accessToken}`)
      .send({ role: "MEMBER" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("POST /team/invite-code/regenerate creates a new invite code", async () => {
    const adminRes = await request(app).post("/api/v1/auth/signup").send({
      name: "Regen Admin",
      email: "regen@example.com",
      password: "Password123",
      teamName: "Regen Team",
    });

    const firstGet = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${adminRes.body.accessToken}`);
    const originalCode = firstGet.body.inviteCode;

    const regenRes = await request(app)
      .post("/api/v1/team/invite-code/regenerate")
      .set("Authorization", `Bearer ${adminRes.body.accessToken}`);

    expect(regenRes.status).toBe(200);
    expect(regenRes.body).toHaveProperty("inviteCode");
    expect(regenRes.body.inviteCode).not.toBe(originalCode);
    expect(regenRes.body.inviteCode).toHaveLength(8);
  });
});

