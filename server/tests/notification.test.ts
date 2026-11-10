import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Team } from "../src/models/Team.js";
import { Notification } from "../src/models/Notification.js";
import { Meeting } from "../src/models/Meeting.js";
import { NotificationService } from "../src/services/notification.service.js";

describe("Phase P7: Notification Endpoints and Business Logic", () => {
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

  describe("Notification API Endpoints", () => {
    it("lists notifications (max 50, newest first) and computes unreadCount", async () => {
      const admin = await createTeamWithAdmin("NotifList");

      // Seed 55 notifications for admin
      const docs = [];
      const now = Date.now();
      for (let i = 0; i < 55; i++) {
        docs.push({
          userId: new mongoose.Types.ObjectId(admin.user.id),
          teamId: new mongoose.Types.ObjectId(admin.user.teamId),
          type: "TASK_ASSIGNED",
          message: `Task ${i}`,
          link: `/tasks?highlight=t${i}`,
          read: i < 5, // 5 read, 50 unread
          createdAt: new Date(now + i * 1000),
        });
      }
      await Notification.insertMany(docs);

      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(50);
      expect(res.body.unreadCount).toBe(50);
      // Newest first
      expect(res.body.items[0].message).toBe("Task 54");
      expect(res.body.items[49].message).toBe("Task 5");
    });

    it("marks single notification as read, returning 204", async () => {
      const admin = await createTeamWithAdmin("NotifMark");
      const notif = await Notification.create({
        userId: new mongoose.Types.ObjectId(admin.user.id),
        teamId: new mongoose.Types.ObjectId(admin.user.teamId),
        type: "TASK_ASSIGNED",
        message: "Check this task",
        link: "/tasks",
        read: false,
      });

      const patchRes = await request(app)
        .patch(`/api/v1/notifications/${notif._id}/read`)
        .set("Authorization", `Bearer ${admin.token}`);

      expect(patchRes.status).toBe(204);

      const updated = await Notification.findById(notif._id);
      expect(updated?.read).toBe(true);
    });

    it("returns 404 when marking a notification belonging to another user", async () => {
      const admin = await createTeamWithAdmin("NotifOtherUser");
      const team = await Team.findById(admin.user.teamId);
      const member = await addMember("NotifOtherMember", team!.inviteCode);

      const notif = await Notification.create({
        userId: new mongoose.Types.ObjectId(admin.user.id),
        teamId: new mongoose.Types.ObjectId(admin.user.teamId),
        type: "TASK_ASSIGNED",
        message: "Private for admin",
        link: "/tasks",
        read: false,
      });

      // Member attempts to mark admin's notification as read
      const patchRes = await request(app)
        .patch(`/api/v1/notifications/${notif._id}/read`)
        .set("Authorization", `Bearer ${member.token}`);

      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error.code).toBe("NOT_FOUND");
    });

    it("marks all unread notifications as read via POST /read-all", async () => {
      const admin = await createTeamWithAdmin("NotifReadAll");

      await Notification.insertMany([
        {
          userId: new mongoose.Types.ObjectId(admin.user.id),
          teamId: new mongoose.Types.ObjectId(admin.user.teamId),
          type: "TASK_ASSIGNED",
          message: "Task 1",
          link: "/tasks",
          read: false,
        },
        {
          userId: new mongoose.Types.ObjectId(admin.user.id),
          teamId: new mongoose.Types.ObjectId(admin.user.teamId),
          type: "MEETING_SUMMARY_READY",
          message: "Meeting 1",
          link: "/meetings",
          read: false,
        },
      ]);

      const res = await request(app)
        .post("/api/v1/notifications/read-all")
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(204);

      const listRes = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${admin.token}`);

      expect(listRes.body.unreadCount).toBe(0);
      expect(listRes.body.items.every((item: { read: boolean }) => item.read === true)).toBe(true);
    });
  });

  describe("Task Assignment and Summary Notifications", () => {
    it("creates a notification when a task is assigned to another user, but not on self-assignment", async () => {
      const admin = await createTeamWithAdmin("NotifAssign");
      const team = await Team.findById(admin.user.teamId);
      const member = await addMember("Assignee", team!.inviteCode);

      // Self-assignment by admin -> no notification
      await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          title: "Self assigned",
          assigneeId: admin.user.id,
        });

      const adminNotifs = await Notification.find({ userId: admin.user.id });
      expect(adminNotifs).toHaveLength(0);

      // Admin assigns task to member -> member gets notification
      const taskRes = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          title: "Review PR #42",
          assigneeId: member.user.id,
        });
      expect(taskRes.status).toBe(201);

      const memberNotifs = await Notification.find({ userId: member.user.id });
      expect(memberNotifs).toHaveLength(1);
      expect(memberNotifs[0].type).toBe("TASK_ASSIGNED");
      expect(memberNotifs[0].message).toBe('NotifAssign Admin assigned you "Review PR #42"');
      expect(memberNotifs[0].link).toBe(`/tasks?highlight=${taskRes.body.id}`);
      expect(memberNotifs[0].read).toBe(false);
    });

    it("creates meeting summary notification for host idempotently", async () => {
      const admin = await createTeamWithAdmin("NotifSummary");
      const meeting = await Meeting.create({
        teamId: new mongoose.Types.ObjectId(admin.user.teamId),
        hostId: new mongoose.Types.ObjectId(admin.user.id),
        title: "Sprint Planning",
        roomCode: "abc-defg-hij",
        colorIndex: 1,
        status: "ENDED",
      });

      // First call -> creates notification
      const notif1 = await NotificationService.notifyMeetingSummaryReady(
        meeting._id.toString(),
        meeting.title,
        admin.user.id,
        admin.user.teamId,
      );
      expect(notif1).not.toBeNull();
      expect(notif1?.message).toBe('Summary ready for "Sprint Planning"');
      expect(notif1?.link).toBe(`/meetings/${meeting._id}`);

      // Second call -> idempotent, returns existing notification without creating new one
      const notif2 = await NotificationService.notifyMeetingSummaryReady(
        meeting._id.toString(),
        meeting.title,
        admin.user.id,
        admin.user.teamId,
      );
      expect(notif2?._id.toString()).toBe(notif1?._id.toString());

      const count = await Notification.countDocuments({
        userId: admin.user.id,
        type: "MEETING_SUMMARY_READY",
      });
      expect(count).toBe(1);
    });
  });
});
