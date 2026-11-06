import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";

export class UserController {
  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.updateMe(req.user!.id, req.body);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }
}

