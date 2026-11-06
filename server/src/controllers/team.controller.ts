import type { Request, Response, NextFunction } from "express";
import { TeamService } from "../services/team.service.js";

export class TeamController {
  static async getTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const team = await TeamService.getTeam(req.user!.teamId, req.user!.role);
      res.status(200).json(team);
    } catch (error) {
      next(error);
    }
  }

  static async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await TeamService.updateMemberRole(
        req.user!.teamId,
        req.params.userId as string,
        req.body.role,
      );
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async regenerateInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await TeamService.regenerateInviteCode(req.user!.teamId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

