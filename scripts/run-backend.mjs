#!/usr/bin/env node
/**
 * Run Spring Boot API (backend-java) on port 8000.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const backendJava = join(root, "backend-java");
const win = process.platform === "win32";
const gradlew = win
  ? join(backendJava, "gradlew.bat")
  : join(backendJava, "gradlew");

if (!existsSync(gradlew)) {
  console.error("");
  console.error("  Missing backend-java/gradlew — clone or restore the Java backend.");
  console.error("");
  process.exit(1);
}

const r = spawnSync(gradlew, ["bootRun", "--no-daemon"], {
  cwd: backendJava,
  stdio: "inherit",
  env: process.env,
  shell: win,
});
process.exit(r.status === null ? 1 : r.status);
