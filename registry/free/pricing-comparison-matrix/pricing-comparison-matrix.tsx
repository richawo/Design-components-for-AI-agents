"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
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
  type Variants,
} from "motion/react";

/** true = included, false = not included, string = a value ("50M", "99.9%"). */
export type MatrixValue = boolean | string;

export type MatrixPlan = {
  id: string;
  name: string;
  /** Price as displayed, e.g. "$24" or "Custom". A number inside counts up. */
  price: string;
  /** Unit under the price, e.g. "per seat / month". */
  unit: string;
  blurb: string;
  cta: { label: string; href: string };
};

export type MatrixFeature = {
  name: string;
  /** Tooltip explaining the feature. */
  hint?: string;
  /** One value per plan, in plan order. */
  values: MatrixValue[];
};

export type MatrixGroup = {
  name: string;
  features: MatrixFeature[];
  /** Open on first render. Defaults to true. */
  defaultOpen?: boolean;
};

export type PricingComparisonMatrixProps = {
  eyebrow?: string;
  title?: string;
  body?: string;
  plans?: MatrixPlan[];
  groups?: MatrixGroup[];
  /** id of the highlighted plan. */
  recommendedId?: string;
  recommendedLabel?: string;
  footnote?: string;
  /** The one signal colour: the recommended column's top edge and label dot. */
  accent?: string;
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    page: "#08080a",
    ink: "#f4f4f5",
    onInk: "#08080a",
    band: "#111114",
    // The tooltip is dark in both themes, so its text is always light.
    tip: "#1c1c20",
    tipInk: "#e4e4e7",
    tipShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 16px 32px -12px rgba(0,0,0,0.8)",
  },
  light: {
    page: "#ffffff",
    ink: "#111113",
    onInk: "#ffffff",
    band: "#f5f5f6",
    tip: "#111113",
    tipInk: "#e4e4e7",
    tipShadow: "0 12px 28px -10px rgba(17,17,19,0.45)",
  },
} as const;

const DEFAULT_ACCENT = "#2dd4bf";
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/**
 * One timeline, in seconds. Copy first, then the plan headers left to right
 * (name, price counting up, unit, action), then the recommended band's accent
 * edge, then the rows group by group. Rows below the fold keep their place in
 * this order if they're visible at once, and arrive straight away if they're
 * scrolled to later.
 */
const T = {
  eyebrow: 0,
  title: 0.05,
  body: 0.1,
  plans: 0.16,
  planStep: 0.06,
  price: 0.06,
  count: 0.6,
  cta: 0.12,
  edge: 0.5,
  rows: 0.42,
  groupStep: 0.12,
  rowStep: 0.03,
  footnote: 0.1,
} as const;

/** Rise 10px out of an 8px blur. `custom` is the start time; the filter is dropped at rest. */
const reveal: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
/** Table rows: a smaller rise and blur, quick, so twenty of them never feel like a queue. */
const rowIn: Variants = {
  hidden: { opacity: 0, y: 6, filter: "blur(6px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
  exit: { opacity: 0, transition: { duration: 0.12 } },
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
    transition: { pathLength: { duration: 0.32, ease: EASE, delay }, opacity: { duration: 0.1, delay } },
  }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cm-ink)";
/** The recommended column's sides, drawn as inset hairlines so the band reads as one continuous strip. */
const BAND_SIDES = "@3xl:shadow-[inset_1px_0_0_color-mix(in_srgb,var(--cm-ink)_12%,transparent),inset_-1px_0_0_color-mix(in_srgb,var(--cm-ink)_12%,transparent)]";

const DEFAULT_PLANS: MatrixPlan[] = [
  { id: "hobby", name: "Hobby", price: "$0", unit: "forever", blurb: "Side projects and weekend launches.", cta: { label: "Start free", href: "#signup" } },
  { id: "team", name: "Team", price: "$24", unit: "per seat / month", blurb: "Product teams shipping weekly.", cta: { label: "Start trial", href: "#trial-team" } },
  { id: "business", name: "Business", price: "$64", unit: "per seat / month", blurb: "Several teams, one source of truth.", cta: { label: "Start trial", href: "#trial-business" } },
  { id: "enterprise", name: "Enterprise", price: "Custom", unit: "annual contract", blurb: "Procurement, SSO and a named engineer.", cta: { label: "Talk to us", href: "#sales" } },
];

const DEFAULT_GROUPS: MatrixGroup[] = [
  {
    name: "Flags & rollouts",
    features: [
      { name: "Feature flags", values: ["10", "Unlimited", "Unlimited", "Unlimited"] },
      {
        name: "Flag evaluations",
        hint: "Each time your app asks Hatch for a flag value, per month. Evaluations served from the SDK cache are free.",
        values: ["1M", "50M", "500M", "Custom"],
      },
      { name: "Percentage rollouts", values: [true, true, true, true] },
      { name: "Scheduled releases", hint: "Turn a flag on at 09:00 Tuesday without anyone setting an alarm.", values: [false, true, true, true] },
      { name: "Environments", values: ["2", "5", "Unlimited", "Unlimited"] },
    ],
  },
  {
    name: "Experimentation",
    features: [
      { name: "A/B tests", values: [false, "3 running", "Unlimited", "Unlimited"] },
      {
        name: "Sequential testing",
        hint: "Check results whenever you like without inflating your false-positive rate. No more waiting for day 14.",
        values: [false, true, true, true],
      },
      {
        name: "Warehouse-native metrics",
        hint: "Metrics are computed inside your own Snowflake, BigQuery or Postgres. Raw events never leave your warehouse.",
        values: [false, false, true, true],
      },
      { name: "Holdout groups", values: [false, false, true, true] },
    ],
  },
  {
    name: "Collaboration",
    features: [
      { name: "Seats", values: ["1", "Up to 50", "Unlimited", "Unlimited"] },
      { name: "Approval workflows", hint: "Require a second pair of eyes before a flag changes in production.", values: [false, "1 step", "Multi-step", "Multi-step"] },
      { name: "Change history", values: ["7 days", "90 days", "2 years", "Forever"] },
      { name: "Slack and Linear apps", values: [true, true, true, true] },
    ],
  },
  {
    name: "Security & compliance",
    defaultOpen: false,
    features: [
      { name: "SAML single sign-on", values: [false, false, true, true] },
      { name: "SCIM provisioning", hint: "People added or removed in your identity provider are added or removed here too.", values: [false, false, false, true] },
      { name: "SOC 2 Type II report", values: [false, true, true, true] },
      { name: "Data residency", values: [false, false, "EU or US", "Any region"] },
    ],
  },
  {
    name: "Support",
    defaultOpen: false,
    features: [
      { name: "Support channel", values: ["Community", "Email", "Shared Slack", "Named engineer"] },
      { name: "First response", values: [false, "1 business day", "4 hours", "1 hour, 24/7"] },
      { name: "Uptime SLA", hint: "Credited automatically if we miss it. You won’t have to file a ticket to get money back.", values: [false, "99.9%", "99.95%", "99.99%"] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function PricingComparisonMatrix({
  eyebrow = "Compare plans",
  title = "Every line of the contract, in one table.",
  body = "No asterisks, no “contact us to find out”. If it’s in a plan, it’s on this page.",
  plans = DEFAULT_PLANS,
  groups = DEFAULT_GROUPS,
  recommendedId = "team",
  recommendedLabel = "Recommended",
  footnote = "Prices in USD, per seat per month, billed annually. Monthly billing costs 20% more. Every paid plan starts with a 14-day trial; no card needed.",
  accent = DEFAULT_ACCENT,
  theme = "dark",
}: PricingComparisonMatrixProps) {
  const uid = useId();
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.1 });
  const revealedAt = useRevealTime(inView);
  const recIndex = Math.max(0, plans.findIndex((p) => p.id === recommendedId));
  const [mobilePlan, setMobilePlan] = useState(recIndex);
  // Moving the recommendation moves the phone switcher with it.
  useEffect(() => setMobilePlan(recIndex), [recIndex]);
  const [open, setOpen] = useState<boolean[]>(() => groups.map((g) => g.defaultOpen !== false));
  const featureCount = groups.reduce((n, g) => n + g.features.length, 0);
  const allOpen = open.every(Boolean);

  const p = PALETTE[theme];
  const vars = {
    "--cm-page": p.page,
    "--cm-ink": p.ink,
    "--cm-on-ink": p.onInk,
    "--cm-band": p.band,
    "--cm-tip": p.tip,
    "--cm-tip-ink": p.tipInk,
    "--cm-tip-shadow": p.tipShadow,
    "--cm-accent": accent,
  } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  const renderControls = (demo?: string) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-(--cm-ink)/65">
      <span className="tabular-nums">
        {featureCount} features · {groups.length} groups
      </span>
      <button
        type="button"
        data-demo={demo}
        onClick={() => setOpen(groups.map(() => !allOpen))}
        className={`-mx-2 rounded-md px-2 py-1.5 font-semibold uppercase text-(--cm-ink)/80 underline decoration-(--cm-ink)/25 underline-offset-4 transition-[color,text-decoration-color,transform] duration-150 hover:text-(--cm-ink) hover:decoration-(--cm-ink) active:scale-[0.97] ${FOCUS}`}
      >
        {allOpen ? "Collapse all" : "Expand all"}
      </button>
    </div>
  );

  return (
    <motion.section
      ref={rootRef}
      aria-labelledby={`${uid}-title`}
      style={vars}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className="@container relative overflow-x-clip bg-(--cm-page) text-(--cm-ink)"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 @xl:px-8 @xl:py-20 @5xl:px-10 @5xl:py-24">
        <div className="flex flex-col gap-6 @3xl:flex-row @3xl:items-end @3xl:justify-between">
          <div>
            <motion.p variants={v(reveal)} custom={T.eyebrow} className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-(--cm-ink)/65">
              {eyebrow}
            </motion.p>
            <motion.h2
              id={`${uid}-title`}
              variants={v(reveal)}
              custom={T.title}
              className="mt-4 max-w-[18ch] text-balance font-display text-[clamp(2.1rem,1.3rem+3.2cqi,3.75rem)] font-semibold leading-[1] tracking-[-0.04em]"
            >
              {title}
            </motion.h2>
            <motion.p variants={v(reveal)} custom={T.body} className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-(--cm-ink)/65">
              {body}
            </motion.p>
          </div>
          <motion.div variants={v(reveal)} custom={T.body} className="@3xl:hidden">
            {renderControls()}
          </motion.div>
        </div>

        <MobilePlanBar
          plans={plans}
          selected={mobilePlan}
          onSelect={setMobilePlan}
          recIndex={recIndex}
          recommendedLabel={recommendedLabel}
          uid={uid}
          reduce={reduce}
          variants={v}
        />

        <table className="mt-4 w-full table-auto border-separate border-spacing-0 text-left @3xl:mt-14 @3xl:table-fixed">
          <caption className="sr-only">Plan comparison: features by plan</caption>

          <thead className="hidden @3xl:sticky @3xl:top-0 @3xl:z-20 @3xl:table-header-group">
            <tr>
              <th scope="col" className="w-[28%] border-b border-(--cm-ink)/[0.08] bg-(--cm-page) pb-5 pr-6 align-bottom @5xl:w-[30%]">
                <motion.div variants={v(reveal)} custom={T.plans}>
                  {renderControls("toggle-all")}
                </motion.div>
              </th>
              {plans.map((plan, i) => (
                <PlanHeader
                  key={plan.id}
                  plan={plan}
                  start={T.plans + i * T.planStep}
                  recommended={i === recIndex}
                  recommendedLabel={recommendedLabel}
                  active={inView}
                  reduce={reduce}
                  variants={v}
                />
              ))}
            </tr>
          </thead>

          {groups.map((g, gi) => (
            <GroupBody
              key={g.name}
              group={g}
              index={gi}
              open={open[gi] ?? true}
              onToggle={() => setOpen((o) => o.map((x, k) => (k === gi ? !x : x)))}
              plans={plans}
              recIndex={recIndex}
              mobilePlan={mobilePlan}
              panelId={`${uid}-group-${gi}`}
              revealedAt={revealedAt}
              reduce={reduce}
              variants={v}
            />
          ))}

          {/* Foot: closes the recommended column. */}
          <tfoot className="hidden @3xl:table-footer-group">
            <tr>
              <td className="pt-0" />
              {plans.map((plan, i) => (
                <td key={plan.id} className="p-0">
                  {i === recIndex ? (
                    <div className="h-4 rounded-b-2xl bg-(--cm-band) shadow-[inset_1px_0_0_color-mix(in_srgb,var(--cm-ink)_12%,transparent),inset_-1px_0_0_color-mix(in_srgb,var(--cm-ink)_12%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--cm-ink)_12%,transparent)]" />
                  ) : null}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>

        <Footnote text={footnote} variants={v} />
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

/** The moment (performance.now) the section was first revealed, so later blocks can find their slot in the timeline. */
function useRevealTime(inView: boolean) {
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    if (inView && at === null) setAt(performance.now());
  }, [inView, at]);
  return at;
}

/** Seconds left until `slot` on a timeline that started at `startedAt`; zero once that moment has passed. */
function remaining(startedAt: number, slot: number) {
  return Math.max(0, startedAt / 1000 + slot - performance.now() / 1000);
}

/** Splits "$24" into prefix, number and suffix so the number can count. Non-numeric prices return null. */
function parsePrice(price: string) {
  const m = /^(\D*)(\d+(?:\.\d+)?)(.*)$/.exec(price);
  if (!m) return null;
  return { prefix: m[1] ?? "", value: Number(m[2]), decimals: m[2]?.split(".")[1]?.length ?? 0, suffix: m[3] ?? "" };
}

/**
 * A price that counts up from zero on first view and tweens between values
 * afterwards (the mobile switcher), in a motion value: no re-render per frame.
 * Text prices like "Custom" cross-fade instead.
 */
function CountedPrice({ price, active, reduce, delay, className }: { price: string; active: boolean; reduce: boolean; delay: number; className: string }) {
  const parsed = parsePrice(price);
  const target = parsed?.value ?? 0;
  const value = useMotionValue(0);
  const entered = useRef(false);
  const velocity = useVelocity(value);
  const text = useTransform(value, (n) => n.toFixed(parsed?.decimals ?? 0));
  const filter = useTransform(velocity, (s) => (reduce ? "none" : `blur(${Math.min(2.5, Math.abs(s) / 30).toFixed(2)}px)`));

  useEffect(() => {
    if (!active) return;
    if (reduce) {
      value.jump(target);
      entered.current = true;
      return;
    }
    const controls = entered.current
      ? animate(value, target, { duration: 0.45, ease: EASE })
      : animate(value, target, { delay, duration: T.count, ease: EASE, onComplete: () => (entered.current = true) });
    return () => controls.stop();
  }, [active, reduce, target, delay, value]);

  if (!parsed) return <span className={className}>{price}</span>;
  return (
    <span className={className}>
      <span className="sr-only">{price}</span>
      <motion.span aria-hidden="true" className="inline-block tabular-nums" style={{ filter }}>
        {parsed.prefix}
        <motion.span>{text}</motion.span>
        {parsed.suffix}
      </motion.span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop header                                                      */
/* ------------------------------------------------------------------ */

type VariantPicker = (v: Variants) => Variants;

function PlanHeader({
  plan,
  start,
  recommended,
  recommendedLabel,
  active,
  reduce,
  variants: v,
}: {
  plan: MatrixPlan;
  start: number;
  recommended: boolean;
  recommendedLabel: string;
  active: boolean;
  reduce: boolean;
  variants: VariantPicker;
}) {
  return (
    <th
      scope="col"
      className={`relative border-b px-3 pb-5 pt-6 align-top font-normal @5xl:px-5 ${
        recommended ? `rounded-t-2xl border-(--cm-ink)/[0.12] bg-(--cm-band) ${BAND_SIDES}` : "border-(--cm-ink)/[0.08] bg-(--cm-page)"
      }`}
    >
      {recommended ? (
        // The one accent: a 2px edge drawn across the top of the band once the headers have landed.
        <motion.span
          aria-hidden="true"
          variants={v(drawX)}
          custom={T.edge}
          className="absolute inset-x-4 top-0 h-[2px] rounded-b-full bg-(--cm-accent)"
        />
      ) : null}
      <motion.div variants={v(reveal)} custom={start}>
        <div className="flex h-5 items-center">
          {recommended ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-(--cm-ink)/80">
              <span className="size-1.5 rounded-full bg-(--cm-accent)" aria-hidden="true" />
              {recommendedLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-display text-[19px] font-semibold tracking-[-0.02em]">{plan.name}</p>
      </motion.div>
      <motion.div variants={v(reveal)} custom={start + T.price}>
        <p className="mt-3">
          <CountedPrice
            price={plan.price}
            active={active}
            reduce={reduce}
            delay={start + T.price}
            className="font-display text-[clamp(1.6rem,1rem+1.2vw,2.25rem)] font-semibold leading-none tracking-[-0.04em]"
          />
        </p>
        <p className="mt-1.5 text-[12px] leading-snug text-(--cm-ink)/65">{plan.unit}</p>
        <p className="mt-3 hidden min-h-[2.75em] text-[13px] leading-snug text-(--cm-ink)/65 @5xl:block">{plan.blurb}</p>
      </motion.div>
      <motion.div variants={v(reveal)} custom={start + T.cta} className="mt-4">
        <PlanCta plan={plan} primary={recommended} />
      </motion.div>
    </th>
  );
}

function PlanCta({ plan, primary, compact }: { plan: MatrixPlan; primary: boolean; compact?: boolean }) {
  return (
    <a
      href={plan.cta.href}
      className={`group/cta inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] ${FOCUS} ${
        compact ? "h-11 shrink-0 px-5 text-[14px]" : "h-10 w-full px-3 text-[13px] @5xl:text-[14px]"
      } ${
        primary
          ? "bg-(--cm-ink) text-(--cm-on-ink) hover:bg-(--cm-ink)/88"
          : "bg-(--cm-ink)/[0.04] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--cm-ink)_14%,transparent)] hover:bg-(--cm-ink)/[0.08]"
      }`}
    >
      {plan.cta.label}
      <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-150 group-hover/cta:translate-x-0.5" fill="none" aria-hidden="true">
        <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile plan switcher                                                */
/* ------------------------------------------------------------------ */

function MobilePlanBar({
  plans,
  selected,
  onSelect,
  recIndex,
  recommendedLabel,
  uid,
  reduce,
  variants: v,
}: {
  plans: MatrixPlan[];
  selected: number;
  onSelect: (i: number) => void;
  recIndex: number;
  recommendedLabel: string;
  uid: string;
  reduce: boolean;
  variants: VariantPicker;
}) {
  const plan = plans[selected];
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (selected + step + plans.length) % plans.length;
    onSelect(next);
    e.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };
  if (!plan) return null;

  return (
    <motion.div
      variants={v(reveal)}
      custom={T.plans}
      className="sticky top-0 z-30 -mx-4 mt-10 border-b border-(--cm-ink)/[0.08] bg-(--cm-page)/95 px-4 pb-4 pt-3 backdrop-blur-sm @3xl:hidden"
    >
      <LayoutGroup id={`${uid}-tabs`}>
        <div
          role="tablist"
          aria-label="Choose a plan to compare"
          onKeyDown={onKeyDown}
          className="grid rounded-xl bg-(--cm-ink)/[0.05] p-1"
          style={{ gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))` }}
        >
          {plans.map((p, i) => {
            const on = i === selected;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => onSelect(i)}
                className={`relative h-11 rounded-lg px-1 text-[13px] font-semibold transition-[color,transform] duration-150 active:scale-[0.97] ${FOCUS} ${
                  on ? "text-(--cm-on-ink)" : "text-(--cm-ink)/65"
                }`}
              >
                {on ? (
                  <motion.span layoutId="tab" className="absolute inset-0 rounded-lg bg-(--cm-ink)" transition={reduce ? { duration: 0 } : SPRING_UI} />
                ) : null}
                <span className="relative">{p.name}</span>
                {i === recIndex ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-(--cm-accent)" /> : null}
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      <div className="mt-4 flex items-center justify-between gap-4" aria-live="polite">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13px] text-(--cm-ink)/65">
            {plan.name}
            {selected === recIndex ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-(--cm-ink)/[0.06] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-(--cm-ink)/80">
                <span className="size-1.5 rounded-full bg-(--cm-accent)" aria-hidden="true" />
                {recommendedLabel}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <CountedPrice
              price={plan.price}
              active
              reduce={reduce}
              delay={T.plans + T.price}
              className="font-display text-[28px] font-semibold leading-none tracking-[-0.03em]"
            />
            <span className="truncate text-[12px] text-(--cm-ink)/65">{plan.unit}</span>
          </p>
        </div>
        <PlanCta plan={plan} primary={selected === recIndex} compact />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Feature groups                                                      */
/* ------------------------------------------------------------------ */

function GroupBody({
  group,
  index,
  open,
  onToggle,
  plans,
  recIndex,
  mobilePlan,
  panelId,
  revealedAt,
  reduce,
  variants: v,
}: {
  group: MatrixGroup;
  index: number;
  open: boolean;
  onToggle: () => void;
  plans: MatrixPlan[];
  recIndex: number;
  mobilePlan: number;
  panelId: string;
  revealedAt: number | null;
  reduce: boolean;
  variants: VariantPicker;
}) {
  const ref = useRef<HTMLTableSectionElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const ready = inView && revealedAt !== null;
  // Where this group starts: its slot in the first-view timeline, or now if that slot has passed.
  const base = useMemo(() => (ready && revealedAt !== null ? remaining(revealedAt, T.rows + index * T.groupStep) : 0), [ready, revealedAt, index]);

  const toggle = (demo?: string) => (
    <button
      type="button"
      data-demo={demo}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      className={`group flex w-full items-center gap-3 rounded-md py-3.5 text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--cm-ink)`}
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-md border border-(--cm-ink)/[0.12] text-(--cm-ink)/65 transition-[transform,background-color] duration-300 group-hover:bg-(--cm-ink)/[0.06] ${open ? "" : "-rotate-90"}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 12 12" className="size-3" fill="none">
          <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">{group.name}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-(--cm-ink)/65">{group.features.length}</span>
    </button>
  );

  return (
    <motion.tbody ref={ref} id={panelId} initial="hidden" animate={ready ? "show" : "hidden"}>
      {/* Mobile: the group header spans both visible columns. */}
      <motion.tr variants={v(rowIn)} custom={base} className="@3xl:hidden">
        <th scope="colgroup" colSpan={plans.length + 1} className="border-b border-(--cm-ink)/[0.08] p-0 pt-6">
          {toggle()}
        </th>
      </motion.tr>
      <motion.tr variants={v(rowIn)} custom={base} className="hidden @3xl:table-row">
        <th scope="colgroup" className="border-b border-(--cm-ink)/[0.08] p-0 pt-6">
          {toggle(`group-${index}`)}
        </th>
        {plans.map((p, pi) => (
          <td
            key={p.id}
            aria-hidden="true"
            className={`border-b ${pi === recIndex ? `border-(--cm-ink)/[0.08] bg-(--cm-band) ${BAND_SIDES}` : "border-(--cm-ink)/[0.08]"}`}
          />
        ))}
      </motion.tr>
      {/* No initial={false}: rows stagger in on first view and again on every expand. */}
      <AnimatePresence>
        {open
          ? group.features.map((f, fi) => (
              <FeatureRow
                key={f.name}
                feature={f}
                at={(ready ? base : 0) + T.rowStep * (fi + 1)}
                show={ready}
                plans={plans}
                recIndex={recIndex}
                mobilePlan={mobilePlan}
                reduce={reduce}
                variants={v}
              />
            ))
          : null}
      </AnimatePresence>
    </motion.tbody>
  );
}

function FeatureRow({
  feature,
  at,
  show,
  plans,
  recIndex,
  mobilePlan,
  reduce,
  variants: v,
}: {
  feature: MatrixFeature;
  at: number;
  show: boolean;
  plans: MatrixPlan[];
  recIndex: number;
  mobilePlan: number;
  reduce: boolean;
  variants: VariantPicker;
}) {
  // Once the row has landed, a value swapped in by the phone plan switcher draws straight away.
  const landed = useRef(false);
  return (
    // Rows set their own states: inside AnimatePresence they don't pick up the body's initial variant.
    <motion.tr
      variants={v(rowIn)}
      custom={at}
      initial="hidden"
      animate={show ? "show" : "hidden"}
      exit="exit"
      onAnimationComplete={(name) => name === "show" && (landed.current = true)}
      className="group/row"
    >
      <th
        scope="row"
        className="w-[58%] border-b border-(--cm-ink)/[0.06] py-3.5 pr-4 align-middle text-[14px] font-normal text-(--cm-ink)/80 group-hover/row:bg-(--cm-ink)/[0.02] @3xl:w-auto"
      >
        <FeatureName feature={feature} />
      </th>
      {plans.map((p, pi) => {
        const rec = pi === recIndex;
        return (
          <td
            key={p.id}
            className={`border-b px-3 py-3.5 align-middle text-[14px] @5xl:px-5 ${pi === mobilePlan ? "" : "hidden @3xl:table-cell"} ${
              rec ? `border-(--cm-ink)/[0.06] bg-(--cm-band) ${BAND_SIDES}` : "border-(--cm-ink)/[0.06] group-hover/row:bg-(--cm-ink)/[0.02]"
            }`}
          >
            {/* On phones only one column shows; switching plans swaps its values with a short blur. */}
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={pi === mobilePlan ? `m${mobilePlan}` : "d"}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.25, ease: EASE }}
                className="inline-flex min-h-5 items-center align-middle"
              >
                <Value
                  value={feature.values[pi] ?? false}
                  strong={rec}
                  show={show}
                  variants={v}
                  delay={landed.current ? SWAP_DRAW_DELAY : at + 0.08 + pi * 0.03}
                />
              </motion.span>
            </AnimatePresence>
          </td>
        );
      })}
    </motion.tr>
  );
}

/** Pause before a swapped-in check draws, so it follows the value's own fade. */
const SWAP_DRAW_DELAY = 0.06;

/** A check that draws, a dash that draws, or a value. Marks set their own state, so a remounted one still draws. */
function Value({ value, strong, show, variants: v, delay }: { value: MatrixValue; strong: boolean; show: boolean; variants: VariantPicker; delay: number }) {
  const state = { initial: "hidden", animate: show ? "show" : "hidden" } as const;
  if (value === true) {
    return (
      <span className="inline-flex items-center">
        <svg viewBox="0 0 16 16" className={`size-[18px] ${strong ? "text-(--cm-ink)" : "text-(--cm-ink)/75"}`} fill="none" aria-hidden="true">
          <motion.path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" variants={v(drawPath)} custom={delay} {...state} />
        </svg>
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center">
        <motion.span aria-hidden="true" variants={v(drawX)} custom={delay} {...state} className="h-[1.5px] w-3 origin-left rounded-full bg-(--cm-ink)/30" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className={`tabular-nums ${strong ? "font-medium text-(--cm-ink)" : "text-(--cm-ink)/70"}`}>{value}</span>;
}

/** Feature name with an optional hint: a dotted underline and a tooltip on hover, focus or tap. */
function FeatureName({ feature }: { feature: MatrixFeature }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  if (!feature.hint) return <span>{feature.name}</span>;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-demo={`hint-${feature.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={`-my-1 rounded py-1 text-left text-(--cm-ink) underline decoration-(--cm-ink)/35 decoration-dotted decoration-[1.5px] underline-offset-[5px] transition-[text-decoration-color,transform] duration-150 hover:decoration-(--cm-ink) active:scale-[0.97] ${FOCUS}`}
      >
        {feature.name}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.span
            id={tipId}
            role="tooltip"
            initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE }}
            className="pointer-events-none absolute bottom-full left-0 z-40 mb-2.5 w-[min(272px,calc(100vw-48px))] rounded-xl bg-(--cm-tip) px-3.5 py-3 text-[13px] font-normal leading-snug text-(--cm-tip-ink) shadow-(--cm-tip-shadow)"
          >
            {feature.hint}
            <span aria-hidden="true" className="absolute -bottom-1 left-5 size-2.5 rotate-45 bg-(--cm-tip)" />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

function Footnote({ text, variants: v }: { text: string; variants: VariantPicker }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  return (
    <motion.p
      ref={ref}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={v(reveal)}
      custom={T.footnote}
      className="mt-10 max-w-[68ch] text-[13px] leading-relaxed text-(--cm-ink)/65"
    >
      {text}
    </motion.p>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** The matrix on a stage that follows the theme. Overrides (the page's Customize panel) go straight to the table. */
export default function PricingComparisonMatrixDemo(overrides: Partial<PricingComparisonMatrixProps> = {}) {
  return (
    <div className={`w-full ${overrides.theme === "light" ? "bg-white" : "bg-[#08080a]"}`}>
      <PricingComparisonMatrix {...overrides} />
    </div>
  );
}
