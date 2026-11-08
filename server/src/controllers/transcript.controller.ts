import type { Request, Response, NextFunction } from "express";
import { TranscriptService } from "../services/transcript.service.js";
import { getTranscriptQuerySchema, postTranscriptBodySchema } from "../validators/transcript.js";

export class TranscriptController {
  static async getTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meetingId = req.params.id as string;
      const query = getTranscriptQuerySchema.parse(req.query);
      const result = await TranscriptService.getMeetingTranscript(
        meetingId,
        req.user!.teamId,
        query,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async postTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meetingId = req.params.id as string;
      const body = postTranscriptBodySchema.parse(req.body);
      const result = await TranscriptService.postMeetingTranscript(
        meetingId,
        req.user!.id,
        req.user!.role,
        req.user!.teamId,
        body.text,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}

