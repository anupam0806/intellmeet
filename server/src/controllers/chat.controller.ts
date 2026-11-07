import type { Request, Response, NextFunction } from "express";
import { ChatService } from "../services/chat.service.js";
import { ApiError } from "../middleware/errorHandler.js";

export class ChatController {
  static async listChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
      }

      const rawId = req.params.id;
      const meetingId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!meetingId) {
        throw new ApiError(400, "VALIDATION_ERROR", "Meeting ID is required");
      }

      const result = await ChatService.getMeetingChat(meetingId, req.user.teamId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
