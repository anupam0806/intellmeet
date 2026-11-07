import { Router } from "express";
import { MeetingController } from "../controllers/meeting.controller.js";
import { ChatController } from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  createMeetingSchema,
  updateMeetingSchema,
  joinMeetingSchema,
  meetingQuerySchema,
  meetingIdParamSchema,
} from "../validators/meeting.js";

export const meetingRouter = Router();

// All meeting endpoints require authentication
meetingRouter.use(requireAuth);

meetingRouter.post("/", validateBody(createMeetingSchema), MeetingController.create);
meetingRouter.get("/", validateQuery(meetingQuerySchema), MeetingController.list);
meetingRouter.post("/join", validateBody(joinMeetingSchema), MeetingController.join);

meetingRouter.get("/:id", validateParams(meetingIdParamSchema), MeetingController.getById);
meetingRouter.get("/:id/chat", validateParams(meetingIdParamSchema), ChatController.listChat);
meetingRouter.patch(
  "/:id",
  validateParams(meetingIdParamSchema),
  validateBody(updateMeetingSchema),
  MeetingController.update,
);
meetingRouter.delete("/:id", validateParams(meetingIdParamSchema), MeetingController.delete);
meetingRouter.post("/:id/start", validateParams(meetingIdParamSchema), MeetingController.start);
meetingRouter.post("/:id/end", validateParams(meetingIdParamSchema), MeetingController.end);

