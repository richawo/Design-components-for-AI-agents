import Link from "next/link";
import type { Metadata } from "next";
import { Cover } from "@/components/site/cover";
import { JsonLd } from "@/components/site/json-ld";
import { allPosts } from "@/lib/content";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog: design for the age of AI agents",
  description: "Essays and guides on getting AI coding agents to produce interfaces with taste: prompting, design systems, components and the anatomy of AI slop.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/rss.xml" } },
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function BlogIndex() {
  const posts = allPosts();
  const [lead, ...rest] = posts;
  return (
    <div className="mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `${site.name} blog`,
          url: absoluteUrl("/blog"),
          blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: absoluteUrl(`/blog/${p.slug}`), datePublished: p.date, dateModified: p.dateModified })),
        }}
      />
      <section className="grid gap-6 pb-12 pt-14 lg:grid-cols-12 lg:items-end lg:pt-20">
        <h1 className="site-in text-[clamp(2.75rem,1.5rem+5vw,6rem)] font-semibold leading-[0.92] tracking-[-0.055em] lg:col-span-8">
          <span className="site-silver-text">Notes on</span> <span className="text-site-fg-3">taste.</span>
        </h1>
        <p className="site-in max-w-[44ch] text-[17px] leading-relaxed text-site-fg-2 [--i:1] lg:col-span-4">
          How to get AI agents to design like they mean it: prompting, systems, components and the anatomy of slop.{" "}
          <Link href="/rss.xml" className="rounded-sm font-medium text-site-fg underline decoration-white/30 underline-offset-4 transition-colors duration-150 hover:decoration-white/80">
            RSS
          </Link>
        </p>
      </section>

      {lead && (
        <Link
          href={`/blog/${lead.slug}`}
          className="site-surface site-in group grid overflow-hidden rounded-[24px] transition-[border-color,scale] duration-150 ease-site [--i:2] hover:border-white/[0.16] active:scale-[0.99] active:duration-75 lg:grid-cols-2"
        >
          <div className="relative min-h-[260px] overflow-hidden bg-site-sunken lg:min-h-[420px]" aria-hidden="true">
            <div className="absolute inset-0 transition-transform duration-700 ease-site group-hover:scale-[1.03]">
              <Cover seed={lead.slug} />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-8 p-7 sm:p-10">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">
                {lead.category} · {lead.readingTime} min read
              </p>
              <h2 className="mt-4 text-balance text-[clamp(2rem,1.4rem+2vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-site-fg">{lead.title}</h2>
              <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-site-fg-2">{lead.excerpt}</p>
            </div>
            <p className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">
              {fmt(lead.date)}
              <span className="inline-flex items-center gap-1.5 text-site-fg-2 transition-colors duration-150 group-hover:text-site-fg">
                Read
                <span aria-hidden="true" className="transition-transform duration-150 ease-site group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </p>
          </div>
        </Link>
      )}

      <ul className="mt-12 border-t border-white/[0.12]">
        {rest.map((p) => (
          <li key={p.slug} className="site-reveal">
            <Link href={`/blog/${p.slug}`} className="group grid gap-3 border-b border-white/[0.08] py-7 sm:grid-cols-12 sm:items-baseline sm:gap-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3 sm:col-span-2">{fmt(p.date)}</span>
              <span className="sm:col-span-7">
                <span className="block text-balance text-2xl font-semibold leading-tight tracking-[-0.035em] text-site-fg-2 transition-colors duration-150 group-hover:text-site-fg sm:text-3xl">{p.title}</span>
                <span className="mt-2 block max-w-[62ch] text-[15px] leading-relaxed text-site-fg-3">{p.excerpt}</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3 sm:col-span-3 sm:text-right">
                {p.category} · {p.readingTime} min
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
