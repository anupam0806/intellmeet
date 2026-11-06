import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { env } from "../config/env.js";

const REFRESH_COOKIE_NAME = "refreshToken";

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/v1/auth",
    secure: env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/v1/auth",
    secure: env.NODE_ENV === "production",
  });
}

export class AuthController {
  static async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.signup(req.body);
      setRefreshCookie(res, result.refreshTokenValue);
      res.status(201).json({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      setRefreshCookie(res, result.refreshTokenValue);
      res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async demo(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.demoLogin();
      setRefreshCookie(res, result.refreshTokenValue);
      res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const result = await AuthService.refresh(refreshToken);
      setRefreshCookie(res, result.refreshTokenValue);
      res.status(200).json({
        accessToken: result.accessToken,
      });
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      await AuthService.logout(refreshToken, req.user?.id);
      clearRefreshCookie(res);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.getMe(req.user!.id);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }
}
