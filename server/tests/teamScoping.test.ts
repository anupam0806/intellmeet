import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Notification } from "../src/models/Notification.js";

describe("Security Audit: Strict Team Scoping (Phase P8)", () => {
  const app = createApp();

  async function createTeamUser(prefix: string) {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name: `${prefix} User`,
      email: `${prefix.toLowerCase()}@example.com`,
      password: "Password123",
      teamName: `${prefix} Team`,
    });
    return {
      token: res.body.accessToken as string,
      user: res.body.user as { id: string; teamId: string; role: string; name: string },
    };
  }

  it("returns 404 (never 403, never data) when accessing another team's resources", async () => {
    // 1. Create Team A resources
    const teamA = await createTeamUser("TeamA");
    const teamB = await createTeamUser("TeamB");

    // Create a meeting in Team A
    const meetingRes = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", `Bearer ${teamA.token}`)
      .send({
        title: "Confidential Strategy Meeting",
        description: "Team A confidential roadmap",
      });
    expect(meetingRes.status).toBe(201);
    const meetingId = meetingRes.body.id;

    // Create a task in Team A
    const taskRes = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${teamA.token}`)
      .send({
        title: "Confidential Project Task",
        description: "Team A confidential task",
      });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.id;

    // Create a notification for Team A user
    const notif = await Notification.create({
      userId: teamA.user.id,
      teamId: teamA.user.teamId,
      type: "TASK_ASSIGNED",
      message: "Confidential assignment",
      link: "/tasks",
    });
    const notificationId = notif.id;

    // 2. Parametrised routes testing with Team B user
    const crossTeamRoutes = [
      { method: "get", path: `/api/v1/meetings/${meetingId}` },
      { method: "patch", path: `/api/v1/meetings/${meetingId}`, body: { title: "Hacked Title" } },
      { method: "delete", path: `/api/v1/meetings/${meetingId}` },
      { method: "post", path: `/api/v1/meetings/${meetingId}/start` },
      { method: "post", path: `/api/v1/meetings/${meetingId}/end` },
      { method: "post", path: `/api/v1/meetings/${meetingId}/ai/generate` },
      { method: "get", path: `/api/v1/meetings/${meetingId}/transcript` },
      { method: "post", path: `/api/v1/meetings/${meetingId}/transcript`, body: { text: "Pasted text" } },
      { method: "get", path: `/api/v1/meetings/${meetingId}/chat` },
      { method: "get", path: `/api/v1/meetings/${meetingId}/export?format=json` },
      { method: "patch", path: `/api/v1/tasks/${taskId}`, body: { title: "Hacked Task" } },
      { method: "delete", path: `/api/v1/tasks/${taskId}` },
      { method: "patch", path: `/api/v1/notifications/${notificationId}/read` },
      { method: "delete", path: `/api/v1/notifications/${notificationId}` },
    ] as const;

    for (const route of crossTeamRoutes) {
      let req = request(app)[route.method](route.path).set("Authorization", `Bearer ${teamB.token}`);
      if ("body" in route && route.body) {
        req = req.send(route.body);
      }
      const res = await req;

      expect(res.status, `Expected 404 for ${route.method.toUpperCase()} ${route.path}, got ${res.status}`).toBe(404);
      expect(res.body.error?.code).toBe("NOT_FOUND");
      // Must NEVER leak data
      expect(JSON.stringify(res.body)).not.toContain("Confidential");
    }

    // 3. Collection list routes must return only Team B's own data
    const teamBMeetings = await request(app)
      .get("/api/v1/meetings")
      .set("Authorization", `Bearer ${teamB.token}`);
    expect(teamBMeetings.status).toBe(200);
    expect(teamBMeetings.body.items).toHaveLength(0);

    const teamBTasks = await request(app)
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${teamB.token}`);
    expect(teamBTasks.status).toBe(200);
    expect(teamBTasks.body.items).toHaveLength(0);

    const teamBNotifications = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${teamB.token}`);
    expect(teamBNotifications.status).toBe(200);
    expect(teamBNotifications.body.items).toHaveLength(0);

    const teamBAnalytics = await request(app)
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${teamB.token}`);
    expect(teamBAnalytics.status).toBe(200);
    expect(teamBAnalytics.body.totals.meetings).toBe(0);
  });
});
