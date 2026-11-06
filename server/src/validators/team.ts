import { z } from "zod";

export const updateRoleSchema = z
  .object({
    role: z.enum(["ADMIN", "MEMBER"], {
      errorMap: () => ({ message: "Role must be ADMIN or MEMBER" }),
    }),
  })
  .strict();

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const userIdParamSchema = z
  .object({
    userId: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
  })
  .strict();

export type UserIdParamInput = z.infer<typeof userIdParamSchema>;

