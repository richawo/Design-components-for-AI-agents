import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentCard, TierBadge } from "@/components/site/component-card";
import { JsonLd } from "@/components/site/json-ld";
import { PreviewFrame } from "@/components/site/preview-frame";
import { SourceTabs, type SourcePayload } from "@/components/site/source-tabs";
import { highlight } from "@/lib/highlight";
import { fileNameFor, installText } from "@/lib/install";
import { allComponents, componentsIn, getComponent, readSource, thumbnailFor, toCard } from "@/lib/registry";
import { CATEGORIES } from "@/lib/registry-types";
import { absoluteUrl, site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return allComponents().map((c) => ({ slug: c.slug }));
}

function seoTitle(e: NonNullable<ReturnType<typeof getComponent>>) {
  return e.platform === "mobile"
    ? `${e.name}: React Native component with AI prompt`
    : `${e.name}: ${CATEGORIES[e.category].noun} for React + Tailwind, with AI prompt`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = getComponent(slug);
  if (!e) return {};
  return {
    title: seoTitle(e),
    description: e.description,
    keywords: [...e.tags, e.platform === "mobile" ? "react native" : "react", "tailwind", "ai prompt", "component", "ai agent"],
    alternates: { canonical: `/components/${slug}`, types: { "text/markdown": `/components/${slug}.md` } },
    openGraph: { type: "article", title: `${e.name} · ${site.name}`, description: e.description, url: absoluteUrl(`/components/${slug}`) },
  };
}

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getComponent(slug);
  if (!e) notFound();

  const install = installText(e);
  const [installHtml, usageHtml] = await Promise.all([highlight(install, "bash"), highlight(e.usage, "tsx")]);

  // Pro source is never rendered into the page. The client fetches it with a licence.
  let initial: SourcePayload | null = null;
  if (e.tier === "free") {
    const src = await readSource(slug);
    if (src) {
      initial = {
        code: src.code,
        codeHtml: await highlight(src.code, "tsx"),
        prompt: src.prompt,
        promptJson: src.promptJson,
        promptJsonHtml: await highlight(src.promptJson, "json"),
      };
    }
  }

  const related = componentsIn(e.category).filter((c) => c.slug !== slug).slice(0, 3);
  const cat = CATEGORIES[e.category];
  const thumb = thumbnailFor(slug);

  return (
    <div className="mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareSourceCode",
            name: e.name,
            description: e.description,
            url: absoluteUrl(`/components/${slug}`),
            programmingLanguage: "TypeScript",
            runtimePlatform: e.platform === "mobile" ? "React Native" : "React",
            keywords: e.tags.join(", "),
            dateCreated: e.added,
            image: thumb ? absoluteUrl(thumb) : undefined,
            license: e.tier === "free" ? "https://opensource.org/licenses/MIT" : absoluteUrl("/docs/license"),
            isAccessibleForFree: e.tier === "free",
            codeRepository: e.tier === "free" ? `${site.github}/tree/main/registry/free/${slug}` : undefined,
            author: { "@type": "Organization", name: site.name, url: site.url },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Components", item: absoluteUrl("/components") },
              { "@type": "ListItem", position: 2, name: cat.label, item: absoluteUrl(`/categories/${e.category}`) },
              { "@type": "ListItem", position: 3, name: e.name, item: absoluteUrl(`/components/${slug}`) },
            ],
          },
        ]}
      />

      <nav aria-label="Breadcrumb" className="pt-10 text-[13px] text-site-fg-3">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/components" className="transition-colors hover:text-site-fg">
              Components
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-60">/</li>
          <li>
            <Link href={`/categories/${e.category}`} className="transition-colors hover:text-site-fg">
              {cat.label}
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-60">/</li>
          <li aria-current="page" className="text-site-fg-2">
            {e.name}
          </li>
        </ol>
      </nav>

      <header className="grid gap-8 pb-10 pt-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <div className="flex flex-wrap items-center gap-1.5">
            <TierBadge tier={e.tier} />
            <span className="inline-flex h-5 items-center rounded-full bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-site-fg-3 ring-1 ring-inset ring-white/[0.08]">
              {e.platform === "mobile" ? "React Native" : "React · Tailwind v4"}
            </span>
            {e.dependencies.map((d) => (
              <span key={d} className="inline-flex h-5 items-center rounded-full bg-white/[0.04] px-2 font-mono text-[10px] text-site-fg-3 ring-1 ring-inset ring-white/[0.08]">
                {d}
              </span>
            ))}
          </div>
          <h1 className="mt-5 text-[clamp(2.25rem,1.5rem+3vw,3.75rem)] font-semibold leading-[1] tracking-[-0.05em]">
            <span className="site-silver-text">{e.name}</span>
          </h1>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-site-fg-2">{e.description}</p>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-white/[0.08] bg-white/[0.08] lg:col-span-4">
          {[
            ["Category", cat.label],
            ["Added", new Date(e.added).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })],
            ["Licence", e.tier === "free" ? "MIT" : "Pro"],
          ].map(([k, v]) => (
            <div key={k} className="bg-[#0a0a0b] px-4 py-3.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-site-fg-3">{k}</dt>
              <dd className="mt-1.5 truncate text-[14px] font-medium text-site-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {e.hasSource ? (
        <PreviewFrame slug={slug} name={e.name} height={e.previewHeight} platform={e.platform} theme={e.theme} />
      ) : (
        <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0a0a0b]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt={`${e.name} preview`} className="w-full" />
          ) : (
            <div className="site-dots flex h-80 items-center justify-center text-[14px] text-site-fg-3">Live preview available on {site.url.replace("https://", "")}</div>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <SourceTabs
            slug={slug}
            name={e.name}
            tier={e.tier}
            fileName={fileNameFor(e)}
            initial={initial}
            installText={install}
            installHtml={installHtml}
          />
        </div>
        <aside className="flex min-w-0 flex-col gap-4 lg:col-span-4">
          <section className="site-surface rounded-[20px] p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">Usage</h2>
            <div
              className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/50 p-4 font-mono text-[12px] leading-[1.7] [&_pre]:!bg-transparent"
              dangerouslySetInnerHTML={{ __html: usageHtml }}
            />
          </section>
          <section className="site-surface rounded-[20px] p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">Ships with</h2>
            <ul className="mt-4 space-y-3.5 text-[14px] leading-relaxed text-site-fg-2">
              {[
                ["Code", "One self-contained file. Drop it in and it works."],
                ["Prompt", "A designer’s brief your agent can rebuild it from, in your brand."],
                ["JSON prompt", "The same brief as data: layout, type, colour, motion, and what to avoid."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-site-accent shadow-[0_0_10px_#ff7a45]" />
                  <span>
                    <span className="font-medium text-site-fg">{t}.</span> {d}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="site-surface rounded-[20px] p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">Tags</h2>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {e.tags.map((t) => (
                <li key={t} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[12px] text-site-fg-2 ring-1 ring-inset ring-white/[0.06]">
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {e.props.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">Props</h2>
          <div className="mt-5 overflow-x-auto rounded-[20px] border border-white/[0.08] bg-[#0a0a0b]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] font-mono text-[10px] uppercase tracking-[0.14em] text-site-fg-3">
                  <th className="px-5 py-3 font-medium">Prop</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Default</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {e.props.map((p) => (
                  <tr key={p.name} className="border-b border-white/[0.05] last:border-0">
                    <td className="px-5 py-3.5 font-mono text-[13px] text-site-fg">{p.name}</td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-site-glow/90">{p.type}</td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-site-fg-3">{p.default ?? "—"}</td>
                    <td className="px-5 py-3.5 text-site-fg-2">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">More {cat.label.toLowerCase()}</h2>
            <Link href={`/categories/${e.category}`} className="text-[14px] text-site-fg-2 transition-colors hover:text-site-fg">
              See all
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <ComponentCard key={r.slug} c={toCard(r)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
