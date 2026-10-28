import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scratch: string[] = [];

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pro-sync-test-"));
  scratch.push(dir);
  for (const sub of ["scripts", "registry", "bin", "tmp"]) fs.mkdirSync(path.join(dir, sub));
  for (const file of ["sync-pro.mjs", "github-known-hosts"]) {
    fs.copyFileSync(path.join(import.meta.dirname, "../scripts", file), path.join(dir, "scripts", file));
  }
  fs.mkdirSync(path.join(dir, "scripts/lib"), { recursive: true });
  fs.copyFileSync(path.join(import.meta.dirname, "../scripts/lib/style-source.mjs"), path.join(dir, "scripts/lib/style-source.mjs"));
  fs.writeFileSync(path.join(dir, "registry/pro-manifest.json"), JSON.stringify([{ slug: "demo" }]));
  // Stand in for git so tests can inspect credentials without sending them.
  fs.writeFileSync(path.join(dir, "bin/git"), `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2), env = process.env;
const authFile = env.GIT_ASKPASS || /-i '([^']+)'/.exec(env.GIT_SSH_COMMAND || "")?.[1];
fs.writeFileSync(env.TEST_GIT_LOG, JSON.stringify({args, authFile, mode:authFile && fs.statSync(authFile).mode & 0o777, ssh:env.GIT_SSH_COMMAND}));
if (env.TEST_GIT_FAIL) process.exit(1);
const dest = args.at(-1);
fs.mkdirSync(path.join(dest, ".git"), {recursive:true});
fs.mkdirSync(path.join(dest, "demo"));
if (!env.TEST_MISSING_SOURCE) fs.writeFileSync(path.join(dest, "demo/demo.tsx"), "export function Demo() {}");
if (!env.TEST_MISSING_BLOG) {
  fs.mkdirSync(path.join(dest, "_site/blog"), {recursive:true});
  fs.writeFileSync(path.join(dest, "_site/blog/fixture.md"), "Private blog fixture");
}
`, { mode: 0o700 });
  const run = (extra: Record<string, string> = {}, required = true) => spawnSync(process.execPath,
    [path.join(dir, "scripts/sync-pro.mjs"), ...(required ? ["--require-source"] : [])], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${path.join(dir, "bin")}${path.delimiter}${process.env.PATH}`, TMPDIR: path.join(dir, "tmp"),
        PRO_REPO_TOKEN: "", PRO_REPO_SSH_KEY: "", TEST_GIT_LOG: path.join(dir, "git.json"), ...extra },
    });
  return { dir, run, log: () => JSON.parse(fs.readFileSync(path.join(dir, "git.json"), "utf8")) };
}

afterEach(() => { for (const dir of scratch.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe("production Pro sync", () => {
  function pinnedFixture() {
    const f = fixture(), source = path.join(f.dir, "source"), dest = path.join(f.dir, "registry/pro");
    fs.mkdirSync(source);
    const git = (...args: string[]) => execFileSync("git", ["-C", source, ...args], {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]}).trim();
    git("init", "-b", "main");
    fs.mkdirSync(path.join(source, "demo"));
    fs.mkdirSync(path.join(source, "_site/blog"), {recursive:true});
    fs.writeFileSync(path.join(source, "demo/demo.tsx"), "export function Demo() {}");
    fs.writeFileSync(path.join(source, "_site/blog/fixture.md"), "Approved article");
    git("add", ".");
    git("-c", "user.name=Publication QA", "-c", "user.email=qa@example.test", "commit", "-m", "approved source");
    const approved = git("rev-parse", "HEAD");
    fs.writeFileSync(path.join(source, "_site/blog/fixture.md"), "Unapproved newer article");
    git("add", ".");
    git("-c", "user.name=Publication QA", "-c", "user.email=qa@example.test", "commit", "-m", "later private changes");
    const latest = git("rev-parse", "HEAD");
    fs.mkdirSync(path.join(f.dir, "publication"));
    const request = (revision: string) => fs.writeFileSync(path.join(f.dir, "publication/content-request.json"), JSON.stringify({version:2,privateContentCommit:revision}));
    request(approved);
    const run = () => spawnSync(process.execPath, [path.join(f.dir, "scripts/sync-pro.mjs"), "--require-source"], {
      encoding:"utf8", env:{...process.env, TMPDIR:path.join(f.dir,"tmp"), PRO_REPO_TOKEN:"local-fixture-only", PRO_REPO_SSH_KEY:"",
        GIT_CONFIG_COUNT:"1", GIT_CONFIG_KEY_0:`url.file://${source}.insteadOf`, GIT_CONFIG_VALUE_0:"https://github.com/richawo/Design-for-AI.git"},
    });
    return {...f,source,dest,approved,latest,request,run};
  }

  it("materializes the approved private commit even when remote main has newer content", () => {
    const f = pinnedFixture(), result = f.run();
    expect(result.status, result.stderr).toBe(0);
    expect(execFileSync("git",["-C",f.dest,"rev-parse","HEAD"],{encoding:"utf8"}).trim()).toBe(f.approved);
    expect(fs.readFileSync(path.join(f.dest,"_site/blog/fixture.md"),"utf8")).toBe("Approved article");
    expect(f.run().status).toBe(0);
  });

  it("does not fall back to remote main when the pinned commit is unavailable", () => {
    const f = pinnedFixture();f.request("a".repeat(40));
    expect(f.run().status).toBe(1);
    expect(fs.existsSync(f.dest)).toBe(false);
  });

  it("preserves an existing main checkout that differs from the requested commit", () => {
    const f = pinnedFixture();execFileSync("git",["clone",f.source,f.dest],{stdio:"ignore"});
    const result = f.run();expect(result.status).toBe(1);
    expect(result.stderr).toContain("differs from the publication commit");
    expect(execFileSync("git",["-C",f.dest,"branch","--show-current"],{encoding:"utf8"}).trim()).toBe("main");
    expect(fs.readFileSync(path.join(f.dest,"_site/blog/fixture.md"),"utf8")).toBe("Unapproved newer article");
  });

  it.each(["tracked", "untracked"])("preserves %s work in a checkout at the requested commit", kind => {
    const f = pinnedFixture();expect(f.run().status).toBe(0);
    const file=path.join(f.dest,kind==="tracked"?"_site/blog/fixture.md":"local-note.md");
    fs.writeFileSync(file,"Keep this unfinished work");
    const result=f.run();expect(result.status).toBe(1);expect(result.stderr).toContain("clean checkout");
    expect(fs.readFileSync(file,"utf8")).toBe("Keep this unfinished work");
  });

  it("rejects a malformed publication revision before cloning", () => {
    const f=pinnedFixture();f.request("main");const result=f.run();
    expect(result.status).toBe(1);expect(result.stderr).toContain("complete private Git commit");
    expect(fs.existsSync(f.dest)).toBe(false);
  });

  it("fails without source credentials while keeping source optional for local development", () => {
    const f = fixture();
    expect(f.run().status).toBe(1);
    expect(f.run({}, false).status).toBe(0);
  });

  it("keeps token credentials out of git arguments and removes the temporary helper", () => {
    const f = fixture();
    const token = "private-test-token";
    const result = f.run({ PRO_REPO_TOKEN: token });
    expect(result.status).toBe(0);
    expect(JSON.stringify(f.log().args) + result.stdout + result.stderr).not.toContain(token);
    expect(f.log().args).toContain("https://github.com/richawo/Design-for-AI.git");
    expect(fs.existsSync(f.log().authFile)).toBe(false);
  });

  it.each([false, true])("protects and cleans up the SSH key, including failed clones (%s)", (fails) => {
    const f = fixture();
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\nprivate-test-key\n-----END OPENSSH PRIVATE KEY-----";
    const result = f.run({ PRO_REPO_SSH_KEY: key, ...(fails ? { TEST_GIT_FAIL: "1" } : {}) });
    expect(result.status).toBe(fails ? 1 : 0);
    const log = f.log();
    expect(log.mode).toBe(0o600);
    expect(log.ssh).toContain("StrictHostKeyChecking=yes");
    expect(log.args).toContain("git@github.com:richawo/Design-for-AI.git");
    expect(JSON.stringify(log) + result.stdout + result.stderr).not.toContain("private-test-key");
    expect(fs.existsSync(log.authFile)).toBe(false);
    if (fails) expect(fs.existsSync(path.join(f.dir, "registry/pro"))).toBe(false);
  });

  it("rejects an incomplete Pro checkout instead of allowing a production build", () => {
    const f = fixture();
    const result = f.run({ PRO_REPO_TOKEN: "private-test-token", TEST_MISSING_SOURCE: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Pro source is missing for: demo");
  });

  it("preserves an existing source folder that is not a git checkout", () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.dir, "registry/pro"));
    fs.writeFileSync(path.join(f.dir, "registry/pro/work.tsx"), "keep this work");
    expect(f.run({ PRO_REPO_TOKEN: "private-test-token" }).status).toBe(1);
    expect(fs.readFileSync(path.join(f.dir, "registry/pro/work.tsx"), "utf8")).toBe("keep this work");
  });

  it("rejects a production checkout without private blog content", () => {
    const f = fixture();
    const result = f.run({ PRO_REPO_TOKEN: "private-test-token", TEST_MISSING_BLOG: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Private blog source is missing");
  });
});
