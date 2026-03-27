#!/usr/bin/env node
/**
 * Fail fast before `npm run dev` if Python deps were never installed.
 * Skip with: SKIP_BACKEND_VENV_CHECK=1 npm run dev
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.SKIP_BACKEND_VENV_CHECK === "1") {
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const backend = join(__dirname, "..", "backend");
const win = process.platform === "win32";
const py = win
  ? join(backend, ".venv", "Scripts", "python.exe")
  : join(backend, ".venv", "bin", "python");

if (existsSync(py)) {
  process.exit(0);
}

console.error("");
console.error("  Cannot start API: missing backend/.venv (no bundled uvicorn).");
console.error("");
console.error("  Run once from the repo root:");
console.error("");
console.error("    npm run setup:backend");
console.error("");
  console.error("  Then: npm run dev");
  console.error("");
  console.error("  (Frontend only: npm run dev:web)");
console.error("");
process.exit(1);
