import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name cannot exceed 60 characters"),
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password cannot exceed 72 characters"),
    teamName: z
      .string()
      .trim()
      .min(2, "Team name must be at least 2 characters")
      .max(80, "Team name cannot exceed 80 characters")
      .optional(),
    inviteCode: z
      .string()
      .trim()
      .toUpperCase()
      .length(8, "Invite code must be exactly 8 characters")
      .regex(/^[A-Z0-9]{8}$/, "Invite code must be 8 alphanumeric characters")
      .optional(),
  })
  .strict()
  .refine(
    (data) => (data.teamName && !data.inviteCode) || (!data.teamName && data.inviteCode),
    {
      message: "Provide either teamName to create a team or inviteCode to join one, but not both",
      path: ["teamName"],
    },
  );

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z.string().min(1, "Password is required").max(72, "Password cannot exceed 72 characters"),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

