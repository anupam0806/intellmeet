import type { Server, Socket } from "socket.io";
import {
  socketSignalOfferSchema,
  socketSignalAnswerSchema,
  socketSignalIceSchema,
} from "../validators/socket.js";

export function registerSignalHandlers(io: Server, socket: Socket) {
  // signal:offer
  socket.on("signal:offer", (payload: unknown) => {
    const parsed = socketSignalOfferSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", {
        code: "VALIDATION_ERROR",
        message: "Invalid signal:offer payload",
      });
      return;
    }

    const { to, sdp } = parsed.data;
    const meetingId = socket.data.meetingId;
    if (!meetingId) {
      socket.emit("error", {
        code: "FORBIDDEN",
        message: "Sender must be in a meeting room",
      });
      return;
    }

    const targetSocket = io.sockets.sockets.get(to);
    if (!targetSocket || targetSocket.data.meetingId !== meetingId) {
      socket.emit("error", {
        code: "FORBIDDEN",
        message: "Target peer is not in the same meeting",
      });
      return;
    }

    io.to(to).emit("signal:offer", {
      from: socket.id,
      sdp,
    });
  });

  // signal:answer
  socket.on("signal:answer", (payload: unknown) => {
    const parsed = socketSignalAnswerSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", {
        code: "VALIDATION_ERROR",
        message: "Invalid signal:answer payload",
      });
      return;
    }

    const { to, sdp } = parsed.data;
    const meetingId = socket.data.meetingId;
    if (!meetingId) {
      socket.emit("error", {
        code: "FORBIDDEN",
        message: "Sender must be in a meeting room",
      });
      return;
    }

    const targetSocket = io.sockets.sockets.get(to);
    if (!targetSocket || targetSocket.data.meetingId !== meetingId) {
      socket.emit("error", {
        code: "FORBIDDEN",
        message: "Target peer is not in the same meeting",
      });
      return;
    }

    io.to(to).emit("signal:answer", {
      from: socket.id,
      sdp,
    });
  });

  // signal:ice
  socket.on("signal:ice", (payload: unknown) => {
    const parsed = socketSignalIceSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", {
        code: "VALIDATION_ERROR",
        message: "Invalid signal:ice payload",
      });
      return;
    }

    const { to, candidate } = parsed.data;
    const meetingId = socket.data.meetingId;
    if (!meetingId) {
      socket.emit("error", {
        code: "FORBIDDEN",
        message: "Sender must be in a meeting room",
      });
      return;
    }

    const targetSocket = io.sockets.sockets.get(to);
    if (!targetSocket || targetSocket.data.meetingId !== meetingId) {
      socket.emit("error", {
        code: "FORBIDDEN",
        message: "Target peer is not in the same meeting",
      });
      return;
    }

    io.to(to).emit("signal:ice", {
      from: socket.id,
      candidate,
    });
  });
}
