#!/usr/bin/env node
// design-for-ai: search, read and add Design for AI components from a terminal.
// Zero dependencies. Talks to the public JSON API.
//
//   npx design-for-ai search pricing
//   npx design-for-ai add chart-portfolio
//   npx design-for-ai prompt chart-portfolio | pbcopy

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "0.1.0";
const BASE = (process.env.DESIGN_FOR_AI_URL || "https://design.yaps.ai").replace(/\/$/, "");
const CONFIG = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "design-for-ai", "config.json");

/* ------------------------------------------------------------ output */

// `npx design-for-ai list | head` closes the pipe early; that's not an error.
process.stdout.on("error", (e) => (e.code === "EPIPE" ? process.exit(0) : (() => { throw e; })()));

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const dim = c("2");
const bold = c("1");
const accent = c("38;5;209");
const green = c("32");
const red = c("31");
const out = (s = "") => process.stdout.write(`${s}\n`);
const err = (s = "") => process.stderr.write(`${s}\n`);
function die(message, code = 1) {
  err(`${red("✕")} ${message}`);
  process.exit(code);
}

/* ------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) flags[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith("-") && ["dir", "category", "tier", "platform", "limit"].includes(k)) flags[k] = argv[++i];
    else flags[k] = true;
  } else if (a === "-h") flags.help = true;
  else if (a === "-v") flags.version = true;
  else if (a === "-y") flags.yes = true;
  else positional.push(a);
}
const [command, ...rest] = positional;

/* ------------------------------------------------------------ config */

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch {
    return {};
  }
}
function writeConfig(data) {
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  fs.writeFileSync(CONFIG, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}
const license = () => process.env.DESIGN_FOR_AI_LICENSE || readConfig().license || "";

/* ------------------------------------------------------------ api */

async function api(pathname, { raw = false } = {}) {
  const key = license();
  let res;
  try {
    res = await fetch(`${BASE}${pathname}`, { headers: { Accept: raw ? "text/plain" : "application/json", "User-Agent": `design-for-ai-cli/${VERSION}`, ...(key ? { Authorization: `Bearer ${key}` } : {}) } });
  } catch (e) {
    die(`Couldn't reach ${BASE}: ${e.message}`);
  }
  if (res.status === 401 || res.status === 403) {
    const e = new Error("pro");
    e.code = res.status === 401 ? "NO_LICENSE" : "BAD_LICENSE";
    throw e;
  }
  if (res.status === 404) {
    const e = new Error("not found");
    e.code = "NOT_FOUND";
    throw e;
  }
  if (!res.ok) die(`${BASE}${pathname} returned ${res.status}`);
  return raw ? res.text() : res.json();
}

let indexCache;
async function index() {
  indexCache ??= (await api("/api/registry")).components;
  return indexCache;
}

function explain(e, slug) {
  if (e.code === "NO_LICENSE") die(`${bold(slug)} is a Pro component. Run ${accent("npx design-for-ai login <key>")} or set DESIGN_FOR_AI_LICENSE. Get a key at ${BASE}/pricing`);
  if (e.code === "BAD_LICENSE") die(`Your licence key was rejected (expired or revoked). Check it at ${BASE}/account`);
  if (e.code === "NOT_FOUND") die(`No component called ${bold(slug)}. Try ${accent(`npx design-for-ai search ${slug.split("-")[0]}`)}`);
  throw e;
}

/* ------------------------------------------------------------ project */

function detectPackageManager(cwd) {
  if (fs.existsSync(path.join(cwd, "bun.lock")) || fs.existsSync(path.join(cwd, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function installedDeps(cwd) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    return new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
  } catch {
    return null;
  }
}

function defaultDir(cwd, platform) {
  // Respect the shadcn alias convention when the project has a src/ dir.
  const base = fs.existsSync(path.join(cwd, "src", "components")) ? path.join("src", "components") : "components";
  return path.join(base, "design-for-ai", platform === "mobile" ? "native" : "");
}

/* ------------------------------------------------------------ commands */

const row = (x) => `  ${accent(x.slug.padEnd(28))} ${x.tier === "pro" ? accent("pro ") : dim("free")}  ${x.name}${x.platform === "mobile" ? dim(" · React Native") : ""}\n  ${" ".repeat(28)}       ${dim(x.description)}`;

async function search(query) {
  const words = (query || "").toLowerCase().split(/\s+/).filter(Boolean);
  const hits = (await index())
    .filter((x) => (!flags.category || x.category === flags.category) && (!flags.tier || x.tier === flags.tier) && (!flags.platform || x.platform === flags.platform))
    .map((x) => {
      const hay = [x.name, x.slug, x.description, x.category, ...(x.tags || [])].join(" ").toLowerCase();
      return { x, score: words.reduce((s, w) => s + (hay.includes(w) ? (x.slug.includes(w) || x.name.toLowerCase().includes(w) ? 3 : 1) : 0), 0) };
    })
    .filter((h) => !words.length || h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(flags.limit) || 20);
  if (flags.json) return out(JSON.stringify(hits.map((h) => h.x), null, 2));
  if (!hits.length) return out(`No components match ${bold(query || "")}. Try ${accent("npx design-for-ai list")}.`);
  out(`${hits.length} component${hits.length === 1 ? "" : "s"}\n`);
  for (const h of hits) out(`${row(h.x)}\n`);
  out(dim(`Add one: npx design-for-ai add <slug>   Read its brief: npx design-for-ai prompt <slug>`));
}

async function list() {
  const all = await index();
  if (flags.json) return out(JSON.stringify(all, null, 2));
  const cats = [...new Set(all.map((x) => x.category))];
  for (const cat of cats) {
    if (flags.category && flags.category !== cat) continue;
    const items = all.filter((x) => x.category === cat && (!flags.tier || x.tier === flags.tier));
    if (!items.length) continue;
    out(bold(cat));
    for (const x of items) out(`  ${accent(x.slug.padEnd(28))} ${x.tier === "pro" ? accent("pro ") : dim("free")}  ${x.name}`);
    out();
  }
}

async function info(slug) {
  if (!slug) die("Usage: npx design-for-ai info <slug>");
  const meta = (await index()).find((x) => x.slug === slug);
  if (!meta) explain({ code: "NOT_FOUND" }, slug);
  let full = null;
  try {
    full = await api(`/api/registry/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e.code !== "NO_LICENSE") explain(e, slug);
  }
  if (flags.json) return out(JSON.stringify(full ?? meta, null, 2));
  out(`${bold(meta.name)} ${dim(`(${meta.slug})`)}  ${meta.tier === "pro" ? accent("Pro") : dim("Free · MIT")}`);
  out(meta.description);
  out(dim(`${meta.category} · ${meta.platform}${meta.dependencies?.length ? ` · needs ${meta.dependencies.join(", ")}` : ""}`));
  out(dim(meta.url));
  if (full) {
    out(`\n${bold("Install")}\n${full.install}`);
    if (full.props?.length) {
      out(`\n${bold("Props")}`);
      for (const p of full.props) out(`  ${accent(p.name)} ${dim(p.type)}${p.default ? dim(` = ${p.default}`) : ""}\n    ${p.description}`);
    }
  } else out(`\n${dim("Pro: run")} ${accent("npx design-for-ai login <key>")} ${dim("for props, prompts and source.")}`);
}

async function prompt(slug) {
  if (!slug) die("Usage: npx design-for-ai prompt <slug> [--json]");
  try {
    const full = await api(`/api/registry/${encodeURIComponent(slug)}`);
    out(flags.json ? JSON.stringify(full.promptJson, null, 2) : full.prompt.trim());
  } catch (e) {
    explain(e, slug);
  }
}

async function add(slugs) {
  if (!slugs.length) die("Usage: npx design-for-ai add <slug> [more slugs] [--dir path] [--force] [--no-install]");
  const cwd = process.cwd();
  const all = await index();
  const needed = new Set();
  for (const slug of slugs) {
    const meta = all.find((x) => x.slug === slug);
    if (!meta) explain({ code: "NOT_FOUND" }, slug);
    let code;
    try {
      code = await api(`/api/registry/${encodeURIComponent(slug)}?format=raw`, { raw: true });
    } catch (e) {
      explain(e, slug);
    }
    const dir = typeof flags.dir === "string" ? path.join(flags.dir, meta.platform === "mobile" ? "native" : "") : defaultDir(cwd, meta.platform);
    const file = path.join(cwd, dir, `${slug}.tsx`);
    if (fs.existsSync(file) && !flags.force) {
      err(`${dim("•")} ${path.relative(cwd, file)} already exists ${dim("(use --force to overwrite)")}`);
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, code);
      out(`${green("✓")} ${bold(meta.name)} → ${path.relative(cwd, file)}`);
    }
    for (const d of meta.dependencies || []) needed.add(d);
  }

  const have = installedDeps(cwd);
  const missing = [...needed].filter((d) => !have || !have.has(d));
  if (missing.length) {
    const pm = detectPackageManager(cwd);
    const cmd = pm === "npm" ? ["install", ...missing] : ["add", ...missing];
    if (!have || flags["no-install"]) {
      out(`\n${dim("Also install:")} ${accent(`${pm} ${cmd.join(" ")}`)}`);
    } else {
      out(`\n${dim("Installing")} ${missing.join(", ")} ${dim(`with ${pm}…`)}`);
      const r = spawnSync(pm, cmd, { stdio: "inherit", cwd, shell: process.platform === "win32" });
      if (r.status !== 0) err(`${red("✕")} ${pm} failed. Run it yourself: ${pm} ${cmd.join(" ")}`);
    }
  }
  const web = slugs.some((s) => all.find((x) => x.slug === s)?.platform === "web");
  if (web) out(dim(`\nComponents use the font roles font-display, font-serif, font-sans and font-mono.\nOnce per project: npx shadcn@latest add ${BASE}/r/theme.json (or map them in your Tailwind theme).`));
}

function login(key) {
  if (!key) die("Usage: npx design-for-ai login <licence key>   (starts with dfa_)");
  if (!/^dfa_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key.trim())) die("That doesn't look like a licence key. It starts with dfa_ and has a dot in the middle.");
  writeConfig({ ...readConfig(), license: key.trim() });
  out(`${green("✓")} Licence saved to ${dim(CONFIG)}. Pro components are unlocked for this user.`);
}

function logout() {
  const cfg = readConfig();
  delete cfg.license;
  writeConfig(cfg);
  out(`${green("✓")} Licence removed.`);
}

function mcp() {
  const key = license();
  out(bold("Connect your agent to Design for AI over MCP\n"));
  out(dim("Claude Code"));
  out(`  claude mcp add --transport http design-for-ai ${BASE}/mcp${key ? ` --header "Authorization: Bearer ${key.slice(0, 10)}…"` : ""}`);
  out(dim("\nCursor, Windsurf, VS Code and other clients (mcp.json)"));
  out(
    JSON.stringify(
      { mcpServers: { "design-for-ai": { url: `${BASE}/mcp`, ...(key ? { headers: { Authorization: "Bearer ${DESIGN_FOR_AI_LICENSE}" } } : {}) } } },
      null,
      2,
    )
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n"),
  );
  out(dim(`\nPrefer a local stdio server? npx -y design-for-ai-mcp`));
}

function help() {
  out(`${bold("design-for-ai")} ${dim(VERSION)}  ${dim("Premium components for AI agents · " + BASE)}

${bold("Usage")}
  npx design-for-ai ${accent("search")} <query>        Find components ${dim("[--category] [--tier free|pro] [--json]")}
  npx design-for-ai ${accent("list")}                  Every component by category ${dim("[--category] [--tier] [--json]")}
  npx design-for-ai ${accent("info")} <slug>           Description, install command and props
  npx design-for-ai ${accent("add")} <slug…>           Write the file(s) and install missing deps ${dim("[--dir] [--force] [--no-install]")}
  npx design-for-ai ${accent("prompt")} <slug>         Print the design brief for your agent ${dim("[--json]")}
  npx design-for-ai ${accent("login")} <key>           Save a Pro licence key
  npx design-for-ai ${accent("logout")}                Forget it
  npx design-for-ai ${accent("mcp")}                   How to connect Claude Code, Cursor and others

${bold("Environment")}
  DESIGN_FOR_AI_LICENSE   Pro licence key (overrides login)
  DESIGN_FOR_AI_URL       API base ${dim(`(default ${BASE})`)}`);
}

/* ------------------------------------------------------------ main */

if (flags.version) out(VERSION);
else if (flags.help || !command || command === "help") help();
else {
  const cmds = { search: () => search(rest.join(" ")), find: () => search(rest.join(" ")), list, ls: list, info: () => info(rest[0]), add: () => add(rest), prompt: () => prompt(rest[0]), brief: () => prompt(rest[0]), login: () => login(rest[0]), logout, mcp };
  const run = cmds[command];
  if (!run) {
    err(`Unknown command ${bold(command)}.\n`);
    help();
    process.exit(1);
  }
  await run();
}
