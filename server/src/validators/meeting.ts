import { z } from "zod";

export const createMeetingSchema = z
  .object({
    title: z
      .string({ required_error: "Title is required" })
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(120, "Title cannot exceed 120 characters"),
    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .optional(),
    scheduledAt: z
      .string()
      .datetime({ message: "scheduledAt must be an ISO 8601 date string" })
      .optional()
      .or(z.null().transform(() => undefined)),
  })
  .strict();

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const updateMeetingSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(120, "Title cannot exceed 120 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .optional()
      .or(z.null().transform(() => undefined)),
    scheduledAt: z
      .string()
      .datetime({ message: "scheduledAt must be an ISO 8601 date string" })
      .optional()
      .or(z.null().transform(() => undefined)),
  })
  .strict();

export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

export const joinMeetingSchema = z
  .object({
    roomCode: z
      .string({ required_error: "Room code is required" })
      .trim()
      .min(1, "Room code is required")
      .max(20, "Room code cannot exceed 20 characters"),
  })
  .strict();

export type JoinMeetingInput = z.infer<typeof joinMeetingSchema>;

export const meetingQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    status: z.enum(["SCHEDULED", "LIVE", "ENDED"]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    page: z.preprocess(
      (val) => (val === undefined || val === "" ? 1 : Number(val)),
      z.number().int().min(1).default(1),
    ),
    limit: z.preprocess(
      (val) => (val === undefined || val === "" ? 10 : Number(val)),
      z.number().int().min(1).max(50).default(10),
    ),
  })
  .strict();

export type MeetingQueryInput = z.infer<typeof meetingQuerySchema>;

export const meetingIdParamSchema = z
  .object({
    id: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid meeting ID format"),
  })
  .strict();

export type MeetingIdParam = z.infer<typeof meetingIdParamSchema>;

export const actionItemIdParamSchema = z
  .object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid meeting ID format"),
    itemId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid action item ID format"),
  })
  .strict();

export type ActionItemIdParam = z.infer<typeof actionItemIdParamSchema>;

export const updateActionItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(200, "Title cannot exceed 200 characters")
      .optional(),
    assigneeId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid assignee ID format")
      .nullable()
      .optional(),
    dueDate: z
      .string()
      .datetime({ message: "dueDate must be an ISO 8601 date string" })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .nullable()
      .optional(),
  })
  .strict();

export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;

export const convertActionItemSchema = z
  .object({
    assigneeId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid assignee ID format")
      .nullable()
      .optional(),
    dueDate: z
      .string()
      .datetime({ message: "dueDate must be an ISO 8601 date string" })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .nullable()
      .optional(),
  })
  .strict();

export type ConvertActionItemInput = z.infer<typeof convertActionItemSchema>;

export const exportMeetingQuerySchema = z
  .object({
    format: z.enum(["md", "json"], { required_error: "Format must be md or json" }),
  })
  .strict();

export type ExportMeetingQuery = z.infer<typeof exportMeetingQuerySchema>;


