import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { logger } from "../src/utils/logger.js";
import {
  getSecretFingerprint,
  getStartupConfigSummary,
  logStartupSummary,
} from "../src/utils/startupSummary.js";
import { env } from "../src/config/env.js";

describe("Startup Configuration Summary Logging", () => {
  const FAKE_ACCESS_SECRET = "super-secret-access-token-bytes-xyz-1234567890";
  const FAKE_REFRESH_SECRET = "super-secret-refresh-token-bytes-abc-0987654321";
  const FAKE_MONGODB_URI = "mongodb://user:hiddenPassword123@localhost:27017/prod_db";
  const FAKE_AI_KEY = "sk-fake-ai-secret-key-abcdef1234567890";

  beforeEach(() => {
    // Inject test values directly into env for testing summary extraction
    env.JWT_ACCESS_SECRET = FAKE_ACCESS_SECRET;
    env.JWT_REFRESH_SECRET = FAKE_REFRESH_SECRET;
    env.MONGODB_URI = FAKE_MONGODB_URI;
    env.AI_API_KEY = FAKE_AI_KEY;
  });

  it("produces correct 8-character SHA-256 fingerprint for secrets", () => {
    const expectedAccessFingerprint = crypto
      .createHash("sha256")
      .update(FAKE_ACCESS_SECRET)
      .digest("hex")
      .slice(0, 8);
    expect(getSecretFingerprint(FAKE_ACCESS_SECRET)).toBe(expectedAccessFingerprint);
    expect(getSecretFingerprint(FAKE_ACCESS_SECRET)).toHaveLength(8);
    expect(getSecretFingerprint("")).toBe("none");
    expect(getSecretFingerprint(undefined)).toBe("none");
  });

  it("extracts all required non-secret facts in configuration summary", () => {
    const summary = getStartupConfigSummary();

    expect(summary).toHaveProperty("nodeEnv");
    expect(summary).toHaveProperty("port");
    expect(summary).toHaveProperty("aiProvider");
    expect(summary).toHaveProperty("demoLoginEnabled");
    expect(summary).toHaveProperty("maxParticipants");
    expect(summary).toHaveProperty("turnConfigured");
    expect(summary).toHaveProperty("clientFolderFound");
    expect(summary).toHaveProperty("jwtAccessFingerprint");
    expect(summary).toHaveProperty("jwtRefreshFingerprint");

    expect(typeof summary.demoLoginEnabled).toBe("boolean");
    expect(typeof summary.turnConfigured).toBe("boolean");
    expect(typeof summary.clientFolderFound).toBe("boolean");
    expect(summary.jwtAccessFingerprint).toHaveLength(8);
    expect(summary.jwtRefreshFingerprint).toHaveLength(8);
  });

  it("logs ONE info line containing all required keys and zero secrets/URIs/API keys", () => {
    const infoSpy = vi.spyOn(logger, "info");

    logStartupSummary();

    expect(infoSpy).toHaveBeenCalledTimes(1);

    const [loggedObj, loggedMsg] = infoSpy.mock.calls[0];
    const fullLogString = `${JSON.stringify(loggedObj)} ${String(loggedMsg)}`;

    // 1. Verify required keys are present
    expect(fullLogString).toContain("NODE_ENV");
    expect(fullLogString).toContain("port");
    expect(fullLogString).toContain("AI_PROVIDER");
    expect(fullLogString).toContain("demoLoginEnabled");
    expect(fullLogString).toContain("MAX_PARTICIPANTS");
    expect(fullLogString).toContain("turnConfigured");
    expect(fullLogString).toContain("clientFolderFound");
    expect(fullLogString).toContain("jwtAccessFingerprint");
    expect(fullLogString).toContain("jwtRefreshFingerprint");

    // 2. Verify fingerprints are present
    const expectedAccessFp = crypto
      .createHash("sha256")
      .update(FAKE_ACCESS_SECRET)
      .digest("hex")
      .slice(0, 8);
    const expectedRefreshFp = crypto
      .createHash("sha256")
      .update(FAKE_REFRESH_SECRET)
      .digest("hex")
      .slice(0, 8);

    expect(fullLogString).toContain(expectedAccessFp);
    expect(fullLogString).toContain(expectedRefreshFp);

    // 3. Verify secrets, credentials, DB URIs, and API keys are strictly ABSENT from every log call
    for (const call of infoSpy.mock.calls) {
      const callString = `${JSON.stringify(call[0])} ${String(call[1])}`;
      expect(callString).not.toContain(FAKE_ACCESS_SECRET);
      expect(callString).not.toContain(FAKE_REFRESH_SECRET);
      expect(callString).not.toContain(FAKE_MONGODB_URI);
      expect(callString).not.toContain(FAKE_AI_KEY);
      expect(callString).not.toContain("hiddenPassword123");
      expect(callString).not.toContain("super-secret");
    }

    infoSpy.mockRestore();
  });
});

