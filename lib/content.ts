import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked, type Tokens } from "marked";
import { highlight } from "./highlight";

/**
 * Markdown content for the blog and docs. Mirrors the yaps.ai blog setup:
 * frontmatter for SEO fields, slugged heading anchors (unique per article),
 * a table of contents from h2/h3, and FAQ extraction from a
 * "Frequently asked questions" h2 for FAQPage JSON-LD.
 */

export type Heading = { id: string; text: string; level: 2 | 3 };
export type QA = { q: string; a: string };

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  date: string;
  dateModified: string;
  category: string;
  author: string;
  keywords: string[];
  readingTime: number;
};

export type DocMeta = { slug: string; title: string; description: string; order: number; section: string };

const ROOT = path.join(process.cwd(), "content");

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

async function render(markdown: string) {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  const codeBlocks: { lang: string; text: string }[] = [];
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, { tokens, depth }: Tokens.Heading) {
        const html = this.parser.parseInline(tokens);
        const base = slugify(html) || "section";
        const n = (used.get(base) ?? 0) + 1;
        used.set(base, n);
        const id = n === 1 ? base : `${base}-${n}`;
        if (depth === 2 || depth === 3) headings.push({ id, text: stripTags(html), level: depth });
        return `<h${depth} id="${id}"><a href="#${id}" class="no-underline">${html}</a></h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        codeBlocks.push({ lang: lang || "text", text });
        return `<!--code:${codeBlocks.length - 1}-->`;
      },
      link(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, { href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href) && !href.includes("design.yaps.ai");
        return `<a href="${href}"${title ? ` title="${title}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
      },
    },
  });
  let html = await marked.parse(markdown);
  const langs = new Set(["tsx", "ts", "json", "bash", "markdown", "css"]);
  for (let i = 0; i < codeBlocks.length; i++) {
    const { lang, text } = codeBlocks[i];
    const l = lang === "sh" || lang === "shell" ? "bash" : lang === "jsx" ? "tsx" : lang;
    const block = langs.has(l)
      ? await highlight(text, l as "tsx")
      : `<pre><code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`;
    html = html.replace(`<!--code:${i}-->`, block);
  }
  return { html, headings };
}

function extractFaqs(html: string): QA[] {
  const start = html.search(/<h2[^>]*>(?:(?!<\/h2>).)*frequently asked questions/i);
  if (start === -1) return [];
  const rest = html.slice(start);
  const end = rest.slice(5).search(/<h2/);
  const section = end === -1 ? rest : rest.slice(0, end + 5);
  const parts = section.split(/<h3[^>]*>/).slice(1);
  return parts
    .map((p) => {
      const [qHtml, ...aHtml] = p.split("</h3>");
      return { q: stripTags(qHtml), a: stripTags(aHtml.join("")).replace(/\s+/g, " ") };
    })
    .filter((x) => x.q && x.a);
}

function readDir(dir: string) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith(".md"));
}

// ------------------------------------------------------------------ blog

export function allPosts(): PostMeta[] {
  return readDir("blog")
    .map((f) => {
      const raw = fs.readFileSync(path.join(ROOT, "blog", f), "utf8");
      const { data, content } = matter(raw);
      const words = content.split(/\s+/).filter(Boolean).length;
      return {
        slug: data.slug ?? f.replace(/\.md$/, ""),
        title: data.title,
        description: data.description,
        excerpt: data.excerpt ?? data.description,
        date: String(data.date instanceof Date ? data.date.toISOString().slice(0, 10) : data.date),
        dateModified: String(data.dateModified instanceof Date ? data.dateModified.toISOString().slice(0, 10) : (data.dateModified ?? data.date)),
        category: data.category ?? "Guides",
        author: data.author ?? "Design for AI",
        keywords: String(data.keywords ?? "")
          .split(",")
          .map((k: string) => k.trim())
          .filter(Boolean),
        readingTime: Math.max(1, Math.round(words / 220)),
      } satisfies PostMeta;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function rawPost(slug: string) {
  const file = readDir("blog").find((f) => f.replace(/\.md$/, "") === slug);
  if (!file) return null;
  return matter(fs.readFileSync(path.join(ROOT, "blog", file), "utf8"));
}

export async function getPost(slug: string) {
  const meta = allPosts().find((p) => p.slug === slug);
  const raw = rawPost(slug);
  if (!meta || !raw) return null;
  const { html, headings } = await render(raw.content);
  return { meta, html, headings, faqs: extractFaqs(html), markdown: raw.content };
}

export function relatedPosts(slug: string, n = 2) {
  const posts = allPosts();
  const me = posts.find((p) => p.slug === slug);
  const same = posts.filter((p) => p.slug !== slug && p.category === me?.category);
  const rest = posts.filter((p) => p.slug !== slug && p.category !== me?.category);
  return [...same, ...rest].slice(0, n);
}

// ------------------------------------------------------------------ docs

export function allDocs(): DocMeta[] {
  return readDir("docs")
    .map((f) => {
      const { data } = matter(fs.readFileSync(path.join(ROOT, "docs", f), "utf8"));
      return { slug: f.replace(/\.md$/, ""), title: data.title, description: data.description, order: data.order ?? 99, section: data.section ?? "Guides" };
    })
    .sort((a, b) => a.order - b.order);
}

export async function getDoc(slug: string) {
  const meta = allDocs().find((d) => d.slug === slug);
  if (!meta) return null;
  const { content } = matter(fs.readFileSync(path.join(ROOT, "docs", `${slug}.md`), "utf8"));
  const { html, headings } = await render(content);
  return { meta, html, headings, markdown: content };
}
