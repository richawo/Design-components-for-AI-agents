import "server-only";
import { getDoc } from "./content";
import { fileNameFor, installText } from "./install";
import type { Verified } from "./license";
import { markdownForPage } from "./page-markdown";
import { allComponents, categoriesWithCounts, getComponent, readSource } from "./registry";
import { absoluteUrl, site } from "./site";

/**
 * A stateless MCP server (Streamable HTTP transport, JSON responses) served
 * from /mcp on the site itself. No install step: point any MCP client at the
 * URL. Pro components unlock with `Authorization: Bearer <licence>`.
 *
 * The local stdio server (packages/mcp) offers the same tools over the API.
 */

export const SERVER_INFO = { name: "design-for-ai", title: "Design for AI", version: "0.2.0" };
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export const INSTRUCTIONS = `Design for AI is a library of premium, hand-built React + Tailwind v4 (and React Native) components, each with a design prompt and a JSON prompt. Use search_components to find candidates, get_component for code, props and the design brief, and get_principles before building UI from scratch. Free components work without a licence; Pro components need the user's licence key as a Bearer token. Adapt colours and copy to the project, but keep the type scale, spacing, motion and states the brief specifies.`;

type JsonRpcId = string | number | null;
type Req = { jsonrpc: "2.0"; id?: JsonRpcId; method: string; params?: Record<string, unknown> };
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
type Ctx = { license: Verified };

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });

const line = (c: ReturnType<typeof allComponents>[number]) =>
  `- ${c.slug} · ${c.name} (${c.tier}${c.platform === "mobile" ? ", React Native" : ""}, ${c.category}): ${c.description}`;

const proMessage = (slug: string) =>
  `"${slug}" is a Pro component. Ask the user for their Design for AI licence key and connect with the header "Authorization: Bearer <key>" (get one at ${absoluteUrl("/pricing")}). Free alternatives: search_components with tier "free".`;

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: Ctx) => Promise<ToolResult>;
};

const readOnly = { readOnlyHint: true, openWorldHint: false };

export const TOOLS: Tool[] = [
  {
    name: "search_components",
    title: "Search components",
    description: "Search Design for AI's components by keyword, category, tier or platform. Returns slugs to pass to get_component.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords, e.g. 'pricing', 'sign in', 'header', 'three.js', 'chart', 'bottom sheet'" },
        category: { type: "string", description: "Category key: " + categoriesWithCounts().map((c) => c.key).join(", ") },
        tier: { type: "string", enum: ["free", "pro"] },
        platform: { type: "string", enum: ["web", "mobile"] },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 12 },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    async run(a) {
      const words = String(a.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const limit = Math.min(50, Math.max(1, Number(a.limit ?? 12)));
      const hits = allComponents()
        .filter((c) => (!a.category || c.category === a.category) && (!a.tier || c.tier === a.tier) && (!a.platform || c.platform === a.platform))
        .map((c) => {
          const hay = [c.name, c.slug, c.description, c.category, ...c.tags].join(" ").toLowerCase();
          const score = words.reduce((s, w) => s + (hay.includes(w) ? (c.name.toLowerCase().includes(w) || c.slug.includes(w) ? 3 : 1) : 0), 0);
          return { c, score };
        })
        .filter((x) => !words.length || x.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, limit);
      if (!hits.length) return text("No components matched. Try list_categories or a broader query.");
      return text([`${hits.length} component(s):`, ...hits.map((x) => line(x.c)), "", "Call get_component with a slug for its code, props and design brief."].join("\n"));
    },
  },
  {
    name: "get_component",
    title: "Get a component",
    description: "One component: install command, usage, props, the design prompt, the JSON prompt and the full source file.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Component slug from search_components" },
        include: {
          type: "array",
          items: { type: "string", enum: ["install", "props", "prompt", "json", "code"] },
          description: "Sections to include (default: all)",
        },
      },
      required: ["slug"],
      additionalProperties: false,
    },
    annotations: readOnly,
    async run(a, ctx) {
      const slug = String(a.slug ?? "");
      const e = getComponent(slug);
      if (!e) return text(`No component "${slug}". Use search_components to find slugs.`, true);
      const want = new Set((a.include as string[] | undefined) ?? ["install", "props", "prompt", "json", "code"]);
      const parts = [
        `# ${e.name} (${e.slug})`,
        "",
        e.description,
        "",
        `Tier: ${e.tier} · Platform: ${e.platform} · Category: ${e.category} · File: ${fileNameFor(e)}${e.dependencies.length ? ` · Dependencies: ${e.dependencies.join(", ")}` : ""}`,
        `Page: ${absoluteUrl(`/components/${e.slug}`)}`,
      ];
      if (want.has("install")) parts.push("", "## Install", "```bash", installText(e), "```", "", "## Usage", "```tsx", e.usage, "```");
      if (want.has("props") && e.props.length)
        parts.push("", "## Props", ...e.props.map((p) => `- \`${p.name}\`: ${p.type}${p.default ? ` (default ${p.default})` : ""}. ${p.description}`));
      const needsSource = want.has("prompt") || want.has("json") || want.has("code");
      if (needsSource) {
        if (e.tier === "pro" && !ctx.license.ok) {
          parts.push("", proMessage(slug));
        } else {
          const src = await readSource(slug);
          if (!src) parts.push("", "Source isn't available in this deployment.");
          else {
            if (want.has("prompt")) parts.push("", "## Design prompt", src.prompt.trim());
            if (want.has("json")) parts.push("", "## JSON prompt", "```json", src.promptJson.trim(), "```");
            if (want.has("code")) parts.push("", `## Source (${fileNameFor(e)})`, "```tsx", src.code.trim(), "```");
          }
        }
      }
      return text(parts.join("\n"));
    },
  },
  {
    name: "list_categories",
    title: "List categories",
    description: "Every component category with a description and counts of free and Pro components.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: readOnly,
    async run() {
      const all = allComponents();
      return text(
        categoriesWithCounts()
          .map((c) => {
            const list = all.filter((e) => e.category === c.key);
            return `- ${c.key} · ${c.label}: ${list.filter((e) => e.tier === "free").length} free, ${list.filter((e) => e.tier === "pro").length} Pro. ${c.blurb}`;
          })
          .join("\n"),
      );
    },
  },
  {
    name: "get_principles",
    title: "Design principles",
    description: "The anti-slop design principles every component follows, plus a checklist. Read before building UI from scratch.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: readOnly,
    async run() {
      const d = await getDoc("principles");
      return text(d ? `# ${d.meta.title}\n\n${d.markdown.trim()}` : `Read ${absoluteUrl("/docs/principles.md")}`);
    },
  },
  {
    name: "install_command",
    title: "Install command",
    description: "The exact command that adds a component to the current project (shadcn CLI for web, curl for React Native).",
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"], additionalProperties: false },
    annotations: readOnly,
    async run(a) {
      const e = getComponent(String(a.slug ?? ""));
      return e ? text(installText(e)) : text(`No component "${String(a.slug)}".`, true);
    },
  },
  {
    name: "get_page",
    title: "Read a site page",
    description: "Any page of design.yaps.ai as Markdown, e.g. 'pricing', 'docs/installation', 'docs/agents', 'categories/auth', 'components'.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "Page path without the domain or .md" } }, required: ["path"], additionalProperties: false },
    annotations: readOnly,
    async run(a) {
      const md = await markdownForPage(String(a.path ?? ""));
      return md ? text(md) : text(`No page "${String(a.path)}". Try 'components', 'pricing' or 'docs/installation'.`, true);
    },
  },
];

const ok = (id: JsonRpcId, result: unknown) => ({ jsonrpc: "2.0" as const, id, result });
const fail = (id: JsonRpcId, code: number, message: string) => ({ jsonrpc: "2.0" as const, id, error: { code, message } });

/** Handles one JSON-RPC message. Returns null for notifications. */
export async function handleMessage(msg: Req, ctx: Ctx) {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined;
  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") return isNotification ? null : fail(id, -32600, "Invalid request");

  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { ...SERVER_INFO, websiteUrl: site.url },
        instructions: INSTRUCTIONS + (ctx.license.ok ? " A Pro licence is active for this connection." : ""),
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS.map(({ run: _r, ...t }) => t) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${name}`);
      try {
        return ok(id, await tool.run((msg.params?.arguments as Record<string, unknown>) ?? {}, ctx));
      } catch (e) {
        return ok(id, text(`Tool failed: ${(e as Error).message}`, true));
      }
    }
    default:
      if (msg.method.startsWith("notifications/")) return null;
      return isNotification ? null : fail(id, -32601, `Method not found: ${msg.method}`);
  }
}
