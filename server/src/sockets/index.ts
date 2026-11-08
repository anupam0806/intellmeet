import { Server as SocketIOServer, type Server, Socket } from "socket.io";
import type http from "node:http";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { registerRoomHandlers } from "./room.js";
import { registerSignalHandlers } from "./signal.js";
import { registerChatHandlers } from "./chat.js";
import { registerTranscriptHandlers } from "./transcript.js";
import { logger } from "../utils/logger.js";

interface TokenPayload {
  userId: string;
  teamId: string;
  role: string;
}

export function createSocketServer(server: http.Server): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors:
      env.NODE_ENV === "development" || env.NODE_ENV === "test"
        ? {
            origin: true,
            credentials: true,
          }
        : undefined,
  });
  initSocketServer(io);
  return io;
}

export function initSocketServer(io: Server): void {
  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error("UNAUTHENTICATED"));
        return;
      }

      let payload: TokenPayload;
      try {
        payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
          algorithms: ["HS256"],
        }) as TokenPayload;
      } catch {
        next(new Error("UNAUTHENTICATED"));
        return;
      }

      if (!payload.userId || !payload.teamId || !payload.role) {
        next(new Error("UNAUTHENTICATED"));
        return;
      }

      // Fetch user name from DB
      const user = await User.findById(payload.userId).select("name");
      const name = user?.name || "Participant";

      socket.data = {
        userId: payload.userId,
        teamId: payload.teamId,
        role: payload.role,
        name,
      };

      next();
    } catch (err) {
      logger.error({ err }, "Socket authentication error");
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket: Socket) => {
    logger.debug({ socketId: socket.id, userId: socket.data.userId }, "Socket connected");

    // Automatically join the team room on connect
    if (socket.data.teamId) {
      socket.join(`team:${socket.data.teamId}`);
    }

    registerRoomHandlers(io, socket);
    registerSignalHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerTranscriptHandlers(io, socket);

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id, userId: socket.data.userId }, "Socket disconnected");
    });
  });
}
