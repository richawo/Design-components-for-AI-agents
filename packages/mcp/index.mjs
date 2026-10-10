#!/usr/bin/env node
// Design for AI MCP server.
//
// Gives agents six tools: search_components, get_component, list_categories,
// get_principles, install_command and get_page. Everything goes through the public JSON
// API, so there is nothing to keep in sync. Pro components need a licence key
// in DESIGN_FOR_AI_LICENSE.
//
//   claude mcp add design-for-ai -- npx -y https://design.yaps.ai/mcp.tgz

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.DESIGN_FOR_AI_URL || "https://design.yaps.ai").replace(/\/$/, "");
const LICENSE = process.env.DESIGN_FOR_AI_LICENSE || "";
const here = path.dirname(fileURLToPath(import.meta.url));

let indexCache = null;

async function api(pathname) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { Accept: "application/json", ...(LICENSE ? { Authorization: `Bearer ${LICENSE}` } : {}) },
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("pro");
    err.code = "PRO";
    throw err;
  }
  if (!res.ok) throw new Error(`Design for AI API returned ${res.status} for ${pathname}`);
  return res.json();
}

async function index() {
  indexCache ??= (await api("/api/registry")).components;
  return indexCache;
}

const text = (t) => ({ content: [{ type: "text", text: t }] });

function line(c) {
  return `- ${c.slug} · ${c.name} (${c.tier}${c.platform === "mobile" ? ", React Native" : ""}, ${c.category}): ${c.description}`;
}

// Mirrors lib/demo/describe.ts on the site.
function controlLine(c) {
  if (c.kind === "action" && c.prop === "$replay") return `- ${c.label}: replays the demo.`;
  const opts = (c.options ?? []).map((o) => (o && typeof o === "object" ? o : { value: o }));
  const range =
    c.kind === "slider" ? `${c.min}–${c.max}${c.unit ? ` ${c.unit}` : ""}${c.step ? `, step ${c.step}` : ""}`
    : c.kind === "select" || c.kind === "segmented" ? opts.map((o) => JSON.stringify(o.value)).join(" | ")
    : c.kind === "color" ? `hex colour${opts.length ? `; suggested ${opts.map((o) => o.value).join(", ")}` : ""}`
    : c.kind === "toggle" ? "true | false"
    : c.kind === "action" ? `runtime state: ${(opts.length ? opts.map((o) => JSON.stringify(o.value)) : [JSON.stringify(c.value)]).join(" | ")}`
    : "text";
  return `- \`${c.prop}\` (${c.label}, ${c.kind}): ${range}${c.default !== undefined ? ` · demo default ${JSON.stringify(c.default)}` : ""}`;
}
const controlsSection = (controls) =>
  controls?.length
    ? ["", "## Controls", "", "The props worth tuning, with the ranges the preview offers. Action controls show runtime states the host app drives.", "", ...controls.map(controlLine)]
    : [];

const proMessage = (slug) =>
  `"${slug}" is a Pro component. Set DESIGN_FOR_AI_LICENSE in this MCP server's environment to unlock it (get a licence at ${BASE}/pricing). The free components work without one; use search_components with tier "free" to find alternatives.`;

const server = new McpServer({ name: "design-for-ai", version: "0.2.0" });

server.tool(
  "search_components",
  "Search Design for AI's design components by keyword, category, tier or platform. Returns slugs to pass to get_component.",
  {
    query: z.string().optional().describe("Keywords, e.g. 'pricing', 'chart', 'bottom sheet', 'three.js'"),
    category: z.string().optional().describe("Category key, e.g. hero, pricing, charts, three-d, pixel, ai, app, mobile"),
    tier: z.enum(["free", "pro"]).optional(),
    platform: z.enum(["web", "mobile"]).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  },
  async ({ query, category, tier, platform, limit = 12 }) => {
    const all = await index();
    const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const scored = all
      .filter((c) => (!category || c.category === category) && (!tier || c.tier === tier) && (!platform || c.platform === platform))
      .map((c) => {
        const hay = [c.name, c.slug, c.description, c.category, ...(c.tags ?? [])].join(" ").toLowerCase();
        const score = words.reduce((s, w) => s + (hay.includes(w) ? (c.name.toLowerCase().includes(w) ? 3 : 1) : 0), 0);
        return { c, score };
      })
      .filter((x) => !words.length || x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    if (!scored.length) return text(`No components matched. Try list_categories, or a broader query.`);
    return text(
      [`${scored.length} component(s):`, ...scored.map((x) => line(x.c)), "", `Call get_component with a slug for its code, prompt and JSON prompt.${LICENSE ? "" : " Pro components need DESIGN_FOR_AI_LICENSE."}`].join("\n"),
    );
  },
);

server.tool(
  "get_component",
  "Get one component: install command, usage, props, tunable controls, the design prompt, the JSON prompt and the full source file.",
  {
    slug: z.string().describe("Component slug from search_components"),
    include: z.array(z.enum(["code", "prompt", "json", "props", "controls", "install"])).optional().describe("Sections to include (default: all)"),
  },
  async ({ slug, include }) => {
    const want = new Set(include ?? ["code", "prompt", "json", "props", "controls", "install"]);
    try {
      const c = await api(`/api/registry/${encodeURIComponent(slug)}`);
      const parts = [`# ${c.name} (${c.slug})`, "", c.description, "", `Tier: ${c.tier} · Platform: ${c.platform} · File: ${c.file}${c.dependencies?.length ? ` · Dependencies: ${c.dependencies.join(", ")}` : ""}`];
      if (want.has("install")) parts.push("", "## Install", "```bash", c.install, "```", "", "## Usage", "```tsx", c.usage, "```");
      if (want.has("props") && c.props?.length) parts.push("", "## Props", ...c.props.map((p) => `- \`${p.name}\`: ${p.type}${p.default ? ` (default ${p.default})` : ""}. ${p.description}`));
      if (want.has("controls") || want.has("props")) parts.push(...controlsSection(c.controls));
      if (want.has("prompt")) parts.push("", "## Design prompt", c.prompt.trim());
      if (want.has("json")) parts.push("", "## JSON prompt", "```json", JSON.stringify(c.promptJson, null, 2), "```");
      if (want.has("code")) parts.push("", `## Source (${c.file})`, "```tsx", c.code.trim(), "```");
      return text(parts.join("\n"));
    } catch (e) {
      if (e.code === "PRO") {
        // Controls are public metadata, so show them even without a licence.
        const meta = (await index()).find((x) => x.slug === slug);
        return text([proMessage(slug), ...controlsSection(meta?.controls)].join("\n"));
      }
      throw e;
    }
  },
);

server.tool("list_categories", "List every component category with counts of free and Pro components.", {}, async () => {
  const all = await index();
  const by = new Map();
  for (const c of all) {
    const b = by.get(c.category) ?? { free: 0, pro: 0 };
    b[c.tier] += 1;
    by.set(c.category, b);
  }
  return text([...by.entries()].map(([k, v]) => `- ${k}: ${v.free} free, ${v.pro} Pro`).join("\n"));
});

server.tool(
  "get_principles",
  "The anti-slop design principles every component follows, plus a checklist to apply to any UI the agent builds.",
  {},
  async () => {
    const file = path.join(here, "principles.md");
    const md = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/^---[\s\S]*?---\n/, "") : `Read ${BASE}/docs/principles`;
    return text(md);
  },
);

server.tool(
  "install_command",
  "The exact command that adds a component to the current project (shadcn CLI for web, curl for React Native).",
  { slug: z.string() },
  async ({ slug }) => {
    try {
      const c = await api(`/api/registry/${encodeURIComponent(slug)}`);
      return text(c.install);
    } catch (e) {
      if (e.code === "PRO") return text(proMessage(slug));
      throw e;
    }
  },
);

server.tool(
  "get_page",
  "Any page of design.yaps.ai as Markdown, e.g. 'pricing', 'docs/installation', 'docs/agents', 'categories/auth', 'components'.",
  { path: z.string().describe("Page path without the domain or .md") },
  async ({ path: page }) => {
    const p = page.replace(/^\/+|\/+$/g, "").replace(/\.md$/, "") || "index";
    const res = await fetch(`${BASE}/${p}.md`, { headers: { Accept: "text/markdown" } });
    return text(res.ok ? await res.text() : `No page "${page}". Try 'components', 'pricing' or 'docs/installation'.`);
  },
);

await server.connect(new StdioServerTransport());
