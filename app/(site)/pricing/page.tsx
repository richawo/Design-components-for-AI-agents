import type { Metadata } from "next";
import { DitherGlow } from "@/components/site/dither-glow";
import { Faq, faqJsonLd } from "@/components/site/faq";
import { PRICING_FAQ } from "@/lib/copy";
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


export default function PricingPage() {
  const s = stats();
  const prices = Object.fromEntries(PLANS.map((p) => [p.id, p.price]));
  return (
    <div className="relative isolate mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <div aria-hidden="true" className="absolute inset-x-0 -top-16 -z-10 h-[36rem]">
        <DitherGlow className="[mask-image:linear-gradient(180deg,#000_40%,transparent)]" />
      </div>
      <JsonLd
        data={[
          faqJsonLd(PRICING_FAQ),
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
          <Faq items={PRICING_FAQ} />
        </div>
      </section>
    </div>
  );
}
