import type { Metadata } from "next";
import { Faq, faqJsonLd, type QA } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { PricingPlans } from "@/components/site/pricing-plans";
import { PLANS } from "@/lib/pricing";
import { stats } from "@/lib/registry";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing: free and open source, or Pro once and for good",
  description:
    "Design for AI is free and MIT licensed. Pro adds showpiece components, Pro prompts and the private registry: yearly or one payment for life, for one person or a team of 10.",
  alternates: { canonical: "/pricing" },
};

const FAQ: QA[] = [
  {
    q: "What do I actually get with Pro?",
    a: "Every Pro component's code, natural-language prompt and JSON prompt; access to the private shadcn registry and the Pro tools in the MCP server; and every Pro component we release while your licence is active. Lifetime means exactly that: no renewal.",
  },
  {
    q: "Can I use components in client work and products I sell?",
    a: "Yes. Free components are MIT. Pro components can be used in unlimited personal and commercial projects, including client work. What you can't do is redistribute or resell the components themselves, or put them in a competing component library or template marketplace.",
  },
  {
    q: "How do my AI agents get Pro components?",
    a: "Your licence key works everywhere: set DESIGN_FOR_AI_LICENSE in your environment and the MCP server, the shadcn registry and the API all unlock. Agents in Claude Code, Cursor, Windsurf or v0 fetch the code and prompts directly.",
  },
  {
    q: "Why are some components free and others not?",
    a: "The free core is genuinely useful on its own: heroes, pricing, AI chat, dashboards and mobile screens. Pro pays for the showpieces that take days to get right, like kinetic type, 3D product stacks, drag-and-drop boards and native gestures, and keeps the free library maintained.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes. If Pro isn't for you, email within 14 days of purchase and we'll refund you in full, no questions asked.",
  },
  {
    q: "Is there a student or open-source discount?",
    a: "Maintainers of active open-source projects and students get 50% off. Email us from your university address or with a link to your project.",
  },
];

export default function PricingPage() {
  const s = stats();
  const prices = Object.fromEntries(PLANS.map((p) => [p.id, p.price]));
  return (
    <div className="relative isolate mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <div aria-hidden="true" className="absolute left-1/2 top-[-14rem] -z-10 h-[30rem] w-[56rem] max-w-full -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,122,69,0.16),transparent)] blur-2xl" />
      <JsonLd
        data={[
          faqJsonLd(FAQ),
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Design for AI Pro",
            description: site.description,
            brand: { "@type": "Brand", name: site.name },
            url: absoluteUrl("/pricing"),
            offers: PLANS.map((p) => ({
              "@type": "Offer",
              name: p.name,
              price: p.price,
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: absoluteUrl("/pricing"),
            })),
          },
        ]}
      />
      <section className="mx-auto max-w-3xl pb-14 pt-16 text-center lg:pt-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">Pricing</p>
        <h1 className="mt-5 text-balance text-[clamp(2.5rem,1.5rem+4vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
          <span className="site-silver-text">Free to start.</span> <span className="site-gradient-text">Pay once for the rest.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[54ch] text-[16px] leading-relaxed text-site-fg-2">
          {s.free} components are free and always will be. Pro unlocks the other {s.pro}, their prompts and the private registry, yearly or with one payment that covers every future release.
        </p>
      </section>

      <PricingPlans counts={s} prices={prices} />

      <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">Prices in USD · VAT where applicable · 14-day refunds</p>

      <section className="mx-auto mt-28 grid max-w-6xl gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">FAQ</p>
          <h2 className="mt-4 text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] font-semibold tracking-[-0.045em]">Questions, answered.</h2>
        </div>
        <div className="lg:col-span-8">
          <Faq items={FAQ} />
        </div>
      </section>
    </div>
  );
}
