"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
} from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
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
  /** Small print beside the price. */
  unit?: string;
  /** Badge that pops in on annual billing. */
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
  className?: string;
};

const ease = [0.22, 1, 0.36, 1] as const;
const springUi = { type: "spring", stiffness: 500, damping: 40 } as const;

const defaultFeatures = [
  "Unlimited docs, with full version history",
  "Comments, approvals and @-mentions",
  "Guests at no extra cost, with per-page access",
  "SSO with Google and Okta",
  "Support from people who use it daily",
];

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function PricingPlanToggle({
  name = "Team",
  description = "For product teams who write things down and can find them again.",
  monthly = 24,
  annual = 19,
  currency = "$",
  locale = "en-US",
  unit = "per seat / month",
  saveLabel = "Save 20%",
  notes = { monthly: "Billed monthly. Cancel any time.", annual: "Billed yearly. Switch to monthly whenever." },
  features = defaultFeatures,
  cta = "Start 14-day trial",
  ctaDone = "Check your inbox",
  onCheckout,
  seats = true,
  defaultBilling = "annual",
  footnote = "Prices in USD. Tax added at checkout.",
  className = "",
}: PricingPlanToggleProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const [billing, setBilling] = useState<Billing>(defaultBilling);
  const range = typeof seats === "object" ? seats : {};
  const minSeats = range.min ?? 1;
  const maxSeats = range.max ?? 50;
  const [count, setCount] = useState(Math.min(maxSeats, Math.max(minSeats, range.initial ?? 5)));
  const showSeats = seats !== false;
  const [cta_, setCta] = useState<"idle" | "loading" | "done">("idle");

  const price = billing === "annual" ? annual : monthly;
  const n = showSeats ? count : 1;
  const total = billing === "annual" ? price * n * 12 : price * n;
  const fmt = (v: number) => `${currency}${v.toLocaleString(locale, { maximumFractionDigits: Number.isInteger(v) ? 0 : 2, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 })}`;

  const checkout = () => {
    if (cta_ !== "idle") return;
    const r = onCheckout?.({ billing, seats: n, total });
    const settle = (ok: boolean) => {
      setCta(ok ? "done" : "idle");
      if (ok) window.setTimeout(() => setCta("idle"), 2600);
    };
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setCta("loading");
      (r as Promise<unknown>).then(
        () => settle(true),
        () => settle(false),
      );
    } else settle(true);
  };

  return (
    <div className={`@container flex w-full max-w-[420px] flex-col items-center ${className}`}>
      <BillingSwitch billing={billing} onChange={setBilling} uid={uid} reduce={reduce} />

      <article
        aria-labelledby={`${uid}-name`}
        className="relative mt-5 w-full rounded-[22px] bg-[#0b0b0c] p-6 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.06),0_40px_80px_-40px_rgba(0,0,0,0.9)] @sm:p-7"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id={`${uid}-name`} className="text-[16px] font-medium tracking-[-0.015em] text-white">
              {name}
            </h3>
            <p className="mt-1.5 max-w-[30ch] text-pretty text-[14px] leading-[1.5] text-white/50">{description}</p>
          </div>
          <div className="h-6 shrink-0">
            <AnimatePresence initial={false}>
              {billing === "annual" && saveLabel && (
                <motion.span
                  key="save"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
                  transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 520, damping: 20, mass: 0.8 }}
                  className="inline-flex h-6 origin-right items-center rounded-full bg-[#7dd3a8]/[0.12] px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#9be7c0] ring-1 ring-inset ring-[#7dd3a8]/30"
                >
                  {saveLabel}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Price */}
        <div className="mt-8 flex items-end gap-3">
          <p className="flex items-start font-sans font-semibold tracking-[-0.05em] text-white" aria-hidden="true">
            <span className="mr-1 mt-[0.32em] text-[22px] font-medium tracking-[-0.02em] text-white/45">{currency}</span>
            <span className="text-[clamp(3.25rem,2.6rem+3cqi,4rem)] leading-none">
              <RollingNumber value={price} locale={locale} reduce={reduce} />
            </span>
          </p>
          <p aria-hidden="true" className="pb-[0.45rem] text-[13px] leading-[1.3] text-white/45">
            {unit.split(" / ").map((u, i, a) => (
              <span key={u} className="block">
                {u}
                {i < a.length - 1 ? " /" : ""}
              </span>
            ))}
          </p>
          <span className="sr-only">
            {fmt(price)} {unit}, {notes[billing]}
          </span>
        </div>

        <div aria-hidden="true" className="relative mt-3 h-5 overflow-hidden text-[13px] text-white/45">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              key={billing}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(3px)", transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
              transition={{ duration: 0.3, ease }}
              className="whitespace-nowrap"
            >
              {notes[billing]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Seats and total */}
        {showSeats && (
          <div className="mt-7 rounded-[14px] bg-white/[0.025] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between gap-3 py-1 pl-3 pr-1">
              <span id={`${uid}-seats`} className="text-[14px] text-white/80">
                Seats
              </span>
              <Stepper value={count} min={minSeats} max={maxSeats} onChange={setCount} labelledBy={`${uid}-seats`} reduce={reduce} />
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.06] px-3 pb-2.5 pt-3">
              <span className="text-[13px] text-white/45">Total</span>
              <span className="flex items-baseline gap-1.5">
                <TweenNumber value={total} format={fmt} reduce={reduce} className="text-[15px] font-medium tabular-nums tracking-[-0.01em] text-white" />
                <span className="relative inline-grid text-[13px] text-white/45">
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
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {billing === "annual" ? "Annual" : "Monthly"} billing, {fmt(price)} {unit}
          {showSeats ? `, ${n} ${n === 1 ? "seat" : "seats"}, ${fmt(total)} ${billing === "annual" ? "per year" : "per month"}` : ""}.
        </p>

        {/* CTA */}
        <button
          type="button"
          onClick={checkout}
          aria-busy={cta_ === "loading" || undefined}
          className="group relative mt-5 grid h-11 w-full place-items-center rounded-[11px] bg-[#f4f4f5] px-5 text-[14px] font-medium tracking-[-0.01em] text-[#0b0b0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.4)] transition-[background-color,scale] duration-150 ease-out hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <AnimatePresence initial={false}>
            <motion.span
              key={cta_}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 7, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -7, filter: "blur(3px)", transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
              transition={{ duration: 0.24, ease }}
              className="col-start-1 row-start-1 inline-flex items-center gap-2"
            >
              {cta_ === "loading" ? (
                <>
                  <svg viewBox="0 0 16 16" className="size-4 animate-spin motion-reduce:animate-none" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.6" />
                    <path d="M13.75 8A5.75 5.75 0 0 0 8 2.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Setting up your trial…
                </>
              ) : cta_ === "done" ? (
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
                      transition={{ duration: 0.34, ease, delay: 0.05 }}
                    />
                  </svg>
                  {ctaDone}
                </>
              ) : (
                <>
                  {cta}
                  <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-[2px]" fill="none" aria-hidden="true">
                    <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </motion.span>
          </AnimatePresence>
          <span className="sr-only" role="status">
            {cta_ === "loading" ? "Setting up your trial" : cta_ === "done" ? ctaDone : ""}
          </span>
        </button>

        {/* Features */}
        <ul className="mt-7 space-y-3 border-t border-white/[0.07] pt-6">
          {features.map((f, i) => (
            <li key={f} className="flex gap-3 text-[14px] leading-[1.45] text-white/75">
              <DrawnCheck delay={0.1 + i * 0.07} reduce={reduce} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {footnote && <p className="mt-7 font-mono text-[11px] tracking-[0.01em] text-white/30">{footnote}</p>}
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Billing switch                                                       */
/* ------------------------------------------------------------------ */

function BillingSwitch({ billing, onChange, uid, reduce }: { billing: Billing; onChange: (b: Billing) => void; uid: string; reduce: boolean }) {
  const options: { value: Billing; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "annual", label: "Annual" },
  ];
  return (
    <LayoutGroup id={`${uid}-billing`}>
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="relative inline-grid grid-cols-2 rounded-full bg-white/[0.04] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault();
          const next = billing === "monthly" ? "annual" : "monthly";
          onChange(next);
          e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
        }}
      >
        {options.map((o) => {
          const on = billing === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-value={o.value}
              onClick={() => onChange(o.value)}
              className={`relative h-9 min-w-[104px] rounded-full px-5 text-[14px] font-medium tracking-[-0.01em] transition-[color,scale] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                on ? "text-[#0b0b0c]" : "text-white/55 hover:text-white"
              }`}
            >
              {on && (
                <motion.span
                  layoutId="thumb"
                  className="absolute inset-0 rounded-full bg-[#f4f4f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_8px_-2px_rgba(0,0,0,0.6)]"
                  transition={reduce ? { duration: 0 } : springUi}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ------------------------------------------------------------------ */
/* Slot-reel number                                                     */
/* ------------------------------------------------------------------ */

/** Every digit is its own reel. All reels spin the same way: up when the price rises, down when it falls. */
function RollingNumber({ value, locale, reduce }: { value: number; locale: string; reduce: boolean }) {
  const prev = useRef(value);
  const dir = value === prev.current ? 1 : value > prev.current ? 1 : -1;
  const dirRef = useRef(dir);
  if (value !== prev.current) {
    dirRef.current = dir;
    prev.current = value;
  }
  const text = value.toLocaleString(locale, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
  const chars = Array.from(text);
  return (
    <span className="inline-flex tabular-nums">
      <AnimatePresence initial={false}>
        {chars.map((c, i) => {
          const key = chars.length - i; // keyed from the right, so units stay units
          const isDigit = /\d/.test(c);
          return (
            <motion.span
              key={`${key}-${isDigit ? "d" : c}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
              transition={{ duration: 0.3, ease }}
              className="inline-block overflow-hidden"
            >
              {isDigit ? <Reel digit={Number(c)} dir={dirRef.current} delay={i * 0.055} reduce={reduce} /> : <span>{c}</span>}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}

const STRIP = 5; // copies of 0–9; the reel rests in the middle copy
const CELL = 1.1; // em

function Reel({ digit, dir, delay, reduce }: { digit: number; dir: number; delay: number; reduce: boolean }) {
  const pos = useMotionValue(20 + digit);
  const target = useRef(20 + digit);
  const velocity = useVelocity(pos);
  const y = useTransform(pos, (p) => `${-p * CELL}em`);
  // Motion blur along the direction of travel, from the reel's own velocity (digits per second).
  const filter = useTransform(velocity, (v) => (reduce ? "none" : `blur(${Math.min(2.4, Math.abs(v) / 9).toFixed(2)}px)`));

  useEffect(() => {
    const from = target.current;
    const fromDigit = ((from % 10) + 10) % 10;
    if (fromDigit === digit) return;
    const step = dir > 0 ? (digit - fromDigit + 10) % 10 : -((fromDigit - digit + 10) % 10);
    const to = from + step;
    target.current = to;
    if (reduce) {
      pos.jump(20 + digit);
      target.current = 20 + digit;
      return;
    }
    const controls = animate(pos, to, {
      type: "spring",
      stiffness: 120,
      damping: 19,
      mass: 1,
      delay,
      onComplete: () => {
        // Snap back to the middle copy (same glyph, so invisible) to leave room for the next spin.
        pos.jump(20 + digit);
        target.current = 20 + digit;
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit]);

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
/* Tweened figure, seats stepper, drawn check                           */
/* ------------------------------------------------------------------ */

function TweenNumber({ value, format, reduce, className }: { value: number; format: (v: number) => string; reduce: boolean; className?: string }) {
  const mv = useMotionValue(value);
  const ref = useRef<HTMLSpanElement>(null);
  const fmtRef = useRef(format);
  fmtRef.current = format;
  useEffect(() => mv.on("change", (v) => ref.current && (ref.current.textContent = fmtRef.current(Math.round(v * 100) / 100))), [mv]);
  useEffect(() => {
    if (reduce) {
      mv.jump(value);
      if (ref.current) ref.current.textContent = fmtRef.current(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.45, ease });
    return () => c.stop();
  }, [value, reduce, mv]);
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
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
  const btn =
    "relative grid size-8 place-items-center rounded-[9px] text-white/70 transition-[background-color,color,scale,opacity] duration-150 hover:bg-white/[0.07] hover:text-white active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-white/70 before:absolute before:-inset-1.5 before:content-['']";
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex items-center gap-1">
      <button type="button" aria-label="Remove a seat" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <span className="relative grid h-8 min-w-[2.5ch] place-items-center overflow-hidden text-[15px] font-medium tabular-nums text-white" aria-live="polite">
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
            transition={{ duration: 0.22, ease }}
            className="col-start-1 row-start-1"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" aria-label="Add a seat" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <path d="M3.5 8h9M8 3.5v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function DrawnCheck({ delay, reduce }: { delay: number; reduce: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="mt-[2px] size-4 shrink-0 text-[#7dd3a8]" fill="none" aria-hidden="true">
      <motion.path
        d="M3.5 8.4l2.8 2.8 6.2-6.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, amount: 1 }}
        transition={{ pathLength: { duration: 0.45, ease, delay }, opacity: { duration: 0.1, delay } }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

function PricingPlanToggleDemo() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-black px-4 py-14 text-white sm:px-8">
      <PricingPlanToggle onCheckout={() => new Promise((r) => window.setTimeout(r, 1400))} />
    </div>
  );
}

export default PricingPlanToggleDemo;
