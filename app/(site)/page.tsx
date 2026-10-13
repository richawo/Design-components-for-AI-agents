import { SiteLink as Link } from "@/components/site/site-link";
import type { Metadata } from "next";
import { ComponentCard } from "@/components/site/component-card";
import { HomeCatalogue } from "@/components/site/home-catalogue";
import { CopyButton } from "@/components/site/copy-button";
import { Faq, faqJsonLd } from "@/components/site/faq";
import { HOME_FAQ } from "@/lib/copy";
import { JsonLd } from "@/components/site/json-ld";
import { PLANS } from "@/lib/pricing";
import { getComponent, stats, toCard } from "@/lib/registry";
import { absoluteUrl, site } from "@/lib/site";
import { ChartPortfolio } from "@/registry/free/chart-portfolio/chart-portfolio";
import { showcaseCollections } from "@/lib/showcase-collections.mjs";

export const metadata: Metadata = {
  title: { absolute: "Design for AI: design components for AI agents" },
  description: site.description,
  alternates: { canonical: "/" },
};


function cardsFor(slugs: string[]) {
  return slugs.flatMap((slug) => {
    const entry = getComponent(slug);
    if (!entry) return [];
    const card = toCard(entry);
    return card.thumb ? [card] : [];
  });
}

export default function HomePage() {
  const s = stats();
  const lifetime = PLANS.find((plan) => plan.id === "pro-lifetime")!;
  const collections = showcaseCollections.map((collection) => ({ ...collection, cards: cardsFor(collection.slugs) }));
  const blocks = cardsFor(["block-music-workspace", "block-team-workspace", "block-meetings-workspace"]);
  const install = `npx shadcn@latest add ${site.url}/r/chart-portfolio.json`;
  const mcp = `claude mcp add --transport http design-for-ai ${site.url}/mcp`;

  return <>
    <JsonLd data={[
      { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url, description: site.description, potentialAction: { "@type": "SearchAction", target: `${absoluteUrl("/components")}?q={query}`, "query-input": "required name=query" } },
      { "@context": "https://schema.org", "@type": "Organization", name: site.name, url: site.url, logo: absoluteUrl("/icon.svg"), sameAs: [site.github] },
      faqJsonLd(HOME_FAQ),
    ]} />

    <section aria-labelledby="home-title" className="mx-auto max-w-[80rem] px-5 pb-14 pt-8 sm:px-8 sm:pt-14 lg:pb-20">
      <div className="mb-7 grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:gap-16">
        <div>
          <p className="site-in font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">{s.total} components · {s.blocks} complete blocks</p>
          <h1 id="home-title" className="site-in mt-4 max-w-[18ch] text-[clamp(2.6rem,5.8vw,5.2rem)] font-semibold leading-[0.98] tracking-[-0.055em] [--i:1]">Good design.<br /><span className="text-site-fg-2">Ready to build.</span></h1>
        </div>
        <div className="site-in [--i:2]">
          <p className="max-w-[44ch] text-[15px] sm:text-[16px] leading-relaxed text-site-fg-2">React components, complete blocks and native screens. Take the code and design briefs into your project, with your AI agent.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href="/components" className="site-btn site-btn-primary min-h-12 px-4 text-sm sm:px-5">Explore library <span aria-hidden="true">↗</span></Link>
            <Link href="/docs/agents" className="inline-flex min-h-12 items-center rounded-md text-[13px] text-site-fg-2 transition-colors hover:text-site-fg sm:px-2 sm:text-sm">Agent setup <span aria-hidden="true" className="ml-2">→</span></Link>
          </div>
        </div>
      </div>
      <HomeCatalogue groups={collections} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[13px] text-site-fg-3">
        <p>Code. Design prompt. JSON brief. Every component.</p>
        <Link href="/components?tier=free" className="inline-flex min-h-11 items-center gap-2 rounded-md text-site-fg-2 hover:text-site-fg">Start with a free component <span aria-hidden="true">→</span></Link>
      </div>
    </section>

    <section aria-labelledby="try-title" className="border-y border-white/[0.07] bg-site-raised/40">
      <div className="mx-auto max-w-[80rem] px-5 py-14 sm:px-8 lg:py-20">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><h2 id="try-title" className="text-[clamp(1.8rem,3.2vw,2.75rem)] font-semibold leading-tight tracking-[-0.045em]">Try the details.</h2><p className="mt-2 text-[15px] leading-relaxed text-site-fg-2">Scrub the line. Change the period. This is the code you can install.</p></div>
          <Link href="/components" className="inline-flex min-h-11 items-center rounded-md text-sm text-site-fg-2 hover:text-site-fg">More to explore <span aria-hidden="true" className="ml-2">↗</span></Link>
        </div>
        <div className="mx-auto max-w-[64rem]">
          <div className="min-w-0">
            <div className="flex min-h-[360px] items-center rounded-[22px] bg-[#0a0a0b] p-3 sm:p-6 [&_section]:w-full"><ChartPortfolio height={220} /></div>
            <PreviewCaption name="Portfolio Chart" hint="Scrub the line or change the period." href="/components/chart-portfolio" />
          </div>
        </div>
        <div className="mt-6 flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-site-bg p-3 sm:p-4">
          <span className="text-sm text-site-fg-2">Make the chart yours</span><code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-site-fg-2">{install}</code><CopyButton text={install} label="Copy install command" />
        </div>
      </div>
    </section>

    {blocks.length > 0 && <section aria-labelledby="blocks-title" className="mx-auto max-w-[80rem] px-5 py-14 sm:px-8 lg:py-20">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><h2 id="blocks-title" className="text-[clamp(1.8rem,3.2vw,2.75rem)] font-semibold leading-tight tracking-[-0.045em]">The whole workflow.</h2><p className="mt-2 text-[15px] text-site-fg-2">Complete blocks, composed with the same care.</p></div>
        <Link href="/blocks" className="inline-flex min-h-11 items-center rounded-md text-sm text-site-fg-2 hover:text-site-fg">Explore all {s.blocks} blocks <span aria-hidden="true" className="ml-2">↗</span></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{blocks.map((card) => <ComponentCard key={card.slug} c={card} imageSizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw" />)}</div>
    </section>}

    <section className="border-y border-white/[0.07]">
      <div className="mx-auto grid max-w-[80rem] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <div><h2 className="text-[clamp(1.8rem,3.2vw,2.75rem)] font-semibold leading-tight tracking-[-0.045em]">See it. Choose it. Ship it.</h2><p className="mt-4 max-w-[46ch] text-base leading-relaxed text-site-fg-2">Install the source, or give your agent the design prompt to adapt it to your brand. Works with Claude Code, Cursor, Codex and any MCP client.</p><Link href="/docs/agents" className="mt-4 inline-flex min-h-11 items-center rounded-md text-sm text-site-fg hover:text-white">Set up your agent <span aria-hidden="true" className="ml-2">→</span></Link></div>
        <div className="min-w-0 self-center rounded-2xl border border-white/10 bg-site-raised p-5"><div className="mb-4 flex items-center justify-between gap-3"><span className="font-mono text-xs text-site-fg-3">Remote MCP</span><CopyButton text={mcp} label="Copy setup command" /></div><code className="block overflow-x-auto whitespace-nowrap font-mono text-[13px] leading-relaxed text-site-fg-2">{mcp}</code><p className="mt-4 text-[13px] leading-relaxed text-site-fg-3">Pro access connects with your licence key. <Link href="/docs/agents" className="underline underline-offset-4 hover:text-site-fg">Setup instructions</Link></p></div>
      </div>
    </section>

    <section className="mx-auto flex max-w-[80rem] flex-col justify-between gap-6 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:py-20">
      <div><p className="text-[13px] text-site-fg-3">{s.free} free components to start with</p><h2 className="mt-3 text-[clamp(1.8rem,3.2vw,2.75rem)] font-semibold tracking-[-0.045em]">Make something worth shipping.</h2></div>
      <div className="flex flex-wrap gap-3"><Link href="/pricing" className="site-btn site-btn-primary min-h-12 px-6 text-sm">Get Pro · ${lifetime.price} once</Link><Link href="/components?tier=free" className="site-btn site-btn-secondary min-h-12 px-6 text-sm">Explore free components</Link></div>
    </section>

    <section className="mx-auto grid max-w-[80rem] gap-7 px-5 pb-20 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-16"><h2 className="text-2xl font-semibold tracking-[-0.035em]">Questions, answered.</h2><Faq items={HOME_FAQ} /></section>
  </>;
}

function PreviewCaption({ name, hint, href }: { name: string; hint: string; href: string }) {
  return <div className="flex items-start justify-between gap-3 px-1 py-4"><div className="min-w-0"><h3 className="text-[15px] font-medium text-site-fg">{name}</h3><p className="mt-1 text-[13px] leading-relaxed text-site-fg-3">{hint}</p></div><Link href={href} aria-label={`Explore ${name}`} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-site-fg-2 hover:border-white/25 hover:text-site-fg"><span aria-hidden="true">↗</span></Link></div>;
}
