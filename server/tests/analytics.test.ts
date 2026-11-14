import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Team } from "../src/models/Team.js";
import { Meeting } from "../src/models/Meeting.js";
import { Task } from "../src/models/Task.js";

describe("Phase P7: Analytics Endpoints and Aggregations", () => {
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

  describe("Validation (docs/04 section 7)", () => {
    it("validates from and to format, ordering, range limits, and strict schema", async () => {
      const admin = await createTeamWithAdmin("AnaVal");

      // from after to
      const res1 = await request(app)
        .get("/api/v1/analytics/overview?from=2026-05-10&to=2026-05-01")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe("VALIDATION_ERROR");

      // range > 366 days
      const res2 = await request(app)
        .get("/api/v1/analytics/overview?from=2024-01-01&to=2026-01-01")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("VALIDATION_ERROR");

      // invalid format
      const res3 = await request(app)
        .get("/api/v1/analytics/overview?from=bad-date&to=2026-01-01")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res3.status).toBe(400);
      expect(res3.body.error.code).toBe("VALIDATION_ERROR");

      // unknown query key
      const res4 = await request(app)
        .get("/api/v1/analytics/overview?from=2026-01-01&to=2026-01-10&extra=bad")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res4.status).toBe(400);
      expect(res4.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("defaults to 30 days ending today when from/to omitted", async () => {
      const admin = await createTeamWithAdmin("AnaDef");

      const res = await request(app)
        .get("/api/v1/analytics/overview")
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.range).toBeDefined();
      expect(res.body.range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.body.range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.body.totals).toBeDefined();
      expect(res.body.meetingsPerWeek).toBeInstanceOf(Array);
      expect(res.body.tasksByStatus).toBeInstanceOf(Array);
      expect(res.body.participation).toBeInstanceOf(Array);
      expect(typeof res.body.actionItemConversionRate).toBe("number");
    });
  });

  describe("Aggregations & Metrics Calculation", () => {
    it("computes totals, participation, weekly buckets, and action item conversion rate accurately", async () => {
      const admin = await createTeamWithAdmin("AnaCalc");
      const team = await Team.findById(admin.user.teamId);
      const member1 = await addMember("Alice", team!.inviteCode);
      const member2 = await addMember("Bob", team!.inviteCode);

      const teamId = new mongoose.Types.ObjectId(admin.user.teamId);
      const adminId = new mongoose.Types.ObjectId(admin.user.id);
      const m1Id = new mongoose.Types.ObjectId(member1.user.id);
      const m2Id = new mongoose.Types.ObjectId(member2.user.id);

      // Range: 2026-03-01 to 2026-03-31
      const from = "2026-03-01";
      const to = "2026-03-31";

      // Meeting 1: In range, ended, 1800s (30m). Attendees: admin, Alice
      // Has AI status READY with 2 action items (1 converted)
      await Meeting.create({
        teamId,
        hostId: adminId,
        title: "Sprint Retrospective",
        roomCode: "ret-rosp-ect",
        colorIndex: 0,
        status: "ENDED",
        startedAt: new Date("2026-03-05T10:00:00Z"),
        endedAt: new Date("2026-03-05T10:30:00Z"),
        durationSeconds: 1800,
        participants: [
          { userId: adminId, name: "Admin", role: "HOST", joinedAt: new Date("2026-03-05T10:00:00Z") },
          { userId: m1Id, name: "Alice", role: "PARTICIPANT", joinedAt: new Date("2026-03-05T10:02:00Z") },
        ],
        ai: {
          status: "READY",
          actionItems: [
            { title: "Item 1", taskId: new mongoose.Types.ObjectId() },
            { title: "Item 2" },
          ],
        },
      });

      // Meeting 2: In range, ended, 3600s (60m). Attendees: admin, Bob
      await Meeting.create({
        teamId,
        hostId: adminId,
        title: "Architecture Review",
        roomCode: "arc-hire-viw",
        colorIndex: 1,
        status: "ENDED",
        startedAt: new Date("2026-03-12T14:00:00Z"),
        endedAt: new Date("2026-03-12T15:00:00Z"),
        durationSeconds: 3600,
        participants: [
          { userId: adminId, name: "Admin", role: "HOST", joinedAt: new Date("2026-03-12T14:00:00Z") },
          { userId: m2Id, name: "Bob", role: "PARTICIPANT", joinedAt: new Date("2026-03-12T14:00:00Z") },
        ],
      });

      // Meeting 3: Outside range (2026-04-01)
      await Meeting.create({
        teamId,
        hostId: adminId,
        title: "April Fools Meeting",
        roomCode: "apr-ilfo-ols",
        colorIndex: 2,
        status: "ENDED",
        startedAt: new Date("2026-04-01T10:00:00Z"),
        durationSeconds: 600,
      });

      // Tasks:
      // Task 1: TODO (open)
      await Task.create({
        teamId,
        createdBy: adminId,
        title: "Open Todo Task",
        status: "TODO",
        order: 0,
      });

      // Task 2: IN_PROGRESS (open)
      await Task.create({
        teamId,
        createdBy: adminId,
        title: "Open In Progress Task",
        status: "IN_PROGRESS",
        order: 0,
      });

      // Task 3: DONE completed in range (2026-03-15)
      await Task.create({
        teamId,
        createdBy: adminId,
        title: "Done in March",
        status: "DONE",
        completedAt: new Date("2026-03-15T12:00:00Z"),
        order: 0,
      });

      // Task 4: DONE completed outside range (2026-02-15)
      await Task.create({
        teamId,
        createdBy: adminId,
        title: "Done in Feb",
        status: "DONE",
        completedAt: new Date("2026-02-15T12:00:00Z"),
        order: 1,
      });

      const res = await request(app)
        .get(`/api/v1/analytics/overview?from=${from}&to=${to}`)
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      const data = res.body;

      // Totals check:
      // Meetings in range: 2 ended meetings
      expect(data.totals.meetings).toBe(2);
      expect(data.totals.endedMeetings).toBe(2);
      // Average duration: (30m + 60m) / 2 = 45.0m
      expect(data.totals.avgDurationMinutes).toBe(45);
      // Open tasks: 2 (TODO + IN_PROGRESS)
      expect(data.totals.openTasks).toBe(2);
      // Done tasks completed in range: 1
      expect(data.totals.doneTasks).toBe(1);

      // tasksByStatus
      const todo = data.tasksByStatus.find((t: { status: string }) => t.status === "TODO");
      const inProg = data.tasksByStatus.find((t: { status: string }) => t.status === "IN_PROGRESS");
      const done = data.tasksByStatus.find((t: { status: string }) => t.status === "DONE");
      expect(todo.count).toBe(1);
      expect(inProg.count).toBe(1);
      expect(done.count).toBe(2);

      // Participation: Admin attended 2, Alice 1, Bob 1
      expect(data.participation.length).toBeGreaterThanOrEqual(3);
      const adminPart = data.participation.find((p: { userId: string }) => p.userId === admin.user.id);
      expect(adminPart.meetingsAttended).toBe(2);

      // Action items conversion rate: 1 converted out of 2 = 0.50
      expect(data.actionItemConversionRate).toBe(0.5);

      // Weekly buckets: all Mondays in range zero-filled
      expect(data.meetingsPerWeek.length).toBeGreaterThanOrEqual(4);
      const totalWeeklyMeetings = data.meetingsPerWeek.reduce((sum: number, w: { count: number }) => sum + w.count, 0);
      expect(totalWeeklyMeetings).toBe(2);
    });

    it("handles empty range gracefully (0 meetings, 0 rate, 0 avg duration)", async () => {
      const admin = await createTeamWithAdmin("AnaEmpty");

      const res = await request(app)
        .get("/api/v1/analytics/overview?from=2026-01-01&to=2026-01-07")
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.totals.meetings).toBe(0);
      expect(res.body.totals.endedMeetings).toBe(0);
      expect(res.body.totals.avgDurationMinutes).toBe(0);
      expect(res.body.actionItemConversionRate).toBe(0);
      expect(res.body.meetingsPerWeek.length).toBeGreaterThan(0);
      expect(res.body.meetingsPerWeek.every((w: { count: number }) => w.count === 0)).toBe(true);
    });

    it("dynamically includes the current week up to today when defaulting or querying current range", async () => {
      const admin = await createTeamWithAdmin("AnaCurr");

      const res = await request(app)
        .get("/api/v1/analytics/overview")
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.meetingsPerWeek).toBeInstanceOf(Array);
      expect(res.body.meetingsPerWeek.length).toBeGreaterThanOrEqual(4);

      // The last week bucket in default 30-day range (which ends today) must be marked as current week
      const currentWeekItem = res.body.meetingsPerWeek.find((w: { isCurrentWeek?: boolean }) => w.isCurrentWeek === true);
      expect(currentWeekItem).toBeDefined();
    });
  });
});
