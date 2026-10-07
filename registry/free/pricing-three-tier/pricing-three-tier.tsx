"use client";

import { useId, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";

type Billing = "monthly" | "annual";

export type PricingFeature = {
  text: string;
  /** Index into `footnotes` (1-based). Renders as a superscript marker. */
  note?: number;
};

export type PricingPlan = {
  name: string;
  /** Who the plan is for, one short line. */
  audience: string;
  /** Price per month when billed monthly. Whole numbers roll best. */
  monthly: number;
  /** Price per month when billed annually. */
  annual: number;
  /** Shown after the price, e.g. "/ mo". */
  unit?: string;
  cta: { label: string; href: string };
  /** Line above the features, e.g. "Everything in Sole, plus:". */
  lead?: string;
  features: PricingFeature[];
  /** The inverted, taller card. Use on one plan only. */
  featured?: boolean;
};

export type PricingThreeTierProps = {
  eyebrow?: string;
  title?: string;
  /** The muted second clause of the title. */
  titleAccent?: string;
  body?: string;
  plans?: PricingPlan[];
  /** Small note beside the billing toggle. */
  saving?: string;
  /** Label on the featured plan. */
  featuredLabel?: string;
  currency?: string;
  footnotes?: string[];
  defaultBilling?: Billing;
};

const ease = [0.2, 0.8, 0.2, 1] as const;

const defaultPlans: PricingPlan[] = [
  {
    name: "Sole",
    audience: "For freelancers and sole traders",
    monthly: 12,
    annual: 10,
    unit: "/ mo",
    cta: { label: "Start free for 30 days", href: "#start-sole" },
    lead: "The essentials, done properly:",
    features: [
      { text: "1 business, 1 bank feed", note: 1 },
      { text: "Invoices that chase themselves" },
      { text: "Receipt capture by photo or email" },
      { text: "Quarterly tax estimates" },
      { text: "Exports your accountant will accept" },
    ],
  },
  {
    name: "Practice",
    audience: "For small teams with a real payroll",
    monthly: 36,
    annual: 30,
    unit: "/ mo",
    cta: { label: "Start free for 30 days", href: "#start-practice" },
    lead: "Everything in Sole, plus:",
    features: [
      { text: "Unlimited bank feeds", note: 1 },
      { text: "Payroll for up to 15 people" },
      { text: "Bills, approvals and spend limits" },
      { text: "Multi-currency at mid-market rates" },
      { text: "Month-end close in an afternoon" },
      { text: "Invite your accountant, free" },
    ],
    featured: true,
  },
  {
    name: "Firm",
    audience: "For accountants running many books",
    monthly: 84,
    annual: 70,
    unit: "/ mo",
    cta: { label: "Talk to a human", href: "#contact" },
    lead: "Everything in Practice, plus:",
    features: [
      { text: "Up to 40 client businesses", note: 2 },
      { text: "Practice dashboard and deadlines" },
      { text: "Bulk reconciliation rules" },
      { text: "White-label client portal" },
      { text: "A named onboarding specialist" },
    ],
  },
];

const defaultFootnotes = [
  "Bank feeds via open banking in the UK, EU, US and Canada. Everywhere else, CSV import works fine.",
  "Need more than 40? We’ll price it per book, not per seat. All prices exclude sales tax.",
];

export function PricingThreeTier({
  eyebrow = "Pricing",
  title = "Priced like a good accountant:",
  titleAccent = "no surprises.",
  body = "Every plan includes unlimited invoices, unlimited users and the same support team. Switch plans whenever the business changes shape.",
  plans = defaultPlans,
  saving = "2 months free",
  featuredLabel = "Most teams pick this",
  currency = "$",
  footnotes = defaultFootnotes,
  defaultBilling = "annual",
}: PricingThreeTierProps) {
  const [billing, setBilling] = useState<Billing>(defaultBilling);
  const reduce = useReducedMotion() ?? false;
  const uid = useId();

  return (
    <section aria-labelledby={`${uid}-title`} className="relative isolate overflow-hidden bg-[#050506] text-white">
      <div aria-hidden="true" className="absolute left-1/2 top-0 -z-10 h-[520px] w-[1100px] max-w-[160%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(52,211,153,0.16),transparent)]" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pt-20 lg:px-12 lg:pb-24 lg:pt-24">
        {/* Header */}
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45"><span className="size-1.5 rounded-full bg-[#34d399] shadow-[0_0_10px_#34d399]" />{eyebrow}</p>
          <h2
            id={`${uid}-title`}
            className="mt-5 max-w-[900px] text-balance font-sans text-[clamp(2.25rem,1.3rem+3.6vw,4.5rem)] font-semibold leading-[1] tracking-[-0.05em]"
          >
            <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">{title}</span> <span className="text-white/40">{titleAccent}</span>
          </h2>
          <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-[52ch] text-[16px] leading-relaxed text-white/60">{body}</p>
            <BillingToggle billing={billing} onChange={setBilling} saving={saving} uid={uid} reduce={reduce} />
          </div>
        </div>

        {/* Plans */}
        <ul className="mt-14 grid gap-4 lg:mt-16 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan) => (
            <li key={plan.name} className={plan.featured ? "relative lg:-my-4" : "relative"}>
              <PlanCard
                plan={plan}
                billing={billing}
                currency={currency}
                featuredLabel={featuredLabel}
                reduce={reduce}
              />
            </li>
          ))}
        </ul>

        {/* Footnotes */}
        {footnotes.length > 0 && (
          <ol className="mt-14 grid gap-2 border-t border-white/[0.08] pt-6 text-[13px] leading-relaxed text-white/45 md:grid-cols-2 md:gap-10 lg:mt-16">
            {footnotes.map((f, n) => (
              <li key={f} className="flex gap-3">
                <span className="font-mono text-[11px] leading-[1.9] text-white/30">{String(n + 1).padStart(2, "0")}</span>
                <span className="max-w-[60ch]">{f}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function BillingToggle({
  billing,
  onChange,
  saving,
  uid,
  reduce,
}: {
  billing: Billing;
  onChange: (b: Billing) => void;
  saving: string;
  uid: string;
  reduce: boolean;
}) {
  const options: { value: Billing; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "annual", label: "Annual" },
  ];
  return (
    <div className="flex flex-col items-start gap-3 lg:items-end">
      <LayoutGroup id={`${uid}-billing`}>
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="relative inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
              e.preventDefault();
              const next = billing === "monthly" ? "annual" : "monthly";
              onChange(next);
              const target = e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`);
              target?.focus();
            }
          }}
        >
          {options.map((o) => {
            const active = billing === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                data-value={o.value}
                onClick={() => onChange(o.value)}
                className={`relative h-10 rounded-full px-5 text-[14px] font-medium transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  active ? "text-black" : "text-white/55 hover:text-white"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="indicator"
                    className="absolute inset-0 rounded-full bg-white shadow-[0_4px_16px_-4px_rgba(255,255,255,0.5)]"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="relative">{o.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      <p className="flex items-center gap-2 text-[13px] text-white/50">
        Pay annually, get
        <span className="rounded-full bg-[#34d399]/10 px-2 py-0.5 font-medium text-[#6ee7b7] ring-1 ring-inset ring-[#34d399]/25">{saving}</span>
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  billing,
  currency,
  featuredLabel,
  reduce,
}: {
  plan: PricingPlan;
  billing: Billing;
  currency: string;
  featuredLabel: string;
  reduce: boolean;
}) {
  const dark = !!plan.featured;
  const price = billing === "annual" ? plan.annual : plan.monthly;
  const yearly = plan.annual * 12;
  const note =
    billing === "annual"
      ? `${currency}${yearly.toLocaleString("en-US")} billed once a year`
      : "Billed monthly, cancel anytime";

  return (
    <article
      aria-label={`${plan.name} plan`}
      className={`relative isolate flex h-full flex-col overflow-hidden rounded-[22px] p-7 sm:p-8 md:grid md:grid-cols-2 md:gap-x-10 lg:flex lg:gap-0 ${
        dark
          ? "bg-[linear-gradient(180deg,rgba(52,211,153,0.10),rgba(255,255,255,0.02)_42%,rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(52,211,153,0.28),0_40px_100px_-30px_rgba(52,211,153,0.28)] lg:px-9 lg:py-12"
          : "bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(255,255,255,0.08)]"
      }`}
    >
      {dark && (
        <>
          <div aria-hidden="true" className="absolute inset-x-8 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#6ee7b7] to-transparent" />
          <div aria-hidden="true" className="absolute -top-24 left-1/2 -z-10 h-48 w-3/4 -translate-x-1/2 rounded-full bg-[#34d399]/20 blur-3xl" />
          <span className="absolute right-6 top-7 inline-flex items-center gap-1.5 rounded-full bg-[#34d399]/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#6ee7b7] ring-1 ring-inset ring-[#34d399]/30 sm:right-8 lg:right-9 lg:top-12">
            {featuredLabel}
          </span>
        </>
      )}

      <div className="flex flex-col">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="font-sans text-[18px] font-medium tracking-[-0.02em]">{plan.name}</h3>
      </header>
      <p className="mt-1 text-[14px] text-white/50">{plan.audience}</p>

      {/* Price */}
      <div className="mt-8 flex items-start">
        <span className="sr-only">
          {currency}
          {price} per month, {note}
        </span>
        <span aria-hidden="true" className="mr-1 mt-[0.45em] font-sans text-[22px] font-medium tracking-[-0.02em] text-white/50">
          {currency}
        </span>
        <span aria-hidden="true" className="font-sans text-[clamp(3.25rem,2.6rem+2vw,4.25rem)] font-semibold leading-none tracking-[-0.055em]">
          <RollingNumber value={price} reduce={reduce} />
        </span>
        <span aria-hidden="true" className="ml-2 self-end pb-2 text-[14px] text-white/40">
          {plan.unit ?? "/ mo"}
        </span>
      </div>
      <div aria-hidden="true" className="relative mt-2 h-5 overflow-hidden text-[13px] text-white/40">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={note}
            initial={reduce ? false : { y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -14, opacity: 0 }}
            transition={{ duration: 0.35, ease }}
          >
            {note}
          </motion.p>
        </AnimatePresence>
      </div>

      <a
        href={plan.cta.href}
        className={`group mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-medium transition-[background-color,box-shadow,color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          dark
            ? "bg-white text-black shadow-[0_10px_30px_-10px_rgba(255,255,255,0.55)] hover:bg-white/90"
            : "bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-white/[0.1]"
        }`}
      >
        {plan.cta.label}
        <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" aria-hidden="true">
          <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>

      </div>

      <div className="mt-8 border-t border-white/[0.08] pt-7 md:mt-0 md:border-l md:border-t-0 md:pl-10 md:pt-1 lg:mt-8 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-7">
        {plan.lead && (
          <p className="text-[13px] text-white/45">{plan.lead}</p>
        )}
        <ul className="mt-4 space-y-3">
          {plan.features.map((f) => (
            <li key={f.text} className="flex gap-3 text-[14px] leading-snug">
              <Check dark={dark} />
              <span className="text-white/80">
                {f.text}
                {f.note ? (
                  <sup className={`ml-0.5 font-mono text-[10px] ${dark ? "text-[#6ee7b7]" : "text-white/40"}`}>
                    {String(f.note).padStart(2, "0")}
                  </sup>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function Check({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`mt-[1px] size-4 shrink-0 ${dark ? "text-[#6ee7b7]" : "text-white/35"}`} fill="none" aria-hidden="true">
      <path d="M3.5 8.4l2.8 2.8 6.2-6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Odometer-style number: each digit is a 0–9 column that rolls into place. */
function RollingNumber({ value, reduce }: { value: number; reduce: boolean }) {
  const chars = String(value).split("");
  return (
    <span className="inline-flex tabular-nums">
      {chars.map((c, i) => {
        const key = chars.length - i; // key from the right so units stay units
        if (!/\d/.test(c)) return <span key={`s${key}`}>{c}</span>;
        return <Digit key={key} digit={Number(c)} delay={i * 0.07} reduce={reduce} />;
      })}
    </span>
  );
}

function Digit({ digit, delay, reduce }: { digit: number; delay: number; reduce: boolean }) {
  return (
    <span className="relative inline-block overflow-hidden leading-[1.1] [mask-image:linear-gradient(to_bottom,transparent,#000_10%,#000_90%,transparent)]">
      <span className="invisible">0</span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={false}
        animate={{ y: `${-digit * 1.1}em` }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 20, mass: 0.9, delay }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block h-[1.1em] leading-[1.1]">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export default PricingThreeTier;
