import { SiteLink as Link } from "@/components/site/site-link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/site/json-ld";
import { Toc } from "@/components/site/toc";
import { allPosts, getPost, relatedPosts } from "@/lib/content";
import { blogConfig, blogPath, blogText } from "@/lib/blog/runtime";
import { articleJsonLd, hubPath } from "@/lib/blog/seo";
import { localeByCode } from "@/lib/blog/locales.mjs";
import { BlogLanguages } from "./blog-languages";

export default async function BlogPost({ slug, locale = "en" }: { slug: string; locale?: string }) {
  const post = await getPost(slug, locale);
  if (!post) notFound();
  const { meta, html, headings, faqs, howToSteps, markdown } = post;
  if (slug !== meta.slug) permanentRedirect(blogPath(locale, meta.slug));
  const config = blogConfig(locale)!;
  const related = relatedPosts(meta.slug, 3, locale);
  const t = (text: string) => blogText(text, locale);
  const fmt = (date: string) => new Date(date).toLocaleDateString(localeByCode(locale)!.htmlLang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  const jsonLd = articleJsonLd(meta, locale, markdown.split(/\s+/).length, faqs, howToSteps);

  return (
    <article className="mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <JsonLd data={jsonLd} />
      <header className="mx-auto max-w-4xl pb-12 pt-12 lg:pt-20">
        <div className="mb-6 flex items-center"><BlogLanguages locale={locale} sourceSlug={meta.sourceSlug} /></div>
        <nav aria-label={t("Breadcrumb")} className="site-in font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">
          <Link href={blogPath(locale)} className="rounded-sm transition-colors duration-150 hover:text-site-fg">
            {t("Blog")}
          </Link>{" "}
          / <Link href={hubPath({ locale, category: meta.categoryKey })}>{meta.category}</Link>
        </nav>
        <h1 className="site-in mt-6 text-balance [overflow-wrap:anywhere] text-[clamp(2.4rem,1.4rem+4vw,5rem)] font-semibold leading-[0.95] tracking-[-0.05em] [--i:1]">
          <span className="site-silver-text">{meta.title}</span>
        </h1>
        <p className="site-in mt-6 max-w-[60ch] text-[clamp(1.1rem,1rem+0.4vw,1.3rem)] leading-relaxed text-site-fg-2 [--i:2]">{meta.description}</p>
        <div className="site-in mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.08] pt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3 [--i:3]">
          <span>{meta.author}</span>
          <time dateTime={meta.date}>{fmt(meta.date)}</time>
          {meta.dateModified !== meta.date && <span>{t("Updated")} {fmt(meta.dateModified)}</span>}
          <span>{meta.readingTime} {t("min read")}</span>
        </div>
      </header>

      <img src={meta.displayImage} alt={meta.imageAlt} width={1200} height={630} loading="eager" fetchPriority="high" decoding="async" className="mx-auto mb-12 aspect-[1200/630] w-full max-w-4xl rounded-2xl border border-white/[0.08] object-cover" />

      <div className="grid gap-12 lg:grid-cols-12">
        <aside className="site-in hidden [--i:4] lg:col-span-3 lg:block">
          <div className="sticky top-28">
            <Toc headings={headings} label={t("In this piece")} />
          </div>
        </aside>
        <div className="site-prose site-in min-w-0 [--i:4] lg:col-span-7" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <section className="mx-auto mt-16 max-w-4xl border-t border-white/10 pt-6"><h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-site-fg-3">{t("Written by")}</h2><a href={config.author.url} rel="author" className="mt-3 block text-lg font-medium">{config.author.name}</a><p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-site-fg-2">{config.author.bio}</p></section>

      <aside className="site-surface site-reveal relative mx-auto mt-20 max-w-4xl overflow-hidden rounded-[24px] p-8 sm:p-12">
        <p className="text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
          {config.cta.heading}
        </p>
        <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-site-fg-2">{config.cta.body}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/components" className="site-btn site-btn-primary h-12 px-6 text-[15px]">
            {t("Browse components")}
          </Link>
          <Link href="/docs/agents" className="site-btn site-btn-secondary h-12 px-6 text-[15px]">
            {t("Connect your agent")}
          </Link>
        </div>
      </aside>

      {related.length > 0 && (
        <section className="mx-auto mt-20 max-w-4xl">
          <h2 className="site-reveal font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">{t("Keep reading")}</h2>
          <ul className="mt-4 border-t border-white/[0.12]">
            {related.map((r) => (
              <li key={r.slug} className="site-reveal">
                <Link href={blogPath(locale, r.slug)} className="group block border-b border-white/[0.08] py-6 [overflow-wrap:anywhere]">
                  <span className="block text-balance text-2xl font-semibold tracking-[-0.035em] text-site-fg-2 transition-colors duration-150 group-hover:text-site-fg">{r.title}</span>
                  <span className="mt-1 block text-[15px] text-site-fg-3">{r.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <BlogLanguages locale={locale} sourceSlug={meta.sourceSlug} footer />
    </article>
  );
}
