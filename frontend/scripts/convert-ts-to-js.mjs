#!/usr/bin/env node
/**
 * One-shot: strip TypeScript from src via esbuild, rename to .js / .jsx.
 */
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "..", "src");

function walk(dir, fn) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, fn);
    else fn(full, ent.name);
  }
}

const files = [];
walk(srcRoot, (full, name) => {
  if (name.endsWith(".tsx")) files.push({ full, kind: "tsx" });
  else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) files.push({ full, kind: "ts" });
});

for (const { full, kind } of files) {
  const code = fs.readFileSync(full, "utf8");
  const r = esbuild.transformSync(code, {
    loader: kind === "tsx" ? "tsx" : "ts",
    jsx: "automatic",
    jsxImportSource: "react",
    format: "esm",
    target: "es2022",
  });
  const out =
    kind === "tsx" ? full.slice(0, -4) + ".jsx" : full.slice(0, -3) + ".js";
  fs.writeFileSync(out, r.code);
  fs.unlinkSync(full);
  console.log(full, "->", out);
}
