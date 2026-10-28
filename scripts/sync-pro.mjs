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
import { styleSourcePin, materializeStyleSource } from "./lib/style-source.mjs";

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
  const requestFile = path.join(root, "publication", "content-request.json");
  const request = fs.existsSync(requestFile) ? JSON.parse(fs.readFileSync(requestFile, "utf8")) : null;
  const revision = request?.privateContentCommit;
  if (request && (request.version !== 2 || !/^[a-f0-9]{40}$/.test(revision ?? ""))) {
    throw new Error("Publication request must pin a complete private Git commit");
  }
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

  if (checkout && revision) {
    // Preserve developer branches and unfinished work. Workers Builds starts
    // from a fresh clone, where the requested immutable source is materialized.
    const head = execFileSync("git", ["-C", dest, "rev-parse", "HEAD"], { env, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["-C", dest, "status", "--porcelain"], { env, encoding: "utf8" }).trim();
    if (dirty) throw new Error("Pinned Pro source requires a clean checkout; preserve local work and use a fresh build checkout");
    if (head !== revision) throw new Error("Pro checkout differs from the publication commit; use a fresh build checkout");
    console.log(`pro: using pinned publication commit ${revision}`);
  } else if (checkout) {
    console.log("pro: already a git checkout, pulling");
    execFileSync("git", [...gitArgs, "-C", dest, "pull", "--ff-only", ...(sshKey || token ? [remote] : [])], { env, stdio: "inherit" });
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      execFileSync("git", [...gitArgs, "clone", "--depth", "1", ...(revision ? ["--no-checkout"] : []), remote, dest], { env, stdio: "inherit" });
      if (revision) {
        execFileSync("git", [...gitArgs, "-C", dest, "fetch", "--depth", "1", remote, revision], { env, stdio: "inherit" });
        execFileSync("git", ["-C", dest, "checkout", "--detach", revision], { env, stdio: "inherit" });
        const head = execFileSync("git", ["-C", dest, "rev-parse", "HEAD"], { env, encoding: "utf8" }).trim();
        if (head !== revision) throw new Error("Pro sync did not materialize the pinned publication commit");
      }
    } catch (error) {
      fs.rmSync(dest, { recursive: true, force: true });
      throw error;
    }
  }

  const stylePin = styleSourcePin(root);
  if (stylePin) {
    try { execFileSync("git", ["-C", dest, "cat-file", "-e", stylePin.commit + "^{commit}"], { env, stdio: "ignore" }); }
    catch { execFileSync("git", [...gitArgs, "-C", dest, "fetch", "--depth", "1", remote, stylePin.commit], { env, stdio: "inherit" }); }
    materializeStyleSource(root, dest, stylePin);
    console.log(`pro: pinned visual style ${stylePin.commit}`);
  }

  if (required) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "registry", "pro-manifest.json"), "utf8"));
    const missing = manifest.filter((entry) => entry.status !== "draft" && !fs.existsSync(path.join(dest, entry.slug, `${entry.slug}.tsx`)));
    if (missing.length) throw new Error(`Pro source is missing for: ${missing.map((entry) => entry.slug).join(", ")}`);
    const blog = path.join(dest, "_site", "blog");
    if (!fs.existsSync(blog) || !fs.readdirSync(blog).some((file) => file.endsWith(".md"))) {
      throw new Error("Private blog source is missing from _site/blog; refusing to deploy an empty blog.");
    }
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
