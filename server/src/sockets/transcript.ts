import type { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { Meeting } from "../models/Meeting.js";
import { TranscriptService } from "../services/transcript.service.js";
import { socketTranscriptSegmentSchema } from "../validators/transcript.js";
import { logger } from "../utils/logger.js";

const RATE_LIMIT_WINDOW_MS = 10 * 1000;
const RATE_LIMIT_MAX_SEGMENTS = 30;

export function registerTranscriptHandlers(io: Server, socket: Socket) {
  const segmentTimestamps: number[] = [];

  socket.on("transcript:segment", async (payload: unknown) => {
    const now = Date.now();

    // Remove timestamps outside the 10-second window
    while (
      segmentTimestamps.length > 0 &&
      (segmentTimestamps[0] ?? 0) <= now - RATE_LIMIT_WINDOW_MS
    ) {
      segmentTimestamps.shift();
    }

    if (segmentTimestamps.length >= RATE_LIMIT_MAX_SEGMENTS) {
      socket.emit("error", {
        code: "RATE_LIMITED",
        message: "Too many transcript segments",
      });
      return;
    }

    segmentTimestamps.push(now);

    const parsed = socketTranscriptSegmentSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", {
        code: "VALIDATION_ERROR",
        message: "Invalid transcript segment format",
      });
      return;
    }

    const meetingId = socket.data.meetingId;
    if (!meetingId) {
      socket.emit("error", {
        code: "FORBIDDEN",
        message: "Must be in a meeting room to send transcript segments",
      });
      return;
    }

    try {
      // Must be a LIVE meeting belonging to the socket's team
      const meeting = await Meeting.findOne({
        _id: new mongoose.Types.ObjectId(meetingId),
        teamId: new mongoose.Types.ObjectId(socket.data.teamId),
      });

      if (!meeting || meeting.status !== "LIVE") {
        socket.emit("error", {
          code: "MEETING_NOT_LIVE",
          message: "Meeting is not live",
        });
        return;
      }

      // Save segment with speaker identity strictly from the socket
      const stored = await TranscriptService.storeLiveSegment({
        meetingId,
        teamId: socket.data.teamId,
        speakerId: socket.data.userId,
        speakerName: socket.data.name,
        text: parsed.data.text,
        ts: parsed.data.ts,
      });

      // Broadcast to meeting room (Never log transcript text)
      io.to(`meeting:${meetingId}`).emit("transcript:segment", {
        id: stored.id,
        speakerId: stored.speakerId,
        speakerName: stored.speakerName,
        text: stored.text,
        ts: stored.ts,
      });
    } catch (err) {
      logger.error({ err, meetingId }, "Error handling transcript:segment");
      socket.emit("error", {
        code: "INTERNAL_ERROR",
        message: "Failed to store transcript segment",
      });
    }
  });
}

