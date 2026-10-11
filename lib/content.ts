import "server-only";
import matter from "gray-matter";
import { Marked, type Tokens } from "marked";
import { highlight } from "./highlight";
// content/**/*.md, bundled by scripts/build-registry.mjs so request-time routes
// (the Markdown twins) work on Cloudflare Workers, which have no filesystem.
// Edited a post in dev? Re-run `npm run registry`.
import { BLOG_DATA, blogFiles, blogConfig, blogPath } from "./blog/runtime";
import { imageDimensions } from "./blog/image-markup";

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
  sourceSlug: string;
  title: string;
  seoTitle: string;
  description: string;
  seoDescription: string;
  excerpt: string;
  date: string;
  dateModified: string;
  category: string;
  author: string;
  keywords: string[];
  readingTime: number;
  categoryKey: string;
  image: string;
  imageAlt: string;
  editorialCover: boolean;
  noindex: boolean;
};

export type DocMeta = { slug: string; title: string; description: string; order: number; section: string };

const FILES = BLOG_DATA;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

async function render(markdown: string, locale = "en") {
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
        href = localizedBlogLink(href, locale);
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href) && !href.includes("design.yaps.ai");
        return `<a href="${href}"${title ? ` title="${title}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
      },
    },
  });
  let html = await marked.parse(markdown);
  html = imageDimensions(html, BLOG_DATA.blogImages);
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

function extractFaqs(html: string, heading = "Frequently asked questions"): QA[] {
  const match = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].find((item) => stripTags(item[1]).toLowerCase() === heading.toLowerCase());
  const start = match?.index ?? -1;
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

function readDir(dir: "blog" | "docs") {
  return Object.keys(FILES[dir]);
}

function readFile(dir: "blog" | "docs", file: string) {
  return Object.hasOwn(FILES[dir], file) ? FILES[dir][file] : null;
}

// ------------------------------------------------------------------ blog

const metaCache = new Map<string, PostMeta[]>();
export function allPosts(locale = "en"): PostMeta[] {
  const cached = metaCache.get(locale);
  if (cached) return cached;
  const files = blogFiles(locale);
  const posts = Object.keys(files)
    .filter((file) => !matter(files[file]).data.draft)
    .map((f) => {
      const raw = files[f];
      const { data, content } = matter(raw);
      const source = locale === "en" ? content : matter(FILES.blog[f]).content;
      const words = source.split(/\s+/).filter(Boolean).length;
      return {
        slug: data.slug ?? f.replace(/\.md$/, ""),
        sourceSlug: data.sourceSlug ?? f.replace(/\.md$/, ""),
        title: data.title,
        seoTitle: data.seoTitle ?? data.title,
        description: data.description,
        seoDescription: data.seoDescription ?? data.description,
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
        categoryKey: data.categoryKey ?? Object.entries(blogConfig("en")?.categories ?? {}).find(([, category]) => category.name === data.category)?.[0] ?? "guides",
        image: data.heroImage ?? `/blog-images/${data.sourceSlug ?? data.slug}.png`,
        imageAlt: data.heroImageAlt ?? data.title,
        editorialCover: Boolean(data.heroAsset),
        noindex: data.noindex === true,
      } satisfies PostMeta;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  metaCache.set(locale, posts);
  return posts;
}

export function rawPost(slug: string, locale = "en") {
  const meta = allPosts(locale).find((post) => post.slug === slug || post.sourceSlug === slug);
  if (!meta) return null;
  const raw = blogFiles(locale)[`${meta.sourceSlug}.md`];
  return raw ? matter(raw) : null;
}

export async function getPost(slug: string, locale = "en") {
  const meta = allPosts(locale).find((p) => p.slug === slug || p.sourceSlug === slug);
  const raw = rawPost(slug, locale);
  if (!meta || !raw) return null;
  const { html, headings } = await render(raw.content, locale);
  return { meta, html, headings, faqs: extractFaqs(html, raw.data.faqHeading), markdown: raw.content };
}

export function relatedPosts(slug: string, n = 3, locale = "en") {
  const posts = allPosts(locale);
  const me = posts.find((p) => p.slug === slug);
  const same = posts.filter((p) => p.slug !== slug && p.category === me?.category);
  const rest = posts.filter((p) => p.slug !== slug && p.category !== me?.category);
  return [...same, ...rest].slice(0, n);
}

export function localizedBlogLink(href: string, locale = "en") {
  if (locale === "en") return href;
  const path = href.replace(/^https:\/\/design\.yaps\.ai/, "");
  if (!/^\/blog(?:\/|$|[?#])/.test(path)) return href;
  const match = /^\/blog\/([^/?#]+)(.*)$/.exec(path);
  if (match && !["category", "page", "rss.xml"].includes(match[1])) {
    const post = allPosts(locale).find((p) => p.sourceSlug === match[1] || p.slug === match[1]);
    return post ? blogPath(locale, post.slug) + match[2] : href;
  }
  return `/${locale}${path}`;
}

// ------------------------------------------------------------------ docs

export function allDocs(): DocMeta[] {
  return readDir("docs")
    .map((f) => {
      const { data } = matter(readFile("docs", f)!);
      return { slug: f.replace(/\.md$/, ""), title: data.title, description: data.description, order: data.order ?? 99, section: data.section ?? "Guides" };
    })
    .sort((a, b) => a.order - b.order);
}

export async function getDoc(slug: string) {
  const meta = allDocs().find((d) => d.slug === slug);
  if (!meta) return null;
  const { content } = matter(readFile("docs", `${slug}.md`) ?? "");
  const { html, headings } = await render(content);
  return { meta, html, headings, markdown: content };
}
