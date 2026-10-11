import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "./cover";
import { JsonLd } from "./json-ld";
import { BlogLanguages } from "./blog-languages";
import { hubInfo, hubPath, hubJsonLd, type HubOptions } from "@/lib/blog/seo";
import { blogPath, blogFeedPath, blogText } from "@/lib/blog/runtime";
import { localeByCode } from "@/lib/blog/locales.mjs";

export default function BlogIndex(options: HubOptions = {}) {
  const info = hubInfo(options);
  if (!info) notFound();
  const { locale, page, category, config, topic, posts, pages } = info;
  const t = (text: string) => blogText(text, locale);
  const fmt = (date: string) => new Date(date).toLocaleDateString(localeByCode(locale)!.htmlLang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const [lead, ...rest] = posts;
  return <div className="mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
    <JsonLd data={hubJsonLd(options)} />
    <div className="flex items-center justify-between border-b border-white/[0.08] pt-6"><Link href={blogPath(locale)} className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">{t("Blog")}</Link><BlogLanguages locale={locale} page={page} category={category} /></div>
    <section className="grid gap-6 pb-12 pt-10 lg:grid-cols-12 lg:items-end lg:pt-16">
      <h1 className="site-in text-[clamp(2.75rem,1.5rem+5vw,6rem)] font-semibold leading-[0.98] tracking-[-0.055em] lg:col-span-8"><span className="site-silver-text">{topic?.name ?? config.heading}</span>{page > 1 && <span className="mt-4 block text-2xl text-site-fg-3">{t("Page")} {page}</span>}</h1>
      <p className="site-in max-w-[44ch] text-[17px] leading-relaxed text-site-fg-2 [--i:1] lg:col-span-4">{topic?.description ?? config.intro}{" "}<Link href={blogFeedPath(locale)} className="rounded-sm font-medium text-site-fg underline decoration-white/30 underline-offset-4 hover:decoration-white/80">RSS</Link></p>
    </section>
    <nav aria-label={t("Topics")} className="mb-8 flex flex-wrap gap-x-6 gap-y-3 border-y border-white/[0.08] py-4 text-[14px]">
      <Link href={blogPath(locale)} aria-current={!category ? "page" : undefined} className="text-site-fg-3 hover:text-site-fg aria-[current=page]:text-site-fg">{t("All articles")}</Link>
      {Object.entries(config.categories).map(([key, item]) => <Link key={key} href={hubPath({ locale, category: key })} aria-current={key === category ? "page" : undefined} className="text-site-fg-3 hover:text-site-fg aria-[current=page]:text-site-fg">{item.name}</Link>)}
    </nav>
    {lead && <Link href={blogPath(locale, lead.slug)} className="site-surface site-in group grid overflow-hidden rounded-[24px] transition-[border-color,scale] duration-150 ease-site [--i:2] hover:border-white/[0.16] active:scale-[0.99] lg:grid-cols-2">
      <div className="relative min-h-[260px] overflow-hidden bg-site-sunken lg:min-h-[420px]" aria-hidden={lead.editorialCover ? undefined : true}><div className="absolute inset-0 transition-transform duration-700 ease-site group-hover:scale-[1.03]">{lead.editorialCover ? <img src={lead.displayImage} alt={lead.imageAlt} width={1200} height={630} loading="eager" fetchPriority="high" decoding="async" className="h-full w-full object-contain" /> : <Cover seed={lead.sourceSlug} />}</div></div>
      <div className="flex flex-col justify-between gap-8 p-7 sm:p-10"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">{lead.category} · {lead.readingTime} {t("min read")}</p><h2 className="mt-4 text-balance text-[clamp(2rem,1.4rem+2vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-site-fg">{lead.title}</h2><p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-site-fg-2">{lead.excerpt}</p></div><p className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">{fmt(lead.date)}<span className="text-site-fg-2">{t("Read")} <span aria-hidden="true">→</span></span></p></div>
    </Link>}
    <ul className="mt-12 border-t border-white/[0.12]">{rest.map((post) => <li key={post.slug} className="site-reveal"><Link href={blogPath(locale, post.slug)} className="group grid gap-3 border-b border-white/[0.08] py-7 sm:grid-cols-12 sm:items-baseline sm:gap-6"><time dateTime={post.date} className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3 sm:col-span-2">{fmt(post.date)}</time><span className="sm:col-span-7"><span className="block text-balance text-2xl font-semibold leading-tight tracking-[-0.035em] text-site-fg-2 transition-colors group-hover:text-site-fg sm:text-3xl">{post.title}</span><span className="mt-2 block max-w-[62ch] text-[15px] leading-relaxed text-site-fg-3">{post.excerpt}</span></span><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3 sm:col-span-3 sm:text-end">{post.category} · {post.readingTime} {t("min read")}</span></Link></li>)}</ul>
    {pages > 1 && <nav aria-label={t("Page")} className="mt-8 flex items-center justify-between border-b border-white/10 pb-6 text-[14px]">{page > 1 ? <Link href={hubPath({ locale, category, page: page - 1 })}>{t("Previous")}</Link> : <span />}<span className="text-site-fg-3">{t("Page")} {page} {t("of")} {pages}</span>{page < pages ? <Link href={hubPath({ locale, category, page: page + 1 })}>{t("Next")}</Link> : <span />}</nav>}
    <BlogLanguages locale={locale} page={page} category={category} footer />
  </div>;
}
