"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  useVelocity,
  type Variants,
} from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Billing = "monthly" | "annual";

export type PricingPlanToggleProps = {
  name?: string;
  description?: string;
  /** Price per seat per month on monthly billing. */
  monthly?: number;
  /** Price per seat per month on annual billing. */
  annual?: number;
  /** Symbol shown before every amount. */
  currency?: string;
  /** Locale for number formatting. */
  locale?: string;
  /** Small print beside the price. \n splits it over two lines. */
  unit?: string;
  /** Badge that pops in on annual billing. The only use of the accent. */
  saveLabel?: string;
  /** Notes under the price for each billing period; they cross-fade. */
  notes?: Record<Billing, string>;
  features?: string[];
  cta?: string;
  /** CTA label after a successful checkout. */
  ctaDone?: string;
  /** Runs on CTA click. Return a promise to show the loading state. */
  onCheckout?: (order: { billing: Billing; seats: number; total: number }) => void | Promise<unknown>;
  /** Show the seats stepper. Pass an object to set its range. */
  seats?: boolean | { min?: number; max?: number; initial?: number };
  defaultBilling?: Billing;
  footnote?: string;
  /** The one signal colour, on the save badge. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    card: "#0b0b0c",
    ink: "#f4f4f5",
    onInk: "#0b0b0c",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 80px -40px rgba(0,0,0,0.9)",
    thumbShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 8px -2px rgba(0,0,0,0.6)",
  },
  light: {
    card: "#ffffff",
    ink: "#111113",
    onInk: "#ffffff",
    shadow: "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 40px 80px -40px rgba(17,17,19,0.28)",
    thumbShadow: "0 2px 8px -2px rgba(17,17,19,0.35)",
  },
} as const;

const DEFAULT_ACCENT = "#7dd3a8";
const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
/** One small landing overshoot: a slot reel, not a lift. */
const SPRING_REEL = { type: "spring", stiffness: 120, damping: 19, mass: 1 } as const;
const SPRING_BADGE = { type: "spring", stiffness: 520, damping: 20, mass: 0.8 } as const;
/** How long "Check your inbox" holds before the CTA settles back. */
const DONE_HOLD_MS = 2600;

/**
 * One timeline, in seconds. The switch lands, then the card, then its
 * contents top to bottom; the price spins up from zero once its row is in,
 * the total counts after the seats panel, and the checks draw last.
 */
const T = {
  toggle: 0,
  card: 0.06,
  head: 0.12,
  price: 0.16,
  note: 0.2,
  seats: 0.24,
  total: 0.32,
  cta: 0.28,
  rule: 0.32,
  features: 0.36,
  featureStep: 0.045,
  footnote: 0.62,
  badge: 0.42,
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
const cardIn: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE, delay },
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
    transition: { pathLength: { duration: 0.4, ease: EASE, delay }, opacity: { duration: 0.1, delay } },
  }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pp-ink)";

const DEFAULT_FEATURES = [
  "Unlimited docs, with full version history",
  "Comments, approvals and mentions",
  "Free guests, with access set page by page",
  "SSO with Google and Okta",
  "Support from people who use it daily",
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function PricingPlanToggle({
  name = "Team",
  description = "For product teams who write things down and can find them again.",
  monthly = 24,
  annual = 19,
  currency = "$",
  locale = "en-US",
  unit = "per seat\nper month",
  saveLabel = "Save 20%",
  notes = { monthly: "Billed monthly. Cancel any time.", annual: "Billed yearly. Switch to monthly whenever." },
  features = DEFAULT_FEATURES,
  cta = "Start 14-day trial",
  ctaDone = "Check your inbox",
  onCheckout,
  seats = true,
  defaultBilling = "annual",
  footnote = "Prices in USD. Tax added at checkout.",
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: PricingPlanToggleProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.3 });
  const [billing, setBilling] = useState<Billing>(defaultBilling);
  const range = typeof seats === "object" ? seats : {};
  const minSeats = range.min ?? 1;
  const maxSeats = range.max ?? 50;
  const [count, setCount] = useState(Math.min(maxSeats, Math.max(minSeats, range.initial ?? 5)));
  const showSeats = seats !== false;
  const { state: ctaState, run: checkout } = useCheckout(onCheckout);

  const price = billing === "annual" ? annual : monthly;
  const spoken = unit.replace(/\n/g, " ");
  const n = showSeats ? count : 1;
  const total = billing === "annual" ? price * n * 12 : price * n;
  const fmt = (v: number) => `${currency}${formatNumber(v, locale)}`;
  // Before the card is on screen every figure reads zero, so the entrance counts them up.
  const firstSpin = useFirstRun(inView);

  const p = PALETTE[theme];
  const vars = {
    "--pp-card": p.card,
    "--pp-ink": p.ink,
    "--pp-on-ink": p.onInk,
    "--pp-shadow": p.shadow,
    "--pp-thumb-shadow": p.thumbShadow,
    "--pp-accent": accent,
  } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  return (
    <motion.div
      ref={rootRef}
      style={vars}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className={`@container flex w-full max-w-[420px] flex-col items-center text-(--pp-ink) ${className}`}
    >
      <motion.div variants={v(reveal)} custom={T.toggle}>
        <BillingSwitch billing={billing} onChange={setBilling} uid={uid} reduce={reduce} />
      </motion.div>

      <motion.article
        aria-labelledby={`${uid}-name`}
        variants={v(cardIn)}
        custom={T.card}
        className="relative mt-5 w-full rounded-[22px] bg-(--pp-card) p-6 shadow-(--pp-shadow) @sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <motion.div variants={v(reveal)} custom={T.head} className="min-w-0">
            <h3 id={`${uid}-name`} className="text-[16px] font-medium tracking-[-0.015em]">
              {name}
            </h3>
            <p className="mt-1.5 max-w-[30ch] text-pretty text-[14px] leading-[1.5] text-(--pp-ink)/50">{description}</p>
          </motion.div>
          <SaveBadge label={saveLabel} shown={inView && billing === "annual"} reduce={reduce} delay={firstSpin ? T.badge : 0} />
        </div>

        <motion.div variants={v(reveal)} custom={T.price} className="mt-8 flex items-end gap-3">
          <p className="flex items-start font-semibold tracking-[-0.05em]" aria-hidden="true">
            <span className="mr-1 mt-[0.32em] text-[22px] font-medium tracking-[-0.02em] text-(--pp-ink)/45">{currency}</span>
            <span className="text-[clamp(3.25rem,2.6rem+3cqi,4rem)] leading-none">
              <RollingNumber value={inView ? price : 0} locale={locale} reduce={reduce} delay={firstSpin ? T.price : 0} />
            </span>
          </p>
          <p aria-hidden="true" className="pb-[0.45rem] text-[13px] leading-[1.3] text-(--pp-ink)/45">
            {unit.split("\n").map((u) => (
              <span key={u} className="block">
                {u}
              </span>
            ))}
          </p>
          <span className="sr-only">
            {fmt(price)} {spoken}, {notes[billing]}
          </span>
        </motion.div>

        <motion.div variants={v(reveal)} custom={T.note}>
          <BillingNote notes={notes} billing={billing} reduce={reduce} />
        </motion.div>

        {showSeats ? (
          <motion.div variants={v(reveal)} custom={T.seats} className="mt-7 rounded-[14px] bg-(--pp-ink)/[0.025] p-1 ring-1 ring-inset ring-(--pp-ink)/[0.06]">
            <div className="flex items-center justify-between gap-3 py-1 pl-3 pr-1">
              <span id={`${uid}-seats`} className="text-[14px] text-(--pp-ink)/80">
                Seats
              </span>
              <Stepper value={count} min={minSeats} max={maxSeats} onChange={setCount} labelledBy={`${uid}-seats`} reduce={reduce} />
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-(--pp-ink)/[0.06] px-3 pb-2.5 pt-3">
              <span className="text-[13px] text-(--pp-ink)/45">Total</span>
              <span className="flex items-baseline gap-1.5">
                <TweenNumber
                  value={inView ? total : 0}
                  format={fmt}
                  reduce={reduce}
                  delay={firstSpin ? T.total : 0}
                  className="inline-block text-[15px] font-medium tabular-nums tracking-[-0.01em]"
                />
                <span className="relative inline-grid text-[13px] text-(--pp-ink)/45">
                  {/* Both units reserve their width so the total never jumps sideways. */}
                  <span className="invisible col-start-1 row-start-1">/ month</span>
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={billing}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.2 }}
                      className="col-start-1 row-start-1"
                    >
                      {billing === "annual" ? "/ year" : "/ month"}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
            </div>
          </motion.div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {billing === "annual" ? "Annual" : "Monthly"} billing, {fmt(price)} {spoken}
          {showSeats ? `, ${n} ${n === 1 ? "seat" : "seats"}, ${fmt(total)} ${billing === "annual" ? "per year" : "per month"}` : ""}.
        </p>

        <motion.div variants={v(reveal)} custom={T.cta}>
          <CheckoutButton state={ctaState} label={cta} doneLabel={ctaDone} reduce={reduce} onClick={() => checkout({ billing, seats: n, total })} />
        </motion.div>

        <div className="relative mt-7 pt-6">
          <motion.span variants={v(drawX)} custom={T.rule} aria-hidden="true" className="absolute inset-x-0 top-0 h-px origin-left bg-(--pp-ink)/[0.07]" />
          <ul className="space-y-3">
            {features.map((f, i) => {
              const at = T.features + i * T.featureStep;
              return (
                <motion.li key={f} variants={v(reveal)} custom={at} className="flex gap-3 text-[14px] leading-[1.45] text-(--pp-ink)/75">
                  <DrawnCheck variants={v(drawPath)} delay={at + 0.06} />
                  <span>{f}</span>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {footnote ? (
          <motion.p variants={v(reveal)} custom={T.footnote} className="mt-7 font-mono text-[11px] tracking-[0.01em] text-(--pp-ink)/35">
            {footnote}
          </motion.p>
        ) : null}
      </motion.article>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks and helpers                                                   */
/* ------------------------------------------------------------------ */

function formatNumber(v: number, locale: string) {
  const whole = Number.isInteger(v);
  return v.toLocaleString(locale, { maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 });
}

/** True for the render in which `active` first turns on, so the entrance can use its own delays. */
function useFirstRun(active: boolean) {
  const done = useRef(false);
  const first = active && !done.current;
  useEffect(() => {
    if (active) done.current = true;
  }, [active]);
  return first;
}

type CheckoutState = "idle" | "loading" | "done";

/** CTA state machine: idle → loading (while a returned promise is pending) → done → idle. The hold timer is cleared on unmount. */
function useCheckout(onCheckout: PricingPlanToggleProps["onCheckout"]) {
  const [state, setState] = useState<CheckoutState>("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = (order: { billing: Billing; seats: number; total: number }) => {
    if (state !== "idle") return;
    const settle = (ok: boolean) => {
      setState(ok ? "done" : "idle");
      if (!ok) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState("idle"), DONE_HOLD_MS);
    };
    const result = onCheckout?.(order);
    if (result instanceof Promise) {
      setState("loading");
      result.then(
        () => settle(true),
        () => settle(false),
      );
    } else settle(true);
  };
  return { state, run };
}

/* ------------------------------------------------------------------ */
/* Billing switch, badge and note                                      */
/* ------------------------------------------------------------------ */

const BILLING_OPTIONS: { value: Billing; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

function BillingSwitch({ billing, onChange, uid, reduce }: { billing: Billing; onChange: (b: Billing) => void; uid: string; reduce: boolean }) {
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
        className="relative inline-grid grid-cols-2 rounded-full bg-(--pp-ink)/[0.04] p-1 ring-1 ring-inset ring-(--pp-ink)/[0.08]"
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
              className={`relative h-9 min-w-[104px] rounded-full px-5 text-[14px] font-medium tracking-[-0.01em] transition-[color,scale] duration-150 active:scale-[0.97] ${FOCUS} ${
                on ? "text-(--pp-on-ink)" : "text-(--pp-ink)/55 hover:text-(--pp-ink)"
              }`}
            >
              {on ? (
                <motion.span
                  layoutId="thumb"
                  className="absolute inset-0 rounded-full bg-(--pp-ink) shadow-(--pp-thumb-shadow)"
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

/** The only colour on the card: it springs in when annual billing is chosen, and lands last on first view. */
function SaveBadge({ label, shown, reduce, delay }: { label: string; shown: boolean; reduce: boolean; delay: number }) {
  return (
    <div className="h-6 shrink-0">
      <AnimatePresence initial={false}>
        {shown && label ? (
          <motion.span
            key="save"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 4, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, transition: { duration: 0.14, ease: EASE_IN } }}
            transition={reduce ? { duration: 0.15 } : { ...SPRING_BADGE, delay }}
            className="inline-flex h-6 origin-right items-center rounded-full bg-(--pp-accent)/[0.12] px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--pp-accent)_60%,var(--pp-ink))] ring-1 ring-inset ring-(--pp-accent)/30"
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Both notes sit invisibly in one grid cell, so the block is always as tall as the longer one and wrapping never jumps. */
function BillingNote({ notes, billing, reduce }: { notes: Record<Billing, string>; billing: Billing; reduce: boolean }) {
  return (
    <div aria-hidden="true" className="mt-3 grid text-[13px] leading-[1.45] text-(--pp-ink)/45">
      {BILLING_OPTIONS.map((b) => (
        <p key={b.value} className="invisible col-start-1 row-start-1">
          {notes[b.value]}
        </p>
      ))}
      <AnimatePresence initial={false}>
        <motion.p
          key={billing}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(3px)", transition: { duration: 0.18, ease: EASE_IN } }}
          transition={{ duration: 0.3, ease: EASE }}
          className="col-start-1 row-start-1"
        >
          {notes[billing]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slot-reel number                                                    */
/* ------------------------------------------------------------------ */

/** Copies of 0–9 on each strip; a reel rests in the middle copy so it can spin either way. */
const STRIP = 5;
const REST = 20;
/** Reel cell height, em. */
const CELL = 1.1;
const REEL_STAGGER = 0.055;
const mod10 = (n: number) => ((n % 10) + 10) % 10;

/**
 * Every digit is its own reel. All reels spin the same way: up when the price
 * rises, down when it falls. Digits are keyed from the right so units stay
 * units, and a new column grows in from zero width.
 */
function RollingNumber({ value, locale, reduce, delay }: { value: number; locale: string; reduce: boolean; delay: number }) {
  const prev = useRef(value);
  const dir = value >= prev.current ? 1 : -1;
  useEffect(() => {
    prev.current = value;
  }, [value]);
  const chars = Array.from(formatNumber(value, locale));
  return (
    <span className="inline-flex tabular-nums">
      <AnimatePresence initial={false}>
        {chars.map((c, i) => {
          const key = chars.length - i;
          const isDigit = /\d/.test(c);
          return (
            <motion.span
              key={`${key}-${isDigit ? "d" : c}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
              transition={{ duration: 0.3, ease: EASE, delay: reduce ? 0 : delay }}
              className="inline-block overflow-hidden"
            >
              {isDigit ? <Reel digit={Number(c)} dir={dir} delay={delay + i * REEL_STAGGER} reduce={reduce} /> : <span>{c}</span>}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}

function Reel({ digit, dir, delay, reduce }: { digit: number; dir: number; delay: number; reduce: boolean }) {
  // A reel is born on zero and spins to its digit, so a new column counts up too.
  const pos = useMotionValue(REST + (reduce ? digit : 0));
  const velocity = useVelocity(pos);
  const y = useTransform(pos, (p) => `${-p * CELL}em`);
  // Motion blur along the direction of travel, from the reel's own velocity (digits per second).
  const filter = useTransform(velocity, (s) => (reduce ? "none" : `blur(${Math.min(2.4, Math.abs(s) / 9).toFixed(2)}px)`));

  useEffect(() => {
    if (reduce) {
      pos.jump(REST + digit);
      return;
    }
    // Spin from wherever the reel is now, so an interrupted spin carries on rather than restarting.
    const from = Math.round(pos.get());
    const fromDigit = mod10(from);
    const step = dir > 0 ? mod10(digit - fromDigit) : -mod10(fromDigit - digit);
    const controls = animate(pos, from + step, {
      ...SPRING_REEL,
      delay,
      // Snap back to the middle copy (same glyph, so invisible) to leave room for the next spin.
      onComplete: () => pos.jump(REST + digit),
    });
    return () => controls.stop();
    // Spin only when the digit changes; direction and delay are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit, reduce]);

  return (
    <span
      className="relative inline-block overflow-hidden align-top [mask-image:linear-gradient(to_bottom,transparent,#000_16%,#000_84%,transparent)]"
      style={{ height: `${CELL}em`, lineHeight: `${CELL}em` }}
    >
      <span className="invisible">0</span>
      <motion.span className="absolute inset-x-0 top-0 flex flex-col items-center will-change-transform" style={{ y, filter }}>
        {Array.from({ length: STRIP * 10 }, (_, k) => (
          <span key={k} className="block" style={{ height: `${CELL}em` }}>
            {k % 10}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tweened total, seats stepper, drawn check, CTA                      */
/* ------------------------------------------------------------------ */

/** Counts to each new value in a motion value and writes the text directly, so counting never re-renders. */
function TweenNumber({
  value,
  format,
  reduce,
  delay,
  className,
}: {
  value: number;
  format: (v: number) => string;
  reduce: boolean;
  delay: number;
  className?: string;
}) {
  const mv = useMotionValue(value);
  const velocity = useVelocity(mv);
  const filter = useTransform(velocity, (s) => (reduce ? "none" : `blur(${Math.min(1.6, Math.abs(s) / 600).toFixed(2)}px)`));
  const ref = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;
  const whole = Number.isInteger(value);

  // Whole-number totals stay whole while they count, so "$133.50" never flashes past.
  useMotionValueEvent(mv, "change", (v) => {
    if (ref.current) ref.current.textContent = formatRef.current(whole ? Math.round(v) : Math.round(v * 100) / 100);
  });
  useEffect(() => {
    if (reduce) {
      mv.jump(value);
      if (ref.current) ref.current.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.45, ease: EASE, delay });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, mv]);

  return (
    <motion.span ref={ref} className={className} style={{ filter }}>
      {format(value)}
    </motion.span>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  labelledBy,
  reduce,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  labelledBy: string;
  reduce: boolean;
}) {
  const last = useRef(value);
  const dir = value >= last.current ? 1 : -1;
  useEffect(() => {
    last.current = value;
  }, [value]);
  const btn = `relative grid size-8 place-items-center rounded-[9px] text-(--pp-ink)/70 transition-[background-color,color,scale,opacity] duration-150 hover:bg-(--pp-ink)/[0.07] hover:text-(--pp-ink) active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-(--pp-ink)/70 before:absolute before:-inset-1.5 before:content-[''] ${FOCUS}`;
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex items-center gap-1">
      <button type="button" aria-label="Remove a seat" data-demo="seat-remove" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <span className="relative grid h-8 min-w-[2.5ch] place-items-center overflow-hidden text-[15px] font-medium tabular-nums" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          <motion.span
            key={value}
            custom={dir}
            variants={{
              enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: 10 * d, filter: "blur(2px)" }),
              center: { opacity: 1, y: 0, filter: "blur(0px)" },
              exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: -10 * d, filter: "blur(2px)" }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: EASE }}
            className="col-start-1 row-start-1"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" aria-label="Add a seat" data-demo="seat-add" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <path d="M3.5 8h9M8 3.5v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function DrawnCheck({ variants, delay }: { variants: Variants; delay: number }) {
  return (
    <svg viewBox="0 0 16 16" className="mt-[2px] size-4 shrink-0 text-(--pp-ink)/70" fill="none" aria-hidden="true">
      <motion.path d="M3.5 8.4l2.8 2.8 6.2-6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" variants={variants} custom={delay} />
    </svg>
  );
}

function CheckoutButton({
  state,
  label,
  doneLabel,
  reduce,
  onClick,
}: {
  state: CheckoutState;
  label: string;
  doneLabel: string;
  reduce: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-demo="checkout"
      aria-busy={state === "loading" || undefined}
      className={`group relative mt-5 grid h-11 w-full place-items-center rounded-[11px] bg-(--pp-ink) px-5 text-[14px] font-medium tracking-[-0.01em] text-(--pp-on-ink) shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.4)] transition-[background-color,scale] duration-150 ease-out hover:bg-(--pp-ink)/90 active:scale-[0.98] ${FOCUS}`}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={state}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 7, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -7, filter: "blur(3px)", transition: { duration: 0.15, ease: EASE_IN } }}
          transition={{ duration: 0.24, ease: EASE }}
          className="col-start-1 row-start-1 inline-flex items-center gap-2"
        >
          {state === "loading" ? (
            <>
              <svg viewBox="0 0 16 16" className="size-4 animate-spin motion-reduce:animate-none" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.6" />
                <path d="M13.75 8A5.75 5.75 0 0 0 8 2.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Setting up your trial…
            </>
          ) : state === "done" ? (
            <>
              <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
                <motion.path
                  d="M3.25 8.4l3 3 6.5-6.75"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.34, ease: EASE, delay: 0.05 }}
                />
              </svg>
              {doneLabel}
            </>
          ) : (
            <>
              {label}
              <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" fill="none" aria-hidden="true">
                <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only" role="status">
        {state === "loading" ? "Setting up your trial" : state === "done" ? doneLabel : ""}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** Simulated checkout for the demo: a short network wait. */
const DEMO_CHECKOUT_MS = 1400;

/** The card on a quiet stage. Overrides (the page's Customize panel) go straight to the card. */
export default function PricingPlanToggleDemo(overrides: Partial<PricingPlanToggleProps> = {}) {
  return (
    <div className={`flex min-h-dvh w-full items-center justify-center px-4 py-14 sm:px-8 ${overrides.theme === "light" ? "bg-[#f4f4f5]" : "bg-black"}`}>
      <PricingPlanToggle onCheckout={() => new Promise((resolve) => window.setTimeout(resolve, DEMO_CHECKOUT_MS))} {...overrides} />
    </div>
  );
}
