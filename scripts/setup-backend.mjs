#!/usr/bin/env node
/**
 * Download Gradle deps and compile Spring Boot (backend-java).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const backendJava = join(root, "backend-java");
const win = process.platform === "win32";
const gradlew = win ? join(backendJava, "gradlew.bat") : join(backendJava, "gradlew");

if (!existsSync(gradlew)) {
  console.error("Missing backend-java/gradlew");
  process.exit(1);
}

if (!win) {
  spawnSync("chmod", ["+x", gradlew], { stdio: "inherit" });
}

const r = spawnSync(gradlew, ["classes", "--no-daemon"], {
  cwd: backendJava,
  stdio: "inherit",
  env: process.env,
  shell: win,
});
process.exit(r.status === null ? 1 : r.status);
