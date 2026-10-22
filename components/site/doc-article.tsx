import { serverI18n } from "@/lib/i18n/server";
import { SiteLink as Link } from "@/components/site/site-link";
import { ProseContent } from "./prose-content";
import { Toc } from "./toc";
import type { DocMeta, Heading } from "@/lib/content";

function PageLink({ href, title, direction }: { href: string; title: string; direction: "prev" | "next" }) {
  const next = direction === "next";
  return (
    <Link
      href={href}
      className={`site-surface group block rounded-[18px] p-5 transition-[border-color,background-color,scale] duration-150 ease-site hover:border-white/[0.16] hover:bg-white/[0.03] active:scale-[0.98] motion-reduce:!scale-100 active:duration-75 ${next ? "text-right" : ""}`}
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">
        {!next && <span className="transition-transform duration-150 ease-site group-hover:-translate-x-0.5 motion-reduce:!translate-none">←</span>}
        {next ? "Next" : "Previous"}
        {next && <span className="transition-transform duration-150 ease-site group-hover:translate-x-0.5 motion-reduce:!translate-none">→</span>}
      </span>
      <span className="mt-1.5 block text-xl font-semibold tracking-[-0.03em] text-site-fg">{title}</span>
    </Link>
  );
}

export async function DocArticle({ locale = "en", meta, html, headings, prev, next, lead }: { locale?: string; meta: DocMeta; html: string; headings: Heading[]; prev?: DocMeta; next?: DocMeta; lead?: React.ReactNode }) {
  const { localize } = await serverI18n(locale);

  const href = (d: DocMeta) => (d.slug === "introduction" ? "/docs" : `/docs/${d.slug}`);
  return (
    localize(<div className="grid gap-12 xl:grid-cols-9">
      <article className="min-w-0 xl:col-span-7">
        <p className="site-in font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3 [--i:1]">{meta.section}</p>
        <h1 tabIndex={-1} className="site-in mt-3 text-[clamp(2.4rem,1.6rem+3vw,4rem)] font-semibold leading-[0.95] tracking-[-0.05em] [--i:2]">
          <span className="site-silver-text">{meta.title}</span>
        </h1>
        <p className="site-in mt-4 max-w-[60ch] text-lg leading-relaxed text-site-fg-2 [--i:3]">{meta.description}</p>
        {headings.length > 1 && <details className="site-disclosure mt-6 rounded-xl border border-white/10 xl:hidden"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm text-site-fg-2">On this page</summary><ul className="border-t border-white/10 p-2">{headings.map((heading) => <li key={heading.id}><a className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-site-fg-2 hover:bg-white/5 hover:text-site-fg ${heading.level === 3 ? "pl-6" : ""}`} href={`#${heading.id}`}>{heading.text}</a></li>)}</ul></details>}
        {lead && <div className="site-in mt-10 [--i:4]">{lead}</div>}
        <ProseContent html={html} className="site-in mt-10 [--i:4]" />
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
    </div>)
  );
}
