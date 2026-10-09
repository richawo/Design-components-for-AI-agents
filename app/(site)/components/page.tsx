import type { Metadata } from "next";
import { ComponentBrowser } from "@/components/site/component-browser";
import { JsonLd } from "@/components/site/json-ld";
import { allComponents, categoriesWithCounts, stats, toCard } from "@/lib/registry";
import { absoluteUrl, site } from "@/lib/site";
import { DitherGlow } from "@/components/site/dither-glow";

export const metadata: Metadata = {
  title: "All components: React, Tailwind and React Native, with AI prompts",
  description:
    "Browse every Design for AI component: heroes, pricing, AI chat, dashboards and React Native screens. Each ships with code, a prompt and a JSON prompt for your agent.",
  alternates: { canonical: "/components" },
};

export default function ComponentsPage() {
  const s = stats();
  const all = allComponents();
  const cards = all.map(toCard);
  const categories = categoriesWithCounts().map(({ key, label, count }) => ({ key, label, count }));
  return (
    <div className="relative mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Design for AI components",
          url: absoluteUrl("/components"),
          isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: all.length,
            itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/components/${c.slug}`), name: c.name })),
          },
        }}
      />
      <section className="relative isolate pb-12 pt-14 lg:pb-16 lg:pt-20">
        <div aria-hidden="true" className="absolute -inset-x-5 -top-16 -z-10 h-[30rem] sm:-inset-x-8">
          <DitherGlow className="opacity-70 [mask-image:linear-gradient(180deg,#000_35%,transparent)]" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">Library</p>
        <h1 className="mt-4 max-w-[18ch] text-[clamp(2.25rem,1.4rem+3.4vw,4rem)] font-semibold leading-[1] tracking-[-0.05em]">
          <span className="site-silver-text">{s.total} components.</span> <span className="text-site-fg-3">Every one designed.</span>
        </h1>
        <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-site-fg-2">
          {s.free} free and open source, {s.pro} Pro, {s.mobile} React Native. Each ships with its code, a prompt and a JSON prompt.
        </p>
      </section>
      <ComponentBrowser cards={cards} categories={categories} />
    </div>
  );
}
