import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./errorHandler.js";
import { UserRole } from "../models/User.js";

interface AccessTokenPayload {
  userId: string;
  teamId: string;
  role: UserRole;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (!payload.userId || !payload.teamId || !payload.role) {
      next(new ApiError(401, "UNAUTHENTICATED", "Invalid authentication token"));
      return;
    }

    req.user = {
      id: payload.userId,
      teamId: payload.teamId,
      role: payload.role,
    };
    next();
  } catch {
    next(new ApiError(401, "UNAUTHENTICATED", "Invalid or expired token"));
  }
}

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
      return;
    }

    if (req.user.role !== role) {
      next(new ApiError(403, "FORBIDDEN", "Forbidden: insufficient permissions"));
      return;
    }

    next();
  };
}

