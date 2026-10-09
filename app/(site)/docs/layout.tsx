import { DocsNav } from "@/components/site/docs-nav";
import { allDocs } from "@/lib/content";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = allDocs();
  const sections = [...new Set(docs.map((d) => d.section))];
  const groups = sections.map((section) => ({ section, docs: docs.filter((d) => d.section === section).map(({ slug, title }) => ({ slug, title })) }));
  return (
    <div className="mx-auto grid max-w-[80rem] gap-10 px-5 pb-28 pt-10 sm:px-8 lg:grid-cols-12 lg:pt-14">
      <aside className="site-in lg:col-span-3">
        <div className="lg:sticky lg:top-28">
          <details className="site-disclosure site-surface group rounded-[18px] lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-[18px] px-4 py-3.5 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
              Documentation
              <svg viewBox="0 0 16 16" className="size-4 text-site-fg-2 transition-transform duration-300 ease-site group-open:rotate-180" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="border-t border-white/[0.06] px-2 pb-4 pt-4">
              <DocsNav groups={groups} scope="mobile" />
            </div>
          </details>
          <div className="hidden lg:block">
            <DocsNav groups={groups} scope="desktop" />
          </div>
        </div>
      </aside>
      <div className="min-w-0 lg:col-span-9">{children}</div>
    </div>
  );
}
