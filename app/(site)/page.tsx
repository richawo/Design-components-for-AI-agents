import Link from "next/link";
import type { Metadata } from "next";
import { CopyButton } from "@/components/site/copy-button";
import { DitherGlow } from "@/components/site/dither-glow";
import { Faq, faqJsonLd } from "@/components/site/faq";
import { HOME_FAQ } from "@/lib/copy";
import { JsonLd } from "@/components/site/json-ld";
import { LiveSlot } from "@/components/site/live-slot";
import { highlight } from "@/lib/highlight";
import { PLANS } from "@/lib/pricing";
import { categoriesWithCounts, readSource, stats } from "@/lib/registry";
import { absoluteUrl, site } from "@/lib/site";
import { ChartPortfolio } from "@/registry/free/chart-portfolio/chart-portfolio";
import { PixelMatrixDisplay } from "@/registry/free/pixel-matrix-display/pixel-matrix-display";

export const metadata: Metadata = {
  title: { absolute: "Design for AI: design components for AI agents" },
  description: site.description,
  alternates: { canonical: "/" },
};


const AGENTS = ["Claude Code", "Cursor", "v0", "Windsurf", "Codex", "Lovable", "Bolt"];

export default async function HomePage() {
  const s = stats();
  const categories = categoriesWithCounts();
  const lifetime = PLANS.find((p) => p.id === "pro-lifetime")!;
  const install = `npx shadcn@latest add ${site.url}/r/chart-portfolio.json`;

  const ref = await readSource("chart-portfolio");
  const codeExcerpt = ref ? ref.code.split("\n").slice(86, 104).join("\n") : "";
  const jsonExcerpt = ref ? JSON.stringify({ motion: JSON.parse(ref.promptJson).motion, color: JSON.parse(ref.promptJson).color }, null, 2).split("\n").slice(0, 18).join("\n") : "";
  const promptExcerpt = ref ? ref.prompt.split("\n").slice(9, 17).join("\n") : "";
  const [codeHtml, jsonHtml, mcpHtml] = await Promise.all([
    highlight(codeExcerpt, "tsx"),
    highlight(jsonExcerpt, "json"),
    highlight(
      JSON.stringify({ mcpServers: { "design-for-ai": { url: absoluteUrl("/mcp"), headers: { Authorization: "Bearer ${DESIGN_FOR_AI_LICENSE}" } } } }, null, 2),
      "json",
    ),
  ]);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: site.name,
            url: site.url,
            description: site.description,
            potentialAction: { "@type": "SearchAction", target: `${absoluteUrl("/components")}?q={query}`, "query-input": "required name=query" },
          },
          { "@context": "https://schema.org", "@type": "Organization", name: site.name, url: site.url, logo: absoluteUrl("/icon.svg"), sameAs: [site.github] },
          faqJsonLd(HOME_FAQ),
        ]}
      />

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate -mt-16 overflow-hidden pt-16">
        <div aria-hidden="true" className="site-leaks -z-10" />
        <DitherGlow className="-z-10 [mask-image:linear-gradient(180deg,#000_55%,transparent)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="mx-auto max-w-[80rem] px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-28 lg:pb-20">
          <Link
            href="/categories/auth"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3.5 text-[13px] text-site-fg-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-200 hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.97] active:duration-75 hover:text-site-fg"
          >
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-site-fg">New</span>
            Auth, headers, footers and new 3D scenes
            <svg viewBox="0 0 16 16" className="size-3.5 transition-transform group-hover:translate-x-0.5" fill="none" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <h1 className="mx-auto mt-8 max-w-[16ch] text-balance text-[clamp(2.75rem,1rem+6.2vw,6rem)] font-semibold leading-[0.95] tracking-[-0.055em]">
            <span className="site-silver-text">Design components</span>{" "}
            <span className="site-gradient-text">for AI agents.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-[56ch] text-balance text-[17px] leading-relaxed text-site-fg-2 sm:text-lg">
            Precise, responsive components for React, Tailwind and React Native. Every one ships with the code, a prompt and a JSON prompt, so what your agent builds looks designed, not generated.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/components"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-black shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_10px_30px_-10px_rgba(255,255,255,0.45)] transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_14px_36px_-10px_rgba(255,179,138,0.6)] active:translate-y-0 active:scale-[0.97] active:duration-75 sm:w-auto"
            >
              Browse {s.total} components
              <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
                <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/pricing"
              className="site-surface inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[15px] font-medium text-site-fg transition duration-200 hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.97] active:duration-75 sm:w-auto"
            >
              Get Pro · ${lifetime.price} once
            </Link>
          </div>

          <div className="mx-auto mt-6 flex w-full max-w-xl items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] py-1.5 pl-4 pr-1.5 text-left">
            <span className="font-mono text-[12px] text-site-fg-3">$</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-site-fg-2">{install}</code>
            <CopyButton text={install} label="Copy" />
          </div>
        </div>

        {/* Live showcase */}
        <div className="mx-auto max-w-[80rem] px-5 pb-24 sm:px-8">
          <div className="grid gap-4 lg:grid-cols-12">
            <ShowcaseTile href="/components/three-particle-sphere" label="3D & WebGL" name="Particle Sphere" tier="Pro" className="lg:col-span-7 lg:row-span-2">
              <div className="relative h-[380px] sm:h-[460px] lg:h-full lg:min-h-[640px]">
                <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-[0.05] blur-[90px]" />
                <div className="absolute inset-0">
                  <LiveSlot
                    slug="three-particle-sphere"
                    exportName="ThreeParticleSphere"
                    fallback={<div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">WebGL preview</div>}
                  />
                </div>
              </div>
            </ShowcaseTile>
            <ShowcaseTile href="/components/chart-portfolio" label="Charts & data" name="Portfolio Chart" tier="Free" className="lg:col-span-5">
              <div className="p-3 sm:p-4 [&_section]:rounded-[16px] [&_section]:border-white/[0.06] [&_section]:shadow-none">
                <ChartPortfolioMini />
              </div>
            </ShowcaseTile>
            <ShowcaseTile href="/components/pixel-matrix-display" label="Pixel & generative" name="Pixel Matrix Display" tier="Free" className="lg:col-span-5">
              <div className="flex h-full items-center p-4 sm:p-6">
                <PixelMatrixDisplay chrome={false} cols={56} rows={14} text="SHIP IT   " />
              </div>
            </ShowcaseTile>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Agent strip */}
      <section className="border-y border-white/[0.07]">
        <div className="mx-auto flex max-w-[80rem] flex-col items-center gap-6 px-5 py-10 sm:px-8 lg:flex-row lg:justify-between">
          <p className="text-[13px] text-site-fg-3">Works with the agents you already use</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
            {AGENTS.map((a) => (
              <li key={a} className="text-[15px] font-medium tracking-[-0.02em] text-site-fg-2">
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------- Three formats */}
      <section className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8 lg:py-32">
        <SectionHead
          eyebrow="Three formats"
          title={
            <>
              Install it. Or hand your agent <span className="text-site-fg-3">the brief.</span>
            </>
          }
          body="Every component ships as code, as a designer’s prompt, and as structured JSON, so your agent can drop it in or rebuild it in your brand without losing what makes it good."
        />
        <div className="mt-14 grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <FormatCard n="01" title="Code" body="One self-contained file. React 19 with Tailwind v4, or React Native core. No providers, no wrappers.">
            <div className="h-60 overflow-hidden px-5 pt-4 font-mono text-[11.5px] leading-[1.75] [&_pre]:!bg-transparent" dangerouslySetInnerHTML={{ __html: codeHtml }} />
          </FormatCard>
          <FormatCard n="02" title="Prompt" body="A design director’s brief with exact sizes, colours, motion and a list of what to avoid.">
            <pre className="h-60 overflow-hidden whitespace-pre-wrap px-5 pt-4 font-mono text-[11.5px] leading-[1.75] text-site-fg-2">{promptExcerpt}</pre>
          </FormatCard>
          <FormatCard n="03" title="JSON prompt" body="The same brief as structured data, for agents and pipelines that follow keys better than prose.">
            <div className="h-60 overflow-hidden px-5 pt-4 font-mono text-[11.5px] leading-[1.75] [&_pre]:!bg-transparent" dangerouslySetInnerHTML={{ __html: jsonHtml }} />
          </FormatCard>
        </div>
      </section>

      {/* ---------------------------------------------------------- Categories */}
      <section className="relative border-t border-white/[0.07]">
        <div aria-hidden="true" className="site-leaks -z-10 opacity-60 [mask-image:linear-gradient(180deg,#000,transparent_70%)]" />
        <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8 lg:py-32">
          <SectionHead
            eyebrow="The library"
            title={
              <>
                From the first fold <span className="text-site-fg-3">to the last tap.</span>
              </>
            }
            body="Marketing sections, product UI, AI interfaces, data visualisation, 3D and native screens, all held to the same bar."
          />
          <ul className="mt-14 grid gap-px overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.key}>
                <Link href={`/categories/${c.key}`} className="group flex h-full flex-col bg-black p-6 transition-colors hover:bg-[#0b0b0c]">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[17px] font-medium tracking-[-0.02em] text-site-fg">{c.label}</span>
                    <span className="font-mono text-[11px] tabular-nums text-site-fg-3">{String(c.count).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-site-fg-3 transition-colors group-hover:text-site-fg-2">{c.blurb}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-site-fg-2 opacity-0 transition-opacity group-hover:opacity-100">
                    Explore
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- For agents */}
      <section className="border-t border-white/[0.07]">
        <div className="mx-auto grid max-w-[80rem] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:items-center lg:py-32 [&>*]:min-w-0">
          <div className="lg:col-span-5">
            <SectionHead
              align="left"
              eyebrow="Built for agents"
              title={
                <>
                  Your agent finds, reads and <span className="text-site-fg-3">installs it.</span>
                </>
              }
              body="A remote MCP server, a CLI, a shadcn registry and a Markdown version of every page. Your agent searches the library and pulls code and briefs directly, no scraping."
            />
            <ul className="mt-10 space-y-4">
              {[
                ["Remote MCP", "One line in Claude Code, Cursor or Windsurf. Nothing to install or update."],
                ["CLI", "npx design-for-ai search, add and prompt, from your terminal or your agent's."],
                ["shadcn registry", "Every component is a registry item. Pro sits behind your licence key."],
                ["Markdown everywhere", "Add .md to any URL. llms.txt maps the library for language models."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-4">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-site-accent shadow-[0_0_12px_#ff7a45]" />
                  <p className="text-[15px] leading-relaxed text-site-fg-2">
                    <span className="font-medium text-site-fg">{t}.</span> {d}
                  </p>
                </li>
              ))}
            </ul>
            <Link href="/docs/agents" className="mt-10 inline-flex items-center gap-2 text-[15px] font-medium text-site-fg hover:text-site-glow">
              Connect your agent
              <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
                <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          <div className="lg:col-span-7">
            <div className="site-surface site-beam overflow-hidden rounded-[22px]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-white/15" />
                  <span className="size-2.5 rounded-full bg-white/15" />
                  <span className="size-2.5 rounded-full bg-white/15" />
                </span>
                <span className="font-mono text-[11px] text-site-fg-3">.cursor/mcp.json</span>
                <span className="w-10" />
              </div>
              <div className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-[1.8] [&_pre]:!bg-transparent" dangerouslySetInnerHTML={{ __html: mcpHtml }} />
              <div className="border-t border-white/[0.07] px-5 py-4 font-mono text-[12px] leading-relaxed">
                <p className="text-site-fg-3">› Add a pricing section that suits this brand</p>
                <p className="mt-2 text-site-fg-2">
                  <span className="text-[#34d399]">✓</span> search_components <span className="text-site-fg-3">category:pricing</span>
                </p>
                <p className="text-site-fg-2">
                  <span className="text-[#34d399]">✓</span> get_component <span className="text-site-fg-3">pricing-three-tier</span>
                </p>
                <p className="text-site-fg-2">
                  <span className="text-site-accent">●</span> Adapting colour and copy to your palette…
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Pricing */}
      <section className="border-t border-white/[0.07]">
        <div className="mx-auto max-w-[80rem] px-5 py-24 sm:px-8 lg:py-32">
          <div className="site-surface relative overflow-hidden rounded-[28px] p-8 sm:p-14">
            <div aria-hidden="true" className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,122,69,0.25),transparent)] blur-2xl" />
            <div className="relative grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">Pricing</p>
                <h2 className="mt-4 text-[clamp(2rem,1.2rem+3vw,3.5rem)] font-semibold leading-[1] tracking-[-0.05em]">
                  <span className="site-silver-text">{s.free} free, forever.</span>
                  <br />
                  <span className="site-gradient-text">Everything, once.</span>
                </h2>
                <p className="mt-5 max-w-[48ch] text-[16px] leading-relaxed text-site-fg-2">
                  Pro unlocks all {s.total} components, the Pro prompts, the private registry and every future release, for ${lifetime.price} once. Or yearly, or for your team.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
                <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-[15px] font-medium text-black transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_14px_36px_-10px_rgba(255,179,138,0.6)] active:translate-y-0 active:scale-[0.97] active:duration-75">
                  See pricing
                </Link>
                <Link href="/components" className="inline-flex h-12 items-center justify-center rounded-full border border-white/12 px-6 text-[15px] font-medium text-site-fg transition duration-200 hover:border-white/25 hover:bg-white/[0.04] active:scale-[0.97] active:duration-75">
                  Start free
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- FAQ */}
      <section className="mx-auto grid max-w-[80rem] gap-12 px-5 pb-28 sm:px-8 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="lg:col-span-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">FAQ</p>
          <h2 className="mt-4 text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] font-semibold tracking-[-0.045em]">Questions, answered.</h2>
        </div>
        <div className="lg:col-span-8">
          <Faq items={HOME_FAQ} />
        </div>
      </section>
    </>
  );
}

function ChartPortfolioMini() {
  return <ChartPortfolio height={220} />;
}

function SectionHead({ eyebrow, title, body, align = "center" }: { eyebrow: string; title: React.ReactNode; body: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : ""}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">{eyebrow}</p>
      <h2 className="mt-4 text-balance text-[clamp(2rem,1.2rem+3vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-site-fg">{title}</h2>
      <p className={`mt-5 text-balance text-[16px] leading-relaxed text-site-fg-2 ${align === "center" ? "mx-auto max-w-[56ch]" : "max-w-[46ch]"}`}>{body}</p>
    </div>
  );
}

function ShowcaseTile({ href, label, name, tier, className = "", children }: { href: string; label: string; name: string; tier: "Free" | "Pro"; className?: string; children: React.ReactNode }) {
  return (
    <div className={`site-surface group relative flex flex-col overflow-hidden rounded-[22px] ${className}`}>
      <div className="relative z-10 flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-site-fg-3">{label}</span>
          <span className="truncate text-[14px] font-medium text-site-fg">{name}</span>
        </div>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-site-fg-2 transition-colors hover:text-site-fg">
          <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${tier === "Pro" ? "bg-site-accent/15 text-site-glow" : "bg-white/[0.06] text-site-fg-2"}`}>{tier}</span>
          View
        </Link>
      </div>
      <div className="relative flex-1">{children}</div>
    </div>
  );
}

function FormatCard({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="site-surface flex flex-col overflow-hidden rounded-[22px]">
      <div className="p-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[19px] font-medium tracking-[-0.025em]">{title}</h3>
          <span className="font-mono text-[11px] text-site-fg-3">{n}</span>
        </div>
        <p className="mt-2.5 text-[14px] leading-relaxed text-site-fg-2">{body}</p>
      </div>
      <div className="relative mt-auto border-t border-white/[0.06] bg-black/40 [mask-image:linear-gradient(#000_65%,transparent)]">{children}</div>
    </div>
  );
}
