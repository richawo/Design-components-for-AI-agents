import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentCard } from "@/components/site/component-card";
import { JsonLd } from "@/components/site/json-ld";
import { categoriesWithCounts, componentsIn, toCard } from "@/lib/registry";
import { CATEGORIES, type Category } from "@/lib/registry-types";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return categoriesWithCounts().map((c) => ({ category: c.key }));
}

const isCategory = (c: string): c is Category => c in CATEGORIES;

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return {};
  const c = CATEGORIES[category];
  const n = componentsIn(category).length;
  const stack = category === "mobile" ? "React Native" : "React and Tailwind";
  return {
    title: `${n} ${c.label.toLowerCase()} components for ${stack}, with AI prompts`,
    description: `${c.blurb} ${n} ${c.noun} components for ${stack}, each with code, a prompt and a JSON prompt for AI agents.`,
    alternates: { canonical: `/categories/${category}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isCategory(category)) notFound();
  const c = CATEGORIES[category];
  const items = componentsIn(category);
  if (!items.length) notFound();
  const others = categoriesWithCounts().filter((x) => x.key !== category);
  return (
    <div className="mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${c.label} components`,
          url: absoluteUrl(`/categories/${category}`),
          mainEntity: {
            "@type": "ItemList",
            itemListElement: items.map((e, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/components/${e.slug}`), name: e.name })),
          },
        }}
      />
      <nav aria-label="Breadcrumb" className="pt-10 text-[13px] text-site-fg-3">
        <Link href="/components" className="transition-colors hover:text-site-fg">
          Components
        </Link>
        <span className="mx-2 text-site-fg-3/60">/</span>
        <span className="text-site-fg-2">{c.label}</span>
      </nav>
      <section className="grid gap-6 pb-12 pt-6 lg:grid-cols-12 lg:items-end lg:pb-14">
        <h1 className="text-[clamp(2.25rem,1.4rem+3.4vw,4rem)] font-semibold leading-[1] tracking-[-0.05em] lg:col-span-7">
          <span className="site-silver-text">{c.label}</span>
          <span className="ml-3 align-top font-mono text-sm font-normal tracking-normal text-site-fg-3">{String(items.length).padStart(2, "0")}</span>
        </h1>
        <p className="max-w-[48ch] text-[16px] leading-relaxed text-site-fg-2 lg:col-span-5">
          {c.blurb} Every {c.noun} comes with its code, a prompt and a JSON prompt.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((e, i) => (
          <ComponentCard key={e.slug} c={toCard(e)} priority={i < 3} />
        ))}
      </div>
      <section className="mt-20 border-t border-white/[0.07] pt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">Other categories</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {others.map((o) => (
            <li key={o.key}>
              <Link href={`/categories/${o.key}`} className="inline-flex h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-4 text-[13px] text-site-fg-2 transition duration-200 hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.97] active:duration-75 hover:text-site-fg">
                {o.label} <span className="font-mono text-[10px] text-site-fg-3">{o.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
