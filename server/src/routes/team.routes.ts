import { Router } from "express";
import { TeamController } from "../controllers/team.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { updateRoleSchema, userIdParamSchema } from "../validators/team.js";

export const teamRouter = Router();

teamRouter.get("/", requireAuth, TeamController.getTeam);
teamRouter.patch(
  "/members/:userId/role",
  requireAuth,
  requireRole("ADMIN"),
  validateParams(userIdParamSchema),
  validateBody(updateRoleSchema),
  TeamController.updateMemberRole,
);
teamRouter.post(
  "/invite-code/regenerate",
  requireAuth,
  requireRole("ADMIN"),
  TeamController.regenerateInviteCode,
);

