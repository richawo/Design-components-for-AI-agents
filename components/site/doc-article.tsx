import Link from "next/link";
import { Toc } from "./toc";
import type { DocMeta, Heading } from "@/lib/content";

function PageLink({ href, title, direction }: { href: string; title: string; direction: "prev" | "next" }) {
  const next = direction === "next";
  return (
    <Link
      href={href}
      className={`site-surface group block rounded-[18px] p-5 transition-[border-color,background-color,scale] duration-150 ease-site hover:border-white/[0.16] hover:bg-white/[0.03] active:scale-[0.98] active:duration-75 ${next ? "text-right" : ""}`}
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">
        {!next && <span className="transition-transform duration-150 ease-site group-hover:-translate-x-0.5">←</span>}
        {next ? "Next" : "Previous"}
        {next && <span className="transition-transform duration-150 ease-site group-hover:translate-x-0.5">→</span>}
      </span>
      <span className="mt-1.5 block text-xl font-semibold tracking-[-0.03em] text-site-fg">{title}</span>
    </Link>
  );
}

export function DocArticle({ meta, html, headings, prev, next }: { meta: DocMeta; html: string; headings: Heading[]; prev?: DocMeta; next?: DocMeta }) {
  const href = (d: DocMeta) => (d.slug === "introduction" ? "/docs" : `/docs/${d.slug}`);
  return (
    <div className="grid gap-12 xl:grid-cols-9">
      <article className="min-w-0 xl:col-span-7">
        <p className="site-in font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3 [--i:1]">{meta.section}</p>
        <h1 className="site-in mt-3 text-[clamp(2.4rem,1.6rem+3vw,4rem)] font-semibold leading-[0.95] tracking-[-0.05em] [--i:2]">
          <span className="site-silver-text">{meta.title}</span>
        </h1>
        <p className="site-in mt-4 max-w-[60ch] text-lg leading-relaxed text-site-fg-2 [--i:3]">{meta.description}</p>
        <div className="site-prose site-in mt-10 [--i:4]" dangerouslySetInnerHTML={{ __html: html }} />
        <nav className="site-reveal mt-16 grid gap-4 border-t border-white/[0.08] pt-8 sm:grid-cols-2" aria-label="Pagination">
          {prev ? <PageLink href={href(prev)} title={prev.title} direction="prev" /> : <span className="hidden sm:block" />}
          {next && <PageLink href={href(next)} title={next.title} direction="next" />}
        </nav>
      </article>
      <aside className="site-in hidden [--i:4] xl:col-span-2 xl:block">
        <div className="sticky top-28">
          <Toc headings={headings} />
        </div>
      </aside>
    </div>
  );
}
