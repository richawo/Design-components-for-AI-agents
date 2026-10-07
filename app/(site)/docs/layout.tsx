import { DocsNav } from "@/components/site/docs-nav";
import { allDocs } from "@/lib/content";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = allDocs();
  const sections = [...new Set(docs.map((d) => d.section))];
  const groups = sections.map((section) => ({ section, docs: docs.filter((d) => d.section === section).map(({ slug, title }) => ({ slug, title })) }));
  return (
    <div className="mx-auto grid max-w-[88rem] gap-10 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-12 lg:px-10 lg:pt-14">
      <aside className="lg:col-span-3">
        <div className="lg:sticky lg:top-28">
          <details className="group rounded-2xl border border-white/[0.08] bg-[#0a0a0b] p-4 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
              Documentation
              <span className="transition-transform group-open:rotate-180" aria-hidden="true">
                ↓
              </span>
            </summary>
            <div className="mt-4">
              <DocsNav groups={groups} />
            </div>
          </details>
          <div className="hidden lg:block">
            <DocsNav groups={groups} />
          </div>
        </div>
      </aside>
      <div className="min-w-0 lg:col-span-9">{children}</div>
    </div>
  );
}
