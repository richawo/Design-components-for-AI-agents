import { ArrowUpRight, ChevronDown } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteLink as Link } from "@/components/site/site-link";
import { JsonLd } from "@/components/site/json-ld";
import { Toc } from "@/components/site/toc";
import { ProseContent } from "@/components/site/prose-content";
import { getPost, rawPost, relatedPosts } from "@/lib/content";
import { blogConfig, blogPath, blogText } from "@/lib/blog/runtime";
import { articleJsonLd, hubPath } from "@/lib/blog/seo";
import { localeByCode } from "@/lib/blog/locales.mjs";
import { BlogCover } from "./blog-cover";
import { blogExample } from "./blog-example";
import { BlogLanguages } from "./blog-languages";
import "./blog-editorial.css";

export default async function BlogPost({ slug, locale = "en" }: { slug: string; locale?: string }) {
  const post = await getPost(slug, locale);
  if (!post) notFound();
  const { meta, intro, body, headings, faqs, howToSteps, markdown } = post;
  if (slug !== meta.slug) permanentRedirect(blogPath(locale, meta.slug));
  const config = blogConfig(locale)!;
  const related = relatedPosts(meta.slug, 3, locale);
  const t = (text: string) => blogText(text, locale);
  const fmt = (date: string) => new Date(date).toLocaleDateString(localeByCode(locale)!.htmlLang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const source = locale === "en" ? markdown : rawPost(meta.sourceSlug)?.content ?? "";
  const jsonLd = articleJsonLd(meta, locale, markdown.split(/\s+/).length, faqs, howToSteps);
  const example = await blogExample(meta.sourceSlug, source, locale);

  return (
    <article className="blog-shell">
      <JsonLd data={jsonLd} />
      <BlogLanguages locale={locale} sourceSlug={meta.sourceSlug} />
      <header className="blog-masthead">
        <div className="blog-masthead-copy">
          <nav aria-label={t("Breadcrumb")} className="blog-kicker blog-breadcrumb">
            <Link href={blogPath(locale)}>{t("Blog")}</Link>
            <span aria-hidden="true">/</span>
            <Link href={hubPath({ locale, category: meta.categoryKey })}>{meta.category}</Link>
          </nav>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        {example?.masthead
          ? <div className="blog-masthead-example">{example.element}</div>
          : <div className="blog-masthead-art"><BlogCover post={meta} priority /></div>}
        <div className="blog-byline blog-kicker">
          <span>{meta.author}</span>
          <time dateTime={meta.date}>{fmt(meta.date)}</time>
          {meta.dateModified !== meta.date && <span>{t("Updated")} {fmt(meta.dateModified)}</span>}
          <span>{meta.readingTime} {t("min read")}</span>
        </div>
      </header>

      <div className="blog-reading">
        {headings.length > 0 && (
          <aside className="blog-reading-nav">
            <div className="blog-toc-desktop"><Toc headings={headings} label={t("In this piece")} /></div>
            <details className="blog-toc-mobile">
              <summary>{t("In this piece")}<ChevronDown size={16} aria-hidden="true" /></summary>
              <ol>
                {headings.filter(({ level }) => level === 2).map(({ id, text }) => (
                  <li key={id}><a href={`#${id}`}>{text}</a></li>
                ))}
              </ol>
            </details>
          </aside>
        )}
        <div className="blog-reading-body">
          <ProseContent className="blog-prose blog-intro" html={intro} />
          {example && !example.masthead && example.element}
          {body && <ProseContent className="blog-prose" html={body} />}
          <section className="blog-author">
            <h2 className="blog-kicker">{t("Written by")}</h2>
            <a href={config.author.url} rel="author">{config.author.name}</a>
            <p>{config.author.bio}</p>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="blog-related">
          <h2>{t("Keep reading")}</h2>
          <ul className="blog-card-grid">
            {related.map((item) => (
              <li key={item.slug}>
                <Link href={blogPath(locale, item.slug)} className="blog-card" prefetch={false}>
                  <div className="blog-card-art"><BlogCover post={item} decorative /></div>
                  <h3>{item.title}<ArrowUpRight size={17} aria-hidden="true" /></h3>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <aside className="blog-next-step">
        <div>
          <p>{config.cta.heading}</p>
          <span>{config.cta.body}</span>
        </div>
        <div>
          <Link href="/components" className="site-btn site-btn-primary min-h-11 px-5 text-sm">{t("Browse components")}</Link>
          <Link href="/docs/agents" className="site-btn site-btn-secondary min-h-11 px-5 text-sm">{t("Connect your agent")}</Link>
        </div>
      </aside>
      <BlogLanguages locale={locale} sourceSlug={meta.sourceSlug} footer />
    </article>
  );
}
