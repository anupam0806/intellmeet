import type { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { Meeting } from "../models/Meeting.js";
import { env } from "../config/env.js";
import {
  socketRoomJoinSchema,
  socketRoomLeaveSchema,
  socketMediaStateSchema,
} from "../validators/socket.js";
import { logger } from "../utils/logger.js";

export function registerRoomHandlers(io: Server, socket: Socket) {
  // room:join
  socket.on("room:join", async (payload: unknown, callback?: (res: unknown) => void) => {
    try {
      const parsed = socketRoomJoinSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ ok: false, code: "NOT_FOUND" });
        return;
      }

      const { meetingId } = parsed.data;
      const teamId = socket.data.teamId;
      const userId = socket.data.userId;

      // Check meeting in DB with team tenancy
      const meeting = await Meeting.findOne({
        _id: new mongoose.Types.ObjectId(meetingId),
        teamId: new mongoose.Types.ObjectId(teamId),
      });

      if (!meeting) {
        callback?.({ ok: false, code: "NOT_FOUND" });
        return;
      }

      if (meeting.status === "ENDED") {
        callback?.({ ok: false, code: "MEETING_ENDED" });
        return;
      }

      const roomKey = `meeting:${meetingId}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(roomKey) || new Set<string>();

      // Check single active connection per user per meeting
      for (const sId of socketsInRoom) {
        const s = io.sockets.sockets.get(sId);
        if (s && s.data.userId === userId && s.id !== socket.id) {
          callback?.({ ok: false, code: "ALREADY_IN_ROOM" });
          return;
        }
      }

      // Check capacity by distinct users
      const distinctUsers = new Set<string>();
      for (const sId of socketsInRoom) {
        const s = io.sockets.sockets.get(sId);
        if (s?.data.userId) {
          distinctUsers.add(s.data.userId);
        }
      }

      if (!distinctUsers.has(userId) && distinctUsers.size >= env.MAX_PARTICIPANTS) {
        callback?.({ ok: false, code: "ROOM_FULL" });
        return;
      }

      // Meeting status checks
      if (meeting.status === "SCHEDULED") {
        const isHost = meeting.hostId.toString() === userId;
        if (!isHost) {
          callback?.({ ok: false, code: "WAITING_FOR_HOST" });
          return;
        }

        // Host starts meeting
        meeting.status = "LIVE";
        meeting.startedAt = new Date();
        await meeting.save();

        io.to(`team:${teamId}`).emit("meeting:started", { meetingId });
      }

      // Leave any prior meeting room if socket was in one
      if (socket.data.meetingId && socket.data.meetingId !== meetingId) {
        await handleLeave(io, socket, socket.data.meetingId);
      }

      // Join the socket room
      socket.join(roomKey);
      socket.data.meetingId = meetingId;
      socket.data.media = {
        audio: false,
        video: false,
        screen: false,
        captions: false,
      };

      // Add participant history entry
      await Meeting.findByIdAndUpdate(meetingId, {
        $push: {
          participants: {
            userId: new mongoose.Types.ObjectId(userId),
            name: socket.data.name,
            joinedAt: new Date(),
            captionsOn: false,
          },
        },
      });

      // Collect existing peers in the room
      const peers: Array<{
        socketId: string;
        userId: string;
        name: string;
        media: { audio: boolean; video: boolean; screen: boolean; captions: boolean };
      }> = [];

      for (const sId of socketsInRoom) {
        if (sId !== socket.id) {
          const peerSocket = io.sockets.sockets.get(sId);
          if (peerSocket?.data.userId) {
            peers.push({
              socketId: peerSocket.id,
              userId: peerSocket.data.userId,
              name: peerSocket.data.name,
              media: peerSocket.data.media || {
                audio: false,
                video: false,
                screen: false,
                captions: false,
              },
            });
          }
        }
      }

      // Broadcast peer-joined to existing peers
      socket.to(roomKey).emit("room:peer-joined", {
        socketId: socket.id,
        userId: socket.data.userId,
        name: socket.data.name,
        media: socket.data.media,
      });

      callback?.({
        ok: true,
        meeting: {
          id: meeting._id.toString(),
          status: meeting.status,
        },
        peers,
      });
    } catch (err) {
      logger.error({ err }, "Error in room:join");
      callback?.({ ok: false, code: "INTERNAL_ERROR" });
    }
  });

  // room:leave
  socket.on("room:leave", async (payload: unknown) => {
    const parsed = socketRoomLeaveSchema.safeParse(payload);
    const meetingId = parsed.success ? parsed.data.meetingId : socket.data.meetingId;
    if (meetingId) {
      await handleLeave(io, socket, meetingId);
    }
  });

  // media:state
  socket.on("media:state", async (payload: unknown) => {
    const parsed = socketMediaStateSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", {
        code: "VALIDATION_ERROR",
        message: "Invalid media:state payload",
      });
      return;
    }

    if (!socket.data.meetingId) return;

    socket.data.media = parsed.data;

    // Update captionsOn on participant record in DB
    try {
      await Meeting.updateOne(
        {
          _id: new mongoose.Types.ObjectId(socket.data.meetingId),
          "participants.userId": new mongoose.Types.ObjectId(socket.data.userId),
          "participants.leftAt": { $exists: false },
        },
        {
          $set: { "participants.$.captionsOn": parsed.data.captions },
        },
      );
    } catch (err) {
      logger.error({ err }, "Error updating captionsOn");
    }

    io.to(`meeting:${socket.data.meetingId}`).emit("media:state", {
      socketId: socket.id,
      ...parsed.data,
    });
  });

  // disconnect cleanup
  socket.on("disconnect", async () => {
    if (socket.data.meetingId) {
      await handleLeave(io, socket, socket.data.meetingId);
    }
  });
}

export async function handleLeave(io: Server, socket: Socket, meetingId: string) {
  try {
    const roomKey = `meeting:${meetingId}`;
    socket.leave(roomKey);

    const userId = socket.data.userId;
    delete socket.data.meetingId;

    if (userId) {
      // Set leftAt on open participant entry
      await Meeting.updateOne(
        {
          _id: new mongoose.Types.ObjectId(meetingId),
          "participants.userId": new mongoose.Types.ObjectId(userId),
          "participants.leftAt": { $exists: false },
        },
        {
          $set: { "participants.$.leftAt": new Date() },
        },
      );
    }

    io.to(roomKey).emit("room:peer-left", {
      socketId: socket.id,
      userId,
    });
  } catch (err) {
    logger.error({ err }, "Error in handleLeave");
  }
}
