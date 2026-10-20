import { componentGuide } from "@/lib/component-guidance";
import { cataloguePath } from "@/lib/catalogue-path";
import { allDocs, allPosts, rawPost } from "@/lib/content";
import {
  allComponents,
  categoriesWithCounts,
  thumbnailFor,
} from "@/lib/registry";
import { absoluteUrl, site } from "@/lib/site";
import { LOCALES, localeByCode } from "./locales.mjs";
import { localizePath } from "@/lib/i18n/routing";
import { siteAlternates } from "@/lib/i18n/metadata";
import {
  blogConfig,
  blogLocales,
  blogPath,
  blogFeedPath,
  blogText,
} from "./runtime";
import {
  blogAlternates,
  hubInfo,
  hubPath,
  PAGE_SIZE,
  MIN_INDEXED_TOPIC_POSTS,
} from "./seo";

export const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
export type SitemapEntry = {
  path: string;
  lastmod?: string;
  images?: string[];
  languages?: Record<string, string>;
};
export function sitemapLocales() {
  return LOCALES.map((locale) => locale.code);
}

export function sitemapEntries(locale = "en"): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  {
    const components = allComponents(),
      lastmod = components
        .map((c) => c.added)
        .sort()
        .at(-1);
    entries.push(
      { path: "/", lastmod },
      { path: "/components", lastmod },
      { path: "/blocks", lastmod },
      { path: "/pricing" },
    );
    entries.push(
      ...categoriesWithCounts().map((c) => ({
        path: `/categories/${c.key}`,
        lastmod,
      })),
    );
    entries.push(
      ...components.map((c) => ({
        path: cataloguePath(c),
        lastmod: componentGuide(c.slug).updated ?? c.added,
        images: thumbnailFor(c.slug) ? [thumbnailFor(c.slug)!] : undefined,
      })),
    );
    entries.push(
      ...allDocs().map((d) => ({
        path: d.slug === "introduction" ? "/docs" : `/docs/${d.slug}`,
      })),
    );
    for (const entry of entries) { entry.languages = siteAlternates(entry.path); entry.path = localizePath(entry.path, locale); }
  }
  const posts = allPosts(locale),
    config = blogConfig(locale);
  if (!posts.length || !config) return entries;
  const addHub = (category?: string) => {
    const list = posts.filter(
      (post) => !category || post.categoryKey === category,
    );
    if (
      category &&
      list.filter((post) => !post.noindex).length < MIN_INDEXED_TOPIC_POSTS
    )
      return;
    for (let page = 1; page <= Math.ceil(list.length / PAGE_SIZE); page++) {
      entries.push({
        path: hubPath({ locale, category, page }),
        lastmod: list
          .map((post) => post.dateModified)
          .sort()
          .at(-1),
        images: ["/blog-images/blog.png"],
        languages: blogAlternates({ category, page }),
      });
    }
  };
  addHub();
  for (const category of Object.keys(config.categories)) addHub(category);
  for (const post of posts.filter((post) => !post.noindex))
    entries.push({
      path: blogPath(locale, post.slug),
      lastmod: post.dateModified,
      images: [post.image],
      languages: blogAlternates({ sourceSlug: post.sourceSlug }),
    });
  return entries;
}

export function sitemapIndex() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapLocales()
    .map(
      (locale) =>
        `<sitemap><loc>${absoluteUrl(`/sitemaps/${locale}.xml`)}</loc></sitemap>`,
    )
    .join("\n")}\n</sitemapindex>\n`;
}
export function localeSitemap(locale: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${sitemapEntries(
    locale,
  )
    .map(
      (entry) =>
        `<url><loc>${xml(absoluteUrl(entry.path))}</loc>${entry.lastmod ? `<lastmod>${xml(entry.lastmod)}</lastmod>` : ""}${Object.entries(
          entry.languages ?? {},
        )
          .map(
            ([language, href]) =>
              `<xhtml:link rel="alternate" hreflang="${xml(language)}" href="${xml(href)}"/>`,
          )
          .join(
            "",
          )}${(entry.images ?? []).map((image) => `<image:image><image:loc>${xml(absoluteUrl(image))}</image:loc></image:image>`).join("")}</url>`,
    )
    .join("\n")}\n</urlset>\n`;
}
export function markdownSitemap(locale?: string) {
  if (!locale)
    return `# ${site.name}: Markdown page index\n\n[HTML sitemap](${absoluteUrl("/sitemap.xml")}) · [Agent overview](${absoluteUrl("/llms.txt")})\n\n## Language editions\n\n${sitemapLocales()
      .map(
        (code) =>
          `- [${localeByCode(code)!.label}](${absoluteUrl(`/sitemaps/${code}.md`)})`,
      )
      .join("\n")}\n`;
  return `# ${site.name}: ${localeByCode(locale)!.label}\n\n[All languages](${absoluteUrl("/sitemap.md")})\n\n${sitemapEntries(
    locale,
  )
    .map(
      (entry) =>
        `- [${entry.path}](${absoluteUrl(entry.path === "/" ? "/index.md" : `${entry.path}.md`)})`,
    )
    .join("\n")}\n`;
}

export function rss(locale = "en") {
  const posts = allPosts(locale).filter((post) => !post.noindex),
    config = blogConfig(locale);
  if (!posts.length || !config) return null;
  const latest = posts
    .map((post) => post.dateModified)
    .sort()
    .at(-1)!;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(config.title)}</title><link>${absoluteUrl(blogPath(locale))}</link><description>${xml(config.description)}</description><language>${localeByCode(locale)!.htmlLang}</language><atom:link href="${absoluteUrl(blogFeedPath(locale))}" rel="self" type="application/rss+xml"/><lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>\n${posts.map((post) => `<item><title>${xml(post.title)}</title><link>${absoluteUrl(blogPath(locale, post.slug))}</link><guid isPermaLink="true">${absoluteUrl(blogPath(locale, post.slug))}</guid><description>${xml(post.excerpt)}</description><pubDate>${new Date(post.date).toUTCString()}</pubDate><category>${xml(post.category)}</category></item>`).join("\n")}\n</channel></rss>\n`;
}

export function blogMarkdown(parts: string[]) {
  const [locale, ...path] = parts;
  if (!LOCALES.some((l) => l.code === locale)) return null;
  if (path.length === 1 && !["page", "category"].includes(path[0])) {
    const meta = allPosts(locale).find(
      (post) => post.slug === path[0] || post.sourceSlug === path[0],
    );
    const raw = meta && rawPost(meta.slug, locale);
    if (!meta || !raw) return null;
    const canonical = blogPath(locale, meta.slug);
    return {
      path: canonical,
      alias: meta.slug !== path[0],
      body: [
        "---",
        `title: ${JSON.stringify(meta.title)}`,
        `description: ${JSON.stringify(meta.description)}`,
        `canonical: ${absoluteUrl(canonical)}`,
        `language: ${localeByCode(locale)!.htmlLang}`,
        `date: ${meta.date}`,
        `dateModified: ${meta.dateModified}`,
        `author: ${JSON.stringify(meta.author)}`,
        "---",
        "",
        `# ${meta.title}`,
        "",
        `> ${meta.description}`,
        "",
        raw.content.trim(),
        "",
      ].join("\n"),
    };
  }
  let category: string | undefined,
    page = 1;
  if (path[0] === "category") {
    category = path[1];
    if (path.length !== 2 && !(path.length === 4 && path[2] === "page"))
      return null;
    if (path.length === 4) page = /^\d+$/.test(path[3]) ? Number(path[3]) : NaN;
  } else if (path[0] === "page" && path.length === 2)
    page = /^\d+$/.test(path[1]) ? Number(path[1]) : NaN;
  else if (path.length) return null;
  const info = hubInfo({ locale, category, page });
  if (!info) return null;
  return {
    path: info.path,
    alias: page === 1 && path.includes("page"),
    body: [
      "---",
      `title: ${JSON.stringify(info.title)}`,
      `description: ${JSON.stringify(info.description)}`,
      `canonical: ${absoluteUrl(info.path)}`,
      `language: ${localeByCode(locale)!.htmlLang}`,
      "---",
      "",
      `# ${info.title}`,
      "",
      info.description,
      "",
      ...info.posts.flatMap((post) => [
        `## [${post.title}](${absoluteUrl(`${blogPath(locale, post.slug)}.md`)})`,
        "",
        `${post.date} · ${post.readingTime} ${blogText("min read", locale)}`,
        "",
        post.excerpt,
        "",
      ]),
    ].join("\n"),
  };
}
