import type { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notification.service.js";

export class NotificationController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await NotificationService.listNotifications(
        req.user!.id,
        req.user!.teamId,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await NotificationService.markRead(
        req.params.id as string,
        req.user!.id,
        req.user!.teamId,
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await NotificationService.markAllRead(
        req.user!.id,
        req.user!.teamId,
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
