import { DocsMobileNav } from "@/components/site/docs-mobile-nav";
import { DocsNav } from "@/components/site/docs-nav";
import { localizedDocs } from "@/lib/content";

export default async function DocsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale?: string }> }) {
  const { locale = "en" } = await params;
  const docs = await localizedDocs(locale);
  const sections = [...new Set(docs.map((d) => d.section))];
  const groups = sections.map((section) => ({ section, docs: docs.filter((d) => d.section === section).map(({ slug, title }) => ({ slug, title })) }));
  return (
    <div className="mx-auto grid max-w-[80rem] gap-10 px-5 pb-28 pt-10 sm:px-8 lg:grid-cols-12 lg:pt-14">
      <aside className="site-in lg:col-span-3">
        <div className="lg:sticky lg:top-28">
          <DocsMobileNav groups={groups} />
          <div className="hidden lg:block">
            <DocsNav groups={groups} scope="desktop" />
          </div>
        </div>
      </aside>
      <div className="min-w-0 lg:col-span-9">{children}</div>
    </div>
  );
}
