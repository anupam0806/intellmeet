import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const SECRET_VARS = new Set([
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "AI_API_KEY",
  "TURN_CREDENTIAL",
]);

export function getFingerprint(val: string): string {
  if (!val) return "none";
  return crypto.createHash("sha256").update(val).digest("hex").slice(0, 8);
}

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();

    // Strip outer double or single quotes if present
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    }

    result[key] = val;
  }

  return result;
}

export function parseExampleFile(content: string): string[] {
  const vars: string[] = [];
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx).trim();
      if (key && !vars.includes(key)) {
        vars.push(key);
      }
    }
  }

  return vars;
}

export interface EnvCheckResult {
  lines: string[];
  note: string;
  fullOutput: string;
  results: Record<
    string,
    {
      status: "set" | "empty" | "missing";
      length?: number;
      fingerprint?: string;
      startsWithSrv?: boolean;
    }
  >;
}

export interface CheckEnvOptions {
  envFilePath?: string;
  exampleFilePath?: string;
  envSource?: Record<string, string | undefined>;
}

export function checkEnv(options: CheckEnvOptions = {}): EnvCheckResult {
  const cwd = process.cwd();

  // 1. Resolve .env file path
  let envFilePath = options.envFilePath;
  if (!envFilePath) {
    const candidateServerEnv = path.resolve(cwd, "server", ".env");
    const candidateRootEnv = path.resolve(cwd, ".env");
    if (fs.existsSync(candidateServerEnv)) {
      envFilePath = candidateServerEnv;
    } else if (fs.existsSync(candidateRootEnv)) {
      envFilePath = candidateRootEnv;
    }
  }

  // 2. Load env dictionary
  let envMap: Record<string, string | undefined> = {};
  if (options.envSource) {
    envMap = { ...options.envSource };
  } else if (envFilePath && fs.existsSync(envFilePath)) {
    const content = fs.readFileSync(envFilePath, "utf8");
    envMap = parseEnvFile(content);
  } else {
    envMap = { ...process.env };
  }

  // 3. Resolve .env.example file path
  let exampleFilePath = options.exampleFilePath;
  if (!exampleFilePath) {
    const candidateServerExample = path.resolve(cwd, "server", ".env.example");
    const candidateRootExample = path.resolve(cwd, ".env.example");
    if (fs.existsSync(candidateServerExample)) {
      exampleFilePath = candidateServerExample;
    } else if (fs.existsSync(candidateRootExample)) {
      exampleFilePath = candidateRootExample;
    }
  }

  const exampleContent =
    exampleFilePath && fs.existsSync(exampleFilePath)
      ? fs.readFileSync(exampleFilePath, "utf8")
      : "";

  const varNames = parseExampleFile(exampleContent);

  // 4. Evaluate each variable
  const lines: string[] = [];
  const results: EnvCheckResult["results"] = {};

  for (const name of varNames) {
    const rawVal = envMap[name];

    if (rawVal === undefined) {
      results[name] = { status: "missing" };
      lines.push(`${name}: missing`);
    } else if (rawVal === "") {
      results[name] = { status: "empty" };
      lines.push(`${name}: empty`);
    } else {
      // Set
      if (name === "MONGODB_URI") {
        const startsWithSrv = rawVal.startsWith("mongodb+srv://");
        results[name] = { status: "set", startsWithSrv };
        lines.push(`${name}: set (starts with mongodb+srv://: ${startsWithSrv})`);
      } else if (SECRET_VARS.has(name)) {
        const fp = getFingerprint(rawVal);
        results[name] = { status: "set", length: rawVal.length, fingerprint: fp };
        lines.push(`${name}: set (length: ${rawVal.length}, fingerprint: ${fp})`);
      } else {
        results[name] = { status: "set" };
        lines.push(`${name}: set`);
      }
    }
  }

  // 5. Evaluate required variables for current NODE_ENV
  const nodeEnv = envMap.NODE_ENV || process.env.NODE_ENV || "development";
  const missingRequired: string[] = [];

  if (nodeEnv !== "test") {
    const coreRequired = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
    for (const reqVar of coreRequired) {
      const val = envMap[reqVar];
      if (!val || val.trim() === "") {
        missingRequired.push(reqVar);
      }
    }

    if (envMap.AI_PROVIDER === "openai") {
      const aiRequired = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"];
      for (const reqVar of aiRequired) {
        const val = envMap[reqVar];
        if (!val || val.trim() === "") {
          missingRequired.push(reqVar);
        }
      }
    }
  }

  let note = "";
  if (missingRequired.length > 0) {
    note = `Note: Missing or empty required variables for NODE_ENV=${nodeEnv}: ${missingRequired.join(", ")}`;
  } else {
    note = `Note: All required variables for NODE_ENV=${nodeEnv} are set.`;
  }

  lines.push("");
  lines.push(note);

  const fullOutput = lines.join("\n");
  return { lines, note, fullOutput, results };
}

export function runEnvCheck(): void {
  const { fullOutput } = checkEnv();
  console.log(fullOutput);
}

// Auto-run when executed directly via node or tsx
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && (invokedPath === currentFilePath || invokedPath.endsWith("envCheck.ts") || invokedPath.endsWith("envCheck.js"))) {
  runEnvCheck();
}

