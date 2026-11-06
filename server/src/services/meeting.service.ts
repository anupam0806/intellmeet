import crypto from "node:crypto";
import mongoose, { type FilterQuery } from "mongoose";
import { Meeting, type IMeeting } from "../models/Meeting.js";
import { User, type UserRole } from "../models/User.js";
import { ApiError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import type {
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingQueryInput,
} from "../validators/meeting.js";

export function startAiGeneration(meetingId: string): void {
  logger.info({ meetingId }, "AI generation queued (stub for Phase P5)");
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

    // Remove associated transcripts and chat messages if those collections exist
    try {
      await mongoose.connection.collection("transcriptsegments").deleteMany({ meetingId: meeting._id });
    } catch {
      // Collection may not exist yet in P2
    }

    try {
      await mongoose.connection.collection("chatmessages").deleteMany({ meetingId: meeting._id });
    } catch {
      // Collection may not exist yet in P2
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

    startAiGeneration(meeting._id.toString());

    return { meeting: formatMeeting(meeting) };
  }
}
