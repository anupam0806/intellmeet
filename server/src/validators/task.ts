import { z } from "zod";

export const createTaskSchema = z
  .object({
    title: z
      .string({ required_error: "Title is required" })
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(200, "Title cannot exceed 200 characters"),
    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .optional()
      .or(z.null().transform(() => undefined)),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
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

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters")
      .max(200, "Title cannot exceed 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .nullable()
      .optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
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
    position: z
      .number()
      .int("Position must be an integer")
      .min(0, "Position cannot be negative")
      .optional(),
  })
  .strict();

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskQuerySchema = z
  .object({
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
    assigneeId: z.string().optional(),
    q: z.string().max(100, "Query cannot exceed 100 characters").optional(),
  })
  .strict();

export type TaskQueryInput = z.infer<typeof taskQuerySchema>;

export const taskIdParamSchema = z
  .object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid task ID format"),
  })
  .strict();

export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
