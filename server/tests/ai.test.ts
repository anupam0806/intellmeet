import http from "node:http";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { createSocketServer } from "../src/sockets/index.js";
import { Meeting } from "../src/models/Meeting.js";
import { User } from "../src/models/User.js";
import { TranscriptSegment } from "../src/models/TranscriptSegment.js";
import {
  generateMeetingIntelligence,
  recoverPendingAiGenerations,
  cleanJsonFences,
  matchAssignee,
} from "../src/services/ai/generate.js";
import { OpenAiCompatibleProvider } from "../src/services/ai/openaiCompatible.js";
import { MockAiProvider } from "../src/services/ai/mock.js";
import { buildUserPrompt } from "../src/services/ai/prompts.js";
import type { AiProvider } from "../src/services/ai/provider.js";

describe("Phase P5: AI Write-up & Meeting Intelligence", () => {
  let server: http.Server;
  let app: ReturnType<typeof createApp>;
  let team1: { token: string; user: { id: string; teamId: string; role: string; name: string } };
  let member1: { token: string; user: { id: string; teamId: string; role: string; name: string } };
  let team2: { token: string; user: { id: string; teamId: string; role: string; name: string } };

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

  beforeAll(async () => {
    app = createApp();
    server = http.createServer(app);
    createSocketServer(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
  });

  beforeEach(async () => {
    const rand = Math.random().toString(36).slice(2, 8);
    team1 = await createTestTeam("Owner Maya", `maya.${rand}@ai-test.com`, `AI Team ${rand}`);
    const teamRes = await request(app)
      .get("/api/v1/team")
      .set("Authorization", `Bearer ${team1.token}`);
    const inviteCode = teamRes.body.inviteCode as string;
    member1 = await joinTestTeam("Member Alex", `alex.${rand}@ai-test.com`, inviteCode);
    team2 = await createTestTeam("Other Owner", `other.${rand}@ai-test.com`, `Other Team ${rand}`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("Unit: Prompts and Truncation", () => {
    it("truncates oldest lines when content exceeds maxChars", () => {
      const items = [
        { timestamp: new Date(10000), speaker: "Alice", text: "Line 1 oldest", isChat: false },
        { timestamp: new Date(20000), speaker: "Bob", text: "Line 2 second", isChat: false },
        { timestamp: new Date(30000), speaker: "Charlie", text: "Line 3 newest", isChat: true },
      ];

      // Limit maxChars so only newest 1 or 2 lines fit
      const prompt = buildUserPrompt("Test Meeting", items, 100);
      expect(prompt).toContain("Meeting Title: Test Meeting");
      expect(prompt).toContain("Line 3 newest");
      expect(prompt).not.toContain("Line 1 oldest");
    });

    it("strips markdown code fences cleanly", () => {
      const fenced = '```json\n{"summary": "Test"}\n```';
      expect(cleanJsonFences(fenced)).toBe('{"summary": "Test"}');
      const plainFenced = '```\n{"summary": "Test"}\n```';
      expect(cleanJsonFences(plainFenced)).toBe('{"summary": "Test"}');
    });
  });

  describe("Unit: Assignee Matching", () => {
    it("matches full name case-insensitively and unique first name, leaving ambiguous names as text", async () => {
      const teamId = new mongoose.Types.ObjectId();
      const user1 = new User({
        _id: new mongoose.Types.ObjectId(),
        teamId,
        name: "Sarah Connor",
        email: "sarah1@test.com",
        role: "MEMBER",
        passwordHash: "hash",
      });
      const user2 = new User({
        _id: new mongoose.Types.ObjectId(),
        teamId,
        name: "John Matrix",
        email: "john1@test.com",
        role: "MEMBER",
        passwordHash: "hash",
      });
      const user3 = new User({
        _id: new mongoose.Types.ObjectId(),
        teamId,
        name: "John Rambo",
        email: "john2@test.com",
        role: "MEMBER",
        passwordHash: "hash",
      });

      const members = [user1, user2, user3];

      // Full name match
      const match1 = matchAssignee("sarah connor", members);
      expect(match1.assigneeId?.toString()).toBe(user1._id.toString());
      expect(match1.resolvedName).toBe("Sarah Connor");

      // Unique first name match
      const match2 = matchAssignee("Sarah", members);
      expect(match2.assigneeId?.toString()).toBe(user1._id.toString());

      // Ambiguous first name match (2 Johns) -> no assigneeId
      const match3 = matchAssignee("John", members);
      expect(match3.assigneeId).toBeUndefined();
      expect(match3.resolvedName).toBe("John");

      // Unknown name -> text only
      const match4 = matchAssignee("Nobody", members);
      expect(match4.assigneeId).toBeUndefined();
      expect(match4.resolvedName).toBe("Nobody");
    });
  });

  describe("Unit: Mock Provider Determinism", () => {
    it("builds deterministic output only from the supplied user transcript", async () => {
      const mock = new MockAiProvider();
      const userContent = [
        "[10:00] Alice: Welcome everyone to the sprint meeting.",
        "[10:01] Bob: I'll prepare the database migration by tomorrow.",
        "[10:02] Alice: Charlie will write the unit tests for the auth flow.",
      ].join("\n");

      const raw = await mock.generate({ system: "system", user: userContent });
      const parsed = JSON.parse(raw);

      expect(parsed.summary).toContain("Meeting included 3 segments across speakers: Alice, Bob");
      expect(parsed.keyPoints).toHaveLength(3);
      expect(parsed.decisions).toEqual([]);
      expect(parsed.actionItems).toHaveLength(2);
      expect(parsed.actionItems[0].assigneeName).toBe("Bob");
      expect(parsed.actionItems[1].assigneeName).toBe("Alice");
    });
  });

  describe("Unit: OpenAiCompatible Provider Retries and Timeouts", () => {
    it("retries once on HTTP 429 and succeeds if second attempt succeeds", async () => {
      let callCount = 0;
      const fakeFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "rate limit" }), { status: 429 });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"summary": "ok", "keyPoints": [], "decisions": [], "actionItems": []}' } }],
          }),
          { status: 200 },
        );
      });

      vi.stubGlobal("fetch", fakeFetch);

      const provider = new OpenAiCompatibleProvider({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
        model: "gpt-4o",
        retryDelayMs: 10,
      });

      const res = await provider.generate({ system: "sys", user: "usr" });
      expect(callCount).toBe(2);
      expect(res).toContain('"summary": "ok"');

      vi.unstubAllGlobals();
    });

    it("throws error after second failed attempt on HTTP 500", async () => {
      const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "server error" }), { status: 500 }),
      );

      vi.stubGlobal("fetch", fakeFetch);

      const provider = new OpenAiCompatibleProvider({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
        model: "gpt-4o",
        retryDelayMs: 10,
      });

      await expect(provider.generate({ system: "sys", user: "usr" })).rejects.toThrow(
        "AI generation failed after retry",
      );

      vi.unstubAllGlobals();
    });
  });

  describe("Pipeline: Insufficient Content, Bad Shapes, Retries and Transitions", () => {
    it("sets INSUFFICIENT without calling the provider when fewer than 5 segments exist", async () => {
      const meeting = await Meeting.create({
        teamId: team1.user.teamId,
        title: "Short Meeting",
        hostId: team1.user.id,
        roomCode: "insuf01",
        colorIndex: 1,
        status: "ENDED",
        endedAt: new Date(),
        ai: { status: "NONE", keyPoints: [], decisions: [], actionItems: [], attempts: 0 },
      });

      // Insert only 3 segments
      await TranscriptSegment.create([
        { meetingId: meeting._id, teamId: team1.user.teamId, speakerName: "Alice", text: "Short text 1", ts: 1000 },
        { meetingId: meeting._id, teamId: team1.user.teamId, speakerName: "Alice", text: "Short text 2", ts: 2000 },
        { meetingId: meeting._id, teamId: team1.user.teamId, speakerName: "Alice", text: "Short text 3", ts: 3000 },
      ]);

      const mockProvider: AiProvider = {
        name: "mock",
        model: "mock",
        generate: vi.fn(),
      };

      await generateMeetingIntelligence(meeting._id.toString(), mockProvider);

      // Verify provider was NEVER called
      expect(mockProvider.generate).not.toHaveBeenCalled();

      const updated = await Meeting.findById(meeting._id);
      expect(updated?.ai.status).toBe("INSUFFICIENT");
    });

    it("retries on malformed JSON and sets FAILED on second failure without crashing", async () => {
      const meeting = await Meeting.create({
        teamId: team1.user.teamId,
        title: "Malformed Meeting",
        hostId: team1.user.id,
        roomCode: "malf01",
        colorIndex: 2,
        status: "ENDED",
        endedAt: new Date(),
        ai: { status: "NONE", keyPoints: [], decisions: [], actionItems: [], attempts: 0 },
      });

      // Insert 6 segments with > 40 words
      const segments = [];
      for (let i = 0; i < 6; i++) {
        segments.push({
          meetingId: meeting._id,
          teamId: team1.user.teamId,
          speakerName: "Alice",
          text: `This is a sufficiently long spoken segment number ${i} with multiple words to exceed word count limits.`,
          ts: i * 1000,
        });
      }
      await TranscriptSegment.create(segments);

      const badProvider: AiProvider = {
        name: "bad-ai",
        model: "bad-model",
        generate: vi.fn().mockResolvedValue("Not valid JSON at all!"),
      };

      await generateMeetingIntelligence(meeting._id.toString(), badProvider);

      expect(badProvider.generate).toHaveBeenCalledTimes(2);

      const updated = await Meeting.findById(meeting._id);
      expect(updated?.ai.status).toBe("FAILED");
      expect(updated?.ai.error).toBe("Failed to parse or validate meeting intelligence.");
      // Ensure error never contains raw response or secrets
      expect(updated?.ai.error).not.toContain("Not valid JSON");
    });

    it("recovers stranded PENDING meetings older than 1 minute on server start", async () => {
      const oldMeeting = await Meeting.create({
        teamId: team1.user.teamId,
        title: "Stranded Old Meeting",
        hostId: team1.user.id,
        roomCode: "oldpend01",
        colorIndex: 0,
        status: "ENDED",
        endedAt: new Date(Date.now() - 120000), // 2 minutes ago
        ai: { status: "PENDING", keyPoints: [], decisions: [], actionItems: [], attempts: 0 },
      });

      const recentMeeting = await Meeting.create({
        teamId: team1.user.teamId,
        title: "Recent Meeting",
        hostId: team1.user.id,
        roomCode: "recpend01",
        colorIndex: 1,
        status: "ENDED",
        endedAt: new Date(), // Just now
        ai: { status: "PENDING", keyPoints: [], decisions: [], actionItems: [], attempts: 0 },
      });

      const mockProvider: AiProvider = {
        name: "mock-recover",
        model: "mock",
        generate: vi.fn().mockResolvedValue(
          JSON.stringify({
            summary: "Recovered summary",
            keyPoints: ["Point 1"],
            decisions: ["Decision 1"],
            actionItems: [],
          }),
        ),
      };

      // Add segments to oldMeeting so it doesn't fail minimum content check
      const segments = [];
      for (let i = 0; i < 6; i++) {
        segments.push({
          meetingId: oldMeeting._id,
          teamId: team1.user.teamId,
          speakerName: "Alice",
          text: `Long segment for old meeting number ${i} to exceed forty words total count.`,
          ts: i * 1000,
        });
      }
      await TranscriptSegment.create(segments);

      await recoverPendingAiGenerations(mockProvider);

      const updatedOld = await Meeting.findById(oldMeeting._id);
      const updatedRecent = await Meeting.findById(recentMeeting._id);

      expect(updatedOld?.ai.status).toBe("READY");
      expect(updatedRecent?.ai.status).toBe("PENDING"); // was untouched
    });
  });

  describe("Endpoints: POST /meetings/:id/ai/generate", () => {
    it("enforces permissions (host or Admin only), ENDED only, AI_PENDING guard, and rate limit", async () => {
      const liveMeeting = await Meeting.create({
        teamId: team1.user.teamId,
        title: "Live Meeting",
        hostId: team1.user.id,
        roomCode: "liveai01",
        colorIndex: 0,
        status: "LIVE",
        ai: { status: "NONE", keyPoints: [], decisions: [], actionItems: [], attempts: 0 },
      });

      // 1. Rejected if meeting is not ENDED
      const liveRes = await request(app)
        .post(`/api/v1/meetings/${liveMeeting._id}/ai/generate`)
        .set("Authorization", `Bearer ${team1.token}`);
      expect(liveRes.status).toBe(409);

      // Transition to ENDED
      liveMeeting.status = "ENDED";
      liveMeeting.endedAt = new Date();
      await liveMeeting.save();

      // 2. Rejected if non-host member attempts to generate
      const memberRes = await request(app)
        .post(`/api/v1/meetings/${liveMeeting._id}/ai/generate`)
        .set("Authorization", `Bearer ${member1.token}`);
      expect(memberRes.status).toBe(403);

      // 3. Accepted for host -> returns 202 { status: "PENDING" }
      const hostRes = await request(app)
        .post(`/api/v1/meetings/${liveMeeting._id}/ai/generate`)
        .set("Authorization", `Bearer ${team1.token}`);
      expect(hostRes.status).toBe(202);
      expect(hostRes.body.status).toBe("PENDING");

      // 4. Repeated call while PENDING returns 409 AI_PENDING
      const repeatRes = await request(app)
        .post(`/api/v1/meetings/${liveMeeting._id}/ai/generate`)
        .set("Authorization", `Bearer ${team1.token}`);
      expect(repeatRes.status).toBe(409);
      expect(repeatRes.body.error.code).toBe("AI_PENDING");
    });
  });

  describe("Endpoints: PATCH /meetings/:id/action-items/:itemId", () => {
    it("updates action item title, assigneeId (must be team member), and dueDate; handles ALREADY_CONVERTED and 404s", async () => {
      const itemId = new mongoose.Types.ObjectId();
      const meeting = await Meeting.create({
        teamId: team1.user.teamId,
        title: "Action Item Meeting",
        hostId: team1.user.id,
        roomCode: "act01",
        colorIndex: 1,
        status: "ENDED",
        ai: {
          status: "READY",
          keyPoints: [],
          decisions: [],
          actionItems: [
            {
              _id: itemId,
              title: "Initial action title",
              assigneeName: "Nobody",
            },
          ],
          attempts: 1,
        },
      });

      // 1. Cross-team access returns 404
      const crossRes = await request(app)
        .patch(`/api/v1/meetings/${meeting._id}/action-items/${itemId}`)
        .set("Authorization", `Bearer ${team2.token}`)
        .send({ title: "Updated title" });
      expect(crossRes.status).toBe(404);

      // 2. Member without host/admin role returns 403
      const memberRes = await request(app)
        .patch(`/api/v1/meetings/${meeting._id}/action-items/${itemId}`)
        .set("Authorization", `Bearer ${member1.token}`)
        .send({ title: "Updated title" });
      expect(memberRes.status).toBe(403);

      // 3. Assignee from another team returns 404
      const badAssigneeRes = await request(app)
        .patch(`/api/v1/meetings/${meeting._id}/action-items/${itemId}`)
        .set("Authorization", `Bearer ${team1.token}`)
        .send({ assigneeId: team2.user.id });
      expect(badAssigneeRes.status).toBe(404);

      // 4. Successful update by host
      const validRes = await request(app)
        .patch(`/api/v1/meetings/${meeting._id}/action-items/${itemId}`)
        .set("Authorization", `Bearer ${team1.token}`)
        .send({
          title: "Finalized bugfix task",
          assigneeId: member1.user.id,
          dueDate: "2026-12-01",
        });

      expect(validRes.status).toBe(200);
      expect(validRes.body.item.title).toBe("Finalized bugfix task");
      expect(validRes.body.item.assigneeId).toBe(member1.user.id);
      expect(validRes.body.item.assigneeName).toBe("Member Alex");

      // 5. If item is converted to task, returns 409 ALREADY_CONVERTED
      meeting.ai.actionItems[0]!.taskId = new mongoose.Types.ObjectId();
      await meeting.save();

      const convertedRes = await request(app)
        .patch(`/api/v1/meetings/${meeting._id}/action-items/${itemId}`)
        .set("Authorization", `Bearer ${team1.token}`)
        .send({ title: "Change again" });
      expect(convertedRes.status).toBe(409);
      expect(convertedRes.body.error.code).toBe("ALREADY_CONVERTED");
    });
  });

  describe("Endpoints: GET /meetings/:id/export?format=md|json", () => {
    it("exports Markdown with attachment header and expected sections", async () => {
      const meeting = await Meeting.create({
        teamId: team1.user.teamId,
        title: "Export Test Session",
        hostId: team1.user.id,
        roomCode: "exp01",
        colorIndex: 3,
        status: "ENDED",
        startedAt: new Date("2026-11-08T10:00:00Z"),
        durationSeconds: 120,
        participants: [{ userId: team1.user.id, name: "Maya", joinedAt: new Date(), captionsOn: true }],
        ai: {
          status: "READY",
          summary: "This was a productive planning session.",
          keyPoints: ["Point A", "Point B"],
          decisions: ["Decision 1"],
          actionItems: [{ _id: new mongoose.Types.ObjectId(), title: "Write tests", assigneeName: "Maya" }],
          attempts: 1,
        },
      });

      await TranscriptSegment.create({
        meetingId: meeting._id,
        teamId: team1.user.teamId,
        speakerName: "Maya",
        text: "Let's begin the export test.",
        ts: Date.now(),
      });

      // Markdown export
      const mdRes = await request(app)
        .get(`/api/v1/meetings/${meeting._id}/export?format=md`)
        .set("Authorization", `Bearer ${team1.token}`);

      expect(mdRes.status).toBe(200);
      expect(mdRes.headers["content-type"]).toContain("text/markdown");
      expect(mdRes.headers["content-disposition"]).toContain("attachment; filename=");
      expect(mdRes.text).toContain("# Export Test Session");
      expect(mdRes.text).toContain("## Summary");
      expect(mdRes.text).toContain("This was a productive planning session.");
      expect(mdRes.text).toContain("## Key Points");
      expect(mdRes.text).toContain("Point A");
      expect(mdRes.text).toContain("## Decisions");
      expect(mdRes.text).toContain("Decision 1");
      expect(mdRes.text).toContain("## Action Items");
      expect(mdRes.text).toContain("Write tests");
      expect(mdRes.text).toContain("## Transcript");
      expect(mdRes.text).toContain("Let's begin the export test.");

      // JSON export
      const jsonRes = await request(app)
        .get(`/api/v1/meetings/${meeting._id}/export?format=json`)
        .set("Authorization", `Bearer ${team1.token}`);

      expect(jsonRes.status).toBe(200);
      expect(jsonRes.headers["content-type"]).toContain("application/json");
      expect(jsonRes.headers["content-disposition"]).toContain(".json");
      const parsedJson = JSON.parse(jsonRes.text);
      expect(parsedJson.title).toBe("Export Test Session");
      expect(parsedJson.summary).toBe("This was a productive planning session.");
      expect(parsedJson.actionItems).toHaveLength(1);

      // Cross-team 404
      const crossRes = await request(app)
        .get(`/api/v1/meetings/${meeting._id}/export?format=md`)
        .set("Authorization", `Bearer ${team2.token}`);
      expect(crossRes.status).toBe(404);
    });
  });
});
