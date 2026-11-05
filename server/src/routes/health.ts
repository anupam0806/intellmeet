import { Router } from "express";
import type { Request, Response } from "express";
import { getDatabaseStatus } from "../config/db.js";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    database: getDatabaseStatus(),
  });
});

