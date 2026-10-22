import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { LOCALES } from "../../lib/blog/locales.mjs";
import { packContent } from "./content-pack.mjs";
import { mapMarkdown } from "./blog-source.mjs";

export const keyOf = (text) => text.replace(/\s+/g, " ").trim();
// Demo datasets also contain code examples. They remain useful in every
// edition exactly as written, just like source panels and install commands.
const codeLike = (key) => /^(?:const |let |var |export |import |return |async |await |function |class |interface |type |test\(|it\(|describe\(|\/\/|-- |[+\-] (?:const|test|expect)\b)/.test(key)
  || /^(?:prisma |node |python3? |pip3? |deno |uv |cargo |stripe |gh |docker |kubectl |go (?:run|build|test) |SELECT |INSERT (?:OR \w+ )?INTO |UPDATE [a-z_]+ SET |DELETE FROM |(?:CREATE|ALTER|DROP) (?:TABLE|INDEX|UNIQUE INDEX) |PRAGMA )/.test(key)
  || /=>|^<\/?[a-z][\w.-]*(?:>|\s|\/>)/i.test(key)
  || /^(?:@(?:min|max)-|[;(]|\((?:amount_cents|seats)\)|, (?:invoiced_at\)|mrr\b))/.test(key)
  || /^(?:linear-gradient|radial-gradient|repeating-linear-gradient|color-mix|rgba?|hsla?|calc|var)\(/.test(key)
  || /^inset\s+[-\d]|^span db\.query\b/.test(key)
  || /^\d+\s+(?:[a-z0-9-]+\.)+[a-z]{2,}\//i.test(key)
  || /^at\s+[\w.$]+\s*\([^)]*:\d+:\d+\)/.test(key)
  || /^[^,\n]+,[^,\s]+,\d+(?:\.\d+)?,[^\s,]+@[^\s,]+$/.test(key)
  || /^(?:before|after|hover|focus|focus-visible|active|disabled|group-hover):/.test(key)
  || /^from:\([^)]*\) in:/.test(key)
  || /^\{[\s\S]*\}\.?$/.test(key)
  || /(?:^|\s)(?:Control|Meta|Alt|Shift)\+/.test(key)
  || /^Arrow(?:Left|Right|Up|Down)(?:\s+(?:ArrowLeft|ArrowRight|ArrowUp|ArrowDown|PageUp|PageDown|Home|End|Space|[\[\]]))+$/.test(key);
const human = (value, force = false) => {
  const key = keyOf(value);
  if (/\b(?:ui-monospace|ui-sans-serif|SFMono-Regular)\b/.test(key) || /^(?:GET|POST|PATCH|DELETE|PUT|HEAD|OPTIONS|apply_patch|read_file|list_files)\b/.test(key)) return false;
  if (/(?:^|\s)(?:[a-z-]+:)*!?(?:absolute|relative|fixed|sticky|block|inline|flex|grid|hidden|contents|sr-only|size|inset|top|left|right|bottom|translate|scale|rotate|z|order|col|row|basis|grow|shrink|cursor|overflow|opacity|transition|duration|ease|delay|leading|tracking|text|font|bg|border|rounded|shadow|ring|outline|space|gap|p[tlbrxy]?|m[tlbrxy]?|w|h|min-w|max-w|min-h|max-h|items|justify|pointer-events|select|touch|animate|will-change)(?:$|[-:\[])/.test(key)) return false;
  if (/^(?:npx |npm |pnpm |yarn |bunx? |claude mcp |curl |git )/.test(key) || /^\d.*(?:rgba|hsl|rgb|px)/.test(key) || /^\//.test(key.replace(/\{\{\d+\}\}/g, ""))) return false;
  return key.length > 1 && key.length < 2500 && /[a-zA-Z]/.test(key) && !/^(?:https?:|\/|[.#@][\w.-]+$|--|data:|\w+\()/.test(key)
    && !/[{};=<>]/.test(key.replace(/\{\{\d+\}\}/g, "")) && !/(?:\b(?:bg|text|border|font|rounded|flex|grid|px|py|mt|mb|gap|w|h|shadow|items|justify|leading|tracking)-|\buse client\b|\buse server\b)/.test(key)
    && ((force && /[a-zA-Z]{2,}/.test(key)) || /[a-zA-Z]{2,}\s+[a-zA-Z{{]/.test(key) || /^[A-Z][A-Za-z0-9 &'’.,!?/:()–-]+$/.test(key) || /\{\{\d+\}\}/.test(key));
};
export function sourceKeys(source) {
  const keys = new Set();
  let ast;
  try { ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] }); } catch { return keys; }
  const add = (text, force = false) => {
    const key = keyOf(text);
    if (!key || codeLike(key) || !human(key, force)) return;
    keys.add(key);
    if (text.includes("\n")) for (const line of text.split(/\r?\n/)) if (line.trim()) add(line, true);
  };
  const walk = (node, parent) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXAttribute" && (["className", "style", "id", "htmlFor", "value", "defaultValue", "aria-labelledby", "aria-describedby", "aria-controls", "aria-activedescendant", "aria-owns"].includes(node.name?.name) || node.name?.name?.startsWith("data-"))) return;
    if (node.type === "JSXElement" && ["code", "pre", "kbd", "script", "style"].includes(node.openingElement.name?.name)) return;
    if (parent?.type === "ObjectProperty" && /^(?:fontFamily|fontVariationSettings|gridTemplateAreas|boxShadow|textShadow|clipPath|backgroundImage|transform|transition|filter)$/.test(parent.key?.name ?? "")) return;
    if (node.type === "JSXText") add(node.value, true);
    if (node.type === "StringLiteral") add(node.value, (parent?.type === "JSXAttribute" && ["title", "alt", "placeholder", "aria-label"].includes(parent.name?.name)) || parent?.type === "JSXExpressionContainer" || (parent?.type === "ObjectProperty" && ["label", "title", "description", "noun", "text", "message", "body", "summary"].includes(parent.key?.name ?? parent.key?.value)));
    if (node.type === "TemplateLiteral") add(node.quasis.map((part, index) => part.value.cooked + (index < node.expressions.length ? `{{${index}}}` : "")).join(""));
    for (const [key, value] of Object.entries(node)) if (!["loc", "extra", "comments"].includes(key)) {
      if (Array.isArray(value)) value.forEach((child) => walk(child, node)); else if (value && typeof value === "object") walk(value, node);
    }
  };
  walk(ast);
  return keys;
}
const files = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => item.name.startsWith(".") || ["node_modules", "_drafts", "_site", "__generated__"].includes(item.name) ? [] : item.isDirectory() ? files(path.join(dir, item.name)) : [path.join(dir, item.name)]) : [];
const CARD_FILES = ["components/site/component-card.tsx", "components/site/card-media.tsx", "lib/block-types.mjs"];
const SCOPES = {
  shell: ["components/site/site-header.tsx", "components/site/site-footer.tsx", "components/site/site-link.tsx", "components/site/logo.tsx", "components/site/language-switcher.tsx", "components/site/markdown-link.tsx", "components/site/localized-not-found.tsx", "components/site/copy-button.tsx", "components/site/live-slot.tsx", "components/site/toc.tsx", "components/site/doc-article.tsx", "components/site/docs-mobile-nav.tsx", "components/site/docs-nav.tsx", "lib/registry-types.ts"],
  cards: CARD_FILES,
  catalogue: [...CARD_FILES, "components/site/component-browser.tsx", "components/site/category-sidebar.tsx", "components/site/component-shelf.tsx", "lib/category-groups.ts"],
  detail: [...CARD_FILES, "components/site/preview-frame.tsx", "components/site/controls-panel.tsx", "components/site/source-tabs.tsx", "components/site/component-install.tsx", "components/site/accent-picker.tsx", "lib/pro-source-client.ts"],
  home: [...CARD_FILES, "components/site/home-catalogue.tsx", "lib/showcase-collections.mjs"],
  pricing: ["components/site/pricing-plans.tsx", "lib/copy.ts", "lib/pricing.ts", "lib/commerce/billing.ts", "lib/commerce/env.ts"],
  account: ["components/site/account-panel.tsx", "components/site/account-sign-in.tsx", "components/site/agent-connect.tsx", "lib/pricing.ts"],
  connect: ["components/site/oauth-consent.tsx", "components/site/account-sign-in.tsx", "components/site/agent-connect.tsx"],
};

export function siteCorpus(root) {
  const ui = new Set();
  const server = new Set();
  const previews = {};
  const all = new Set();
  const addAll = (set) => { for (const key of set) all.add(key); };
  for (const dir of ["app/(site)", "app/api", "components/site", "lib"]) for (const file of files(path.join(root, dir)).filter((file) => /\.(tsx?|mjs)$/.test(file) && !/\/(?:blog|i18n|demo|shims)\//.test(file))) for (const key of sourceKeys(fs.readFileSync(file, "utf8"))) ui.add(key);
  // Metadata is public even when the corresponding implementation is Pro.
  const metadata = fs.existsSync(path.join(root, "registry/__generated__/index.json")) ? JSON.parse(fs.readFileSync(path.join(root, "registry/__generated__/index.json"), "utf8")) : [];
  for (const entry of metadata) {
    for (const value of [entry.name, entry.description]) if (value) ui.add(keyOf(value));
    const keys = new Set((entry.props ?? []).map((prop) => keyOf(prop.description)).filter((key) => !codeLike(key)));
    const labels = (value) => { if (Array.isArray(value)) value.forEach(labels); else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { if (["label", "description", "group"].includes(key) && typeof item === "string") keys.add(keyOf(item)); else if (typeof item === "object") labels(item); } };
    labels(entry.controls);
    previews[entry.slug] = [...keys]; addAll(keys);
  }
  for (const tier of ["free", "pro"]) {
    const base = path.join(root, "registry", tier);
    if (!fs.existsSync(base)) continue;
    for (const slug of fs.readdirSync(base).filter((slug) => !slug.startsWith("_") && fs.statSync(path.join(base, slug)).isDirectory())) {
      const keys = new Set(files(path.join(base, slug)).filter((file) => /\.(tsx?|jsx?)$/.test(file)).flatMap((file) => [...sourceKeys(fs.readFileSync(file, "utf8"))]));
      previews[slug] = [...new Set([...(previews[slug] ?? []), ...keys])]; addAll(keys);
    }
  }
  // Shared component implementations and composed blocks retain their own copy.
  for (const entry of metadata) for (const dependency of entry.components ?? []) previews[entry.slug] = [...new Set([...(previews[entry.slug] ?? []), ...(previews[dependency] ?? [])])];
  for (const key of previews["chart-portfolio"] ?? []) ui.add(key);
  for (const value of Object.values(JSON.parse(fs.readFileSync(path.join(root, "content/components/guides.json"), "utf8")))) for (const text of [value.useWhen, value.avoidWhen, ...value.integration]) { all.add(keyOf(text)); server.add(keyOf(text)); }
  for (const file of files(path.join(root, "content/docs"))) {
    const doc = matter(fs.readFileSync(file, "utf8"));
    for (const field of ["title", "description", "section"]) if (doc.data[field]) ui.add(keyOf(doc.data[field]));
    mapMarkdown(doc.content, (key) => { all.add(key); return key; });
  }
  addAll(ui);
  for (const key of ui) server.add(key);
  const scopes = Object.fromEntries(Object.entries(SCOPES).map(([name, filenames]) => [name, [...new Set(filenames.filter((file) => fs.existsSync(path.join(root, file))).flatMap((file) => [...sourceKeys(fs.readFileSync(path.join(root, file), "utf8"))]))]]));
  scopes.home = [...new Set([...scopes.home, ...(previews["chart-portfolio"] ?? [])])];
  scopes.account = [...new Set([...scopes.account, ...files(path.join(root, "lib/commerce")).filter((file) => file.endsWith(".ts")).flatMap((file) => [...sourceKeys(fs.readFileSync(file, "utf8"))])])];
  const apiCopy = files(path.join(root, "app/api")).filter((file) => file.endsWith(".ts")).flatMap((file) => [...sourceKeys(fs.readFileSync(file, "utf8"))]);
  for (const scope of ["account", "pricing", "detail"]) scopes[scope] = [...new Set([...scopes[scope], ...apiCopy])];
  return { keys: [...all].sort(), server: [...server].sort(), ui: [...ui].sort(), scopes, previews };
}

export function buildSiteI18n(root) {
  const corpus = siteCorpus(root);
  const dictionaries = {};
  const retained = new Set();
  for (const locale of LOCALES.filter((language) => language.code !== "en")) {
    const file = path.join(root, "content/site-i18n", `${locale.code}.json`);
    const overrides = JSON.parse(fs.readFileSync(path.join(root, "content/site-i18n-overrides.json"), "utf8"));
    const strings = { ...(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}), ...overrides[locale.code], ...Object.fromEntries(overrides._preserve.map((key) => [key, key])) };
    const docs = Object.fromEntries(files(path.join(root, "content/docs")).map((file) => {
      const doc = matter(fs.readFileSync(file, "utf8"));
      return [path.basename(file, ".md"), mapMarkdown(doc.content, (key) => strings[key] ?? key)];
    }));
    // Keep language data in versioned assets. Next has separate server module
    // contexts, so importing the dictionaries repeats them in the Worker.
    // Only the selected language and component are read at request time.
    const assets = {};
    for (const [slug, keys] of Object.entries(corpus.previews)) {
      const preserve = new Set(overrides._preserveInPreviews?.[slug] ?? []);
      const json = JSON.stringify(Object.fromEntries(keys.filter((key) => strings[key] || preserve.has(key)).map((key) => [key, preserve.has(key) ? key : strings[key]])));
      const hash = createHash("sha256").update(json).digest("hex").slice(0, 16);
      const asset = `/locale-previews/${locale.code}/${slug}.${hash}.json`;
      retained.add(asset);
      const file = path.join(root, "public", asset);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (!fs.existsSync(file)) fs.writeFileSync(file, json);
      assets[slug] = asset;
    }
    const json = JSON.stringify({ values: corpus.server.map((key) => strings[key] === key ? "" : strings[key] ?? ""), docs, previews: assets });
    const hash = createHash("sha256").update(json).digest("hex").slice(0, 16);
    const asset = `/locale-previews/${locale.code}/site.${hash}.json`;
    retained.add(asset);
    fs.writeFileSync(path.join(root, "public", asset), json);
    dictionaries[locale.code] = asset;
  }
  fs.writeFileSync(path.join(root, "registry/__generated__/site-i18n.json"), JSON.stringify({ dictionaries, keys: packContent(corpus.server), scopes: corpus.scopes }));
  // Rebuilding a language changes its fingerprints. Retain only this build's
  // generated files so repeated builds stay within Cloudflare's asset limit.
  for (const locale of LOCALES.filter((language) => language.code !== "en")) {
    const directory = path.join(root, "public/locale-previews", locale.code);
    for (const file of fs.readdirSync(directory, { withFileTypes: true })) {
      if (file.isFile() && /^[a-z0-9-]+\.[a-f0-9]{16}\.json$/.test(file.name) && !retained.has(`/locale-previews/${locale.code}/${file.name}`)) fs.unlinkSync(path.join(directory, file.name));
    }
  }
  console.log(`site i18n: ${corpus.keys.length} text units, ${Object.keys(corpus.previews).length} previews, ${Object.keys(dictionaries).length + 1} languages`);
}
