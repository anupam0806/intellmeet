import type { Server, Socket } from "socket.io";
import { ChatService } from "../services/chat.service.js";
import {
  socketChatSendSchema,
  socketChatTypingSchema,
} from "../validators/socket.js";
import { logger } from "../utils/logger.js";

const RATE_LIMIT_WINDOW_MS = 10 * 1000;
const RATE_LIMIT_MAX_MESSAGES = 20;

export function registerChatHandlers(io: Server, socket: Socket) {
  // Chat rate limiting tracking array
  const messageTimestamps: number[] = [];

  // chat:send
  socket.on(
    "chat:send",
    async (payload: unknown, callback?: (res: { ok: boolean; id?: string }) => void) => {
      const now = Date.now();
      // Remove timestamps outside the 10-second window
      while (messageTimestamps.length > 0 && (messageTimestamps[0] ?? 0) <= now - RATE_LIMIT_WINDOW_MS) {
        messageTimestamps.shift();
      }

      if (messageTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
        socket.emit("error", {
          code: "RATE_LIMITED",
          message: "Too many messages sent. Please wait a few seconds.",
        });
        return;
      }

      messageTimestamps.push(now);

      const parsed = socketChatSendSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", {
          code: "VALIDATION_ERROR",
          message: "Invalid chat message format",
        });
        return;
      }

      const meetingId = socket.data.meetingId;
      if (!meetingId) {
        socket.emit("error", {
          code: "FORBIDDEN",
          message: "Must be in a meeting room to send messages",
        });
        return;
      }

      try {
        const message = await ChatService.createMessage({
          meetingId,
          teamId: socket.data.teamId,
          senderId: socket.data.userId,
          senderName: socket.data.name,
          text: parsed.data.text,
        });

        callback?.({ ok: true, id: message.id });

        io.to(`meeting:${meetingId}`).emit("chat:message", {
          id: message.id,
          senderId: message.senderId,
          senderName: message.senderName,
          text: message.text,
          createdAt: message.createdAt,
        });
      } catch (err) {
        logger.error({ err }, "Error storing or broadcasting chat message");
        socket.emit("error", {
          code: "INTERNAL_ERROR",
          message: "Failed to send chat message",
        });
      }
    },
  );

  // chat:typing
  socket.on("chat:typing", (payload: unknown) => {
    const parsed = socketChatTypingSchema.safeParse(payload);
    if (!parsed.success) return;

    const meetingId = socket.data.meetingId;
    if (!meetingId) return;

    socket.to(`meeting:${meetingId}`).emit("chat:typing", {
      userId: socket.data.userId,
      name: socket.data.name,
      isTyping: parsed.data.isTyping,
    });
  });
}

