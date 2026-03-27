#!/usr/bin/env node
/**
 * Run uvicorn using backend/.venv so we don't rely on system Python (no uvicorn).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backend = join(__dirname, "..", "backend");
const win = process.platform === "win32";
const py = win
  ? join(backend, ".venv", "Scripts", "python.exe")
  : join(backend, ".venv", "bin", "python");

const levelMap = {
  DEBUG: "debug",
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
};
const lu = (process.env.LOG_LEVEL || "").toUpperCase();
let uvicornLog = levelMap[lu];
if (!uvicornLog) {
  uvicornLog = process.env.APP_ENV === "production" ? "info" : "debug";
}

const args = [
  "-m",
  "uvicorn",
  "app.main:app",
  "--reload",
  // Watch only app code — backend/.venv is under cwd and would otherwise trigger endless reloads.
  "--reload-dir",
  "app",
  "--host",
  "127.0.0.1",
  "--port",
  "8000",
  "--log-level",
  uvicornLog,
];

if (!existsSync(py)) {
  console.error("");
  console.error("  No backend/.venv — install Python dependencies first:");
  console.error("");
  console.error("    npm run setup:backend");
  console.error("");
  console.error("  (Uses python3 to create backend/.venv and pip install -r requirements.txt)");
  console.error("");
  process.exit(1);
}

const r = spawnSync(py, args, { cwd: backend, stdio: "inherit", env: process.env });
process.exit(r.status === null ? 1 : r.status);
