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
  /** The italic serif ending of the title. */
  titleAccent?: string;
  body?: string;
  plans?: PricingPlan[];
  /** Small note beside the billing toggle. */
  saving?: string;
  /** Sticker on the featured plan. */
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
    <section aria-labelledby={`${uid}-title`} className="relative isolate overflow-hidden bg-[#f3f1ec] text-[#1c1a17]">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pt-20 lg:px-12 lg:pb-24 lg:pt-24">
        {/* Header */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#1c1a17]/55 sm:text-xs">{eyebrow}</p>
          <h2
            id={`${uid}-title`}
            className="mt-5 max-w-[1040px] text-balance font-display text-[clamp(2.4rem,1.3rem+4.4vw,5.25rem)] font-bold leading-[0.95] tracking-[-0.045em]"
          >
            {title} <span className="font-serif font-normal italic tracking-[-0.02em]">{titleAccent}</span>
          </h2>
          <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-[52ch] text-[16px] leading-relaxed text-[#1c1a17]/70 sm:text-[17px]">{body}</p>
            <BillingToggle billing={billing} onChange={setBilling} saving={saving} uid={uid} reduce={reduce} />
          </div>
        </div>

        {/* Plans */}
        <ul className="mt-14 grid gap-8 lg:mt-20 lg:grid-cols-3 lg:items-stretch lg:gap-4">
          {plans.map((plan) => (
            <li key={plan.name} className={plan.featured ? "relative lg:-my-5" : "relative"}>
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
          <ol className="mt-14 grid gap-2 border-t border-[#1c1a17]/12 pt-6 text-[13px] leading-relaxed text-[#1c1a17]/60 md:grid-cols-2 md:gap-10 lg:mt-20">
            {footnotes.map((f, n) => (
              <li key={f} className="flex gap-3">
                <span className="font-mono text-[11px] leading-[1.9] text-[#1c1a17]/45">{String(n + 1).padStart(2, "0")}</span>
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
          className="relative inline-flex rounded-full border border-[#1c1a17]/12 bg-[#e8e5de] p-1"
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
                className={`relative h-11 rounded-full px-6 text-[14px] font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1a17] ${
                  active ? "text-[#f3f1ec]" : "text-[#1c1a17]/65 hover:text-[#1c1a17]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="indicator"
                    className="absolute inset-0 rounded-full bg-[#1c1a17] shadow-[0_1px_2px_rgba(28,26,23,0.25)]"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="relative">{o.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      <p className="flex items-center gap-2 text-[13px] text-[#1c1a17]/65">
        <svg viewBox="0 0 34 20" className="h-4 w-7 text-[#1c1a17]/55" fill="none" aria-hidden="true">
          <path d="M2 16c8 2 20 1 27-9m0 0-6 1m6-1 1 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          Pay annually, get{" "}
          <span className="rounded-[4px] bg-[#d7f25c] px-1.5 py-0.5 font-semibold text-[#1c1a17]">{saving}</span>
        </span>
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
      className={`relative flex h-full flex-col rounded-[22px] p-7 sm:p-8 md:grid md:grid-cols-2 md:gap-x-10 lg:flex lg:gap-0 ${
        dark
          ? "bg-[#1c1a17] text-[#f3f1ec] shadow-[0_30px_60px_-30px_rgba(28,26,23,0.55)] lg:px-9 lg:py-12"
          : "border border-[#1c1a17]/10 bg-[#faf9f6] text-[#1c1a17]"
      }`}
    >
      {dark && (
        <span className="absolute -top-3.5 left-7 inline-flex -rotate-[2.5deg] items-center gap-2 rounded-full bg-[#d7f25c] px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#1c1a17] shadow-[0_2px_0_#1c1a17] sm:left-8 lg:left-9">
          <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
            <path d="M6 0l1.5 4.5L12 6 7.5 7.5 6 12 4.5 7.5 0 6l4.5-1.5z" fill="currentColor" />
          </svg>
          {featuredLabel}
        </span>
      )}

      <div className="flex flex-col">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-[26px] font-semibold tracking-[-0.03em]">{plan.name}</h3>
      </header>
      <p className={`mt-1.5 text-[14px] ${dark ? "text-[#f3f1ec]/60" : "text-[#1c1a17]/60"}`}>{plan.audience}</p>

      {/* Price */}
      <div className="mt-8 flex items-start">
        <span className="sr-only">
          {currency}
          {price} per month, {note}
        </span>
        <span aria-hidden="true" className="mt-[0.55em] mr-1 font-display text-[22px] font-medium tracking-[-0.02em] opacity-70">
          {currency}
        </span>
        <span aria-hidden="true" className="font-display text-[clamp(3.6rem,2.8rem+2.4vw,4.75rem)] font-semibold leading-none tracking-[-0.05em]">
          <RollingNumber value={price} reduce={reduce} />
        </span>
        <span aria-hidden="true" className={`ml-2 self-end pb-2 text-[15px] ${dark ? "text-[#f3f1ec]/55" : "text-[#1c1a17]/55"}`}>
          {plan.unit ?? "/ mo"}
        </span>
      </div>
      <div aria-hidden="true" className={`relative mt-2 h-5 overflow-hidden text-[13px] ${dark ? "text-[#f3f1ec]/55" : "text-[#1c1a17]/55"}`}>
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
        className={`group mt-8 inline-flex h-12 items-center justify-between rounded-full pl-6 pr-1.5 text-[15px] font-semibold transition-[transform,background-color,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 ${
          dark
            ? "bg-[#d7f25c] text-[#1c1a17] focus-visible:outline-[#d7f25c]"
            : "border border-[#1c1a17]/80 text-[#1c1a17] hover:bg-[#1c1a17] hover:text-[#f3f1ec] focus-visible:outline-[#1c1a17]"
        }`}
      >
        {plan.cta.label}
        <span
          className={`flex size-9 items-center justify-center rounded-full transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-x-0.5 ${
            dark ? "bg-[#1c1a17] text-[#d7f25c]" : "bg-[#1c1a17] text-[#f3f1ec] group-hover:bg-[#f3f1ec] group-hover:text-[#1c1a17]"
          }`}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
            <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </a>

      </div>

      <div className={`mt-8 border-t pt-7 md:mt-0 md:border-l md:border-t-0 md:pl-10 md:pt-1 lg:mt-8 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-7 ${dark ? "border-[#f3f1ec]/12" : "border-[#1c1a17]/10"}`}>
        {plan.lead && (
          <p className={`text-[13px] font-medium ${dark ? "text-[#f3f1ec]/75" : "text-[#1c1a17]/75"}`}>{plan.lead}</p>
        )}
        <ul className="mt-4 space-y-3">
          {plan.features.map((f) => (
            <li key={f.text} className="flex gap-3 text-[15px] leading-snug md:text-[14px] lg:text-[15px]">
              <Check dark={dark} />
              <span className={dark ? "text-[#f3f1ec]/90" : "text-[#1c1a17]/85"}>
                {f.text}
                {f.note ? (
                  <sup className={`ml-0.5 font-mono text-[10px] ${dark ? "text-[#d7f25c]" : "text-[#1c1a17]/50"}`}>
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

/** A slightly hand-drawn tick in a ledger-ruled square. */
function Check({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="mt-[1px] size-[18px] shrink-0" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="5" className={dark ? "fill-[#d7f25c]" : "fill-[#1c1a17]/[0.07]"} />
      <path
        d="M5.6 10.4c1 .7 1.9 1.6 2.6 2.7 1.4-3.1 3.4-5.4 6.2-7"
        stroke={dark ? "#1c1a17" : "#1c1a17"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
