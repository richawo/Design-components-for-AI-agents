import { SiteLink as Link } from "@/components/site/site-link";
import type { Metadata } from "next";
import { ComponentCard } from "@/components/site/component-card";
import { JsonLd } from "@/components/site/json-ld";
import { allBlocks, toCard } from "@/lib/registry";
import { BLOCK_LABELS, cataloguePath } from "@/lib/catalogue-path";
import { BLOCK_DESCRIPTIONS } from "@/lib/block-types.mjs";
import type { BlockType } from "@/lib/registry-types";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title:
    "Complete React blocks: dashboards, collaboration, media and product pages",
  description:
    "Build complete product pages from Design for AI components. Browse dashboards, collaboration and media apps, reports, settings and landing pages with source and AI briefs.",
  alternates: {
    canonical: "/blocks",
    types: { "text/markdown": "/blocks.md" },
  },
};
export default function BlocksPage() {
  const blocks = allBlocks();
  const groups = (Object.entries(BLOCK_LABELS) as [BlockType, string][]).filter(([key]) =>
    blocks.some((block) => block.blockType === key),
  );
  return (
    <div className="mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Design for AI blocks",
          url: absoluteUrl("/blocks"),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: blocks.length,
            itemListElement: blocks.map((block, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: block.name,
              url: absoluteUrl(cataloguePath(block)),
            })),
          },
        }}
      />
      <header className="pb-12 pt-14 lg:pb-16 lg:pt-20">
        <p className="site-in font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">
          Composed pages / Pro
        </p>
        <h1 className="site-in mt-5 max-w-[20ch] text-[clamp(2.6rem,2rem+3vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.055em] [--i:1]">
          Start with the whole page.
        </h1>
        <p className="site-in mt-6 max-w-[64ch] text-[16px] leading-[1.8] text-site-fg-2 [--i:2]">
          {blocks.length} complete {blocks.length === 1 ? "block" : "blocks"},
          built from the components in this library. Find the right starting
          point for an operations dashboard, a team conversation, a listening
          app or a complete product page.
        </p>
        <div className="site-in mt-7 flex flex-wrap gap-3 [--i:3]">
          <Link
            href="/pricing"
            className="site-btn site-btn-accent min-h-11 px-5"
          >
            Get Pro access ↗
          </Link>
          <Link
            href="/components"
            className="site-btn site-btn-secondary min-h-11 px-5"
          >
            Explore the components
          </Link>
        </div>
      </header>
      <nav
        aria-label="Block types"
        className="mb-14 flex flex-wrap gap-x-7 gap-y-4 border-y border-site-line py-5"
      >
        {groups.map(([key, label]) => (
          <a
            key={key}
            href={`#${key}`}
            className="rounded-sm text-sm text-site-fg-2 transition-colors hover:text-site-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-site-accent"
          >
            {label}
            <span className="ml-2 font-mono text-xs text-site-fg-3">
              {blocks.filter((block) => block.blockType === key).length}
            </span>
          </a>
        ))}
      </nav>
      <div className="space-y-16">
        {groups.map(([key, label]) => (
          <section key={key} id={key} className="scroll-mt-24">
            <div className="mb-6">
              <h2 className="text-2xl font-medium tracking-tight">{label}</h2>
              <p className="mt-2 text-sm leading-relaxed text-site-fg-2">
                {BLOCK_DESCRIPTIONS[key]}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {blocks
                .filter((block) => block.blockType === key)
                .map((block) => (
                  <ComponentCard key={block.slug} c={toCard(block)} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
