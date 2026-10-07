#!/usr/bin/env node
// Clones the private Pro repository into registry/pro so the build includes
// Pro previews, prompts and the gated registry. Requires PRO_REPO_TOKEN (a
// fine-grained token with read access to the private repo) in CI.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dest = path.join(root, "registry", "pro");
const repo = process.env.PRO_REPO || "richawo/Design-for-AI";
const token = process.env.PRO_REPO_TOKEN;

if (fs.existsSync(path.join(dest, ".git"))) {
  console.log("pro: already a git checkout, pulling");
  execFileSync("git", ["-C", dest, "pull", "--ff-only"], { stdio: "inherit" });
  process.exit(0);
}
if (!token) {
  console.log("pro: PRO_REPO_TOKEN not set, building without Pro source (locked previews)");
  process.exit(0);
}
fs.rmSync(dest, { recursive: true, force: true });
execFileSync("git", ["clone", "--depth", "1", `https://x-access-token:${token}@github.com/${repo}.git`, dest], { stdio: "inherit" });
console.log("pro: synced");
