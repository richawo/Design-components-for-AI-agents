#!/usr/bin/env node
// Clones the private Pro repository into registry/pro so the build includes
// Pro previews, prompts and the gated registry. CI can use a read-only SSH
// deploy key or a fine-grained token. --require-source protects production
// from silently publishing a build without its Pro components.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "registry", "pro");
const repo = process.env.PRO_REPO || "richawo/Design-for-AI";
const token = process.env.PRO_REPO_TOKEN;
const sshKey = process.env.PRO_REPO_SSH_KEY;
const required = process.argv.includes("--require-source");
const checkout = fs.existsSync(path.join(dest, ".git"));
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
let authDir;

function sync() {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("PRO_REPO must be a GitHub owner/repository name");
  if (!checkout && !token && !sshKey) {
    if (required) throw new Error("Pro source is required. Set PRO_REPO_SSH_KEY or PRO_REPO_TOKEN.");
    console.log("pro: no credentials set, building without Pro source (locked previews)");
    return;
  }
  if (!checkout && fs.existsSync(dest)) throw new Error("registry/pro exists but is not a git checkout; refusing to replace it");

  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  let remote = `https://github.com/${repo}.git`;
  const gitArgs = [];
  if (sshKey || token) {
    authDir = fs.mkdtempSync(path.join(os.tmpdir(), "design-yaps-pro-"));
    // Keep automated credentials out of command arguments and git remotes.
    gitArgs.push("-c", "credential.helper=");
    if (sshKey) {
      const keyPath = path.join(authDir, "key");
      fs.writeFileSync(keyPath, `${sshKey.trimEnd()}\n`, { mode: 0o600 });
      const hosts = path.join(root, "scripts", "github-known-hosts");
      env.GIT_SSH_COMMAND = `ssh -F /dev/null -i ${quote(keyPath)} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${quote(hosts)}`;
      remote = `git@github.com:${repo}.git`;
    } else {
      const askpass = path.join(authDir, "askpass");
      fs.writeFileSync(askpass, '#!/bin/sh\ncase "$1" in\n  *Username*) printf "%s\\n" "x-access-token" ;;\n  *Password*) printf "%s\\n" "$PRO_REPO_TOKEN" ;;\n  *) exit 1 ;;\nesac\n', { mode: 0o700 });
      env.GIT_ASKPASS = askpass;
    }
  }

  if (checkout) {
    console.log("pro: already a git checkout, pulling");
    execFileSync("git", [...gitArgs, "-C", dest, "pull", "--ff-only", ...(sshKey || token ? [remote] : [])], { env, stdio: "inherit" });
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      execFileSync("git", [...gitArgs, "clone", "--depth", "1", remote, dest], { env, stdio: "inherit" });
    } catch (error) {
      fs.rmSync(dest, { recursive: true, force: true });
      throw error;
    }
  }

  if (required) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "registry", "pro-manifest.json"), "utf8"));
    const missing = manifest.filter((entry) => entry.status !== "draft" && !fs.existsSync(path.join(dest, entry.slug, `${entry.slug}.tsx`)));
    if (missing.length) throw new Error(`Pro source is missing for: ${missing.map((entry) => entry.slug).join(", ")}`);
  }
  console.log("pro: synced");
}

try {
  sync();
} catch (error) {
  console.error(`pro: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (authDir) fs.rmSync(authDir, { recursive: true, force: true });
}
