#!/usr/bin/env node
// Builds everything the site and the agents read from registry/:
//
//   registry/__generated__/index.json        every component's metadata
//   registry/__generated__/previews.tsx      lazy loaders for live previews
//   registry/__generated__/sources/*.json    code + prompts (server-side reads only)
//   registry/__generated__/r-pro/*.json      Pro shadcn items, served behind a licence
//   registry/pro-manifest.json               public metadata for Pro components
//   public/r/*.json                          free shadcn registry items
//
// Pro source is optional. Without registry/pro (a fresh open-source clone) the
// site still builds: Pro components come from pro-manifest.json and render as
// locked cards.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const registryDir = path.join(root, "registry");
const outDir = path.join(registryDir, "__generated__");
const publicR = path.join(root, "public", "r");
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://design.yaps.ai").replace(/\/$/, "");

const CATEGORIES = [
  "charts", "three-d", "pixel", "hero", "pricing", "features", "social-proof", "cta", "navigation", "content",
  "ai", "app", "forms", "portfolio", "commerce", "primitives", "mobile",
];
const REQUIRED_PROMPT_KEYS = [
  "component", "intent", "platform", "stack", "layout", "typography", "color",
  "motion", "responsive", "accessibility", "content", "avoid",
];

const STRICT = process.argv.includes("--strict");
const errors = [];
const broken = new Set();
const fail = (slug, msg) => {
  errors.push(`${slug}: ${msg}`);
  broken.add(slug);
};

function readComponents(tier) {
  const dir = path.join(registryDir, tier);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
    .map((d) => {
      const slug = d.name;
      const base = path.join(dir, slug);
      const metaPath = path.join(base, "meta.json");
      if (!fs.existsSync(metaPath)) {
        fail(slug, "missing meta.json");
        return null;
      }
      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      } catch (e) {
        fail(slug, `meta.json is not valid JSON (${e.message})`);
        return null;
      }
      const codePath = path.join(base, `${slug}.tsx`);
      const promptPath = path.join(base, "prompt.md");
      const jsonPath = path.join(base, "prompt.json");
      for (const p of [codePath, promptPath, jsonPath]) {
        if (!fs.existsSync(p)) fail(slug, `missing ${path.basename(p)}`);
      }
      validateMeta(slug, tier, meta);
      let promptJson = "";
      if (fs.existsSync(jsonPath)) {
        promptJson = fs.readFileSync(jsonPath, "utf8");
        try {
          const parsed = JSON.parse(promptJson);
          for (const k of REQUIRED_PROMPT_KEYS) if (!(k in parsed)) fail(slug, `prompt.json missing "${k}"`);
        } catch (e) {
          fail(slug, `prompt.json is not valid JSON (${e.message})`);
        }
      }
      return {
        meta,
        tier,
        importPath: `../${tier}/${slug}/${slug}`,
        code: fs.existsSync(codePath) ? fs.readFileSync(codePath, "utf8") : "",
        prompt: fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf8") : "",
        promptJson,
      };
    })
    .filter(Boolean);
}

function validateMeta(slug, tier, m) {
  if (m.slug !== slug) fail(slug, `meta.slug "${m.slug}" does not match folder`);
  if (m.tier !== tier) fail(slug, `meta.tier "${m.tier}" but folder is ${tier}/`);
  if (!["web", "mobile"].includes(m.platform)) fail(slug, `bad platform "${m.platform}"`);
  if (!CATEGORIES.includes(m.category)) fail(slug, `unknown category "${m.category}"`);
  if (m.platform === "mobile" && m.category !== "mobile") fail(slug, "mobile components use category \"mobile\"");
  if (typeof m.name !== "string" || m.name.length < 3) fail(slug, "name missing");
  if (typeof m.description !== "string" || m.description.length < 80 || m.description.length > 170)
    fail(slug, `description must be 80–170 chars (is ${m.description?.length ?? 0})`);
  if (!Array.isArray(m.tags) || m.tags.length < 3) fail(slug, "needs at least 3 tags");
  if (!Array.isArray(m.dependencies)) fail(slug, "dependencies must be an array");
  if (!["light", "dark"].includes(m.theme)) fail(slug, "theme must be light or dark");
  if (typeof m.previewHeight !== "number") fail(slug, "previewHeight must be a number");
  if (typeof m.usage !== "string" || !m.usage.trim()) fail(slug, "usage missing");
  if (!Array.isArray(m.props)) fail(slug, "props must be an array");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.added ?? "")) fail(slug, "added must be YYYY-MM-DD");
}

function registryItem(c) {
  const m = c.meta;
  const target = m.platform === "mobile" ? `components/design-for-ai/native/${m.slug}.tsx` : `components/design-for-ai/${m.slug}.tsx`;
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: m.slug,
    type: "registry:block",
    title: m.name,
    description: m.description,
    author: "Design for AI <hello@yaps.ai>",
    dependencies: m.dependencies,
    registryDependencies: m.platform === "web" ? [`${SITE_URL}/r/theme.json`] : [],
    files: [{ path: `registry/${c.tier}/${m.slug}/${m.slug}.tsx`, content: c.code, type: "registry:component", target }],
    categories: [m.category, ...m.tags].slice(0, 8),
    docs: `Prompt: ${SITE_URL}/components/${m.slug}.md`,
  };
}

const THEME_ITEM = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "theme",
  type: "registry:theme",
  title: "Design for AI theme",
  description: "Font roles used by every Design for AI component: display, serif, sans and mono. Swap the families for your brand's.",
  dependencies: ["@fontsource-variable/bricolage-grotesque", "@fontsource/instrument-serif", "@fontsource-variable/geist", "@fontsource-variable/geist-mono"],
  cssVars: {
    theme: {
      "font-display": '"Bricolage Grotesque Variable", "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
      "font-serif": '"Instrument Serif", ui-serif, Georgia, serif',
      "font-sans": '"Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif',
      "font-mono": '"Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, monospace',
    },
  },
  files: [],
};

function writeJson(p, data) {
  const text = JSON.stringify(data, null, 2) + "\n";
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === text) return;
  fs.writeFileSync(p, text);
}

// In dev, a half-finished component is skipped so it can't break the others.
// With --strict (prebuild, CI) any problem fails the build.
const free = readComponents("free").filter((c) => !broken.has(c.meta.slug));
const pro = readComponents("pro").filter((c) => !broken.has(c.meta.slug));
const proManifestPath = path.join(registryDir, "pro-manifest.json");
const hasProSource = pro.length > 0;

// Slugs must be unique across tiers.
const seen = new Set();
for (const c of [...free, ...pro]) {
  if (seen.has(c.meta.slug)) fail(c.meta.slug, "slug used in both free/ and pro/");
  seen.add(c.meta.slug);
}

if (errors.length) {
  console.error(`\nRegistry has ${errors.length} problem(s)${STRICT ? "" : " (skipped those components)"}:\n  - ${errors.join("\n  - ")}\n`);
  if (STRICT) process.exit(1);
}

// Pro metadata: from source when we have it, otherwise from the committed manifest.
let proMetas;
if (hasProSource) {
  proMetas = pro.map((c) => c.meta).sort((a, b) => a.slug.localeCompare(b.slug));
  writeJson(proManifestPath, proMetas);
} else {
  proMetas = fs.existsSync(proManifestPath) ? JSON.parse(fs.readFileSync(proManifestPath, "utf8")) : [];
}

const entries = [
  ...free.map((c) => ({ ...c.meta, hasSource: true })),
  ...proMetas.map((m) => ({ ...m, hasSource: hasProSource })),
].sort((a, b) => a.name.localeCompare(b.name));

// Write in place (several agents may run this while a dev server is compiling)
// and prune files for components that no longer exist.
function prune(dir, keep) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.rmSync(path.join(dir, f), { force: true });
}
function writeIfChanged(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === text) return;
  fs.writeFileSync(p, text);
}
writeJson(path.join(outDir, "index.json"), entries);
prune(path.join(outDir, "sources"), new Set([...free, ...pro].map((c) => `${c.meta.slug}.json`)));
prune(path.join(outDir, "r-pro"), new Set(pro.map((c) => `${c.meta.slug}.json`)));

for (const c of [...free, ...pro]) {
  writeJson(path.join(outDir, "sources", `${c.meta.slug}.json`), {
    slug: c.meta.slug,
    code: c.code,
    prompt: c.prompt,
    promptJson: c.promptJson,
  });
}

const loaders = [...free, ...pro]
  .map((c) => `  ${JSON.stringify(c.meta.slug)}: () => import(${JSON.stringify(c.importPath)}),`)
  .join("\n");
writeIfChanged(
  path.join(outDir, "previews.tsx"),
  `// Generated by scripts/build-registry.mjs. Do not edit.\nimport type { ComponentType } from "react";\n\nexport const previews: Record<string, () => Promise<{ default: ComponentType }>> = {\n${loaders}\n};\n`,
);

// shadcn registry: free items are public files, Pro items are served by the API.
prune(publicR, new Set([...free.map((c) => `${c.meta.slug}.json`), "theme.json", "registry.json"]));
for (const c of free) writeJson(path.join(publicR, `${c.meta.slug}.json`), registryItem(c));
for (const c of pro) writeJson(path.join(outDir, "r-pro", `${c.meta.slug}.json`), registryItem(c));
writeJson(path.join(publicR, "theme.json"), THEME_ITEM);
writeJson(path.join(publicR, "registry.json"), {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "design-for-ai",
  homepage: SITE_URL,
  items: [
    { name: THEME_ITEM.name, type: THEME_ITEM.type, title: THEME_ITEM.title, description: THEME_ITEM.description },
    ...free.map((c) => ({ name: c.meta.slug, type: "registry:block", title: c.meta.name, description: c.meta.description })),
  ],
});

console.log(
  `registry: ${free.length} free, ${proMetas.length} pro${hasProSource ? "" : " (manifest only, no source)"}${errors.length ? `, ${errors.length} problem(s)` : ""}`,
);
