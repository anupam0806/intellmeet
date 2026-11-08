import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// Attempt to load local environment file if it exists, without throwing
try {
  if (typeof process.loadEnvFile === "function") {
    const cwdEnvPath = path.resolve(process.cwd(), ".env");
    const serverEnvPath = path.resolve(process.cwd(), "server", ".env");
    if (fs.existsSync(cwdEnvPath)) {
      process.loadEnvFile(cwdEnvPath);
    } else if (fs.existsSync(serverEnvPath)) {
      process.loadEnvFile(serverEnvPath);
    }
  }
} catch {
  // If reading fails, ignore and proceed with environment variables
}

const isTest = process.env.NODE_ENV === "test";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.preprocess(
      (val) => (val === "" || val === undefined ? 3000 : val),
      z.coerce.number().default(3000),
    ),
    MONGODB_URI: z.string().default(isTest ? "mongodb://localhost:27017/test" : ""),
    JWT_ACCESS_SECRET: z
      .string()
      .default(isTest ? "test-jwt-access-secret-placeholder-for-tests" : ""),
    JWT_REFRESH_SECRET: z
      .string()
      .default(isTest ? "test-jwt-refresh-secret-placeholder-for-tests" : ""),
    CLIENT_ORIGIN: z
      .string()
      .transform((val) => (val ? val : "http://localhost:5173"))
      .default("http://localhost:5173"),
    DEMO_LOGIN_ENABLED: z.preprocess((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string" && val.trim() !== "") {
        return val === "true" || val === "1";
      }
      return process.env.NODE_ENV !== "production";
    }, z.boolean()),
    AI_PROVIDER: z
      .enum(["openai", "mock", ""])
      .transform((val) => (val === "" || !val ? "mock" : val))
      .default("mock"),
    AI_BASE_URL: z.string().optional().default(""),
    AI_API_KEY: z.string().optional().default(""),
    AI_MODEL: z.string().optional().default(""),
    AI_MAX_INPUT_CHARS: z.preprocess(
      (val) => (val === "" || val === undefined ? 30000 : val),
      z.coerce.number().default(30000),
    ),
    STUN_URLS: z
      .string()
      .transform((val) => (val ? val : "stun:stun.l.google.com:19302"))
      .default("stun:stun.l.google.com:19302"),
    TURN_URL: z.string().optional().default(""),
    TURN_USERNAME: z.string().optional().default(""),
    TURN_CREDENTIAL: z.string().optional().default(""),
    MAX_PARTICIPANTS: z.preprocess(
      (val) => (val === "" || val === undefined ? 4 : val),
      z.coerce.number().default(4),
    ),
    LOG_LEVEL: z
      .string()
      .transform((val) => (val ? val : "info"))
      .default("info"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "test") {
      if (!data.MONGODB_URI || data.MONGODB_URI.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MONGODB_URI"],
          message: "MONGODB_URI is required",
        });
      }
      if (!data.JWT_ACCESS_SECRET || data.JWT_ACCESS_SECRET.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_ACCESS_SECRET"],
          message: "JWT_ACCESS_SECRET is required",
        });
      }
      if (!data.JWT_REFRESH_SECRET || data.JWT_REFRESH_SECRET.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message: "JWT_REFRESH_SECRET is required",
        });
      }
      if (data.AI_PROVIDER === "openai") {
        if (!data.AI_BASE_URL || data.AI_BASE_URL.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AI_BASE_URL"],
            message: "AI_BASE_URL is required when AI_PROVIDER is openai",
          });
        }
        if (!data.AI_API_KEY || data.AI_API_KEY.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AI_API_KEY"],
            message: "AI_API_KEY is required when AI_PROVIDER is openai",
          });
        }
        if (!data.AI_MODEL || data.AI_MODEL.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AI_MODEL"],
            message: "AI_MODEL is required when AI_PROVIDER is openai",
          });
        }
      }
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;

export function isDemoLoginEnabled(): boolean {
  const envVal = process.env.DEMO_LOGIN_ENABLED;
  if (envVal !== undefined && envVal !== "") {
    return envVal === "true" || envVal === "1";
  }
  return env.NODE_ENV !== "production";
}
