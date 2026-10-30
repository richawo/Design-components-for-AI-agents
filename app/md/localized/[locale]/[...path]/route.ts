import matter from "gray-matter";
import { localeByCode } from "@/lib/blog/locales.mjs";
import { getDoc } from "@/lib/content";
import { cataloguePath } from "@/lib/catalogue-path";
import { getComponent } from "@/lib/registry";
import { markdownForPage } from "@/lib/page-markdown";
import { entryCopy, siteDictionary } from "@/lib/i18n/server";
import { treeLocalizer } from "@/lib/i18n/tree";
import { mapMarkdown } from "@/lib/i18n/markdown.mjs";
import { localizePath } from "@/lib/i18n/routing";
import { absoluteUrl } from "@/lib/site";
import { GET as componentMarkdown } from "@/app/md/components/[slug]/route";
import { GET as blockMarkdown } from "@/app/md/blocks/[slug]/route";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string; path: string[] }> }) {
  const { locale, path } = await params;
  const language = localeByCode(locale);
  if (!language || locale === "en" || path.length > 2) return new Response("Not found", { status: 404 });
  const [section, slug] = path;
  let markdown: string | null = null;
  let selectedCopy: Record<string, string> = {};
  let cataloguePage: string | undefined;
  if (["components", "blocks"].includes(section) && slug) {
    const response = await (section === "blocks" ? blockMarkdown : componentMarkdown)(request, { params: Promise.resolve({ slug }) });
    if (!response.ok) return response;
    markdown = await response.text();
    selectedCopy = await entryCopy(locale, slug);
    const entry = getComponent(slug);
    if (entry) cataloguePage = cataloguePath(entry);
  } else if (section === "docs") {
    const doc = await getDoc(slug ?? "introduction", locale);
    if (doc) markdown = matter.stringify(`# ${doc.meta.title}\n\n${doc.markdown}`, { title: doc.meta.title, description: doc.meta.description });
  } else markdown = await markdownForPage(path.join("/"));
  if (!markdown) return new Response("Not found", { status: 404 });
  const { t } = treeLocalizer(locale, { ...await siteDictionary(locale), ...selectedCopy });
  const parsed = matter(markdown);
  const page = cataloguePage ?? (path.join("/") === "index" ? "/" : "/" + path.join("/"));
  const inline = (key: string) => {
    const translated = t(key);
    if (translated !== key) return translated;
    let code = false;
    return key.split(/(<[^>]*>)/g).map((part) => {
      if (/^<code\b/.test(part)) code = true;
      if (part.startsWith("<")) { if (/^<\/code/.test(part)) code = false; return part; }
      return code ? part : t(part);
    }).join("");
  };
  const content = section === "docs" ? parsed.content : mapMarkdown(parsed.content, inline);
  const result = matter.stringify(content, { ...parsed.data, title: parsed.data.title ? t(parsed.data.title) : t(section), ...(parsed.data.description ? { description: t(parsed.data.description) } : {}), canonical: absoluteUrl(localizePath(page, locale)), language: language.htmlLang });
  return new Response(result, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Language": language.htmlLang, "X-Robots-Tag": "noindex, follow", Link: `<${absoluteUrl(localizePath(page, locale))}>; rel="canonical"` } });
}
