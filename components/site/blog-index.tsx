import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { SiteLink as Link } from "@/components/site/site-link";
import { notFound } from "next/navigation";
import { BlogCover } from "./blog-cover";
import { JsonLd } from "./json-ld";
import { BlogLanguages } from "./blog-languages";
import { hubInfo, hubPath, hubJsonLd, type HubOptions } from "@/lib/blog/seo";
import { blogPath, blogFeedPath, blogText } from "@/lib/blog/runtime";
import { localeByCode } from "@/lib/blog/locales.mjs";
import "./blog-editorial.css";

export default function BlogIndex(options: HubOptions = {}) {
  const info = hubInfo(options);
  if (!info) notFound();
  const { locale, page, category, config, topic, posts, pages } = info;
  const t = (text: string) => blogText(text, locale);
  const fmt = (date: string) => new Date(date).toLocaleDateString(localeByCode(locale)!.htmlLang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const lead = page === 1 ? posts[0] : undefined;
  const rest = lead ? posts.slice(1) : posts;

  return (
    <div className="blog-shell blog-archive">
      <JsonLd data={hubJsonLd(options)} />
      <BlogLanguages locale={locale} page={page} category={category} />
      <header className="blog-archive-heading">
        <div className="blog-kicker blog-archive-label">
          <Link href={blogPath(locale)}>{t("Blog")}</Link>
          <Link href={blogFeedPath(locale)}>RSS<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
        <div className="blog-archive-intro">
          <h1>{topic?.name ?? config.heading}</h1>
          <p>{topic?.description ?? config.intro}</p>
        </div>
      </header>
      <nav aria-label={t("Topics")} className="blog-topics">
        <Link href={blogPath(locale)} aria-current={!category ? "page" : undefined}>{t("All articles")}</Link>
        {Object.entries(config.categories).map(([key, item]) => (
          <Link key={key} href={hubPath({ locale, category: key })} aria-current={key === category ? "page" : undefined}>{item.name}</Link>
        ))}
      </nav>
      {lead && (
        <Link href={blogPath(locale, lead.slug)} className="blog-lead" prefetch={false}>
          <div className="blog-lead-art"><BlogCover post={lead} priority decorative /></div>
          <div className="blog-lead-copy">
            <p className="blog-kicker">{lead.category} <span aria-hidden="true">·</span> {lead.readingTime} {t("min read")}</p>
            <h2>{lead.title}</h2>
            <p>{lead.excerpt}</p>
            <div><time className="blog-kicker" dateTime={lead.date}>{fmt(lead.date)}</time><ArrowUpRight size={26} aria-hidden="true" /></div>
          </div>
        </Link>
      )}
      <ul className="blog-card-grid">
        {rest.map((post) => (
          <li key={post.slug}>
            <Link href={blogPath(locale, post.slug)} className="blog-card" prefetch={false}>
              <div className="blog-card-art"><BlogCover post={post} decorative /></div>
              <p className="blog-kicker">{post.category} <span aria-hidden="true">·</span> {post.readingTime} {t("min read")}</p>
              <h2>{post.title}<ArrowUpRight size={17} aria-hidden="true" /></h2>
              <p className="blog-card-excerpt">{post.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav aria-label={t("Page")} className="blog-pages">
          {page > 1 ? <Link href={hubPath({ locale, category, page: page - 1 })}><ArrowLeft size={15} aria-hidden="true" className="rtl:rotate-180" />{t("Previous")}</Link> : <span />}
          <span className="blog-kicker">{t("Page")} {page} {t("of")} {pages}</span>
          {page < pages ? <Link href={hubPath({ locale, category, page: page + 1 })}>{t("Next")}<ArrowRight size={15} aria-hidden="true" className="rtl:rotate-180" /></Link> : <span />}
        </nav>
      )}
      <BlogLanguages locale={locale} page={page} category={category} footer />
    </div>
  );
}
