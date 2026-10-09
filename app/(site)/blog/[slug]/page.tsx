import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/site/json-ld";
import { Toc } from "@/components/site/toc";
import { allPosts, getPost, relatedPosts } from "@/lib/content";
import { absoluteUrl, site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = allPosts().find((x) => x.slug === slug);
  if (!p) return {};
  return {
    title: { absolute: p.title },
    description: p.description,
    keywords: p.keywords,
    authors: [{ name: p.author }],
    alternates: { canonical: `/blog/${slug}`, types: { "text/markdown": `/blog/${slug}.md` } },
    openGraph: { type: "article", title: p.title, description: p.description, url: absoluteUrl(`/blog/${slug}`), publishedTime: p.date, modifiedTime: p.dateModified, section: p.category, tags: p.keywords },
  };
}

const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const { meta, html, headings, faqs, markdown } = post;
  const url = absoluteUrl(`/blog/${slug}`);
  const related = relatedPosts(slug);

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: meta.title,
      description: meta.description,
      datePublished: meta.date,
      dateModified: meta.dateModified,
      wordCount: markdown.split(/\s+/).length,
      articleSection: meta.category,
      keywords: meta.keywords.join(", "),
      url,
      isAccessibleForFree: true,
      author: { "@type": "Organization", name: meta.author, url: site.url },
      publisher: { "@type": "Organization", name: site.name, url: site.url, logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") } },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
        { "@type": "ListItem", position: 3, name: meta.title, item: url },
      ],
    },
  ];
  if (faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }

  return (
    <article className="mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <JsonLd data={jsonLd} />
      <header className="mx-auto max-w-4xl pb-12 pt-12 lg:pt-20">
        <nav aria-label="Breadcrumb" className="site-in font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">
          <Link href="/blog" className="rounded-sm transition-colors duration-150 hover:text-site-fg">
            Blog
          </Link>{" "}
          / {meta.category}
        </nav>
        <h1 className="site-in mt-6 text-balance text-[clamp(2.4rem,1.4rem+4vw,5rem)] font-semibold leading-[0.95] tracking-[-0.05em] [--i:1]">
          <span className="site-silver-text">{meta.title}</span>
        </h1>
        <p className="site-in mt-6 max-w-[60ch] text-[clamp(1.1rem,1rem+0.4vw,1.3rem)] leading-relaxed text-site-fg-2 [--i:2]">{meta.description}</p>
        <div className="site-in mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.08] pt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3 [--i:3]">
          <span>{meta.author}</span>
          <time dateTime={meta.date}>{fmt(meta.date)}</time>
          {meta.dateModified !== meta.date && <span>Updated {fmt(meta.dateModified)}</span>}
          <span>{meta.readingTime} min read</span>
        </div>
      </header>

      <div className="grid gap-12 lg:grid-cols-12">
        <aside className="site-in hidden [--i:4] lg:col-span-3 lg:block">
          <div className="sticky top-28">
            <Toc headings={headings} label="In this piece" />
          </div>
        </aside>
        <div className="site-prose site-in min-w-0 [--i:4] lg:col-span-7" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <aside className="site-surface site-reveal relative mx-auto mt-20 max-w-4xl overflow-hidden rounded-[24px] p-8 sm:p-12">
        <p className="text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
          Give your agent something <span className="text-site-fg-3">worth copying.</span>
        </p>
        <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-site-fg-2">Every Design for AI component ships with its code, a prompt and a JSON prompt. Most are free.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/components" className="site-btn site-btn-primary h-12 px-6 text-[15px]">
            Browse components
          </Link>
          <Link href="/docs/agents" className="site-btn site-btn-secondary h-12 px-6 text-[15px]">
            Connect your agent
          </Link>
        </div>
      </aside>

      {related.length > 0 && (
        <section className="mx-auto mt-20 max-w-4xl">
          <h2 className="site-reveal font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">Keep reading</h2>
          <ul className="mt-4 border-t border-white/[0.12]">
            {related.map((r) => (
              <li key={r.slug} className="site-reveal">
                <Link href={`/blog/${r.slug}`} className="group block border-b border-white/[0.08] py-6">
                  <span className="block text-balance text-2xl font-semibold tracking-[-0.035em] text-site-fg-2 transition-colors duration-150 group-hover:text-site-fg">{r.title}</span>
                  <span className="mt-1 block text-[15px] text-site-fg-3">{r.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
