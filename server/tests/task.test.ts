import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Task } from "../src/models/Task.js";
import { Meeting } from "../src/models/Meeting.js";
import { Team } from "../src/models/Team.js";

describe("Phase P6: Tasks Management and Action Item Conversion", () => {
  const app = createApp();

  // Helper to create team and admin user
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

  // Helper to add member with invite code
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

  describe("Task CRUD and Permissions (docs/04 section 2 & 6)", () => {
    it("enforces permissions for Admin and Member on create, edit, move, delete", async () => {
      const admin = await createTeamWithAdmin("Perms");
      const team = await Team.findById(admin.user.teamId);
      const member1 = await addMember("M1", team!.inviteCode);
      const member2 = await addMember("M2", team!.inviteCode);

      // 1. Both Admin and Member can create tasks
      const m1TaskRes = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${member1.token}`)
        .send({
          title: "Task created by M1",
          description: "M1's initial task",
          status: "TODO",
        });
      expect(m1TaskRes.status).toBe(201);
      const m1Task = m1TaskRes.body;
      expect(m1Task.title).toBe("Task created by M1");
      expect(m1Task.order).toBe(0);

      // 2. Member can edit task they created
      const m1EditRes = await request(app)
        .patch(`/api/v1/tasks/${m1Task.id}`)
        .set("Authorization", `Bearer ${member1.token}`)
        .send({
          title: "Updated by M1",
        });
      expect(m1EditRes.status).toBe(200);
      expect(m1EditRes.body.title).toBe("Updated by M1");

      // 3. Member 2 CAN edit/move an unassigned task
      const m2EditUnassignedRes = await request(app)
        .patch(`/api/v1/tasks/${m1Task.id}`)
        .set("Authorization", `Bearer ${member2.token}`)
        .send({
          assigneeId: member2.user.id,
        });
      expect(m2EditUnassignedRes.status).toBe(200);
      expect(m2EditUnassignedRes.body.assigneeId).toBe(member2.user.id);

      // 4. Now that task is assigned to M2, M2 can edit it
      const m2EditAssignedRes = await request(app)
        .patch(`/api/v1/tasks/${m1Task.id}`)
        .set("Authorization", `Bearer ${member2.token}`)
        .send({
          status: "IN_PROGRESS",
        });
      expect(m2EditAssignedRes.status).toBe(200);
      expect(m2EditAssignedRes.body.status).toBe("IN_PROGRESS");

      // 5. Create a task by Admin assigned to Member 1
      const adminTaskRes = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          title: "Admin task for M1",
          assigneeId: member1.user.id,
        });
      const adminTask = adminTaskRes.body;

      // 6. Member 2 tries to edit Admin's task assigned to Member 1 -> 403 FORBIDDEN
      const m2ForbiddenEdit = await request(app)
        .patch(`/api/v1/tasks/${adminTask.id}`)
        .set("Authorization", `Bearer ${member2.token}`)
        .send({
          title: "Unauthorized edit",
        });
      expect(m2ForbiddenEdit.status).toBe(403);

      // 7. Member 1 tries to delete Admin's task assigned to Member 1 -> 403 FORBIDDEN (can edit, but cannot delete)
      const m1ForbiddenDelete = await request(app)
        .delete(`/api/v1/tasks/${adminTask.id}`)
        .set("Authorization", `Bearer ${member1.token}`);
      expect(m1ForbiddenDelete.status).toBe(403);

      // 8. Admin CAN edit and delete any task
      const adminEditRes = await request(app)
        .patch(`/api/v1/tasks/${m1Task.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          title: "Admin override title",
        });
      expect(adminEditRes.status).toBe(200);

      const adminDeleteRes = await request(app)
        .delete(`/api/v1/tasks/${adminTask.id}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(adminDeleteRes.status).toBe(204);

      // 9. Member 1 CAN delete the task they created
      const m1DeleteRes = await request(app)
        .delete(`/api/v1/tasks/${m1Task.id}`)
        .set("Authorization", `Bearer ${member1.token}`);
      expect(m1DeleteRes.status).toBe(204);
    });

    it("rejects invalid assignee outside the team with 400 VALIDATION_ERROR", async () => {
      const teamA = await createTeamWithAdmin("TeamA");
      const teamB = await createTeamWithAdmin("TeamB");

      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${teamA.token}`)
        .send({
          title: "Cross team task",
          assigneeId: teamB.user.id,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Ordering and Single bulkWrite Renumbering", () => {
    it("renumbers column contiguously on position change within column and column change", async () => {
      const admin = await createTeamWithAdmin("OrderTeam");

      // Create 3 tasks in TODO: T0, T1, T2
      const t0Res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ title: "Task 0", status: "TODO" });
      const t1Res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ title: "Task 1", status: "TODO" });
      const t2Res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ title: "Task 2", status: "TODO" });

      expect(t0Res.body.order).toBe(0);
      expect(t1Res.body.order).toBe(1);
      expect(t2Res.body.order).toBe(2);

      // Move T2 to position 0 within TODO: order should become T2 (0), T0 (1), T1 (2)
      const moveWithin = await request(app)
        .patch(`/api/v1/tasks/${t2Res.body.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ position: 0 });
      expect(moveWithin.status).toBe(200);
      expect(moveWithin.body.order).toBe(0);

      const listAfterWithin = await request(app)
        .get("/api/v1/tasks?status=TODO")
        .set("Authorization", `Bearer ${admin.token}`);
      const todoItems = listAfterWithin.body.items;
      expect(todoItems[0].id).toBe(t2Res.body.id);
      expect(todoItems[0].order).toBe(0);
      expect(todoItems[1].id).toBe(t0Res.body.id);
      expect(todoItems[1].order).toBe(1);
      expect(todoItems[2].id).toBe(t1Res.body.id);
      expect(todoItems[2].order).toBe(2);

      // Move T0 to IN_PROGRESS at position 0
      const moveToProgress = await request(app)
        .patch(`/api/v1/tasks/${t0Res.body.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "IN_PROGRESS", position: 0 });
      expect(moveToProgress.status).toBe(200);
      expect(moveToProgress.body.status).toBe("IN_PROGRESS");
      expect(moveToProgress.body.order).toBe(0);

      // Verify TODO remaining items (T2, T1) are renumbered 0, 1
      const listTodoRemaining = await request(app)
        .get("/api/v1/tasks?status=TODO")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(listTodoRemaining.body.items).toHaveLength(2);
      expect(listTodoRemaining.body.items[0].id).toBe(t2Res.body.id);
      expect(listTodoRemaining.body.items[0].order).toBe(0);
      expect(listTodoRemaining.body.items[1].id).toBe(t1Res.body.id);
      expect(listTodoRemaining.body.items[1].order).toBe(1);

      // Move T0 to DONE: completedAt should be set
      const moveToDone = await request(app)
        .patch(`/api/v1/tasks/${t0Res.body.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "DONE" });
      expect(moveToDone.status).toBe(200);
      expect(moveToDone.body.status).toBe("DONE");
      expect(moveToDone.body.completedAt).toBeDefined();

      // Move T0 back to TODO: completedAt should be cleared
      const moveBack = await request(app)
        .patch(`/api/v1/tasks/${t0Res.body.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "TODO" });
      expect(moveBack.status).toBe(200);
      expect(moveBack.body.status).toBe("TODO");
      expect(moveBack.body.completedAt).toBeUndefined();
    });
  });

  describe("Task Filters (status, assigneeId, q)", () => {
    it("filters correctly by status, assigneeId (including unassigned), and regex-escaped q", async () => {
      const admin = await createTeamWithAdmin("FilterTeam");
      const team = await Team.findById(admin.user.teamId);
      const member = await addMember("FilterMember", team!.inviteCode);

      // Create test tasks
      await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          title: "Fix crash on payment [urgent]",
          description: "Timeout on checkout stripe gateway",
          status: "TODO",
          assigneeId: member.user.id,
        });

      await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          title: "Refactor database schema",
          description: "Clean up indexes",
          status: "IN_PROGRESS",
        }); // unassigned

      // Filter by status
      const resStatus = await request(app)
        .get("/api/v1/tasks?status=IN_PROGRESS")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(resStatus.body.items).toHaveLength(1);
      expect(resStatus.body.items[0].title).toBe("Refactor database schema");

      // Filter by unassigned
      const resUnassigned = await request(app)
        .get("/api/v1/tasks?assigneeId=unassigned")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(resUnassigned.body.items).toHaveLength(1);
      expect(resUnassigned.body.items[0].assigneeId).toBeUndefined();

      // Filter by assigneeId
      const resAssigned = await request(app)
        .get(`/api/v1/tasks?assigneeId=${member.user.id}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(resAssigned.body.items).toHaveLength(1);
      expect(resAssigned.body.items[0].assigneeName).toBe(member.user.name);

      // Filter by q with special regex chars [urgent]
      const resQ = await request(app)
        .get("/api/v1/tasks?q=[urgent]")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(resQ.body.items).toHaveLength(1);
      expect(resQ.body.items[0].title).toContain("[urgent]");

      // Filter by q matching description
      const resQDesc = await request(app)
        .get("/api/v1/tasks?q=stripe gateway")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(resQDesc.body.items).toHaveLength(1);
      expect(resQDesc.body.items[0].title).toContain("payment");
    });
  });

  describe("Action Item Conversion (POST /meetings/:id/action-items/:itemId/convert)", () => {
    it("converts an action item atomically, prevents double conversion, and rolls back on failure", async () => {
      const admin = await createTeamWithAdmin("ConvertTeam");
      const team = await Team.findById(admin.user.teamId);
      const member = await addMember("ConvMember", team!.inviteCode);

      const actionItemId = new mongoose.Types.ObjectId();
      const meeting = await Meeting.create({
        teamId: admin.user.teamId,
        title: "Triage Meeting",
        hostId: admin.user.id,
        roomCode: "triage001a",
        colorIndex: 2,
        status: "ENDED",
        endedAt: new Date(),
        ai: {
          status: "READY",
          summary: "Triage meeting summary.",
          keyPoints: ["Point 1"],
          decisions: ["Decision 1"],
          actionItems: [
            {
              _id: actionItemId,
              title: "Deploy hotfix to staging",
              assigneeId: member.user.id,
              assigneeName: member.user.name,
              dueDate: new Date(Date.now() + 86400000),
            },
          ],
          attempts: 1,
        },
      });

      // 1. Non-host Member attempting conversion -> 403 FORBIDDEN
      const forbiddenRes = await request(app)
        .post(`/api/v1/meetings/${meeting._id}/action-items/${actionItemId}/convert`)
        .set("Authorization", `Bearer ${member.token}`)
        .send({});
      expect(forbiddenRes.status).toBe(403);

      // 2. Successful conversion by host/Admin -> 201 with { task }
      const convertRes = await request(app)
        .post(`/api/v1/meetings/${meeting._id}/action-items/${actionItemId}/convert`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          dueDate: "2026-11-20",
        });
      expect(convertRes.status).toBe(201);
      expect(convertRes.body.task).toBeDefined();
      const createdTask = convertRes.body.task;
      expect(createdTask.title).toBe("Deploy hotfix to staging");
      expect(createdTask.status).toBe("TODO");
      expect(createdTask.sourceMeetingId).toBe(meeting._id.toString());
      expect(createdTask.sourceMeetingTitle).toBe("Triage Meeting");
      expect(createdTask.sourceMeetingColorIndex).toBe(2);

      // 3. Second attempt to convert the same item -> 409 ALREADY_CONVERTED
      const duplicateRes = await request(app)
        .post(`/api/v1/meetings/${meeting._id}/action-items/${actionItemId}/convert`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({});
      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error.code).toBe("ALREADY_CONVERTED");

      // 4. Verify Meeting action item has taskId set
      const updatedMeeting = await Meeting.findById(meeting._id);
      const convertedItem = updatedMeeting?.ai.actionItems.find(
        (i) => i._id.toString() === actionItemId.toString(),
      );
      expect(convertedItem?.taskId?.toString()).toBe(createdTask.id);

      // 5. Test Rollback: create another item and simulate failure with invalid assigneeId
      const item2Id = new mongoose.Types.ObjectId();
      await Meeting.updateOne(
        { _id: meeting._id },
        {
          $push: {
            "ai.actionItems": {
              _id: item2Id,
              title: "Item destined to fail conversion",
            },
          },
        },
      );

      const foreignId = new mongoose.Types.ObjectId().toString();
      const failRes = await request(app)
        .post(`/api/v1/meetings/${meeting._id}/action-items/${item2Id}/convert`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          assigneeId: foreignId, // not in team -> 400 VALIDATION_ERROR
        });
      expect(failRes.status).toBe(400);

      // Verify that after rollback, item2 is NOT marked converted and can be converted again
      const meetingAfterFail = await Meeting.findById(meeting._id);
      const failedItem = meetingAfterFail?.ai.actionItems.find(
        (i) => i._id.toString() === item2Id.toString(),
      );
      expect(failedItem?.taskId).toBeUndefined();

      // Now convert item2 properly -> succeeds
      const retryRes = await request(app)
        .post(`/api/v1/meetings/${meeting._id}/action-items/${item2Id}/convert`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          assigneeId: member.user.id,
        });
      expect(retryRes.status).toBe(201);
    });
  });

  describe("Clearing References on Delete (docs/03 section 3)", () => {
    it("clears sourceMeetingId on task when meeting is deleted, and clears taskId on item when task is deleted", async () => {
      const admin = await createTeamWithAdmin("CleanRefTeam");

      const actionItemId = new mongoose.Types.ObjectId();
      const meeting = await Meeting.create({
        teamId: admin.user.teamId,
        title: "Meeting to Delete",
        hostId: admin.user.id,
        roomCode: "delmeet001",
        colorIndex: 1,
        status: "ENDED",
        endedAt: new Date(),
        ai: {
          status: "READY",
          summary: "Summary text",
          keyPoints: [],
          decisions: [],
          actionItems: [
            {
              _id: actionItemId,
              title: "Action item link test",
            },
          ],
          attempts: 1,
        },
      });

      // Convert to task
      const convRes = await request(app)
        .post(`/api/v1/meetings/${meeting._id}/action-items/${actionItemId}/convert`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({});
      expect(convRes.status).toBe(201);
      const taskId = convRes.body.task.id;

      // 1. Delete Task -> clears taskId on Meeting action item
      const delTaskRes = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(delTaskRes.status).toBe(204);

      const meetingAfterTaskDel = await Meeting.findById(meeting._id);
      const itemAfterTaskDel = meetingAfterTaskDel?.ai.actionItems.find(
        (i) => i._id.toString() === actionItemId.toString(),
      );
      expect(itemAfterTaskDel?.taskId).toBeUndefined();

      // Convert again since it was cleared
      const conv2Res = await request(app)
        .post(`/api/v1/meetings/${meeting._id}/action-items/${actionItemId}/convert`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({});
      expect(conv2Res.status).toBe(201);
      const task2Id = conv2Res.body.task.id;

      // 2. Delete Meeting -> keeps Task, unsets sourceMeetingId and sourceActionItemId
      const delMeetingRes = await request(app)
        .delete(`/api/v1/meetings/${meeting._id}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(delMeetingRes.status).toBe(204);

      const taskAfterMeetingDel = await Task.findById(task2Id);
      expect(taskAfterMeetingDel).not.toBeNull();
      expect(taskAfterMeetingDel?.sourceMeetingId).toBeUndefined();
      expect(taskAfterMeetingDel?.sourceActionItemId).toBeUndefined();
    });
  });

  describe("Real-time Socket Events (task:created, task:updated, task:deleted)", () => {
    it("emits events to team room on task operations", async () => {
      const mockIo = {
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      };

      const admin = await createTeamWithAdmin("SocketTeam");
      const appWithMockIo = createApp();
      appWithMockIo.set("io", mockIo);

      // Create task
      const createRes = await request(appWithMockIo)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ title: "Socket Task" });
      expect(createRes.status).toBe(201);
      expect(mockIo.to).toHaveBeenCalledWith(`team:${admin.user.teamId}`);
      expect(mockIo.emit).toHaveBeenCalledWith("task:created", expect.objectContaining({ title: "Socket Task" }));

      // Update task
      const updateRes = await request(appWithMockIo)
        .patch(`/api/v1/tasks/${createRes.body.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ title: "Socket Task Updated" });
      expect(updateRes.status).toBe(200);
      expect(mockIo.emit).toHaveBeenCalledWith("task:updated", expect.objectContaining({ title: "Socket Task Updated" }));

      // Delete task
      const deleteRes = await request(appWithMockIo)
        .delete(`/api/v1/tasks/${createRes.body.id}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(deleteRes.status).toBe(204);
      expect(mockIo.emit).toHaveBeenCalledWith("task:deleted", { id: createRes.body.id });
    });
  });
});
