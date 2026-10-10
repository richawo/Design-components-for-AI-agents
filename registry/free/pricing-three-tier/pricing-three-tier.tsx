"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
  type MotionValue,
  type Variants,
} from "motion/react";

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
  /** Whole-number price per month when billed monthly. */
  monthly: number;
  /** Whole-number price per month when billed annually. */
  annual: number;
  /** Shown after the price, e.g. "/ mo". */
  unit?: string;
  cta: { label: string; href: string };
  /** Line above the features, e.g. "Everything in Sole, plus:". */
  lead?: string;
  features: PricingFeature[];
  /** The lifted, taller card. Use on one plan only. */
  featured?: boolean;
};

export type PricingThreeTierProps = {
  plans?: PricingPlan[];
  /** Saving offered for annual billing, beside the toggle. */
  saving?: string;
  /** Label on the featured plan. */
  featuredLabel?: string;
  currency?: string;
  /** Fine print under the plans, referenced by feature `note` markers. */
  footnotes?: string[];
  defaultBilling?: Billing;
  /** The one signal colour: the featured plan's edge and label dot, and the saving once it's earned. */
  accent?: string;
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    page: "#08080a",
    card: "#0e0e10",
    lifted: "#151518",
    ink: "#f4f4f5",
    onInk: "#08080a",
    ring: "rgba(255,255,255,0.08)",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.07)",
    liftedShadow:
      "inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(255,255,255,0.12), 0 24px 48px -20px rgba(0,0,0,0.8), 0 60px 120px -40px rgba(0,0,0,0.9)",
    spotlight: "rgba(255,255,255,0.05)",
    edge: "rgba(255,255,255,0.32)",
  },
  light: {
    page: "#f4f4f5",
    card: "#fafafa",
    lifted: "#ffffff",
    ink: "#111113",
    onInk: "#ffffff",
    ring: "rgba(17,17,19,0.08)",
    shadow: "0 0 0 1px rgba(17,17,19,0.07)",
    liftedShadow:
      "0 0 0 1px rgba(17,17,19,0.1), 0 2px 4px rgba(17,17,19,0.04), 0 24px 48px -20px rgba(17,17,19,0.18), 0 60px 100px -40px rgba(17,17,19,0.22)",
    spotlight: "rgba(17,17,19,0.035)",
    edge: "rgba(17,17,19,0.22)",
  },
} as const;

const DEFAULT_ACCENT = "#34d399";
const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/**
 * One timeline, in seconds. The toggle lands, the cards rise left to right,
 * then each card fills in top to bottom: name, price (counting up from zero),
 * note, action, and finally its feature checks, row by row.
 */
const T = {
  toggle: 0,
  card: 0.08,
  cardStep: 0.07,
  head: 0.08,
  price: 0.12,
  count: 0.65,
  note: 0.18,
  cta: 0.22,
  rule: 0.26,
  features: 0.3,
  featureStep: 0.035,
  edge: 0.42,
  footnotes: 0.5,
  tween: 0.5,
} as const;

/** Rise 12px out of an 8px blur. `custom` is the start time; the filter is dropped at rest so text stays crisp. */
const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
/** Cards rise further, from a softer blur. */
const cardIn: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: 0.5, ease: EASE, delay } }),
};
const drawPath: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (delay: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 0.36, ease: EASE, delay }, opacity: { duration: 0.1, delay } },
  }),
};
/** Reduced motion: one short fade for everything, no transforms, blur or stagger. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pt-ink)";

const DEFAULT_PLANS: PricingPlan[] = [
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

const DEFAULT_FOOTNOTES = [
  "Bank feeds via open banking in the UK, EU, US and Canada. Everywhere else, CSV import works fine.",
  "Need more than 40? We’ll price it per book, not per seat. All prices exclude sales tax.",
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function PricingThreeTier({
  plans = DEFAULT_PLANS,
  saving = "2 months free",
  featuredLabel = "Most teams pick this",
  currency = "$",
  footnotes = DEFAULT_FOOTNOTES,
  defaultBilling = "annual",
  accent = DEFAULT_ACCENT,
  theme = "dark",
}: PricingThreeTierProps) {
  const [billing, setBilling] = useState<Billing>(defaultBilling);
  // Footnote under the pointer or keyboard focus, so marker and note light up together.
  const [hotNote, setHotNote] = useState<number | null>(null);
  const reduce = !!useReducedMotion();
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.15 });
  const p = PALETTE[theme];
  const vars = {
    "--pt-page": p.page,
    "--pt-card": p.card,
    "--pt-lifted": p.lifted,
    "--pt-ink": p.ink,
    "--pt-on-ink": p.onInk,
    "--pt-ring": p.ring,
    "--pt-shadow": p.shadow,
    "--pt-lifted-shadow": p.liftedShadow,
    "--pt-spot": p.spotlight,
    "--pt-edge": p.edge,
    "--pt-accent": accent,
  } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  return (
    <motion.section
      ref={rootRef}
      aria-label="Pricing plans"
      style={vars}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className="@container relative isolate bg-(--pt-page) text-(--pt-ink)"
    >
      <div className="mx-auto max-w-7xl px-5 py-14 @xl:px-8 @5xl:px-12 @5xl:py-20">
        <motion.div variants={v(reveal)} custom={T.toggle} className="flex flex-col items-center gap-3 @xl:flex-row @xl:justify-center @xl:gap-5">
          <BillingToggle billing={billing} onChange={setBilling} uid={uid} reduce={reduce} />
          <SavingNote saving={saving} earned={billing === "annual"} reduce={reduce} />
        </motion.div>

        <ul className="mt-10 grid gap-4 @5xl:mt-14 @5xl:grid-cols-3 @5xl:items-stretch">
          {plans.map((plan, i) => (
            <li key={plan.name} className={plan.featured ? "relative @5xl:-my-4" : "relative"}>
              <PlanCard
                plan={plan}
                start={T.card + i * T.cardStep}
                billing={billing}
                currency={currency}
                featuredLabel={featuredLabel}
                reduce={reduce}
                uid={uid}
                hotNote={hotNote}
                onNote={setHotNote}
                variants={v}
              />
            </li>
          ))}
        </ul>

        {footnotes.length > 0 ? (
          <Footnotes footnotes={footnotes} uid={uid} hotNote={hotNote} variants={v} />
        ) : null}
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

const BILLING_OPTIONS: { value: Billing; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

function BillingToggle({ billing, onChange, uid, reduce }: { billing: Billing; onChange: (b: Billing) => void; uid: string; reduce: boolean }) {
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = billing === "monthly" ? "annual" : "monthly";
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };

  return (
    <LayoutGroup id={`${uid}-billing`}>
      <div
        role="radiogroup"
        aria-label="Billing period"
        onKeyDown={onKeyDown}
        className="relative inline-grid grid-cols-2 rounded-full bg-(--pt-ink)/[0.04] p-1 ring-1 ring-(--pt-ring)"
      >
        {BILLING_OPTIONS.map((o) => {
          const on = billing === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-value={o.value}
              data-demo={`billing-${o.value}`}
              onClick={() => onChange(o.value)}
              className={`relative h-10 min-w-[104px] rounded-full px-5 text-[14px] font-medium transition-[color,scale] duration-150 active:scale-[0.97] ${FOCUS} ${
                on ? "text-(--pt-on-ink)" : "text-(--pt-ink)/55 hover:text-(--pt-ink)"
              }`}
            >
              {on ? (
                <motion.span
                  layoutId="thumb"
                  className="absolute inset-0 rounded-full bg-(--pt-ink) shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]"
                  transition={reduce ? { duration: 0 } : SPRING_UI}
                />
              ) : null}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** The saving is offered in grey, and earns the accent once annual is on. */
function SavingNote({ saving, earned, reduce }: { saving: string; earned: boolean; reduce: boolean }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-(--pt-ink)/50">
      Pay annually, get
      <motion.span
        data-demo="saving"
        animate={earned && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, ease: EASE }}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset transition-colors duration-200 ${
          earned ? "bg-(--pt-accent)/12 text-(--pt-ink) ring-(--pt-accent)/35" : "bg-(--pt-ink)/[0.03] text-(--pt-ink)/50 ring-(--pt-ring)"
        }`}
      >
        <span className={`size-1.5 rounded-full transition-colors duration-200 ${earned ? "bg-(--pt-accent)" : "bg-(--pt-ink)/30"}`} aria-hidden="true" />
        {saving}
      </motion.span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Plan card                                                           */
/* ------------------------------------------------------------------ */

type VariantPicker = (v: Variants) => Variants;

function PlanCard({
  plan,
  start,
  billing,
  currency,
  featuredLabel,
  reduce,
  uid,
  hotNote,
  onNote,
  variants: v,
}: {
  plan: PricingPlan;
  start: number;
  billing: Billing;
  currency: string;
  featuredLabel: string;
  reduce: boolean;
  uid: string;
  hotNote: number | null;
  onNote: (n: number | null) => void;
  variants: VariantPicker;
}) {
  const ref = useRef<HTMLElement>(null);
  // Each card has its own trigger: stacked on a phone, the lower ones land as they scroll in.
  const active = useInView(ref, { once: true, amount: 0.25 });
  const lifted = !!plan.featured;
  const price = billing === "annual" ? plan.annual : plan.monthly;
  const shown = useCountedValue(price, active, reduce, start + T.price);
  const note =
    billing === "annual"
      ? `${currency}${(plan.annual * 12).toLocaleString("en-US")} billed once a year`
      : "Billed monthly, cancel any time";
  const at = (offset: number) => start + offset;

  return (
    <motion.article
      ref={ref}
      onPointerMove={(e) => trackPointer(e, ref.current)}
      aria-label={`${plan.name} plan`}
      initial="hidden"
      animate={active ? "show" : "hidden"}
      variants={v(cardIn)}
      custom={start}
      style={{ "--x": "50%", "--y": "0px" } as CSSProperties}
      className={`group/card relative isolate flex h-full flex-col overflow-hidden rounded-[20px] p-7 @xl:p-8 @2xl:grid @2xl:grid-cols-2 @2xl:gap-x-10 @5xl:flex @5xl:gap-0 ${
        lifted ? "bg-(--pt-lifted) shadow-(--pt-lifted-shadow) @5xl:px-9 @5xl:py-12" : "bg-(--pt-card) shadow-(--pt-shadow)"
      }`}
    >
      <PointerLight />
      {lifted ? <LiftedLight variants={v} delay={at(T.edge)} /> : null}

      <div className="flex flex-col">
        <motion.header variants={v(reveal)} custom={at(T.head)}>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[18px] font-medium tracking-[-0.02em]">{plan.name}</h3>
            {lifted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-(--pt-ink)/[0.06] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ring-1 ring-inset ring-(--pt-ring)">
                <span className="size-1.5 rounded-full bg-(--pt-accent)" aria-hidden="true" />
                {featuredLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[14px] text-(--pt-ink)/50">{plan.audience}</p>
        </motion.header>

        <motion.div variants={v(reveal)} custom={at(T.price)} className="mt-8 flex items-start">
          <span className="sr-only">
            {currency}
            {price} per month, {note}
          </span>
          <span aria-hidden="true" className="mr-1 mt-[0.45em] text-[22px] font-medium tracking-[-0.02em] text-(--pt-ink)/50">
            {currency}
          </span>
          <span aria-hidden="true" className="text-[clamp(3.25rem,2.8rem+1.6cqi,4.25rem)] font-semibold leading-none tracking-[-0.055em]">
            <Odometer value={shown} digits={digitCount(Math.max(plan.monthly, plan.annual))} reduce={reduce} />
          </span>
          <span aria-hidden="true" className="ml-2 flex flex-col items-start self-end pb-2 text-[14px] leading-tight text-(--pt-ink)/40">
            {/* On annual, the monthly price it replaced sits struck through above the unit. */}
            <AnimatePresence initial={false}>
              {billing === "annual" && plan.monthly !== plan.annual ? (
                <motion.s
                  key="was"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.16, ease: EASE_IN } }}
                  transition={{ duration: 0.24, ease: EASE }}
                  className="text-[13px] text-(--pt-ink)/30 decoration-(--pt-ink)/40"
                >
                  {currency}
                  {plan.monthly}
                </motion.s>
              ) : null}
            </AnimatePresence>
            {plan.unit ?? "/ mo"}
          </span>
        </motion.div>

        <motion.div variants={v(reveal)} custom={at(T.note)} aria-hidden="true" className="relative mt-2 h-5 overflow-hidden text-[13px] text-(--pt-ink)/40">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={note}
              initial={reduce ? { opacity: 0 } : { y: 8, opacity: 0, filter: "blur(3px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { y: -8, opacity: 0, filter: "blur(3px)", transition: { duration: 0.2, ease: EASE_IN } }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {note}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        <motion.div variants={v(reveal)} custom={at(T.cta)} className="mt-8">
          <PlanCta cta={plan.cta} solid={lifted} />
        </motion.div>
      </div>

      <div className="relative mt-8 pt-7 @2xl:mt-0 @2xl:pl-10 @2xl:pt-1 @5xl:mt-8 @5xl:pl-0 @5xl:pt-7">
        {/* The divider draws across on stacked and wide layouts, and down the middle on the split one. */}
        <motion.span
          variants={v(drawX)}
          custom={at(T.rule)}
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px origin-left bg-(--pt-ink)/[0.08] @2xl:hidden @5xl:block"
        />
        <span aria-hidden="true" className="absolute inset-y-0 left-0 hidden w-px bg-(--pt-ink)/[0.08] @2xl:block @5xl:hidden" />
        {plan.lead ? (
          <motion.p variants={v(reveal)} custom={at(T.rule)} className="text-[13px] text-(--pt-ink)/45">
            {plan.lead}
          </motion.p>
        ) : null}
        <ul className="mt-4 space-y-3">
          {plan.features.map((f, fi) => {
            const rowAt = at(T.features + fi * T.featureStep);
            return (
              <motion.li key={f.text} variants={v(reveal)} custom={rowAt} className="flex gap-3 text-[14px] leading-snug">
                <Check variants={v(drawPath)} delay={rowAt + 0.06} strong={lifted} />
                <span className="text-(--pt-ink)/80">
                  {f.text}
                  {f.note ? <NoteMarker note={f.note} plan={plan.name} uid={uid} hot={hotNote === f.note} onNote={onNote} /> : null}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.article>
  );
}

/** Writes the pointer position to CSS variables, so the spotlight follows without a re-render. Mouse only. */
function trackPointer(e: ReactPointerEvent, el: HTMLElement | null) {
  if (e.pointerType !== "mouse" || !el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--x", `${e.clientX - r.left}px`);
  el.style.setProperty("--y", `${e.clientY - r.top}px`);
}

const EDGE_MASK: CSSProperties = {
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
};

/** A soft spotlight on the surface and a brighter arc on the 1px edge, both at the pointer, both neutral. */
function PointerLight() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
        style={{ background: "radial-gradient(420px circle at var(--x) var(--y), var(--pt-spot), transparent 45%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
        style={{ background: "radial-gradient(240px circle at var(--x) var(--y), var(--pt-edge), transparent 60%)", ...EDGE_MASK }}
      />
    </>
  );
}

/**
 * How the recommended plan is marked: light, not a wash. A wash of white
 * falls from the top edge, and a single accent hairline draws out from the
 * centre of that edge once the card has landed.
 */
function LiftedLight({ variants: v, delay }: { variants: VariantPicker; delay: number }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56"
        style={{ background: "radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--pt-ink) 6%, transparent), transparent)" }}
      />
      <motion.span
        aria-hidden="true"
        variants={v(drawX)}
        custom={delay}
        className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--pt-accent),transparent)]"
      />
    </>
  );
}

function PlanCta({ cta, solid }: { cta: PricingPlan["cta"]; solid: boolean }) {
  return (
    <a
      href={cta.href}
      data-demo={solid ? "cta-featured" : undefined}
      className={`group/cta inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-[14px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98] ${FOCUS} ${
        solid
          ? "bg-(--pt-ink) text-(--pt-on-ink) hover:bg-(--pt-ink)/90"
          : "bg-(--pt-ink)/[0.05] ring-1 ring-inset ring-(--pt-ring) hover:bg-(--pt-ink)/[0.09]"
      }`}
    >
      {cta.label}
      <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5" fill="none" aria-hidden="true">
        <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

function Check({ variants, delay, strong }: { variants: Variants; delay: number; strong: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`mt-[1px] size-4 shrink-0 ${strong ? "text-(--pt-ink)" : "text-(--pt-ink)/40"}`} fill="none" aria-hidden="true">
      <motion.path d="M3.5 8.4l2.8 2.8 6.2-6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" variants={variants} custom={delay} />
    </svg>
  );
}

function NoteMarker({ note, plan, uid, hot, onNote }: { note: number; plan: string; uid: string; hot: boolean; onNote: (n: number | null) => void }) {
  return (
    <sup className="ml-0.5">
      <a
        href={`#${uid}-fn-${note}`}
        data-demo={`note-${note}-${plan.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        aria-label={`Footnote ${note}`}
        onPointerEnter={() => onNote(note)}
        onPointerLeave={() => onNote(null)}
        onFocus={() => onNote(note)}
        onBlur={() => onNote(null)}
        className={`rounded-[3px] px-0.5 font-mono text-[10px] transition-colors duration-150 focus-visible:outline-1 focus-visible:outline-(--pt-ink) ${
          hot ? "bg-(--pt-ink)/10 text-(--pt-ink)" : "text-(--pt-ink)/40 hover:text-(--pt-ink)/70"
        }`}
      >
        {String(note).padStart(2, "0")}
      </a>
    </sup>
  );
}

function Footnotes({ footnotes, uid, hotNote, variants: v }: { footnotes: string[]; uid: string; hotNote: number | null; variants: VariantPicker }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "show" : "hidden"} className="relative mt-12 pt-6 @5xl:mt-16">
      <motion.span variants={v(drawX)} custom={T.footnotes} aria-hidden="true" className="absolute inset-x-0 top-0 h-px origin-left bg-(--pt-ink)/[0.08]" />
      <ol className="grid gap-2 text-[13px] leading-relaxed text-(--pt-ink)/45 @2xl:grid-cols-2 @2xl:gap-10">
        {footnotes.map((f, n) => {
          const hot = hotNote === n + 1;
          return (
            <motion.li
              key={f}
              id={`${uid}-fn-${n + 1}`}
              variants={v(reveal)}
              custom={T.footnotes + n * 0.05}
              className={`flex scroll-mt-24 gap-3 transition-colors duration-150 ${hot ? "text-(--pt-ink)/85" : ""}`}
            >
              <span className={`font-mono text-[11px] leading-[1.9] transition-colors duration-150 ${hot ? "text-(--pt-ink)" : "text-(--pt-ink)/30"}`}>
                {String(n + 1).padStart(2, "0")}
              </span>
              <span className="max-w-[60ch]">{f}</span>
            </motion.li>
          );
        })}
      </ol>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Counting odometer                                                   */
/* ------------------------------------------------------------------ */

/**
 * A number held in a motion value. It counts up from zero the first time it
 * becomes active, then tweens from wherever it is to each new target, so a
 * quick double toggle reverses mid-roll. Reduced motion sets it instantly.
 */
function useCountedValue(target: number, active: boolean, reduce: boolean, delay: number): MotionValue<number> {
  const value = useMotionValue(0);
  const entered = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      value.jump(target);
      entered.current = true;
      return;
    }
    const controls = entered.current
      ? animate(value, target, { duration: T.tween, ease: EASE })
      : animate(value, target, { delay, duration: T.count, ease: EASE, onComplete: () => (entered.current = true) });
    return () => controls.stop();
  }, [target, active, reduce, delay, value]);
  return value;
}

const digitCount = (n: number) => Math.max(1, String(Math.round(Math.abs(n))).length);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Odometer cell height, em. */
const CELL = 1.1;
/** Approximate advance of a tabular digit at this tracking, em; only used while a column folds open. */
const DIGIT_WIDTH = 0.56;
/** 0–9 plus a trailing 0, so 9 → 10 rolls forward instead of snapping back. */
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/**
 * Where a column of an odometer sits for a continuous value. The units turn
 * freely; every higher column only moves while the column below rolls from 9
 * to 0, exactly like the mechanical counter.
 */
function columnPosition(v: number, place: number) {
  if (place === 1) return v;
  return Math.floor(v / place) + clamp01((v % place) - (place - 1));
}

/** Mechanical odometer driven by one motion value. Velocity blurs the reels; a still number is crisp. */
function Odometer({ value, digits, reduce }: { value: MotionValue<number>; digits: number; reduce: boolean }) {
  const velocity = useVelocity(value);
  const filter = useTransform(velocity, (s) => (reduce ? "none" : `blur(${Math.min(2.2, Math.abs(s) / 14).toFixed(2)}px)`));
  return (
    <motion.span className="inline-flex tabular-nums" style={{ filter }}>
      {Array.from({ length: digits }, (_, i) => (
        <DigitColumn key={i} value={value} place={10 ** (digits - 1 - i)} />
      ))}
    </motion.span>
  );
}

function DigitColumn({ value, place }: { value: MotionValue<number>; place: number }) {
  const y = useTransform(value, (v) => `${-(columnPosition(v, place) % 10) * CELL}em`);
  // Leading columns fold away while the number is too small to need them, and open as it carries.
  const width = useTransform(value, (v) => {
    const open = place === 1 ? 1 : clamp01(v - (place - 1));
    return open === 1 ? "auto" : `${(open * DIGIT_WIDTH).toFixed(3)}em`;
  });
  return (
    <motion.span
      className="relative inline-block overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_22%,#000_78%,transparent)]"
      style={{ height: `${CELL}em`, lineHeight: `${CELL}em`, width }}
    >
      <span className="invisible">0</span>
      <motion.span className="absolute inset-x-0 top-0 flex flex-col items-center" style={{ y }}>
        {CELLS.map((n, k) => (
          <span key={k} className="block" style={{ height: `${CELL}em` }}>
            {n}
          </span>
        ))}
      </motion.span>
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** The component as published; overrides (the page's Customize panel) go straight to it. */
export default function PricingThreeTierDemo(overrides: Partial<PricingThreeTierProps> = {}) {
  return <PricingThreeTier {...overrides} />;
}
