import mongoose from "mongoose";
import { TranscriptSegment } from "../models/TranscriptSegment.js";
import { Meeting } from "../models/Meeting.js";
import { ApiError } from "../middleware/errorHandler.js";
import type { UserRole } from "../types/auth.js";
import type { GetTranscriptQuery } from "../validators/transcript.js";

export function splitTextIntoChunks(text: string, maxLen = 1000): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.length <= maxLen) {
      chunks.push(line);
      continue;
    }

    let remaining = line;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      // Find last whitespace boundary within maxLen
      let breakIdx = remaining.lastIndexOf(" ", maxLen);
      if (breakIdx <= 0) {
        // Fallback: hard slice if word exceeds maxLen
        breakIdx = maxLen;
      }

      const chunk = remaining.slice(0, breakIdx).trim();
      if (chunk) chunks.push(chunk);
      remaining = remaining.slice(breakIdx).trim();
    }
  }

  return chunks;
}

export class TranscriptService {
  static async getMeetingTranscript(meetingId: string, teamId: string, query: GetTranscriptQuery) {
    const meeting = await Meeting.findOne({
      _id: new mongoose.Types.ObjectId(meetingId),
      teamId: new mongoose.Types.ObjectId(teamId),
    });

    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    const filter = {
      meetingId: meeting._id,
      teamId: meeting.teamId,
    };

    const [segments, total] = await Promise.all([
      TranscriptSegment.find(filter)
        .sort({ ts: 1 })
        .skip(query.offset)
        .limit(query.limit),
      TranscriptSegment.countDocuments(filter),
    ]);

    const items = segments.map((s) => ({
      id: s._id.toString(),
      ...(s.speakerId ? { speakerId: s.speakerId.toString() } : {}),
      speakerName: s.speakerName,
      text: s.text,
      ts: s.ts.toISOString(),
    }));

    return {
      items,
      total,
    };
  }

  static async postMeetingTranscript(
    meetingId: string,
    userId: string,
    userRole: UserRole,
    teamId: string,
    text: string,
  ) {
    const meeting = await Meeting.findOne({
      _id: new mongoose.Types.ObjectId(meetingId),
      teamId: new mongoose.Types.ObjectId(teamId),
    });

    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    // Role check: Host or Admin only
    if (userRole !== "ADMIN" && meeting.hostId.toString() !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Only the host or an Admin can paste a transcript");
    }

    // ENDED meetings only per docs/04
    if (meeting.status !== "ENDED") {
      throw new ApiError(
        409,
        "MEETING_NOT_ENDED",
        "Transcripts can only be pasted for ended meetings",
      );
    }

    const chunks = splitTextIntoChunks(text, 1000);
    if (chunks.length === 0) {
      return { created: 0 };
    }

    const baseTime = meeting.startedAt || meeting.endedAt || new Date();
    const baseMs = baseTime.getTime();

    const docs = chunks.map((chunk, index) => ({
      meetingId: meeting._id,
      teamId: meeting.teamId,
      speakerName: "Pasted transcript",
      text: chunk,
      ts: new Date(baseMs + index * 1000),
    }));

    await TranscriptSegment.insertMany(docs);

    return { created: docs.length };
  }

  static async storeLiveSegment(data: {
    meetingId: string;
    teamId: string;
    speakerId: string;
    speakerName: string;
    text: string;
    ts: number;
  }) {
    const now = Date.now();
    // Replace ts with server time when more than 60 seconds off
    const correctedTs = Math.abs(now - data.ts) > 60_000 ? now : data.ts;

    const segment = await TranscriptSegment.create({
      meetingId: new mongoose.Types.ObjectId(data.meetingId),
      teamId: new mongoose.Types.ObjectId(data.teamId),
      speakerId: new mongoose.Types.ObjectId(data.speakerId),
      speakerName: data.speakerName,
      text: data.text,
      ts: new Date(correctedTs),
    });

    return {
      id: segment._id.toString(),
      speakerId: data.speakerId,
      speakerName: data.speakerName,
      text: segment.text,
      ts: correctedTs,
    };
  }
}

