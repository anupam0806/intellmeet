import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Team } from "../src/models/Team.js";

describe("Role Matrix Audit: Admin vs Member Permissions (docs/04 section 2)", () => {
  const app = createApp();

  async function createTeamWithAdmin(prefix: string) {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name: `${prefix} Admin`,
      email: `${prefix.toLowerCase()}-admin@example.com`,
      password: "Password123",
      teamName: `${prefix} Team`,
    });
    return {
      token: res.body.accessToken as string,
      user: res.body.user as { id: string; teamId: string; role: string; name: string },
    };
  }

  async function addMember(prefix: string, inviteCode: string) {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name: `${prefix} Member`,
      email: `${prefix.toLowerCase()}-member@example.com`,
      password: "Password123",
      inviteCode,
    });
    return {
      token: res.body.accessToken as string,
      user: res.body.user as { id: string; teamId: string; role: string; name: string },
    };
  }

  it("confirms all permission rules for Admin and Member", async () => {
    const admin = await createTeamWithAdmin("Matrix");
    const team = await Team.findById(admin.user.teamId);
    const member1 = await addMember("M1", team!.inviteCode);
    const member2 = await addMember("M2", team!.inviteCode);

    // 1. Team data and invite codes
    // Admin CAN see inviteCode
    const adminTeamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminTeamRes.status).toBe(200);
    expect(adminTeamRes.body.inviteCode).toBeDefined();

    // Member CAN view team members but CANNOT see inviteCode
    const memberTeamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${member1.token}`);
    expect(memberTeamRes.status).toBe(200);
    expect(memberTeamRes.body.members).toHaveLength(3);
    expect(memberTeamRes.body.inviteCode).toBeUndefined();

    // Member CANNOT regenerate invite code
    const memberRegenRes = await request(app)
      .post("/api/v1/team/invite-code/regenerate")
      .set("Authorization", `Bearer ${member1.token}`);
    expect(memberRegenRes.status).toBe(403);

    // Admin CAN regenerate invite code
    const adminRegenRes = await request(app)
      .post("/api/v1/team/invite-code/regenerate")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminRegenRes.status).toBe(200);
    expect(adminRegenRes.body.inviteCode).toBeDefined();

    // Member CANNOT change user roles
    const memberChangeRoleRes = await request(app)
      .patch(`/api/v1/team/members/${member2.user.id}/role`)
      .set("Authorization", `Bearer ${member1.token}`)
      .send({ role: "ADMIN" });
    expect(memberChangeRoleRes.status).toBe(403);

    // Admin CAN change user roles
    const adminChangeRoleRes = await request(app)
      .patch(`/api/v1/team/members/${member2.user.id}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "ADMIN" });
    expect(adminChangeRoleRes.status).toBe(200);

    // Reset member2 back to MEMBER
    await request(app)
      .patch(`/api/v1/team/members/${member2.user.id}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "MEMBER" });

    // 2. Meetings: Create, Edit, End, Delete
    // Member CAN create meetings
    const memberMeetingRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${member1.token}`)
      .send({ title: "M1 Hosted Meeting" });
    expect(memberMeetingRes.status).toBe(201);
    const m1MeetingId = memberMeetingRes.body.id;

    // Admin creates a meeting
    const adminMeetingRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Hosted Meeting" });
    expect(adminMeetingRes.status).toBe(201);
    const adminMeetingId = adminMeetingRes.body.id;

    // Member CAN edit own meeting
    const m1EditOwnRes = await request(app)
      .patch(`/api/v1/meetings/${m1MeetingId}`)
      .set("Authorization", `Bearer ${member1.token}`)
      .send({ title: "M1 Edited Meeting" });
    expect(m1EditOwnRes.status).toBe(200);

    // Member CANNOT edit another user's meeting
    const m1EditAdminRes = await request(app)
      .patch(`/api/v1/meetings/${adminMeetingId}`)
      .set("Authorization", `Bearer ${member1.token}`)
      .send({ title: "M1 Tampered Admin Meeting" });
    expect(m1EditAdminRes.status).toBe(403);

    // Admin CAN edit any meeting
    const adminEditM1Res = await request(app)
      .patch(`/api/v1/meetings/${m1MeetingId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Overseeing M1 Meeting" });
    expect(adminEditM1Res.status).toBe(200);

    // Member CANNOT delete another user's meeting
    const m1DeleteAdminRes = await request(app)
      .delete(`/api/v1/meetings/${adminMeetingId}`)
      .set("Authorization", `Bearer ${member1.token}`);
    expect(m1DeleteAdminRes.status).toBe(403);

    // 3. Tasks: Create, Edit, Move, Delete
    // Member 1 creates a task assigned to Member 2
    const m1TaskRes = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${member1.token}`)
      .send({
        title: "Task by M1 assigned to M2",
        assigneeId: member2.user.id,
        status: "TODO",
      });
    expect(m1TaskRes.status).toBe(201);
    const m1TaskId = m1TaskRes.body.id;

    // Member 2 (assignee) CAN edit the task
    const m2EditRes = await request(app)
      .patch(`/api/v1/tasks/${m1TaskId}`)
      .set("Authorization", `Bearer ${member2.token}`)
      .send({ status: "IN_PROGRESS" });
    expect(m2EditRes.status).toBe(200);

    // Unassigned task: both members can edit/move
    const unassignedTaskRes = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Unassigned Team Task", status: "TODO" });
    const unassignedTaskId = unassignedTaskRes.body.id;

    const m1MoveUnassignedRes = await request(app)
      .patch(`/api/v1/tasks/${unassignedTaskId}`)
      .set("Authorization", `Bearer ${member1.token}`)
      .send({ status: "IN_PROGRESS" });
    expect(m1MoveUnassignedRes.status).toBe(200);

    // Member 2 CANNOT delete a task created by Member 1
    const m2DeleteM1TaskRes = await request(app)
      .delete(`/api/v1/tasks/${m1TaskId}`)
      .set("Authorization", `Bearer ${member2.token}`);
    expect(m2DeleteM1TaskRes.status).toBe(403);

    // Member 1 CAN delete their own task
    const m1DeleteOwnTaskRes = await request(app)
      .delete(`/api/v1/tasks/${m1TaskId}`)
      .set("Authorization", `Bearer ${member1.token}`);
    expect(m1DeleteOwnTaskRes.status).toBe(204);

    // Admin CAN delete any task
    const adminDeleteTaskRes = await request(app)
      .delete(`/api/v1/tasks/${unassignedTaskId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminDeleteTaskRes.status).toBe(204);
  });
});
