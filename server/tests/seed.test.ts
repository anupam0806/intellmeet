import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { runSeed } from "../src/seed.js";
import { Team } from "../src/models/Team.js";
import { User } from "../src/models/User.js";
import { Meeting } from "../src/models/Meeting.js";
import { Task } from "../src/models/Task.js";
import { Notification } from "../src/models/Notification.js";
import { TranscriptSegment } from "../src/models/TranscriptSegment.js";
import { ChatMessage } from "../src/models/ChatMessage.js";
import { aiOutputSchema } from "../src/services/ai/generate.js";
import { AnalyticsService } from "../src/services/analytics.service.js";

describe("Full Seed Script (server/src/seed.ts)", () => {
  it("creates 1 team, 5 users, 8 meetings (6 ENDED, 2 SCHEDULED), 12 tasks, and 3 notifications", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    const result = await runSeed({ reset: false, silent: false });

    expect(result.teamCount).toBe(1);
    expect(result.userCount).toBe(5);
    expect(result.meetingCount).toBe(8);
    expect(result.taskCount).toBe(12);
    expect(result.notificationCount).toBe(3);
    expect(result.emails).toHaveLength(5);

    // Verify terminal output contains no passwords or connection strings
    const output = logs.join("\n");
    expect(output).toContain("Brightwell Design Co. Demo Seed Complete");
    expect(output).toContain("Meetings: 8");
    expect(output).toContain("Tasks: 12");
    expect(output).toContain("Notifications: 3");
    expect(output).not.toContain("Demo@12345");
    expect(output).not.toContain("mongodb://");
    expect(output).not.toContain("mongodb+srv://");

    // Verify Team
    const team = await Team.findOne({ name: "Brightwell Design Co." });
    expect(team).not.toBeNull();
    expect(team?.inviteCode).toBe("BRIGHT24");

    // Verify Users
    const users = await User.find({ teamId: team?._id }).select("+passwordHash");
    expect(users).toHaveLength(5);
    for (const u of users) {
      expect(bcrypt.getRounds(u.passwordHash)).toBe(12);
      expect(await bcrypt.compare("Demo@12345", u.passwordHash)).toBe(true);
    }
    const mayaUser = users.find((u) => u.email === "maya@brightwell.test")!;

    // Verify Meetings: 6 ENDED and 2 SCHEDULED
    const meetings = await Meeting.find({ teamId: team?._id });
    expect(meetings).toHaveLength(8);

    const scheduled = meetings.filter((m) => m.status === "SCHEDULED");
    expect(scheduled).toHaveLength(2);
    expect(scheduled.map((m) => m.title).sort()).toEqual(["Sprint planning", "Team standup"]);
    const mayaScheduled = scheduled.filter((m) => m.hostId.toString() === mayaUser._id.toString());
    expect(mayaScheduled).toHaveLength(2);
    const standup = scheduled.find((m) => m.title === "Team standup")!;
    const sprintPlan = scheduled.find((m) => m.title === "Sprint planning")!;
    expect(standup.scheduledAt!.getTime()).toBeGreaterThan(Date.now() - 60000);
    expect(sprintPlan.scheduledAt!.getHours()).toBe(10);

    const ended = meetings.filter((m) => m.status === "ENDED");
    expect(ended).toHaveLength(6);

    // Verify Every Seeded Ended Meeting
    const colorIndices = new Set<number>();
    for (const m of ended) {
      colorIndices.add(m.colorIndex);
      // Duration & dates consistency
      expect(m.startedAt).toBeDefined();
      expect(m.endedAt).toBeDefined();
      expect(m.durationSeconds).toBeGreaterThanOrEqual(20 * 60);
      expect(m.durationSeconds).toBeLessThanOrEqual(50 * 60);
      expect(m.endedAt!.getTime() - m.startedAt!.getTime()).toBe(m.durationSeconds! * 1000);

      // AI status and metadata
      expect(m.ai.status).toBe("READY");
      expect(m.ai.provider).toBe("seed");
      expect(m.ai.model).toBe("hand-written");
      expect(m.ai.attempts).toBe(1);
      expect(m.ai.generatedAt!.getTime()).toBeGreaterThan(m.endedAt!.getTime());

      // Validate AI output against strict Zod schema
      const parseResult = aiOutputSchema.safeParse({
        summary: m.ai.summary,
        keyPoints: m.ai.keyPoints,
        decisions: m.ai.decisions,
        actionItems: m.ai.actionItems.map((a) => ({
          title: a.title,
          assigneeName: a.assigneeName ?? null,
          dueDate: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : null,
        })),
      });
      expect(parseResult.success).toBe(true);

      // Every action item assignee belongs to the team
      for (const a of m.ai.actionItems) {
        expect(a.assigneeId).toBeDefined();
        const userExists = users.some((u) => u._id.toString() === a.assigneeId!.toString());
        expect(userExists).toBe(true);
      }

      // Transcript segments and chat messages exist
      const segs = await TranscriptSegment.find({ meetingId: m._id });
      expect(segs.length).toBeGreaterThanOrEqual(10);
      expect(segs.length).toBeLessThanOrEqual(20);

      // Transcript speakers match participants
      const participantIds = new Set(m.participants.map((p) => p.userId.toString()));
      for (const seg of segs) {
        expect(seg.speakerId).toBeDefined();
        expect(participantIds.has(seg.speakerId!.toString())).toBe(true);
      }

      const chats = await ChatMessage.find({ meetingId: m._id });
      expect(chats.length).toBeGreaterThanOrEqual(4);
      expect(chats.length).toBeLessThanOrEqual(10);
    }

    // Color index varied across 0 to 5
    expect(colorIndices.size).toBeGreaterThanOrEqual(4);

    // Verify 12 Tasks
    const tasks = await Task.find({ teamId: team?._id });
    expect(tasks).toHaveLength(12);

    const todoTasks = tasks.filter((t) => t.status === "TODO");
    const inProgTasks = tasks.filter((t) => t.status === "IN_PROGRESS");
    const doneTasks = tasks.filter((t) => t.status === "DONE");

    expect(todoTasks.length).toBe(4);
    expect(inProgTasks.length).toBe(3);
    expect(doneTasks.length).toBe(5);

    // Contiguous order per column
    expect(todoTasks.map((t) => t.order).sort()).toEqual([0, 1, 2, 3]);
    expect(inProgTasks.map((t) => t.order).sort()).toEqual([0, 1, 2]);
    expect(doneTasks.map((t) => t.order).sort()).toEqual([0, 1, 2, 3, 4]);

    // Assigned across all 5 users and at least one unassigned
    const assignees = new Set(tasks.map((t) => t.assigneeId?.toString()).filter(Boolean));
    expect(assignees.size).toBe(5);
    const unassigned = tasks.filter((t) => !t.assigneeId);
    expect(unassigned.length).toBeGreaterThanOrEqual(1);

    // 7 converted tasks point at action items and action items point back at tasks
    const convertedTasks = tasks.filter((t) => t.sourceMeetingId && t.sourceActionItemId);
    expect(convertedTasks).toHaveLength(7);

    for (const ct of convertedTasks) {
      const sourceM = meetings.find((m) => m._id.toString() === ct.sourceMeetingId!.toString());
      expect(sourceM).toBeDefined();
      const matchingItem = sourceM!.ai.actionItems.find(
        (a) => a._id.toString() === ct.sourceActionItemId!.toString(),
      );
      expect(matchingItem).toBeDefined();
      expect(matchingItem!.taskId?.toString()).toBe(ct._id.toString());
    }

    // Done tasks have completedAt values spread across previous weeks
    for (const dt of doneTasks) {
      expect(dt.completedAt).toBeDefined();
      expect(dt.completedAt!.getTime()).toBeLessThan(Date.now());
    }

    // Verify Maya's open tasks: at least 3 open (1 overdue, 2 upcoming)
    const mayaOpenTasks = tasks.filter(
      (t) => t.assigneeId?.toString() === mayaUser._id.toString() && t.status !== "DONE",
    );
    expect(mayaOpenTasks.length).toBeGreaterThanOrEqual(3);
    const overdueMaya = mayaOpenTasks.filter(
      (t) => t.dueDate && t.dueDate.getTime() < Date.now(),
    );
    const upcomingMaya = mayaOpenTasks.filter(
      (t) => t.dueDate && t.dueDate.getTime() > Date.now(),
    );
    expect(overdueMaya.length).toBe(1);
    expect(upcomingMaya.length).toBe(2);

    // Verify 3 Notifications for Maya (1 unread)
    const notifs = await Notification.find({ userId: mayaUser._id }).sort({ createdAt: -1 });
    expect(notifs).toHaveLength(3);
    const unread = notifs.filter((n) => !n.read);
    expect(unread).toHaveLength(1);
    expect(unread[0].type).toBe("TASK_ASSIGNED");
    expect(unread[0].link).toContain("/tasks?highlight=");
    expect(notifs.some((n) => n.type === "MEETING_SUMMARY_READY")).toBe(true);

    // Verify analytics for the last 60 days return nonzero meetings, tasks, and participation
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const fromStr = sixtyDaysAgo.toISOString().slice(0, 10);
    const toStr = new Date().toISOString().slice(0, 10);

    const overview = await AnalyticsService.getOverview(team!._id.toString(), {
      from: fromStr,
      to: toStr,
    });

    expect(overview.totals.meetings).toBe(7); // 6 ended meetings + 1 scheduled meeting today in range
    expect(overview.totals.endedMeetings).toBe(6);
    expect(overview.totals.avgDurationMinutes).toBeGreaterThan(0);
    expect(overview.totals.doneTasks).toBeGreaterThan(0);
    expect(overview.totals.openTasks).toBe(7); // 4 TODO + 3 IN_PROGRESS
    expect(overview.participation.length).toBe(5);
    expect(overview.participation.every((p) => p.meetingsAttended > 0)).toBe(true);
    expect(overview.actionItemConversionRate).toBeGreaterThan(0);
  });

  it("is idempotent: running twice produces identical counts", async () => {
    await runSeed({ reset: false, silent: true });
    const result2 = await runSeed({ reset: false, silent: true });

    expect(result2.teamCount).toBe(1);
    expect(result2.userCount).toBe(5);
    expect(result2.meetingCount).toBe(8);
    expect(result2.taskCount).toBe(12);
    expect(result2.notificationCount).toBe(3);

    const team = await Team.findOne({ name: "Brightwell Design Co." });
    const meetingCount = await Meeting.countDocuments({ teamId: team?._id });
    expect(meetingCount).toBe(8);

    const taskCount = await Task.countDocuments({ teamId: team?._id });
    expect(taskCount).toBe(12);

    const notifCount = await Notification.countDocuments({ teamId: team?._id });
    expect(notifCount).toBe(3);
  });

  it("--reset deletes only Brightwell data and leaves other teams untouched", async () => {
    // Create another team and user
    const otherTeam = await Team.create({
      name: "Other Enterprise Team",
      inviteCode: "OTHER999",
      ownerId: new mongoose.Types.ObjectId(),
    });
    const otherUser = await User.create({
      name: "Other Person",
      email: "other@example.com",
      role: "ADMIN",
      teamId: otherTeam._id,
      passwordHash: "hash123",
    });
    const otherMeeting = await Meeting.create({
      teamId: otherTeam._id,
      title: "Untouched Meeting",
      hostId: otherUser._id,
      roomCode: "OTHERROOM1",
      colorIndex: 0,
      status: "SCHEDULED",
    });
    const otherTask = await Task.create({
      teamId: otherTeam._id,
      title: "Untouched Task",
      status: "TODO",
      order: 0,
      createdBy: otherUser._id,
    });
    const otherNotif = await Notification.create({
      userId: otherUser._id,
      teamId: otherTeam._id,
      type: "TASK_ASSIGNED",
      message: "Untouched notif",
      link: "/tasks",
      read: false,
    });

    // Run seed with --reset
    await runSeed({ reset: true, silent: true });

    // Verify other team data remains untouched
    const existingOtherTeam = await Team.findById(otherTeam._id);
    expect(existingOtherTeam).not.toBeNull();

    const existingOtherUser = await User.findById(otherUser._id);
    expect(existingOtherUser).not.toBeNull();

    const existingOtherMeeting = await Meeting.findById(otherMeeting._id);
    expect(existingOtherMeeting).not.toBeNull();

    const existingOtherTask = await Task.findById(otherTask._id);
    expect(existingOtherTask).not.toBeNull();

    const existingOtherNotif = await Notification.findById(otherNotif._id);
    expect(existingOtherNotif).not.toBeNull();

    // Verify Brightwell data recreated fresh
    const brightwellTeam = await Team.findOne({ name: "Brightwell Design Co." });
    expect(brightwellTeam).not.toBeNull();
    const brightwellMeetings = await Meeting.countDocuments({ teamId: brightwellTeam?._id });
    expect(brightwellMeetings).toBe(8);
  });
});
