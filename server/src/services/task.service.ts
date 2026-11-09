import type mongoose from "mongoose";
import type { SocketIOServer } from "socket.io";
import { Task, type TaskStatus } from "../models/Task.js";
import { User } from "../models/User.js";
import { Meeting } from "../models/Meeting.js";
import { notifyTaskAssigned } from "./notification.service.js";
import { ApiError } from "../middleware/errorHandler.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskQueryInput,
} from "../validators/task.js";

export interface FormattedTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  order: number;
  assigneeId?: string;
  assigneeName?: string;
  createdBy: string;
  dueDate?: string;
  sourceMeetingId?: string;
  sourceMeetingTitle?: string;
  sourceMeetingColorIndex?: number;
  completedAt?: string;
  createdAt: string;
}

export class TaskService {
  static async listTasks(
    teamId: string,
    query: TaskQueryInput,
  ): Promise<{ items: FormattedTask[] }> {
    const filter: Record<string, unknown> = { teamId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.assigneeId !== undefined) {
      if (query.assigneeId === "unassigned") {
        filter.$or = [{ assigneeId: { $exists: false } }, { assigneeId: null }];
      } else {
        filter.assigneeId = query.assigneeId;
      }
    }

    if (query.q && query.q.trim()) {
      const cleanQ = query.q.trim().slice(0, 100);
      const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: escaped, $options: "i" };
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: [{ title: regex }, { description: regex }] },
        ];
        delete filter.$or;
      } else {
        filter.$or = [{ title: regex }, { description: regex }];
      }
    }

    const tasks = await Task.find(filter).lean();

    // Map status priority: TODO (0), IN_PROGRESS (1), DONE (2)
    const statusPriority: Record<string, number> = {
      TODO: 0,
      IN_PROGRESS: 1,
      DONE: 2,
    };

    tasks.sort((a, b) => {
      const prioA = statusPriority[a.status] ?? 0;
      const prioB = statusPriority[b.status] ?? 0;
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      return a.order - b.order;
    });

    const assigneeIds = Array.from(
      new Set(tasks.map((t) => t.assigneeId?.toString()).filter(Boolean) as string[]),
    );
    const meetingIds = Array.from(
      new Set(tasks.map((t) => t.sourceMeetingId?.toString()).filter(Boolean) as string[]),
    );

    const [users, meetings] = await Promise.all([
      assigneeIds.length > 0
        ? User.find({ _id: { $in: assigneeIds } })
            .select("name")
            .lean()
        : [],
      meetingIds.length > 0
        ? Meeting.find({ _id: { $in: meetingIds } })
            .select("title colorIndex")
            .lean()
        : [],
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));
    const meetingMap = new Map(
      meetings.map((m) => [m._id.toString(), { title: m.title, colorIndex: m.colorIndex }]),
    );

    const items: FormattedTask[] = tasks.map((task) => {
      const meetingInfo = task.sourceMeetingId
        ? meetingMap.get(task.sourceMeetingId.toString())
        : undefined;
      return {
        id: task._id.toString(),
        title: task.title,
        description: task.description || undefined,
        status: task.status,
        order: task.order,
        assigneeId: task.assigneeId ? task.assigneeId.toString() : undefined,
        assigneeName: task.assigneeId ? userMap.get(task.assigneeId.toString()) : undefined,
        createdBy: task.createdBy.toString(),
        dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
        sourceMeetingId: task.sourceMeetingId ? task.sourceMeetingId.toString() : undefined,
        sourceMeetingTitle: meetingInfo?.title,
        sourceMeetingColorIndex: meetingInfo?.colorIndex,
        completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
        createdAt: task.createdAt.toISOString(),
      };
    });

    return { items };
  }

  static async createTask(
    teamId: string,
    userId: string,
    input: CreateTaskInput,
    io?: SocketIOServer,
  ): Promise<FormattedTask> {
    if (input.assigneeId) {
      const assignee = await User.findOne({ _id: input.assigneeId, teamId });
      if (!assignee) {
        throw new ApiError(400, "VALIDATION_ERROR", "Assignee must be a member of the team");
      }
    }

    const status = input.status || "TODO";
    const lastTask = await Task.findOne({ teamId, status }).sort({ order: -1 }).select("order");
    const order = lastTask !== null && lastTask !== undefined ? lastTask.order + 1 : 0;

    const task = await Task.create({
      teamId,
      title: input.title,
      description: input.description,
      status,
      order,
      assigneeId: input.assigneeId || undefined,
      createdBy: userId,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      completedAt: status === "DONE" ? new Date() : undefined,
    });

    let assigneeName: string | undefined;
    if (task.assigneeId) {
      const user = await User.findById(task.assigneeId).select("name").lean();
      assigneeName = user?.name;
    }

    const formatted: FormattedTask = {
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      status: task.status,
      order: task.order,
      assigneeId: task.assigneeId ? task.assigneeId.toString() : undefined,
      assigneeName,
      createdBy: task.createdBy.toString(),
      dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
      completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
      createdAt: task.createdAt.toISOString(),
    };

    if (task.assigneeId) {
      notifyTaskAssigned(formatted, task.assigneeId.toString());
    }

    if (io) {
      io.to(`team:${teamId}`).emit("task:created", formatted);
    }

    return formatted;
  }

  static async updateTask(
    taskId: string,
    teamId: string,
    userId: string,
    userRole: string,
    input: UpdateTaskInput,
    io?: SocketIOServer,
  ): Promise<FormattedTask> {
    const task = await Task.findOne({ _id: taskId, teamId });
    if (!task) {
      throw new ApiError(404, "NOT_FOUND", "Task not found");
    }

    // Permissions check:
    // Admin may edit/move any task.
    // Member may edit/move tasks they created, tasks assigned to them, and unassigned tasks.
    if (userRole !== "ADMIN") {
      const isCreator = task.createdBy.toString() === userId;
      const isAssignee = task.assigneeId?.toString() === userId;
      const isUnassigned = !task.assigneeId;

      if (!isCreator && !isAssignee && !isUnassigned) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "You do not have permission to edit or move this task",
        );
      }
    }

    // Validate assignee if changed
    if (input.assigneeId) {
      const assignee = await User.findOne({ _id: input.assigneeId, teamId });
      if (!assignee) {
        throw new ApiError(400, "VALIDATION_ERROR", "Assignee must be a member of the team");
      }
    }

    const oldAssigneeId = task.assigneeId?.toString();
    const newAssigneeId =
      input.assigneeId !== undefined
        ? input.assigneeId || undefined
        : oldAssigneeId;

    const fromStatus = task.status;
    const toStatus = input.status || fromStatus;
    const isStatusChange = fromStatus !== toStatus;
    const isPositionChange = input.position !== undefined;

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description || undefined;
    if (input.assigneeId !== undefined) {
      task.assigneeId = input.assigneeId
        ? (input.assigneeId as unknown as mongoose.Types.ObjectId)
        : undefined;
    }
    if (input.dueDate !== undefined) {
      task.dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
    }

    if (toStatus === "DONE" && fromStatus !== "DONE") {
      task.completedAt = new Date();
    } else if (toStatus !== "DONE") {
      task.completedAt = undefined;
    }
    task.status = toStatus;

    if (isStatusChange) {
      const sourceTasks = await Task.find({
        teamId,
        status: fromStatus,
        _id: { $ne: task._id },
      }).sort({ order: 1, createdAt: 1 });

      const targetTasks = await Task.find({
        teamId,
        status: toStatus,
      }).sort({ order: 1, createdAt: 1 });

      const targetPos = Math.max(
        0,
        Math.min(input.position ?? targetTasks.length, targetTasks.length),
      );
      targetTasks.splice(targetPos, 0, task);

      const bulkOps = [
        ...sourceTasks.map((t, idx) => ({
          updateOne: {
            filter: { _id: t._id },
            update: { $set: { order: idx } },
          },
        })),
        ...targetTasks.map((t, idx) => {
          if (t._id.toString() === taskId) {
            return {
              updateOne: {
                filter: { _id: t._id },
                update: {
                  $set: {
                    status: toStatus,
                    order: idx,
                    title: task.title,
                    description: task.description,
                    assigneeId: task.assigneeId,
                    dueDate: task.dueDate,
                    completedAt: task.completedAt,
                  },
                },
              },
            };
          }
          return {
            updateOne: {
              filter: { _id: t._id },
              update: { $set: { order: idx } },
            },
          };
        }),
      ];

      task.order = targetPos;
      await Task.bulkWrite(bulkOps);
    } else if (isPositionChange) {
      const colTasks = await Task.find({
        teamId,
        status: fromStatus,
      }).sort({ order: 1, createdAt: 1 });

      const filtered = colTasks.filter((t) => t._id.toString() !== taskId);
      const targetPos = Math.max(0, Math.min(input.position!, filtered.length));
      filtered.splice(targetPos, 0, task);

      const bulkOps = filtered.map((t, idx) => {
        if (t._id.toString() === taskId) {
          return {
            updateOne: {
              filter: { _id: t._id },
              update: {
                $set: {
                  order: idx,
                  title: task.title,
                  description: task.description,
                  assigneeId: task.assigneeId,
                  dueDate: task.dueDate,
                  completedAt: task.completedAt,
                },
              },
            },
          };
        }
        return {
          updateOne: {
            filter: { _id: t._id },
            update: { $set: { order: idx } },
          },
        };
      });

      task.order = targetPos;
      await Task.bulkWrite(bulkOps);
    } else {
      await task.save();
    }

    let assigneeName: string | undefined;
    if (task.assigneeId) {
      const user = await User.findById(task.assigneeId).select("name").lean();
      assigneeName = user?.name;
    }
    let sourceMeetingTitle: string | undefined;
    let sourceMeetingColorIndex: number | undefined;
    if (task.sourceMeetingId) {
      const m = await Meeting.findById(task.sourceMeetingId)
        .select("title colorIndex")
        .lean();
      sourceMeetingTitle = m?.title;
      sourceMeetingColorIndex = m?.colorIndex;
    }

    const formatted: FormattedTask = {
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      status: task.status,
      order: task.order,
      assigneeId: task.assigneeId ? task.assigneeId.toString() : undefined,
      assigneeName,
      createdBy: task.createdBy.toString(),
      dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
      sourceMeetingId: task.sourceMeetingId ? task.sourceMeetingId.toString() : undefined,
      sourceMeetingTitle,
      sourceMeetingColorIndex,
      completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
      createdAt: task.createdAt.toISOString(),
    };

    if (newAssigneeId && newAssigneeId !== oldAssigneeId) {
      notifyTaskAssigned(formatted, newAssigneeId);
    }

    if (io) {
      io.to(`team:${teamId}`).emit("task:updated", formatted);
    }

    return formatted;
  }

  static async deleteTask(
    taskId: string,
    teamId: string,
    userId: string,
    userRole: string,
    io?: SocketIOServer,
  ): Promise<void> {
    const task = await Task.findOne({ _id: taskId, teamId });
    if (!task) {
      throw new ApiError(404, "NOT_FOUND", "Task not found");
    }

    if (userRole !== "ADMIN" && task.createdBy.toString() !== userId) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only an Admin or the creator can delete this task",
      );
    }

    if (task.sourceMeetingId && task.sourceActionItemId) {
      try {
        await Meeting.updateOne(
          {
            _id: task.sourceMeetingId,
            "ai.actionItems._id": task.sourceActionItemId,
          },
          {
            $unset: { "ai.actionItems.$.taskId": "" },
          },
        );
      } catch {
        // Ignore meeting update errors
      }
    }

    const colStatus = task.status;
    await Task.deleteOne({ _id: task._id });

    const remaining = await Task.find({
      teamId,
      status: colStatus,
    }).sort({ order: 1, createdAt: 1 });

    if (remaining.length > 0) {
      const bulkOps = remaining.map((t, idx) => ({
        updateOne: {
          filter: { _id: t._id },
          update: { $set: { order: idx } },
        },
      }));
      await Task.bulkWrite(bulkOps);
    }

    if (io) {
      io.to(`team:${teamId}`).emit("task:deleted", { id: taskId });
    }
  }
}
