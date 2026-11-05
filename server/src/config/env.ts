import { z } from "zod";

// Load local environment file if it exists (Node 20+)
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // If .env does not exist, ignore and continue with process.env / defaults
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  // MONGODB_URI is intentionally optional for Phase P0 until Atlas is provisioned
  MONGODB_URI: z.string().optional().default(""),
  JWT_ACCESS_SECRET: z.string().default("dev-jwt-access-secret-key-placeholder"),
  JWT_REFRESH_SECRET: z.string().default("dev-jwt-refresh-secret-key-placeholder"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  AI_PROVIDER: z.enum(["openai", "mock"]).default("mock"),
  AI_BASE_URL: z.string().optional().default(""),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().optional().default(""),
  AI_MAX_INPUT_CHARS: z.coerce.number().default(20000),
  STUN_URLS: z.string().default("stun:stun.l.google.com:19302"),
  TURN_URL: z.string().optional().default(""),
  TURN_USERNAME: z.string().optional().default(""),
  TURN_CREDENTIAL: z.string().optional().default(""),
  MAX_PARTICIPANTS: z.coerce.number().default(4),
  LOG_LEVEL: z.string().default("info"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;

