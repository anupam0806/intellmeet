import { z } from "zod";

export const updateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name cannot exceed 60 characters")
      .optional(),
    avatarUrl: z.string().trim().url("Avatar URL must be a valid URL").optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

