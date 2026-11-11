import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { checkEnv, parseEnvFile, parseExampleFile } from "../scripts/envCheck.js";

describe("Environment Auditor (envCheck)", () => {
  let tempDir: string;
  let tempEnvPath: string;
  let tempExamplePath: string;

  const FAKE_MONGODB_URI = "mongodb+srv://adminUser:SuperSecretPassword99@cluster0.fake.mongodb.net/prod?retryWrites=true";
  const FAKE_ACCESS_SECRET = "super_secret_jwt_access_token_12345";
  const FAKE_REFRESH_SECRET = "super_secret_jwt_refresh_token_67890";
  const FAKE_AI_KEY = "AIzaSySecretApiKeyForGemini999";
  const FAKE_TURN_CREDENTIAL = "superSecretTurnPasswordABC";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-check-test-"));
    tempEnvPath = path.join(tempDir, ".env");
    tempExamplePath = path.join(tempDir, ".env.example");

    // Sample .env.example
    const exampleContent = `# core
NODE_ENV=
PORT=
MONGODB_URI=

# auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# AI
AI_PROVIDER=
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_MAX_INPUT_CHARS=

# video
STUN_URLS=
TURN_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
MAX_PARTICIPANTS=

# demo and hosting
DEMO_LOGIN_ENABLED=
CLIENT_DIST_DIR=
LOG_LEVEL=
CLIENT_ORIGIN=
`;
    fs.writeFileSync(tempExamplePath, exampleContent, "utf8");
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("parses example file variables ignoring comments and whitespace", () => {
    const exampleContent = `
# Comment
VAR_A=
VAR_B=
# Another comment
VAR_C=
`;
    const vars = parseExampleFile(exampleContent);
    expect(vars).toEqual(["VAR_A", "VAR_B", "VAR_C"]);
  });

  it("parses .env file stripping quotes and preserving empty values", () => {
    const envContent = `
# Comment
KEY_PLAIN=value1
KEY_QUOTED="value 2"
KEY_SINGLE='value 3'
KEY_EMPTY=
`;
    const parsed = parseEnvFile(envContent);
    expect(parsed.KEY_PLAIN).toBe("value1");
    expect(parsed.KEY_QUOTED).toBe("value 2");
    expect(parsed.KEY_SINGLE).toBe("value 3");
    expect(parsed.KEY_EMPTY).toBe("");
  });

  it("proves that NO secret or URI value appears in the output while auditing", () => {
    const fakeEnvContent = `
NODE_ENV=production
PORT=3000
MONGODB_URI="${FAKE_MONGODB_URI}"
JWT_ACCESS_SECRET="${FAKE_ACCESS_SECRET}"
JWT_REFRESH_SECRET="${FAKE_REFRESH_SECRET}"
AI_PROVIDER=mock
AI_API_KEY="${FAKE_AI_KEY}"
TURN_CREDENTIAL="${FAKE_TURN_CREDENTIAL}"
STUN_URLS=stun:stun.l.google.com:19302
`;
    fs.writeFileSync(tempEnvPath, fakeEnvContent, "utf8");

    const result = checkEnv({
      envFilePath: tempEnvPath,
      exampleFilePath: tempExamplePath,
    });

    const output = result.fullOutput;

    // 1. Verify every variable name is reported
    expect(output).toContain("NODE_ENV: set");
    expect(output).toContain("PORT: set");
    expect(output).toContain("MONGODB_URI: set (starts with mongodb+srv://: true)");
    expect(output).toContain("DEMO_LOGIN_ENABLED: missing");

    // 2. Verify fingerprints and lengths are reported for secrets
    const accessFp = crypto.createHash("sha256").update(FAKE_ACCESS_SECRET).digest("hex").slice(0, 8);
    const refreshFp = crypto.createHash("sha256").update(FAKE_REFRESH_SECRET).digest("hex").slice(0, 8);
    const aiKeyFp = crypto.createHash("sha256").update(FAKE_AI_KEY).digest("hex").slice(0, 8);
    const turnFp = crypto.createHash("sha256").update(FAKE_TURN_CREDENTIAL).digest("hex").slice(0, 8);

    expect(output).toContain(`JWT_ACCESS_SECRET: set (length: ${FAKE_ACCESS_SECRET.length}, fingerprint: ${accessFp})`);
    expect(output).toContain(`JWT_REFRESH_SECRET: set (length: ${FAKE_REFRESH_SECRET.length}, fingerprint: ${refreshFp})`);
    expect(output).toContain(`AI_API_KEY: set (length: ${FAKE_AI_KEY.length}, fingerprint: ${aiKeyFp})`);
    expect(output).toContain(`TURN_CREDENTIAL: set (length: ${FAKE_TURN_CREDENTIAL.length}, fingerprint: ${turnFp})`);

    // 3. Proves NO secret values or URIs appear anywhere in output
    expect(output).not.toContain(FAKE_ACCESS_SECRET);
    expect(output).not.toContain(FAKE_REFRESH_SECRET);
    expect(output).not.toContain(FAKE_MONGODB_URI);
    expect(output).not.toContain(FAKE_AI_KEY);
    expect(output).not.toContain(FAKE_TURN_CREDENTIAL);
    expect(output).not.toContain("SuperSecretPassword99");
    expect(output).not.toContain("cluster0.fake.mongodb.net");
    expect(output).not.toContain("super_secret");
    expect(output).not.toContain("AIzaSy");
  });

  it("lists required missing variables in note when production environment is incomplete", () => {
    // Missing JWT_ACCESS_SECRET and MONGODB_URI
    const incompleteEnv = `
NODE_ENV=production
JWT_REFRESH_SECRET="something_long_enough"
AI_PROVIDER=openai
`;
    fs.writeFileSync(tempEnvPath, incompleteEnv, "utf8");

    const result = checkEnv({
      envFilePath: tempEnvPath,
      exampleFilePath: tempExamplePath,
    });

    expect(result.note).toContain("Missing or empty required variables for NODE_ENV=production");
    expect(result.note).toContain("MONGODB_URI");
    expect(result.note).toContain("JWT_ACCESS_SECRET");
    expect(result.note).toContain("AI_API_KEY");
    expect(result.note).toContain("AI_BASE_URL");
    expect(result.note).toContain("AI_MODEL");
  });
});

