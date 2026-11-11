import crypto from "node:crypto";
import { env, isDemoLoginEnabled } from "../config/env.js";
import { resolveClientDistPath } from "../app.js";
import { logger } from "./logger.js";

export function getSecretFingerprint(secret: string | undefined): string {
  if (!secret) return "none";
  return crypto.createHash("sha256").update(secret).digest("hex").slice(0, 8);
}

export interface StartupConfigSummary {
  nodeEnv: string;
  port: number;
  aiProvider: string;
  demoLoginEnabled: boolean;
  maxParticipants: number;
  turnConfigured: boolean;
  clientFolderFound: boolean;
  jwtAccessFingerprint: string;
  jwtRefreshFingerprint: string;
}

export function getStartupConfigSummary(clientDistOverride?: string): StartupConfigSummary {
  const { exists: clientDistExists } = resolveClientDistPath(clientDistOverride);
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    aiProvider: env.AI_PROVIDER,
    demoLoginEnabled: isDemoLoginEnabled(),
    maxParticipants: env.MAX_PARTICIPANTS,
    turnConfigured: Boolean(env.TURN_URL && env.TURN_URL.trim() !== ""),
    clientFolderFound: clientDistExists,
    jwtAccessFingerprint: getSecretFingerprint(env.JWT_ACCESS_SECRET),
    jwtRefreshFingerprint: getSecretFingerprint(env.JWT_REFRESH_SECRET),
  };
}

export function logStartupSummary(clientDistOverride?: string): void {
  const summary = getStartupConfigSummary(clientDistOverride);
  logger.info(
    summary,
    `Startup configuration: NODE_ENV=${summary.nodeEnv}, port=${summary.port}, AI_PROVIDER=${summary.aiProvider}, demoLoginEnabled=${summary.demoLoginEnabled}, MAX_PARTICIPANTS=${summary.maxParticipants}, turnConfigured=${summary.turnConfigured}, clientFolderFound=${summary.clientFolderFound}, jwtAccessFingerprint=${summary.jwtAccessFingerprint}, jwtRefreshFingerprint=${summary.jwtRefreshFingerprint}`,
  );
}

