import type { Metadata } from "next";
import { ComponentBrowser } from "@/components/site/component-browser";
import { CountUp } from "@/components/site/count-up";
import { JsonLd } from "@/components/site/json-ld";
import {
  individualComponents,
  categoriesWithCounts,
  stats,
  toCard,
} from "@/lib/registry";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "All components: React, Tailwind and React Native, with AI prompts",
  description:
    "Browse every Design for AI component: heroes, pricing, AI chat, dashboards and React Native screens. Each ships with code, a prompt and a JSON prompt for your agent.",
  alternates: { canonical: "/components" },
};

// Every visitor gets the same catalogue. Query filters are restored locally
// before the browser paints a navigation, so this route can be prerendered.
export default function ComponentsPage() {
  const s = stats();
  const all = individualComponents();
  const cards = all.map(toCard);
  const categories = categoriesWithCounts().map(({ key, label, count }) => ({
    key,
    label,
    count,
  }));
  return (
    <div className="relative px-5 pb-28 pt-7 sm:px-8 lg:pt-8">
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
            itemListElement: all.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: absoluteUrl(`/components/${c.slug}`),
              name: c.name,
            })),
          },
        }}
      />
      <ComponentBrowser
        cards={cards}
        categories={categories}
        introduction={
          <div>
            <h1 className="site-in flex items-baseline gap-3 text-[32px] font-semibold leading-tight tracking-[-0.04em] [--i:1]">
              Components
              <CountUp value={s.total} delay={0.25} className="font-mono text-[13px] font-normal tracking-normal text-site-fg-3" />
            </h1>
            <p className="site-in mt-2 text-[14px] leading-relaxed text-site-fg-2 [--i:2]">
              <CountUp value={s.free} delay={0.35} /> free and open source,{" "}
              <CountUp value={s.pro} delay={0.4} /> Pro. Code, prompt and JSON prompt included.
            </p>
          </div>
        }
      />
    </div>
  );
}
