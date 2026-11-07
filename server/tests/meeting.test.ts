import crypto from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Meeting } from "../src/models/Meeting.js";
import { generateUniqueRoomCode } from "../src/services/meeting.service.js";

describe("Meetings Endpoints and Lifecycle", () => {
  const app = createApp();

  // Helper to create a user and team
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

  // Helper to join a team with invite code
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

  it("POST /meetings creates a new meeting with roomCode and colorIndex", async () => {
    const { token, user } = await createTestTeam("Meeting Host", "host1@example.com", "Meeting Team A");

    const res = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Sprint Planning",
        description: "Plan upcoming sprints",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Sprint Planning",
      description: "Plan upcoming sprints",
      status: "SCHEDULED",
      hostId: user.id,
      hostName: user.name,
      teamId: user.teamId,
      colorIndex: 0,
    });
    expect(res.body.roomCode).toHaveLength(10);
    expect(res.body.ai.status).toBe("NONE");
    expect(res.body.participants).toEqual([]);

    // Create a second meeting in same team -> colorIndex should be 1
    const res2 = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Design Review",
      });

    expect(res2.status).toBe(201);
    expect(res2.body.colorIndex).toBe(1);
    expect(res2.body.roomCode).not.toBe(res.body.roomCode);
  });

  it("GET /meetings lists meetings with search, status filter, date range, and pagination", async () => {
    const { token } = await createTestTeam("List Host", "listhost@example.com", "List Team");

    // Create 3 meetings
    const m1 = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Alpha Meeting", description: "Alpha focus" });

    const m2 = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Beta Meeting", description: "Beta focus" });

    const m3 = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Gamma Meeting" });

    expect(m1.status).toBe(201);
    expect(m2.status).toBe(201);
    expect(m3.status).toBe(201);

    // List all
    const allRes = await request(app)
      .get("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`);

    expect(allRes.status).toBe(200);
    expect(allRes.body.total).toBe(3);
    expect(allRes.body.items).toHaveLength(3);
    expect(allRes.body.page).toBe(1);
    expect(allRes.body.limit).toBe(10);
    expect(allRes.body.items[0]).toHaveProperty("participantCount");
    expect(allRes.body.items[0]).toHaveProperty("aiStatus");

    // Filter by status SCHEDULED
    const scheduledRes = await request(app)
      .get("/api/v1/meetings?status=SCHEDULED")
      .set("Authorization", `Bearer ${token}`);

    expect(scheduledRes.status).toBe(200);
    expect(scheduledRes.body.total).toBe(3);

    // Filter by status LIVE (should be 0)
    const liveRes = await request(app)
      .get("/api/v1/meetings?status=LIVE")
      .set("Authorization", `Bearer ${token}`);

    expect(liveRes.status).toBe(200);
    expect(liveRes.body.total).toBe(0);

    // Pagination test (limit=2, page=1)
    const page1Res = await request(app)
      .get("/api/v1/meetings?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(page1Res.status).toBe(200);
    expect(page1Res.body.items).toHaveLength(2);
    expect(page1Res.body.total).toBe(3);

    // Pagination test (limit=2, page=2)
    const page2Res = await request(app)
      .get("/api/v1/meetings?page=2&limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(page2Res.status).toBe(200);
    expect(page2Res.body.items).toHaveLength(1);

    // Text search query
    const searchRes = await request(app)
      .get("/api/v1/meetings?q=Beta")
      .set("Authorization", `Bearer ${token}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.total).toBe(1);
    expect(searchRes.body.items[0].title).toBe("Beta Meeting");
  });

  it("GET /meetings/:id returns full meeting details with hostName", async () => {
    const { token, user } = await createTestTeam("Detail Host", "detail@example.com", "Detail Team");

    const createRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Detailed Meeting", description: "All details" });

    const getRes = await request(app)
      .get(`/api/v1/meetings/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);
    expect(getRes.body.hostName).toBe(user.name);
    expect(getRes.body.title).toBe("Detailed Meeting");
    expect(getRes.body.description).toBe("All details");
  });

  it("PATCH /meetings/:id allows host or Admin to edit, forbids other members", async () => {
    const admin = await createTestTeam("Admin User", "admin_edit@example.com", "Permission Team");

    // Get invite code to join a non-host member
    const teamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${admin.token}`);
    const inviteCode = teamRes.body.inviteCode;

    // Join Member One (the meeting host)
    const memberHost = await joinTestTeam("Host Member", "host_member@example.com", inviteCode);

    // Join Member Two (other member)
    const memberOther = await joinTestTeam("Other Member", "other_member@example.com", inviteCode);

    // Host Member creates meeting
    const meetingRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${memberHost.token}`)
      .send({ title: "Original Title" });

    const meetingId = meetingRes.body.id;

    // Other Member tries to edit -> 403 FORBIDDEN
    const forbiddenRes = await request(app)
      .patch(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${memberOther.token}`)
      .send({ title: "Hacked Title" });

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe("FORBIDDEN");

    // Host edits -> 200 OK
    const hostEditRes = await request(app)
      .patch(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${memberHost.token}`)
      .send({ title: "Host Edited Title" });

    expect(hostEditRes.status).toBe(200);
    expect(hostEditRes.body.title).toBe("Host Edited Title");

    // Admin edits -> 200 OK
    const adminEditRes = await request(app)
      .patch(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Admin Edited Title" });

    expect(adminEditRes.status).toBe(200);
    expect(adminEditRes.body.title).toBe("Admin Edited Title");
  });

  it("POST /meetings/:id/start allows only the host to start, and is idempotent when LIVE", async () => {
    const admin = await createTestTeam("Admin Start", "admin_start@example.com", "Start Team");
    const teamRes = await request(app).get("/api/v1/team").set("Authorization", `Bearer ${admin.token}`);
    const inviteCode = teamRes.body.inviteCode;

    const host = await joinTestTeam("Host Person", "host_start@example.com", inviteCode);
    const other = await joinTestTeam("Other Person", "other_start@example.com", inviteCode);

    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${host.token}`)
      .send({ title: "Lifecycle Meeting" });
    const meetingId = mRes.body.id;

    // Admin (not host) tries to start -> 403
    const adminStartRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminStartRes.status).toBe(403);
    expect(adminStartRes.body.error.code).toBe("FORBIDDEN");

    // Other member tries to start -> 403
    const otherStartRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(otherStartRes.status).toBe(403);

    // Host starts meeting -> 200 LIVE
    const startRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${host.token}`);
    expect(startRes.status).toBe(200);
    expect(startRes.body.meeting.status).toBe("LIVE");
    expect(startRes.body.meeting.startedAt).toBeDefined();

    // Idempotent: host starts again when already LIVE -> 200
    const secondStartRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${host.token}`);
    expect(secondStartRes.status).toBe(200);
    expect(secondStartRes.body.meeting.status).toBe("LIVE");
  });

  it("POST /meetings/:id/end transitions LIVE to ENDED, sets duration, ai.status, and closes open participants", async () => {
    const { token, user } = await createTestTeam("End Host", "end_host@example.com", "End Team");

    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To End Meeting" });
    const meetingId = mRes.body.id;

    // Trying to end a SCHEDULED meeting -> 409 MEETING_NOT_LIVE
    const notLiveEndRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/end`)
      .set("Authorization", `Bearer ${token}`);
    expect(notLiveEndRes.status).toBe(409);
    expect(notLiveEndRes.body.error.code).toBe("MEETING_NOT_LIVE");

    // Start meeting
    await request(app)
      .post(`/api/v1/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${token}`);

    // Add an open participant directly in DB to test participant closure
    const meetingInDb = await Meeting.findById(meetingId);
    meetingInDb?.participants.push({
      userId: new mongoose.Types.ObjectId(user.id),
      name: user.name,
      joinedAt: new Date(Date.now() - 60000),
      captionsOn: true,
    });
    await meetingInDb?.save();

    // End meeting
    const endRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/end`)
      .set("Authorization", `Bearer ${token}`);

    expect(endRes.status).toBe(200);
    expect(endRes.body.meeting.status).toBe("ENDED");
    expect(endRes.body.meeting.endedAt).toBeDefined();
    expect(endRes.body.meeting.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(endRes.body.meeting.ai.status).toBe("PENDING");
    expect(endRes.body.meeting.participants[0].leftAt).toBeDefined();

    // Attempting to start an ENDED meeting -> 409 MEETING_ENDED
    const restartRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${token}`);
    expect(restartRes.status).toBe(409);
    expect(restartRes.body.error.code).toBe("MEETING_ENDED");

    // Attempting to end an already ENDED meeting -> 409 MEETING_NOT_LIVE
    const reEndRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/end`)
      .set("Authorization", `Bearer ${token}`);
    expect(reEndRes.status).toBe(409);
    expect(reEndRes.body.error.code).toBe("MEETING_NOT_LIVE");
  });

  it("DELETE /meetings/:id returns 409 CONFLICT while LIVE, and 204 when SCHEDULED or ENDED", async () => {
    const { token } = await createTestTeam("Delete Host", "del_host@example.com", "Delete Team");

    // Create meeting
    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Delete Test" });
    const meetingId = mRes.body.id;

    // Start meeting -> LIVE
    await request(app)
      .post(`/api/v1/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${token}`);

    // Attempt to delete while LIVE -> 409 CONFLICT
    const liveDeleteRes = await request(app)
      .delete(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(liveDeleteRes.status).toBe(409);
    expect(liveDeleteRes.body.error.code).toBe("CONFLICT");

    // End meeting -> ENDED
    await request(app)
      .post(`/api/v1/meetings/${meetingId}/end`)
      .set("Authorization", `Bearer ${token}`);

    // Delete while ENDED -> 204 No Content
    const endedDeleteRes = await request(app)
      .delete(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(endedDeleteRes.status).toBe(204);

    // Verify it is gone -> 404
    const getRes = await request(app)
      .get(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it("POST /meetings/join allows joining by roomCode, returns 409 for ended and 404 for unknown/cross-team", async () => {
    const teamA = await createTestTeam("Team A Host", "teama@example.com", "Team A");
    const teamB = await createTestTeam("Team B Host", "teamb@example.com", "Team B");

    // Team A creates a meeting
    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${teamA.token}`)
      .send({ title: "Team A Meeting" });
    const roomCode = mRes.body.roomCode;
    const meetingId = mRes.body.id;

    // Team A member joins -> 200
    const joinRes = await request(app)
      .post("/api/v1/meetings/join")
      .set("Authorization", `Bearer ${teamA.token}`)
      .send({ roomCode });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.meeting.id).toBe(meetingId);

    // Team B tries to join Team A's roomCode -> 404 NOT_FOUND
    const crossTeamJoinRes = await request(app)
      .post("/api/v1/meetings/join")
      .set("Authorization", `Bearer ${teamB.token}`)
      .send({ roomCode });
    expect(crossTeamJoinRes.status).toBe(404);
    expect(crossTeamJoinRes.body.error.code).toBe("NOT_FOUND");

    // Unknown roomCode -> 404 NOT_FOUND
    const unknownJoinRes = await request(app)
      .post("/api/v1/meetings/join")
      .set("Authorization", `Bearer ${teamA.token}`)
      .send({ roomCode: "nonexistent" });
    expect(unknownJoinRes.status).toBe(404);

    // Start and end the meeting
    await request(app).post(`/api/v1/meetings/${meetingId}/start`).set("Authorization", `Bearer ${teamA.token}`);
    await request(app).post(`/api/v1/meetings/${meetingId}/end`).set("Authorization", `Bearer ${teamA.token}`);

    // Joining ended meeting -> 409 MEETING_ENDED
    const endedJoinRes = await request(app)
      .post("/api/v1/meetings/join")
      .set("Authorization", `Bearer ${teamA.token}`)
      .send({ roomCode });
    expect(endedJoinRes.status).toBe(409);
    expect(endedJoinRes.body.error.code).toBe("MEETING_ENDED");
  });

  it("enforces cross-team isolation across all meeting endpoints", async () => {
    const team1 = await createTestTeam("Team 1 Host", "team1@example.com", "Team 1");
    const team2 = await createTestTeam("Team 2 Host", "team2@example.com", "Team 2");

    const mRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${team1.token}`)
      .send({ title: "Private Team 1 Meeting" });
    const meetingId = mRes.body.id;

    // Team 2 tries GET -> 404
    const getRes = await request(app)
      .get(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${team2.token}`);
    expect(getRes.status).toBe(404);

    // Team 2 tries PATCH -> 404
    const patchRes = await request(app)
      .patch(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${team2.token}`)
      .send({ title: "Hijacked" });
    expect(patchRes.status).toBe(404);

    // Team 2 tries DELETE -> 404
    const deleteRes = await request(app)
      .delete(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${team2.token}`);
    expect(deleteRes.status).toBe(404);

    // Team 2 tries START -> 404
    const startRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${team2.token}`);
    expect(startRes.status).toBe(404);

    // Team 2 tries END -> 404
    const endRes = await request(app)
      .post(`/api/v1/meetings/${meetingId}/end`)
      .set("Authorization", `Bearer ${team2.token}`);
    expect(endRes.status).toBe(404);
  });

  it("rejects unknown keys on create, update, and join with 400 VALIDATION_ERROR", async () => {
    const { token } = await createTestTeam("Validator Host", "validator@example.com", "Validator Team");

    // Create a valid meeting first to test update
    const validMeetingRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Base Meeting" });
    expect(validMeetingRes.status).toBe(201);
    const meetingId = validMeetingRes.body.id;
    const roomCode = validMeetingRes.body.roomCode;

    // Unknown key on create
    const unknownCreateRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Valid Title",
        unknownField: "not_allowed",
      });
    expect(unknownCreateRes.status).toBe(400);
    expect(unknownCreateRes.body.error.code).toBe("VALIDATION_ERROR");

    // Unknown key on update
    const unknownUpdateRes = await request(app)
      .patch(`/api/v1/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Updated Title",
        extraProperty: "not_allowed",
      });
    expect(unknownUpdateRes.status).toBe(400);
    expect(unknownUpdateRes.body.error.code).toBe("VALIDATION_ERROR");

    // Unknown key on join
    const unknownJoinRes = await request(app)
      .post("/api/v1/meetings/join")
      .set("Authorization", `Bearer ${token}`)
      .send({
        roomCode,
        unexpectedProperty: "not_allowed",
      });
    expect(unknownJoinRes.status).toBe(400);
    expect(unknownJoinRes.body.error.code).toBe("VALIDATION_ERROR");

    // Title too short on create
    const shortTitleRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "A",
      });
    expect(shortTitleRes.status).toBe(400);

    // Invalid ID format param
    const invalidIdRes = await request(app)
      .get("/api/v1/meetings/not-a-mongo-id")
      .set("Authorization", `Bearer ${token}`);
    expect(invalidIdRes.status).toBe(400);
    expect(invalidIdRes.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("forces a roomCode collision and confirms retry generates a unique code", async () => {
    const { token } = await createTestTeam("Collision Host", "collision@example.com", "Collision Team");

    // Pre-insert a meeting with a known roomCode into the DB
    const collidingCode = "aaaaaaaaaa";
    await Meeting.create({
      teamId: new mongoose.Types.ObjectId(),
      title: "Existing Collision Meeting",
      hostId: new mongoose.Types.ObjectId(),
      roomCode: collidingCode,
      colorIndex: 0,
    });

    const origRandomBytes = crypto.randomBytes;
    let collisionAttempt = 0;
    // Buffer filled with 0s maps to index 0 of chars: "aaaaaaaaaa"
    const mockCollidingBuffer = Buffer.alloc(10, 0);

    const randomBytesSpy = vi.spyOn(crypto, "randomBytes").mockImplementation(((size: number) => {
      if (size === 10 && collisionAttempt === 0) {
        collisionAttempt++;
        return mockCollidingBuffer;
      }
      return origRandomBytes(size);
    }) as typeof crypto.randomBytes);

    try {
      // Direct service function test
      const uniqueCode = await generateUniqueRoomCode();
      expect(collisionAttempt).toBe(1);
      expect(uniqueCode).not.toBe(collidingCode);
      expect(uniqueCode).toHaveLength(10);

      // Verify via POST /meetings endpoint as well
      collisionAttempt = 0;
      const res = await request(app)
        .post("/api/v1/meetings")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Meeting with Collision Retry" });

      expect(res.status).toBe(201);
      expect(res.body.roomCode).not.toBe(collidingCode);
      expect(res.body.roomCode).toHaveLength(10);
      expect(collisionAttempt).toBe(1);
    } finally {
      randomBytesSpy.mockRestore();
    }
  });

  it("GET /meetings returns full MeetingSummary fields (hostName, participantCount, aiStatus, actionItemCount)", async () => {
    const { token, user } = await createTestTeam("Summary Host", "summary_host@example.com", "Summary Team");

    const createRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Summary Spec Meeting", description: "Checking summary properties" });

    expect(createRes.status).toBe(201);
    const meetingId = createRes.body.id;

    // Initially: participantCount is 0, aiStatus is NONE, actionItemCount is 0
    let listRes = await request(app)
      .get("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(1);
    const item = listRes.body.items[0];

    expect(item).toMatchObject({
      id: meetingId,
      title: "Summary Spec Meeting",
      hostId: user.id,
      hostName: user.name,
      colorIndex: 0,
      status: "SCHEDULED",
      participantCount: 0,
      aiStatus: "NONE",
      actionItemCount: 0,
    });

    // Update with participants and action items in DB
    await Meeting.findByIdAndUpdate(meetingId, {
      participants: [
        {
          userId: new mongoose.Types.ObjectId(user.id),
          name: user.name,
          joinedAt: new Date(),
          captionsOn: true,
        },
      ],
      "ai.status": "COMPLETED",
      "ai.actionItems": [
        { text: "Finish documentation", completed: false },
        { text: "Release v1.0", completed: true },
      ],
    });

    listRes = await request(app)
      .get("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const updatedItem = listRes.body.items[0];
    expect(updatedItem.hostName).toBe(user.name);
    expect(updatedItem.participantCount).toBe(1);
    expect(updatedItem.aiStatus).toBe("COMPLETED");
    expect(updatedItem.actionItemCount).toBe(2);
  });

  it("GET /meetings?q= searches across title, description, and ai.summary using the text index", async () => {
    // Ensure text index is created
    await Meeting.init();

    const { token } = await createTestTeam("Search Host", "search_host@example.com", "Search Team");

    // Meeting 1: unique keyword in title
    const m1 = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Kubernetes Cluster Architecture", description: "Regular infrastructure discussion" });

    // Meeting 2: unique keyword in description
    const m2 = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Weekly Standup", description: "Refactoring the authentication microservice" });

    // Meeting 3: unique keyword in ai.summary
    const m3 = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Financial Review", description: "Reviewing company performance" });

    await Meeting.findByIdAndUpdate(m3.body.id, {
      "ai.summary": "The team approved the quarterly marketing expenditure",
    });

    // Search keyword from title
    const searchTitleRes = await request(app)
      .get("/api/v1/meetings?q=Kubernetes")
      .set("Authorization", `Bearer ${token}`);
    expect(searchTitleRes.status).toBe(200);
    expect(searchTitleRes.body.total).toBe(1);
    expect(searchTitleRes.body.items[0].id).toBe(m1.body.id);

    // Search keyword from description
    const searchDescRes = await request(app)
      .get("/api/v1/meetings?q=authentication")
      .set("Authorization", `Bearer ${token}`);
    expect(searchDescRes.status).toBe(200);
    expect(searchDescRes.body.total).toBe(1);
    expect(searchDescRes.body.items[0].id).toBe(m2.body.id);

    // Search keyword from ai.summary
    const searchSummaryRes = await request(app)
      .get("/api/v1/meetings?q=marketing")
      .set("Authorization", `Bearer ${token}`);
    expect(searchSummaryRes.status).toBe(200);
    expect(searchSummaryRes.body.total).toBe(1);
    expect(searchSummaryRes.body.items[0].id).toBe(m3.body.id);

    // Search nonexistent keyword
    const searchEmptyRes = await request(app)
      .get("/api/v1/meetings?q=nonexistentkeyword123")
      .set("Authorization", `Bearer ${token}`);
    expect(searchEmptyRes.status).toBe(200);
    expect(searchEmptyRes.body.total).toBe(0);
    expect(searchEmptyRes.body.items).toHaveLength(0);
  });
});
