import Link from "next/link";
import { Toc } from "./toc";
import type { DocMeta, Heading } from "@/lib/content";

export function DocArticle({ meta, html, headings, prev, next }: { meta: DocMeta; html: string; headings: Heading[]; prev?: DocMeta; next?: DocMeta }) {
  const href = (d: DocMeta) => (d.slug === "introduction" ? "/docs" : `/docs/${d.slug}`);
  return (
    <div className="grid gap-12 xl:grid-cols-9">
      <article className="min-w-0 xl:col-span-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">{meta.section}</p>
        <h1 className="mt-3 text-[clamp(2.4rem,1.6rem+3vw,4rem)] font-semibold leading-[0.95] tracking-[-0.05em]">{meta.title}</h1>
        <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-site-fg-2">{meta.description}</p>
        <div className="site-prose mt-10" dangerouslySetInnerHTML={{ __html: html }} />
        <nav className="mt-16 grid gap-4 border-t border-white/[0.08] pt-8 sm:grid-cols-2" aria-label="Pagination">
          {prev ? (
            <Link href={href(prev)} className="rounded-2xl border border-white/[0.08] p-5 hover:border-white/20">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">← Previous</span>
              <span className="mt-1 block text-xl font-bold tracking-[-0.03em]">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={href(next)} className="rounded-2xl border border-white/[0.08] p-5 text-right hover:border-white/20">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">Next →</span>
              <span className="mt-1 block text-xl font-bold tracking-[-0.03em]">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>
      <aside className="hidden xl:col-span-2 xl:block">
        <div className="sticky top-28">
          <Toc headings={headings} />
        </div>
      </aside>
    </div>
  );
}
