import type { Request, Response, NextFunction } from "express";
import { MeetingService } from "../services/meeting.service.js";
import type { MeetingQueryInput } from "../validators/meeting.js";

export class MeetingController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meeting = await MeetingService.createMeeting(
        req.user!.id,
        req.user!.teamId,
        req.body,
      );
      res.status(201).json(meeting);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MeetingService.getMeetings(
        req.user!.teamId,
        req.query as unknown as MeetingQueryInput,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meeting = await MeetingService.getMeetingById(
        req.params.id as string,
        req.user!.teamId,
      );
      res.status(200).json(meeting);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meeting = await MeetingService.updateMeeting(
        req.params.id as string,
        req.user!.id,
        req.user!.role,
        req.user!.teamId,
        req.body,
      );
      res.status(200).json(meeting);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await MeetingService.deleteMeeting(
        req.params.id as string,
        req.user!.id,
        req.user!.role,
        req.user!.teamId,
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  static async join(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MeetingService.joinMeetingByRoomCode(
        req.body.roomCode as string,
        req.user!.teamId,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MeetingService.startMeeting(
        req.params.id as string,
        req.user!.id,
        req.user!.teamId,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async end(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const io = req.app.get("io");
      const result = await MeetingService.endMeeting(
        req.params.id as string,
        req.user!.id,
        req.user!.role,
        req.user!.teamId,
        io,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async generateAi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const io = req.app.get("io");
      const result = await MeetingService.generateAiWriteup(
        req.params.id as string,
        req.user!.id,
        req.user!.role,
        req.user!.teamId,
        io,
      );
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async updateActionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MeetingService.updateActionItem(
        req.params.id as string,
        req.params.itemId as string,
        req.user!.id,
        req.user!.role,
        req.user!.teamId,
        req.body,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async convertActionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const io = req.app.get("io");
      const result = await MeetingService.convertActionItemToTask(
        req.params.id as string,
        req.params.itemId as string,
        req.user!.id,
        req.user!.role,
        req.user!.teamId,
        req.body,
        io,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async export(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as "md" | "json") || "md";
      const result = await MeetingService.exportMeeting(
        req.params.id as string,
        req.user!.teamId,
        format,
      );
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.status(200).send(result.content);
    } catch (error) {
      next(error);
    }
  }
}

