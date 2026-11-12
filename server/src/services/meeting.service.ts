import crypto from "node:crypto";
import mongoose, { type FilterQuery } from "mongoose";
import type { Server as SocketIOServer } from "socket.io";
import { Meeting, type IMeeting } from "../models/Meeting.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { TranscriptSegment } from "../models/TranscriptSegment.js";
import { Task } from "../models/Task.js";
import { User, type UserRole } from "../models/User.js";
import { generateMeetingIntelligence } from "./ai/generate.js";
import { notifyTaskAssigned } from "./notification.service.js";
import type { FormattedTask } from "./task.service.js";
import { ApiError } from "../middleware/errorHandler.js";
import type {
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingQueryInput,
  UpdateActionItemInput,
  ConvertActionItemInput,
} from "../validators/meeting.js";

export function startAiGeneration(meetingId: string, io?: SocketIOServer): void {
  void generateMeetingIntelligence(meetingId, undefined, io);
}

export async function generateUniqueRoomCode(): Promise<string> {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.randomBytes(10);
    let code = "";
    for (let i = 0; i < 10; i++) {
      const byte = bytes[i] ?? 0;
      code += chars[byte % chars.length];
    }
    const existing = await Meeting.findOne({ roomCode: code });
    if (!existing) {
      return code;
    }
  }
  throw new ApiError(500, "INTERNAL", "Failed to generate unique room code");
}

export function formatMeeting(meeting: IMeeting, explicitHostName?: string) {
  const hostObj = meeting.hostId as unknown as { _id?: mongoose.Types.ObjectId; name?: string };
  const hostIdStr = hostObj?._id ? hostObj._id.toString() : meeting.hostId.toString();
  const hostName = explicitHostName || hostObj?.name || "Unknown";

  return {
    id: meeting._id.toString(),
    teamId: meeting.teamId.toString(),
    title: meeting.title,
    description: meeting.description,
    hostId: hostIdStr,
    hostName,
    roomCode: meeting.roomCode,
    colorIndex: meeting.colorIndex,
    status: meeting.status,
    scheduledAt: meeting.scheduledAt ? meeting.scheduledAt.toISOString() : undefined,
    startedAt: meeting.startedAt ? meeting.startedAt.toISOString() : undefined,
    endedAt: meeting.endedAt ? meeting.endedAt.toISOString() : undefined,
    durationSeconds: meeting.durationSeconds,
    participants: (meeting.participants || []).map((p) => ({
      userId: p.userId.toString(),
      name: p.name,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt ? p.leftAt.toISOString() : undefined,
      captionsOn: p.captionsOn,
    })),
    ai: {
      status: meeting.ai.status,
      summary: meeting.ai.summary,
      keyPoints: meeting.ai.keyPoints || [],
      decisions: meeting.ai.decisions || [],
      actionItems: (meeting.ai.actionItems || []).map((ai) => ({
        id: ai._id.toString(),
        title: ai.title,
        assigneeName: ai.assigneeName,
        assigneeId: ai.assigneeId ? ai.assigneeId.toString() : undefined,
        dueDate: ai.dueDate ? ai.dueDate.toISOString() : undefined,
        taskId: ai.taskId ? ai.taskId.toString() : undefined,
      })),
      provider: meeting.ai.provider,
      model: meeting.ai.model,
      generatedAt: meeting.ai.generatedAt ? meeting.ai.generatedAt.toISOString() : undefined,
      error: meeting.ai.error,
    },
    createdAt: meeting.createdAt.toISOString(),
  };
}

export class MeetingService {
  static async createMeeting(
    userId: string,
    teamId: string,
    input: CreateMeetingInput,
  ) {
    const host = await User.findOne({ _id: userId, teamId });
    if (!host) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    const meetingCount = await Meeting.countDocuments({ teamId });
    const colorIndex = meetingCount % 6;
    const roomCode = await generateUniqueRoomCode();

    const meeting = new Meeting({
      teamId,
      hostId: host._id,
      title: input.title,
      description: input.description,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      colorIndex,
      roomCode,
      status: "SCHEDULED",
      ai: {
        status: "NONE",
        keyPoints: [],
        decisions: [],
        actionItems: [],
        attempts: 0,
      },
    });

    await meeting.save();
    return formatMeeting(meeting, host.name);
  }

  static async getMeetings(teamId: string, query: MeetingQueryInput) {
    const filter: FilterQuery<IMeeting> = { teamId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) {
        filter.createdAt.$gte = new Date(query.from);
      }
      if (query.to) {
        filter.createdAt.$lte = new Date(query.to);
      }
    }

    if (query.q) {
      filter.$text = { $search: query.q };
    }

    const page = query.page || 1;
    const limit = Math.min(query.limit || 10, 50);
    const skip = (page - 1) * limit;

    const [total, meetings] = await Promise.all([
      Meeting.countDocuments(filter),
      Meeting.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("hostId", "name"),
    ]);

    const items = meetings.map((m) => {
      const hostObj = m.hostId as unknown as { _id?: mongoose.Types.ObjectId; name?: string };
      const hostIdStr = hostObj?._id ? hostObj._id.toString() : m.hostId.toString();
      const hostName = hostObj?.name || "Unknown";

      return {
        id: m._id.toString(),
        title: m.title,
        hostId: hostIdStr,
        hostName,
        colorIndex: m.colorIndex,
        status: m.status,
        scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : undefined,
        startedAt: m.startedAt ? m.startedAt.toISOString() : undefined,
        endedAt: m.endedAt ? m.endedAt.toISOString() : undefined,
        durationSeconds: m.durationSeconds,
        participantCount: m.participants?.length || 0,
        aiStatus: m.ai.status,
        actionItemCount: m.ai.actionItems?.length || 0,
      };
    });

    return {
      items,
      page,
      limit,
      total,
    };
  }

  static async getMeetingById(meetingId: string, teamId: string) {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId }).populate("hostId", "name");
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    return formatMeeting(meeting);
  }

  static async updateMeeting(
    meetingId: string,
    userId: string,
    userRole: UserRole,
    teamId: string,
    input: UpdateMeetingInput,
  ) {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId }).populate("hostId", "name");
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    const hostIdStr = (meeting.hostId as unknown as { _id: mongoose.Types.ObjectId })._id
      ? (meeting.hostId as unknown as { _id: mongoose.Types.ObjectId })._id.toString()
      : meeting.hostId.toString();

    if (userRole !== "ADMIN" && hostIdStr !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Only the host or an Admin can edit this meeting");
    }

    if (input.title !== undefined) {
      meeting.title = input.title;
    }
    if (input.description !== undefined) {
      meeting.description = input.description || undefined;
    }
    if (input.scheduledAt !== undefined) {
      meeting.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    }

    await meeting.save();
    return formatMeeting(meeting);
  }

  static async deleteMeeting(
    meetingId: string,
    userId: string,
    userRole: UserRole,
    teamId: string,
  ) {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId });
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    if (userRole !== "ADMIN" && meeting.hostId.toString() !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Only the host or an Admin can delete this meeting");
    }

    if (meeting.status === "LIVE") {
      throw new ApiError(409, "CONFLICT", "Cannot delete a meeting while it is live");
    }

    // Remove associated transcripts and chat messages
    try {
      await mongoose.connection.collection("transcriptsegments").deleteMany({ meetingId: meeting._id });
    } catch {
      // Collection may not exist yet in P3
    }

    try {
      await ChatMessage.deleteMany({ meetingId: meeting._id });
    } catch {
      // Ignore if collection not ready
    }

    // Keep converted tasks but clear their sourceMeetingId and sourceActionItemId
    try {
      await Task.updateMany(
        { sourceMeetingId: meeting._id },
        { $unset: { sourceMeetingId: "", sourceActionItemId: "" } },
      );
    } catch {
      // Ignore if Task collection not ready
    }

    await Meeting.deleteOne({ _id: meeting._id });
  }

  static async joinMeetingByRoomCode(roomCode: string, teamId: string) {
    const meeting = await Meeting.findOne({ roomCode, teamId }).populate("hostId", "name");
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    if (meeting.status === "ENDED") {
      throw new ApiError(409, "MEETING_ENDED", "This meeting has already ended");
    }

    return { meeting: formatMeeting(meeting) };
  }

  static async startMeeting(meetingId: string, userId: string, teamId: string) {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId }).populate("hostId", "name");
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    const hostIdStr = (meeting.hostId as unknown as { _id: mongoose.Types.ObjectId })._id
      ? (meeting.hostId as unknown as { _id: mongoose.Types.ObjectId })._id.toString()
      : meeting.hostId.toString();

    if (hostIdStr !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Only the host may start this meeting");
    }

    if (meeting.status === "ENDED") {
      throw new ApiError(409, "MEETING_ENDED", "This meeting has already ended");
    }

    if (meeting.status === "LIVE") {
      // Idempotent
      return { meeting: formatMeeting(meeting) };
    }

    meeting.status = "LIVE";
    meeting.startedAt = new Date();
    await meeting.save();

    return { meeting: formatMeeting(meeting) };
  }

  static async endMeeting(
    meetingId: string,
    userId: string,
    userRole: UserRole,
    teamId: string,
    io?: SocketIOServer,
  ) {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId }).populate("hostId", "name");
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    const hostIdStr = (meeting.hostId as unknown as { _id: mongoose.Types.ObjectId })._id
      ? (meeting.hostId as unknown as { _id: mongoose.Types.ObjectId })._id.toString()
      : meeting.hostId.toString();

    if (userRole !== "ADMIN" && hostIdStr !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Only the host or an Admin can end this meeting");
    }

    if (meeting.status !== "LIVE") {
      throw new ApiError(409, "MEETING_NOT_LIVE", "Cannot end a meeting that is not live");
    }

    const now = new Date();
    meeting.status = "ENDED";
    meeting.endedAt = now;

    const startedAtTime = meeting.startedAt ? meeting.startedAt.getTime() : now.getTime();
    meeting.durationSeconds = Math.max(0, Math.round((now.getTime() - startedAtTime) / 1000));
    meeting.ai.status = "PENDING";

    // Close any open participant entries
    if (meeting.participants && meeting.participants.length > 0) {
      for (const p of meeting.participants) {
        if (!p.leftAt) {
          p.leftAt = now;
        }
      }
    }

    await meeting.save();

    startAiGeneration(meeting._id.toString(), io);

    if (io) {
      const meetingIdStr = meeting._id.toString();
      const teamIdStr = meeting.teamId.toString();
      io.to(`meeting:${meetingIdStr}`).emit("meeting:ended", { meetingId: meetingIdStr });
      io.to(`team:${teamIdStr}`).emit("meeting:ended", { meetingId: meetingIdStr });
      io.in(`meeting:${meetingIdStr}`).socketsLeave(`meeting:${meetingIdStr}`);
    }

    return { meeting: formatMeeting(meeting) };
  }

  static async generateAiWriteup(
    meetingId: string,
    userId: string,
    userRole: UserRole,
    teamId: string,
    io?: SocketIOServer,
  ) {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId });
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    if (userRole !== "ADMIN" && meeting.hostId.toString() !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Only the host or an Admin can regenerate the AI write-up");
    }

    if (meeting.status !== "ENDED") {
      throw new ApiError(409, "CONFLICT", "AI write-up can only be generated for ended meetings");
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isRunActive =
      meeting.ai.status === "PENDING" &&
      meeting.ai.lockedAt &&
      meeting.ai.lockedAt > fiveMinutesAgo;

    if (isRunActive) {
      throw new ApiError(409, "AI_PENDING", "AI write-up generation is already in progress");
    }

    meeting.ai.status = "PENDING";
    meeting.ai.lockedAt = undefined;
    await meeting.save();

    startAiGeneration(meeting._id.toString(), io);

    return { status: "PENDING" as const };
  }

  static async updateActionItem(
    meetingId: string,
    itemId: string,
    userId: string,
    userRole: UserRole,
    teamId: string,
    input: UpdateActionItemInput,
  ) {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId });
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    if (userRole !== "ADMIN" && meeting.hostId.toString() !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Only the host or an Admin can edit action items");
    }

    const item = meeting.ai.actionItems.find((ai) => ai._id.toString() === itemId);
    if (!item) {
      throw new ApiError(404, "NOT_FOUND", "Action item not found");
    }

    if (item.taskId) {
      throw new ApiError(409, "ALREADY_CONVERTED", "Action item has already been converted to a task");
    }

    if (input.title !== undefined) {
      item.title = input.title;
    }

    if (input.assigneeId !== undefined) {
      if (input.assigneeId === null) {
        item.assigneeId = undefined;
        item.assigneeName = undefined;
      } else {
        const member = await User.findOne({ _id: input.assigneeId, teamId });
        if (!member) {
          throw new ApiError(404, "NOT_FOUND", "Assignee must be a member of this team");
        }
        item.assigneeId = member._id;
        item.assigneeName = member.name;
      }
    }

    if (input.dueDate !== undefined) {
      if (input.dueDate === null) {
        item.dueDate = undefined;
      } else {
        item.dueDate = new Date(input.dueDate);
      }
    }

    await meeting.save();

    return {
      item: {
        id: item._id.toString(),
        title: item.title,
        assigneeName: item.assigneeName,
        assigneeId: item.assigneeId ? item.assigneeId.toString() : undefined,
        dueDate: item.dueDate ? item.dueDate.toISOString() : undefined,
        taskId: undefined,
      },
    };
  }

  static async convertActionItemToTask(
    meetingId: string,
    itemId: string,
    userId: string,
    userRole: UserRole,
    teamId: string,
    input: ConvertActionItemInput,
    io?: SocketIOServer,
  ) {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId });
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    if (userRole !== "ADMIN" && meeting.hostId.toString() !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Only the host or an Admin can convert action items to tasks");
    }

    if (meeting.status !== "ENDED") {
      throw new ApiError(409, "CONFLICT", "Action items can only be converted for ended meetings");
    }

    const item = meeting.ai.actionItems.find((ai) => ai._id.toString() === itemId);
    if (!item) {
      throw new ApiError(404, "NOT_FOUND", "Action item not found");
    }

    if (item.taskId) {
      throw new ApiError(409, "ALREADY_CONVERTED", "Action item has already been converted to a task");
    }

    // Validate override assigneeId if provided
    let finalAssigneeId: mongoose.Types.ObjectId | undefined = item.assigneeId;
    let finalAssigneeName: string | undefined = item.assigneeName;

    if (input.assigneeId !== undefined) {
      if (input.assigneeId === null) {
        finalAssigneeId = undefined;
        finalAssigneeName = undefined;
      } else {
        const member = await User.findOne({ _id: input.assigneeId, teamId });
        if (!member) {
          throw new ApiError(400, "VALIDATION_ERROR", "Assignee must be a member of this team");
        }
        finalAssigneeId = member._id;
        finalAssigneeName = member.name;
      }
    }

    let finalDueDate: Date | undefined = item.dueDate;
    if (input.dueDate !== undefined) {
      if (input.dueDate === null) {
        finalDueDate = undefined;
      } else {
        finalDueDate = new Date(input.dueDate);
      }
    }

    // Atomic claim on the action item with a new Task ID
    const newTaskId = new mongoose.Types.ObjectId();
    const claimedMeeting = await Meeting.findOneAndUpdate(
      {
        _id: meetingId,
        teamId,
        "ai.actionItems._id": itemId,
        $or: [
          { "ai.actionItems.taskId": { $exists: false } },
          { "ai.actionItems.taskId": null },
        ],
      },
      {
        $set: { "ai.actionItems.$.taskId": newTaskId },
      },
      { new: true },
    );

    if (!claimedMeeting) {
      throw new ApiError(409, "ALREADY_CONVERTED", "Action item has already been converted to a task");
    }

    try {
      const lastTodo = await Task.findOne({ teamId, status: "TODO" }).sort({ order: -1 }).select("order");
      const order = lastTodo !== null && lastTodo !== undefined ? lastTodo.order + 1 : 0;

      const task = await Task.create({
        _id: newTaskId,
        teamId,
        title: item.title,
        status: "TODO",
        order,
        assigneeId: finalAssigneeId,
        createdBy: userId,
        dueDate: finalDueDate,
        sourceMeetingId: meeting._id,
        sourceActionItemId: item._id,
      });

      const formattedTask: FormattedTask = {
        id: task._id.toString(),
        title: task.title,
        status: task.status,
        order: task.order,
        assigneeId: task.assigneeId ? task.assigneeId.toString() : undefined,
        assigneeName: finalAssigneeName,
        createdBy: task.createdBy.toString(),
        dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
        sourceMeetingId: meeting._id.toString(),
        sourceMeetingTitle: meeting.title,
        sourceMeetingColorIndex: meeting.colorIndex,
        createdAt: task.createdAt.toISOString(),
      };

      if (task.assigneeId) {
        await notifyTaskAssigned({ ...formattedTask, teamId }, task.assigneeId.toString(), userId, io);
      }

      if (io) {
        io.to(`team:${teamId}`).emit("task:created", formattedTask);
      }

      return { task: formattedTask };
    } catch (err) {
      // Rollback claim on failure
      await Meeting.updateOne(
        { _id: meetingId, "ai.actionItems._id": itemId },
        { $unset: { "ai.actionItems.$.taskId": "" } },
      );
      throw err;
    }
  }

  static async exportMeeting(meetingId: string, teamId: string, format: "md" | "json") {
    const meeting = await Meeting.findOne({ _id: meetingId, teamId }).populate("hostId", "name");
    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    const segments = await TranscriptSegment.find({ meetingId: meeting._id, teamId }).sort({ ts: 1 });

    const safeTitle =
      (meeting.title || "meeting")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "meeting";

    const datePrefix = (meeting.startedAt || meeting.createdAt).toISOString().slice(0, 10);
    const filename = `${safeTitle}-${datePrefix}`;

    const hostName =
      (meeting.hostId as unknown as { name?: string })?.name || "Unknown";

    const participants = (meeting.participants || []).map((p) => ({
      name: p.name,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt ? p.leftAt.toISOString() : undefined,
    }));

    if (format === "json") {
      const data = {
        title: meeting.title,
        description: meeting.description || "",
        host: hostName,
        status: meeting.status,
        date: (meeting.startedAt || meeting.createdAt).toISOString(),
        durationSeconds: meeting.durationSeconds || 0,
        participants,
        summary: meeting.ai.summary || "",
        keyPoints: meeting.ai.keyPoints || [],
        decisions: meeting.ai.decisions || [],
        actionItems: (meeting.ai.actionItems || []).map((ai) => ({
          title: ai.title,
          assigneeName: ai.assigneeName || null,
          dueDate: ai.dueDate?.toISOString() ?? null,
          taskId: ai.taskId?.toString() ?? null,
        })),
        transcript: segments.map((s) => ({
          timestamp: new Date(s.ts).toISOString(),
          speaker: s.speakerName,
          text: s.text,
        })),
      };

      return {
        contentType: "application/json; charset=utf-8",
        filename: `${filename}.json`,
        content: JSON.stringify(data, null, 2),
      };
    }

    // Markdown format
    const durationText =
      meeting.durationSeconds !== undefined
        ? `${Math.floor(meeting.durationSeconds / 60)}m ${meeting.durationSeconds % 60}s`
        : "N/A";

    const participantNames =
      participants.length > 0 ? participants.map((p) => p.name).join(", ") : "None";

    const keyPointsMd =
      meeting.ai.keyPoints && meeting.ai.keyPoints.length > 0
        ? meeting.ai.keyPoints.map((kp) => `- ${kp}`).join("\n")
        : "_None recorded._";

    const decisionsMd =
      meeting.ai.decisions && meeting.ai.decisions.length > 0
        ? meeting.ai.decisions.map((d) => `- ${d}`).join("\n")
        : "_None recorded._";

    const actionItemsMd =
      meeting.ai.actionItems && meeting.ai.actionItems.length > 0
        ? meeting.ai.actionItems
            .map((ai) => {
              const assignee = ai.assigneeName ? ` (Assignee: ${ai.assigneeName})` : "";
              const due = ai.dueDate ? ` [Due: ${ai.dueDate.toISOString().slice(0, 10)}]` : "";
              return `- [ ] ${ai.title}${assignee}${due}`;
            })
            .join("\n")
        : "_None recorded._";

    const transcriptMd =
      segments.length > 0
        ? segments
            .map((s) => {
              const d = new Date(s.ts);
              const hh = String(d.getUTCHours()).padStart(2, "0");
              const mm = String(d.getUTCMinutes()).padStart(2, "0");
              return `**[${hh}:${mm}] ${s.speakerName}:** ${s.text}`;
            })
            .join("\n\n")
        : "_No transcript recorded._";

    const mdLines = [
      `# ${meeting.title}`,
      "",
      `**Host:** ${hostName}  `,
      `**Date:** ${(meeting.startedAt || meeting.createdAt).toISOString().slice(0, 10)}  `,
      `**Duration:** ${durationText}  `,
      `**Participants:** ${participantNames}`,
      "",
      "## Summary",
      "",
      meeting.ai.summary || "_No summary available._",
      "",
      "## Key Points",
      "",
      keyPointsMd,
      "",
      "## Decisions",
      "",
      decisionsMd,
      "",
      "## Action Items",
      "",
      actionItemsMd,
      "",
      "## Transcript",
      "",
      transcriptMd,
      "",
    ];

    return {
      contentType: "text/markdown; charset=utf-8",
      filename: `${filename}.md`,
      content: mdLines.join("\n"),
    };
  }
}
