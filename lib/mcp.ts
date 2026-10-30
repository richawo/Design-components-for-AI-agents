import { VISUAL_STYLE_IDS, parseStyleTheme, parseVisualStyle, supportsVisualStyle, styleInstallText, withStyleTheme, visualStyleQuery } from "./visual-styles";
import { readVisualSource } from "./visual-style-source";
import "server-only";
import { cataloguePath } from "./catalogue-path";
import { getDoc } from "./content";
import { controlsSection } from "./demo/describe";
import { fileNameFor, installText } from "./install";
import type { Verified } from "./license";
import { markdownForPage } from "./page-markdown";
import { localeByCode } from "./blog/locales.mjs";
import { GET as componentMarkdown } from "@/app/md/components/[slug]/route";
import { GET as blockMarkdown } from "@/app/md/blocks/[slug]/route";
import { GET as localizedMarkdown } from "@/app/md/localized/[locale]/[...path]/route";
import {
  allComponents,
  categoriesWithCounts,
  getComponent,
} from "./registry";
import { absoluteUrl, site } from "./site";

/**
 * A stateless MCP server (Streamable HTTP transport, JSON responses) served
 * from /mcp on the site itself. No install step: point any MCP client at the
 * URL. Pro components unlock by signing in at /mcp/pro (OAuth, see
 * lib/commerce/oauth.ts) or with `Authorization: Bearer <licence>`.
 *
 * The local stdio server (packages/mcp) offers the same tools over the API.
 */

export const SERVER_INFO = {
  name: "design-for-ai",
  title: "Design for AI",
  version: "0.3.0",
};
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export const INSTRUCTIONS = `Design for AI is a library of premium, hand-built React + Tailwind v4 (and React Native) components, each with a design prompt and a JSON prompt. Use search_components to find candidates, get_component for code, props and the design brief, and get_principles before building UI from scratch. Free components work without signing in; Pro components need the user's Pro licence, through browser sign-in at /mcp/pro or a licence key as a Bearer token. Crayon is an optional Pro visual style, including on free components. Discover it with search_components visualStyle "crayon", then request get_component with the same visualStyle. Adapt colours and copy to the project, but keep the type scale, spacing, motion and states the brief specifies.`;

type JsonRpcId = string | number | null;
type Req = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};
type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};
/** Why a credential sent to the open endpoint was not accepted. */
export type KeyIssue = "empty" | "unexpanded" | "scheme" | "invalid" | "expired" | "revoked";
export type Ctx = { license: Verified; account?: { email: string }; keyIssue?: KeyIssue };

const text = (t: string, isError = false): ToolResult => ({
  content: [{ type: "text", text: t }],
  ...(isError ? { isError } : {}),
});

const line = (c: ReturnType<typeof allComponents>[number]) =>
  `- ${c.slug} · ${c.name} (${c.tier}${c.platform === "mobile" ? ", React Native" : ""}, ${c.category}): ${c.description}${c.visualStyles?.includes("crayon") ? " · Styles: Original, Crayon (Pro)" : ""}`;

const SIGN_IN = () => `To unlock Pro without handling a key, connect to ${absoluteUrl("/mcp/pro")} instead: the client opens a browser sign-in. Setup for each agent: ${absoluteUrl("/docs/agents")}.`;

/** Explains a credential problem in terms the user can act on. */
export function connectionNotice(ctx: Ctx): string | null {
  if (ctx.license.ok) return null;
  if (ctx.account) return `Signed in as ${ctx.account.email}, but this account has no active Pro licence. Free components still work. Plans: ${absoluteUrl("/pricing")}. If the licence belongs to another email, sign in with that address.`;
  switch (ctx.keyIssue) {
    case "empty": return `The Authorization header on this connection is empty, so the licence variable (usually DESIGN_FOR_AI_LICENSE) was probably unset when the server was added. ${SIGN_IN()}`;
    case "unexpanded": return `The Authorization header contains a variable name rather than a licence key, so this client didn't expand it. Put the key in the client's supported secret or environment setting. ${SIGN_IN()}`;
    case "scheme": return `The Authorization header must be "Bearer <licence key>". ${SIGN_IN()}`;
    case "expired": return `The licence key on this connection has expired. Renew or check it at ${absoluteUrl("/account")}. ${SIGN_IN()}`;
    case "revoked": return `The licence key on this connection is no longer active (refunded, removed from a team or replaced). Check ${absoluteUrl("/account")}. ${SIGN_IN()}`;
    case "invalid": return `The licence key on this connection isn't valid. Copy it again from ${absoluteUrl("/account")}; it starts with dfa_. ${SIGN_IN()}`;
    default: return null;
  }
}

const proMessage = (slug: string, ctx: Ctx) =>
  `"${slug}" is a Pro component. ${connectionNotice(ctx) ?? `Ask the user to connect their Design for AI account: ${SIGN_IN()} A licence key also works as the header "Authorization: Bearer <key>" (plans at ${absoluteUrl("/pricing")}).`} Free alternatives: search_components with tier "free".`;

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
    description:
      "Search Design for AI's components by keyword, category, tier or platform. Returns slugs to pass to get_component.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Keywords, e.g. 'pricing', 'sign in', 'header', 'three.js', 'chart', 'bottom sheet'",
        },
        category: {
          type: "string",
          description:
            "Category key: " +
            categoriesWithCounts()
              .map((c) => c.key)
              .join(", "),
        },
        kind: { type: "string", enum: ["component", "block"] },
        tier: { type: "string", enum: ["free", "pro"] },
        platform: { type: "string", enum: ["web", "mobile"] },
        visualStyle: { type: "string", enum: VISUAL_STYLE_IDS, description: "Optional visual style. Crayon requires Pro, including for free components." },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 12 },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    async run(a) {
      const words = String(a.query ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const limit = Math.min(50, Math.max(1, Number(a.limit ?? 12)));
      const hits = allComponents()
        .filter(
          (c) =>
            (!a.kind || (c.kind ?? "component") === a.kind) &&
            (!a.category || c.category === a.category) &&
            (!a.tier || c.tier === a.tier) &&
            (!a.platform || c.platform === a.platform) &&
            (!a.visualStyle || c.visualStyles?.some(style => style === a.visualStyle) || a.visualStyle === "original"),
        )
        .map((c) => {
          const hay = [c.name, c.slug, c.description, c.category, ...c.tags]
            .join(" ")
            .toLowerCase();
          const score = words.reduce(
            (s, w) =>
              s +
              (hay.includes(w)
                ? c.name.toLowerCase().includes(w) || c.slug.includes(w)
                  ? 3
                  : 1
                : 0),
            0,
          );
          return { c, score };
        })
        .filter((x) => !words.length || x.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, limit);
      if (!hits.length)
        return text(
          "No components matched. Try list_categories or a broader query.",
        );
      return text(
        [
          `${hits.length} component(s):`,
          ...hits.map((x) => line(x.c)),
          "",
          "Call get_component with a slug for its code, props and design brief.",
        ].join("\n"),
      );
    },
  },
  {
    name: "get_component",
    title: "Get a component",
    description:
      "One component: install command, usage, props, tunable controls (prop ranges and choices), the design prompt, the JSON prompt and the full source file.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Component slug from search_components",
        },
        visualStyle: { type: "string", enum: VISUAL_STYLE_IDS, description: "Crayon source and prompts require a paid Pro licence even when the base is free." },
        theme: { type: "string", enum: ["light", "dark"], description: "Crayon installation theme. Both themes are included in the source; defaults to light." },
        include: {
          type: "array",
          items: {
            type: "string",
            enum: ["install", "props", "controls", "prompt", "json", "code"],
          },
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
      if (!e)
        return text(
          `No component "${slug}". Use search_components to find slugs.`,
          true,
        );
      const visualStyle = parseVisualStyle(a.visualStyle);
      if (!visualStyle || !supportsVisualStyle(e, visualStyle)) return text(`That visual style is not available for "${slug}". Search with visualStyle "crayon" to find supported components.`, true);
      if (visualStyle === "crayon" && !ctx.license.ok) return text(`Crayon is a Pro style, including on free components. ${connectionNotice(ctx) ?? SIGN_IN()} Plans: ${absoluteUrl("/pricing")}.`, true);
      const theme = parseStyleTheme(a.theme);
      if (!theme) return text("Choose a light or dark Crayon theme.", true);
      const selectedMeta = visualStyle === "crayon" ? withStyleTheme(e,theme) : e;
      const want = new Set(
        (a.include as string[] | undefined) ?? [
          "install",
          "props",
          "controls",
          "prompt",
          "json",
          "code",
        ],
      );
      const parts = [
        `# ${e.name} (${e.slug})`,
        "",
        e.description,
        "",
        `Tier: ${e.tier} · Platform: ${e.platform} · Category: ${e.category} · File: ${fileNameFor(e)}${e.dependencies.length ? ` · Dependencies: ${e.dependencies.join(", ")}` : ""}`,
        `Page: ${absoluteUrl(cataloguePath(e)+visualStyleQuery(visualStyle,theme))}`,
        `Visual style: ${visualStyle}${visualStyle === "crayon" ? " · Style licence: Pro" : ""}`,
        `Available styles: ${(e.visualStyles ?? ["original"]).join(", ")}${e.visualStyles?.includes("crayon") ? " (Crayon requires Pro)" : ""}`,
      ];
      if (want.has("install"))
        parts.push(
          "",
          "## Install",
          "```bash",
          visualStyle === "crayon" ? styleInstallText(e,theme) : installText(e),
          "```",
          "",
          "## Usage",
          "```tsx",
          selectedMeta.usage,
          "```",
        );
      if (want.has("props") && selectedMeta.props.length)
        parts.push(
          "",
          "## Props",
          ...selectedMeta.props.map(
            (p) =>
              `- \`${p.name}\`: ${p.type}${p.default ? ` (default ${p.default})` : ""}. ${p.description}`,
          ),
        );
      // Controls are public metadata, so Pro components show them without a licence too.
      if ((want.has("controls") || want.has("props")) && selectedMeta.controls?.length)
        parts.push("", ...controlsSection(selectedMeta.controls));
      const needsSource =
        want.has("prompt") || want.has("json") || want.has("code");
      if (needsSource) {
        if (e.tier === "pro" && !ctx.license.ok) {
          parts.push("", proMessage(slug, ctx));
        } else {
          const src = await readVisualSource(slug, visualStyle, theme);
          if (!src)
            parts.push("", "Source isn't available in this deployment.");
          else {
            if (want.has("prompt"))
              parts.push("", "## Design prompt", src.prompt.trim());
            if (want.has("json"))
              parts.push(
                "",
                "## JSON prompt",
                "```json",
                src.promptJson.trim(),
                "```",
              );
            if (want.has("code"))
              parts.push(
                "",
                `## Source (${fileNameFor(e)})`,
                "```tsx",
                src.code.trim(),
                "```",
              );
          }
        }
      }
      return text(parts.join("\n"));
    },
  },
  {
    name: "list_categories",
    title: "List categories",
    description:
      "Every component category with a description and counts of free and Pro components.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
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
    description:
      "The anti-slop design principles every component follows, plus a checklist. Read before building UI from scratch.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: readOnly,
    async run() {
      const d = await getDoc("principles");
      return text(
        d
          ? `# ${d.meta.title}\n\n${d.markdown.trim()}`
          : `Read ${absoluteUrl("/docs/principles.md")}`,
      );
    },
  },
  {
    name: "install_command",
    title: "Install command",
    description:
      "The exact command that adds a component to the current project (shadcn CLI for web, curl for React Native).",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, visualStyle: { type: "string", enum: VISUAL_STYLE_IDS }, theme: { type: "string", enum: ["light", "dark"] } },
      required: ["slug"],
      additionalProperties: false,
    },
    annotations: readOnly,
    async run(a) {
      const e = getComponent(String(a.slug ?? ""));
      if (!e) return text(`No component "${String(a.slug)}".`, true);
      const style = parseVisualStyle(a.visualStyle);
      if (!style || !supportsVisualStyle(e,style)) return text("That visual style is not available for this component.",true);
      const theme = parseStyleTheme(a.theme);
      if (!theme) return text("Choose a light or dark Crayon theme.",true);
      return text(style === "crayon" ? styleInstallText(e,theme) : installText(e));
    },
  },
  {
    name: "get_page",
    title: "Read a site page",
    description:
      "A public page of design.yaps.ai as Markdown, e.g. 'pricing', 'docs/installation', 'fr/docs/installation', 'components/<slug>', 'fr/blocks/<slug>', 'blog/<slug>' or 'sitemap'. Localized editions keep their language and canonical URL; Pro source remains licensed.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Page path without the domain or .md",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    annotations: readOnly,
    async run(a) {
      const requested = String(a.path ?? "");
      const parts = requested.replace(/^\/+|\/+$/g, "").split("/");
      const locale = localeByCode(parts[0]);
      let md: string | null;
      if (locale && locale.code !== "en" && parts[1] !== "blog") {
        const response = await localizedMarkdown(new Request(absoluteUrl("/")), {
          params: Promise.resolve({ locale: locale.code, path: parts.slice(1) }),
        });
        md = response.ok ? await response.text() : null;
      } else if (parts.length === 2 && ["components", "blocks"].includes(parts[0])) {
        const response = await (parts[0] === "blocks" ? blockMarkdown : componentMarkdown)(new Request(absoluteUrl("/")), {
          params: Promise.resolve({ slug: parts[1] }),
        });
        md = response.ok ? await response.text() : null;
      } else {
        md = await markdownForPage(requested);
      }
      return md
        ? text(md)
        : text(
            `No page "${String(a.path)}". Try 'components', 'pricing' or 'docs/installation'.`,
            true,
          );
    },
  },
];

const ok = (id: JsonRpcId, result: unknown) => ({
  jsonrpc: "2.0" as const,
  id,
  result,
});
const fail = (id: JsonRpcId, code: number, message: string) => ({
  jsonrpc: "2.0" as const,
  id,
  error: { code, message },
});

/** Handles one JSON-RPC message. Returns null for notifications. */
export async function handleMessage(msg: Req, ctx: Ctx) {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined;
  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string")
    return isNotification ? null : fail(id, -32600, "Invalid request");

  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { ...SERVER_INFO, websiteUrl: site.url },
        instructions: [
          INSTRUCTIONS,
          ctx.license.ok
            ? `A Pro licence is active for this connection${ctx.account ? ` (${ctx.account.email})` : ""}.`
            : connectionNotice(ctx),
        ].filter(Boolean).join(" "),
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
        return ok(
          id,
          await tool.run(
            (msg.params?.arguments as Record<string, unknown>) ?? {},
            ctx,
          ),
        );
      } catch (e) {
        return ok(id, text(`Tool failed: ${(e as Error).message}`, true));
      }
    }
    default:
      if (msg.method.startsWith("notifications/")) return null;
      return isNotification
        ? null
        : fail(id, -32601, `Method not found: ${msg.method}`);
  }
}
