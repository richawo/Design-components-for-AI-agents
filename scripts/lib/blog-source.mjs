import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { LOCALES, asciiSlug } from "../../lib/blog/locales.mjs";
import { BLOG_UI } from "../../lib/blog/ui-copy.mjs";
import { escapeText, decodeEntities } from "./translation-tokens.mjs";
import { isUntranslatable } from "./translation-glossary.mjs";

export const keyOf = (value) => value.replace(/\s+/g, " ").trim();
export const readJson = (file, fallback = {}) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;

export function loadBlogSource(root) {
  const base = path.join(root, "registry", "pro", "_site");
  const dir = path.join(base, "blog");
  const posts = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const parsed = matter(raw);
    for (const field of ["date", "dateModified"]) if (parsed.data[field] instanceof Date) parsed.data[field] = parsed.data[field].toISOString().slice(0, 10);
    return { file, raw, ...parsed };
  }) : [];
  return { base, posts, config: readJson(path.join(base, "config.json")) };
}

// Translate whole sentences with their inline markup, preserving code verbatim.
export function inlineUnit(text) {
  const opaque = [];
  const html = marked.parseInline(text).replace(/<(code|kbd)\b[^>]*>[\s\S]*?<\/\1>/g, (code) => {
    opaque.push(code);
    return `{{${opaque.length - 1}}}`;
  });
  return { key: keyOf(html), opaque };
}

function mapMarkdown(content, map) {
  const inline = (text) => {
    const { key, opaque } = inlineUnit(text);
    return map(key).replace(/\{\{(\d+)\}\}/g, (_, index) => opaque[Number(index)] ?? "")
      .replace(/(<img\b[^>]*\balt=")([^"]*)(")/gi, (_, start, alt, end) => `${start}${escapeText(decodeEntities(map(keyOf(alt)))).replaceAll('"', "&quot;")}${end}`);
  };
  const render = (tokens) => tokens.map((token) => {
    switch (token.type) {
      case "heading": return `${"#".repeat(token.depth)} ${inline(token.text)}\n\n`;
      case "paragraph": case "text": return `${inline(token.text)}\n\n`;
      case "blockquote": return render(token.tokens).trimEnd().split("\n").map((line) => `> ${line}`).join("\n") + "\n\n";
      case "list": return token.items.map((item, index) => {
        const prefix = token.ordered ? `${Number(token.start) + index}. ` : "- ";
        const body = render(item.tokens).trimEnd().split("\n");
        return prefix + (item.task ? `[${item.checked ? "x" : " "}] ` : "") + body[0] + "\n" + body.slice(1).map((line) => " ".repeat(prefix.length) + line).join("\n");
      }).join("\n") + "\n\n";
      case "table": {
        const row = (cells) => "| " + cells.map((cell) => inline(cell.text)).join(" | ") + " |\n";
        return row(token.header) + row(token.align.map(() => ({ text: "---" }))) + token.rows.map(row).join("") + "\n";
      }
      // Code, HTML blocks and other non-prose syntax never go to a translator.
      default: return token.raw;
    }
  }).join("");
  return render(marked.lexer(content));
}

export function postUnits(post) {
  const keys = new Set();
  mapMarkdown(post.content, (key) => { keys.add(key); return key; });
  for (const field of ["title", "seoTitle", "description", "seoDescription", "excerpt", "category", "heroImageAlt"]) {
    if (post.data[field]) keys.add(keyOf(escapeText(String(post.data[field]))));
  }
  for (const keyword of String(post.data.keywords ?? "").split(",")) if (keyword.trim()) keys.add(escapeText(keyword.trim()));
  for (const step of post.data.howToSteps ?? []) keys.add(keyOf(escapeText(step)));
  return [...keys].filter((key) => !isUntranslatable(decodeEntities(key.replace(/<[^>]*>/g, " "))));
}

function configUnits(config) {
  const keys = [];
  const walk = (value, field = "") => {
    if (typeof value === "string" && !["url", "type", "sameAs"].includes(field) && !/^https?:/.test(value)) keys.push(keyOf(escapeText(value)));
    else if (value && typeof value === "object") for (const [name, child] of Object.entries(value)) walk(child, name);
  };
  walk(config);
  return keys;
}

export function corpusUnits(source) {
  return [...new Set([...BLOG_UI.map(escapeText), ...configUnits(source.config), ...source.posts.flatMap(postUnits)])]
    .filter((key) => !isUntranslatable(decodeEntities(key.replace(/<[^>]*>/g, " "))));
}

export function bundleBlog(source) {
  const blog = Object.fromEntries(source.posts.map((p) => [p.file, p.raw]));
  const localizedBlog = {}, localizedConfig = {}, ui = {}, coverage = {};
  const allKeys = corpusUnits(source);
  const translateConfig = (config, strings) => {
    const walk = (value, field = "") => {
      if (typeof value === "string" && !["url", "type", "sameAs"].includes(field)) return decodeEntities(strings[keyOf(escapeText(value))] ?? escapeText(value));
      if (Array.isArray(value)) return value.map((item) => walk(item, field));
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, child]) => [name, walk(child, name)]));
      return value;
    };
    return walk(config);
  };
  for (const locale of LOCALES.filter((l) => l.code !== "en")) {
    const strings = readJson(path.join(source.base, "i18n", "strings", `${locale.code}.json`));
    const slugs = readJson(path.join(source.base, "i18n", "slugs", `${locale.code}.json`));
    const missing = allKeys.filter((key) => !strings[key]);
    coverage[locale.code] = { total: allKeys.length, missing: missing.length };
    if (missing.length || !source.posts.length) continue;
    const translated = {};
    for (const post of source.posts) {
      const t = (value) => decodeEntities(strings[keyOf(escapeText(String(value)))] ?? escapeText(String(value)));
      const slug = slugs[post.data.slug];
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Missing or invalid stable slug: ${locale.code}/${post.data.slug}`);
      const data = { ...post.data, sourceSlug: post.data.slug, categoryKey: Object.keys(source.config.categories ?? {}).find((key) => source.config.categories[key].name === post.data.category), slug };
      data.faqHeading = t("Frequently asked questions");
      if (data.howToSteps) data.howToSteps = data.howToSteps.map(t);
      for (const field of ["title", "seoTitle", "description", "seoDescription", "excerpt", "category", "heroImageAlt"]) if (data[field]) data[field] = t(data[field]);
      data.keywords = String(data.keywords ?? "").split(",").map((keyword) => t(keyword.trim())).join(", ");
      const localLink = (href) => {
        const pathname = href.replace(/^https:\/\/design\.yaps\.ai/, "");
        if (!/^\/blog(?:\/|$)/.test(pathname)) return href;
        const match = /^\/blog\/([^/?#]+)(.*)$/.exec(pathname);
        if (match && slugs[match[1]]) return `/${locale.code}/blog/${slugs[match[1]]}${match[2]}`;
        return `/${locale.code}${pathname}`;
      };
      const markdown = mapMarkdown(post.content, (key) => (strings[key] ?? key).replace(/href="([^"]+)"/g, (_, href) => `href="${localLink(href)}"`));
      translated[post.file] = matter.stringify(markdown, data);
    }
    const values = Object.values(translated).map((raw) => matter(raw).data.slug);
    if (new Set(values).size !== values.length) throw new Error(`Duplicate translated slugs in ${locale.code}`);
    localizedBlog[locale.code] = translated;
    localizedConfig[locale.code] = translateConfig(source.config, strings);
    ui[locale.code] = Object.fromEntries(BLOG_UI.map((text) => [text, decodeEntities(strings[escapeText(text)] ?? escapeText(text))]));
  }
  return { blog, localizedBlog, config: source.config, localizedConfig, ui, coverage };
}

export function stableSlugs(source, locale, strings, existing = {}) {
  const result = { ...existing };
  for (const post of source.posts) {
    if (result[post.data.slug]) continue; // Published URLs never drift on retranslation.
    const title = decodeEntities(strings[keyOf(escapeText(post.data.title))] ?? escapeText(post.data.title));
    let slug = locale.latinSlugs ? asciiSlug(title) || post.data.slug : post.data.slug;
    if (Object.values(result).includes(slug)) slug += "-" + post.data.slug;
    result[post.data.slug] = slug;
  }
  return result;
}
