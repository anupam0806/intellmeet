import type { Request, Response, NextFunction } from "express";
import { AnalyticsService } from "../services/analytics.service.js";
import type { AnalyticsQueryInput } from "../validators/analytics.js";

export class AnalyticsController {
  static async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await AnalyticsService.getOverview(
        req.user!.teamId,
        req.query as unknown as AnalyticsQueryInput,
      );
      res.status(200).json(overview);
    } catch (error) {
      next(error);
    }
  }
}
