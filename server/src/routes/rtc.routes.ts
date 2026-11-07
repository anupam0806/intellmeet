import { Router } from "express";
import { RtcController } from "../controllers/rtc.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const rtcRouter = Router();

rtcRouter.use(requireAuth);
rtcRouter.get("/config", RtcController.getConfig);

