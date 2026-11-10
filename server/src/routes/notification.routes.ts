import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateParams } from "../middleware/validate.js";
import { notificationIdParamSchema } from "../validators/notification.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get("/", NotificationController.list);
notificationRouter.patch(
  "/:id/read",
  validateParams(notificationIdParamSchema),
  NotificationController.markRead,
);
notificationRouter.post("/read-all", NotificationController.markAllRead);
