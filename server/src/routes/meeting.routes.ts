import { Router } from "express";
import { MeetingController } from "../controllers/meeting.controller.js";
import { ChatController } from "../controllers/chat.controller.js";
import { TranscriptController } from "../controllers/transcript.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { aiGenerateRateLimiter } from "../middleware/rateLimit.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  createMeetingSchema,
  updateMeetingSchema,
  joinMeetingSchema,
  meetingQuerySchema,
  meetingIdParamSchema,
  actionItemIdParamSchema,
  updateActionItemSchema,
  exportMeetingQuerySchema,
} from "../validators/meeting.js";

export const meetingRouter = Router();

// All meeting endpoints require authentication
meetingRouter.use(requireAuth);

meetingRouter.post("/", validateBody(createMeetingSchema), MeetingController.create);
meetingRouter.get("/", validateQuery(meetingQuerySchema), MeetingController.list);
meetingRouter.post("/join", validateBody(joinMeetingSchema), MeetingController.join);

meetingRouter.get("/:id", validateParams(meetingIdParamSchema), MeetingController.getById);
meetingRouter.get("/:id/chat", validateParams(meetingIdParamSchema), ChatController.listChat);
meetingRouter.get(
  "/:id/transcript",
  validateParams(meetingIdParamSchema),
  TranscriptController.getTranscript,
);
meetingRouter.post(
  "/:id/transcript",
  validateParams(meetingIdParamSchema),
  TranscriptController.postTranscript,
);
meetingRouter.patch(
  "/:id",
  validateParams(meetingIdParamSchema),
  validateBody(updateMeetingSchema),
  MeetingController.update,
);
meetingRouter.delete("/:id", validateParams(meetingIdParamSchema), MeetingController.delete);
meetingRouter.post("/:id/start", validateParams(meetingIdParamSchema), MeetingController.start);
meetingRouter.post("/:id/end", validateParams(meetingIdParamSchema), MeetingController.end);

meetingRouter.post(
  "/:id/ai/generate",
  aiGenerateRateLimiter,
  validateParams(meetingIdParamSchema),
  MeetingController.generateAi,
);

meetingRouter.patch(
  "/:id/action-items/:itemId",
  validateParams(actionItemIdParamSchema),
  validateBody(updateActionItemSchema),
  MeetingController.updateActionItem,
);

meetingRouter.get(
  "/:id/export",
  validateParams(meetingIdParamSchema),
  validateQuery(exportMeetingQuerySchema),
  MeetingController.export,
);

