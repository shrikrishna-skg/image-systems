#!/usr/bin/env node
/**
 * Fail fast before `npm run dev` if Java backend is not set up.
 * Skip with: SKIP_BACKEND_VENV_CHECK=1 npm run dev
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

if (process.env.SKIP_BACKEND_VENV_CHECK === "1") {
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const backendJava = join(root, "backend-java");
const win = process.platform === "win32";
const gradlew = win
  ? join(backendJava, "gradlew.bat")
  : join(backendJava, "gradlew");

if (!existsSync(gradlew)) {
  console.error("");
  console.error("  Cannot start API: missing backend-java/gradlew.");
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
}

const javaCheck = spawnSync("java", ["-version"], { encoding: "utf8" });
if (javaCheck.error || javaCheck.status !== 0) {
  console.error("");
  console.error("  Cannot start API: `java` not found on PATH.");
  console.error("");
  console.error("  Install JDK 21+ and ensure `java -version` works.");
  console.error("");
  process.exit(1);
}

process.exit(0);
