import { z } from "zod";

export const notificationIdParamSchema = z
  .object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid notification ID format"),
  })
  .strict();

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
