import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateQuery } from "../middleware/validate.js";
import { analyticsQuerySchema } from "../validators/analytics.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get(
  "/overview",
  validateQuery(analyticsQuerySchema),
  AnalyticsController.getOverview,
);
