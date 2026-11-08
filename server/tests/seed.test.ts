import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { runSeed } from "../src/seed.js";
import { Team } from "../src/models/Team.js";
import { User } from "../src/models/User.js";
import { Meeting } from "../src/models/Meeting.js";
import { TranscriptSegment } from "../src/models/TranscriptSegment.js";
import { ChatMessage } from "../src/models/ChatMessage.js";

describe("Seed Script (server/src/seed.ts)", () => {
  it("seeds Brightwell team, users with bcrypt cost 12, meetings, transcript and chat", async () => {
    // Capture console.log output to verify terminal summary
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    try {
      const result = await runSeed({ reset: false, silent: false });

      expect(result.teamCount).toBe(1);
      expect(result.userCount).toBe(5);
      expect(result.meetingCount).toBe(3);
      expect(result.transcriptCount).toBe(14);
      expect(result.chatCount).toBe(6);
      expect(result.emails).toHaveLength(5);

      // Verify terminal output
      const output = logs.join("\n");
      expect(output).toContain("Brightwell Design Co. Demo Seed Complete");
      expect(output).toContain("Teams: 1");
      expect(output).toContain("Users: 5");
      expect(output).toContain("Meetings: 3");
      expect(output).toContain("Transcript segments: 14");
      expect(output).toContain("Chat messages: 6");
      expect(output).toContain("maya@brightwell.test (ADMIN)");
      expect(output).toContain("dev@brightwell.test (MEMBER)");
      expect(output).toContain("lena@brightwell.test (MEMBER)");
      expect(output).toContain("omar@brightwell.test (MEMBER)");
      expect(output).toContain("sofia@brightwell.test (MEMBER)");
      // Verify no passwords or URIs printed
      expect(output).not.toContain("Demo@12345");
      expect(output).not.toContain("mongodb://");

      // Verify Team in DB
      const team = await Team.findOne({ name: "Brightwell Design Co." });
      expect(team).not.toBeNull();
      expect(team?.inviteCode).toBe("BRIGHT24");

      // Verify Users in DB
      const users = await User.find({ teamId: team?._id }).select("+passwordHash");
      expect(users).toHaveLength(5);

      const maya = users.find((u) => u.email === "maya@brightwell.test");
      expect(maya).toBeDefined();
      expect(maya?.name).toBe("Maya Chen");
      expect(maya?.role).toBe("ADMIN");
      expect(team?.ownerId.toString()).toBe(maya?._id.toString());

      const members = users.filter((u) => u.email !== "maya@brightwell.test");
      expect(members).toHaveLength(4);
      for (const m of members) {
        expect(m.role).toBe("MEMBER");
      }

      // Verify bcrypt rounds and password match
      for (const u of users) {
        expect(u.passwordHash).toBeDefined();
        const rounds = bcrypt.getRounds(u.passwordHash);
        expect(rounds).toBe(12);
        const match = await bcrypt.compare("Demo@12345", u.passwordHash);
        expect(match).toBe(true);
      }

      // Verify Meeting 1: "Team standup"
      const m1 = await Meeting.findOne({ roomCode: "DEMOROOM01" });
      expect(m1).toBeDefined();
      expect(m1?.title).toBe("Team standup");
      expect(m1?.status).toBe("SCHEDULED");
      expect(m1?.colorIndex).toBe(1);
      expect(m1?.hostId.toString()).toBe(maya?._id.toString());

      // Verify Meeting 2: "Checkout bug triage"
      const dev = users.find((u) => u.email === "dev@brightwell.test")!;
      const m2 = await Meeting.findOne({ roomCode: "DEMOROOM02" });
      expect(m2).toBeDefined();
      expect(m2?.title).toBe("Checkout bug triage");
      expect(m2?.status).toBe("ENDED");
      expect(m2?.colorIndex).toBe(3);
      expect(m2?.hostId.toString()).toBe(dev._id.toString());
      expect(m2?.durationSeconds).toBe(35 * 60);
      expect(m2?.ai.status).toBe("NONE");
      expect(m2?.participants).toHaveLength(4);

      // Verify Meeting 2 transcript segments (at least 5 segments and at least 40 words)
      const segments = await TranscriptSegment.find({ meetingId: m2?._id }).sort({ ts: 1 });
      expect(segments.length).toBe(14);
      expect(segments.length).toBeGreaterThanOrEqual(5);

      const totalWords = segments.reduce((sum, seg) => sum + seg.text.trim().split(/\s+/).length, 0);
      expect(totalWords).toBeGreaterThanOrEqual(40);

      // Check content details
      const allText = segments.map((s) => s.text).join(" ");
      expect(allText).toContain("timeouts");
      expect(allText).toContain("Redis");
      expect(allText).toContain("Decision:");
      expect(allText).toMatch(/\bI'll\b/);
      expect(allText).toMatch(/\bwill\b/);
      expect(allText).toContain("today");

      // Verify Meeting 2 chat messages
      const chats = await ChatMessage.find({ meetingId: m2?._id }).sort({ createdAt: 1 });
      expect(chats).toHaveLength(6);

      // Verify Meeting 3: "Sprint planning"
      const m3 = await Meeting.findOne({ roomCode: "DEMOROOM03" });
      expect(m3).toBeDefined();
      expect(m3?.title).toBe("Sprint planning");
      expect(m3?.status).toBe("SCHEDULED");
      expect(m3?.colorIndex).toBe(0);
      expect(m3?.hostId.toString()).toBe(maya?._id.toString());
      expect(m3?.scheduledAt).toBeDefined();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("is idempotent: running twice produces identical counts", async () => {
    await runSeed({ reset: false, silent: true });
    const firstTeamCount = await Team.countDocuments();
    const firstUserCount = await User.countDocuments();
    const firstMeetingCount = await Meeting.countDocuments();
    const firstTranscriptCount = await TranscriptSegment.countDocuments();
    const firstChatCount = await ChatMessage.countDocuments();

    await runSeed({ reset: false, silent: true });
    const secondTeamCount = await Team.countDocuments();
    const secondUserCount = await User.countDocuments();
    const secondMeetingCount = await Meeting.countDocuments();
    const secondTranscriptCount = await TranscriptSegment.countDocuments();
    const secondChatCount = await ChatMessage.countDocuments();

    expect(secondTeamCount).toBe(firstTeamCount);
    expect(secondUserCount).toBe(firstUserCount);
    expect(secondMeetingCount).toBe(firstMeetingCount);
    expect(secondTranscriptCount).toBe(firstTranscriptCount);
    expect(secondChatCount).toBe(firstChatCount);
  });

  it("--reset deletes only Brightwell data and leaves other teams untouched", async () => {
    // First seed Brightwell
    await runSeed({ reset: false, silent: true });

    // Create an independent team with its own records
    const otherTeam = await Team.create({
      name: "Acme Corp",
      inviteCode: "ACME1234",
      ownerId: new mongoose.Types.ObjectId(),
    });

    const otherUser = await User.create({
      name: "Alice Smith",
      email: "alice@acme.test",
      role: "ADMIN",
      teamId: otherTeam._id,
      passwordHash: "dummyhash",
    });
    otherTeam.ownerId = otherUser._id;
    await otherTeam.save();

    const otherMeeting = await Meeting.create({
      teamId: otherTeam._id,
      title: "Acme Standup",
      hostId: otherUser._id,
      roomCode: "ACMEROOM1",
      colorIndex: 2,
      status: "SCHEDULED",
    });

    const otherSegment = await TranscriptSegment.create({
      meetingId: otherMeeting._id,
      teamId: otherTeam._id,
      speakerId: otherUser._id,
      speakerName: "Alice Smith",
      text: "Acme secret meeting text",
      ts: new Date(),
    });

    const otherChat = await ChatMessage.create({
      meetingId: otherMeeting._id,
      teamId: otherTeam._id,
      senderId: otherUser._id,
      senderName: "Alice Smith",
      text: "Hello from Acme",
    });

    // Run seed with --reset
    await runSeed({ reset: true, silent: true });

    // Verify other team and its records are completely untouched
    const foundOtherTeam = await Team.findById(otherTeam._id);
    expect(foundOtherTeam).not.toBeNull();
    expect(foundOtherTeam?.name).toBe("Acme Corp");

    const foundOtherUser = await User.findById(otherUser._id);
    expect(foundOtherUser).not.toBeNull();
    expect(foundOtherUser?.email).toBe("alice@acme.test");

    const foundOtherMeeting = await Meeting.findById(otherMeeting._id);
    expect(foundOtherMeeting).not.toBeNull();

    const foundOtherSegment = await TranscriptSegment.findById(otherSegment._id);
    expect(foundOtherSegment).not.toBeNull();

    const foundOtherChat = await ChatMessage.findById(otherChat._id);
    expect(foundOtherChat).not.toBeNull();

    // Verify Brightwell was properly recreated
    const brightwell = await Team.findOne({ name: "Brightwell Design Co." });
    expect(brightwell).not.toBeNull();
    const brightwellUsers = await User.find({ teamId: brightwell?._id });
    expect(brightwellUsers).toHaveLength(5);
  });

  it("refuses to run when MONGODB_URI is missing and not connected", async () => {
    // Mock readyState as 0
    const readyStateSpy = vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0);
    const oldUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;

    try {
      await expect(runSeed({ uri: "" })).rejects.toThrow("MONGODB_URI is required to run the seed script.");
    } finally {
      readyStateSpy.mockRestore();
      if (oldUri) process.env.MONGODB_URI = oldUri;
    }
  });
});
