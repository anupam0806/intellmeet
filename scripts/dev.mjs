import { spawn } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const serverProcess = spawn(npmCmd, ["--workspace=server", "run", "dev"], {
  stdio: ["ignore", "inherit", "inherit"],
  shell: true,
});

const clientProcess = spawn(npmCmd, ["--workspace=client", "run", "dev"], {
  stdio: ["ignore", "inherit", "inherit"],
  shell: true,
});

function cleanup() {
  if (serverProcess.pid) {
    try {
      serverProcess.kill("SIGINT");
    } catch {
      // ignore
    }
  }
  if (clientProcess.pid) {
    try {
      clientProcess.kill("SIGINT");
    } catch {
      // ignore
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

serverProcess.on("close", (code) => {
  if (code !== 0 && code !== null) {
    cleanup();
    process.exit(code);
  }
});

clientProcess.on("close", (code) => {
  if (code !== 0 && code !== null) {
    cleanup();
    process.exit(code);
  }
});

