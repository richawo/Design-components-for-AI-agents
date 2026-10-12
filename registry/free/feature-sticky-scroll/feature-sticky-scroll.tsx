"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type Variants } from "motion/react";

type Step = {
  /** Short tab label shown in the product panel. */
  tab: string;
  title: string;
  body: string;
  /** Mono footnote under the body. */
  detail: string;
};

type LineItem = { label: string; qty: string; amount: number };

export type FeatureStickyScrollProps = {
  eyebrow?: string;
  heading?: string;
  /** Muted second clause of the heading. */
  headingMuted?: string;
  intro?: string;
  /** Four steps. Each one drives one state of the product panel, in order. */
  steps?: Step[];
  brand?: string;
  currency?: string;
  client?: string;
  project?: string;
  invoiceNumber?: string;
  items?: LineItem[];
  /** Shares of each payment set aside automatically. "Yours" gets the rest. */
  pots?: { label: string; share: number }[];
  /** The one colour: progress, the primary action, the money that's yours. */
  accent?: string;
  /** Near-black (default) or warm paper. */
  theme?: "dark" | "light";
  /** Scrolls to this step (0-based) whenever it changes. Leave it unset to let the reader scroll. */
  step?: number;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    bg: "#0a0a0a",
    ink: "#f4f4f2",
    // The product panel sits one step up; its wells one step back down.
    panel: "#121212",
    well: "#0a0a0a",
    paper: "#f4f4f2",
    paperInk: "#0a0a0a",
    onAccent: "#0a0a0a",
    shadow: "0 40px 80px -40px rgba(0,0,0,0.7)",
  },
  light: {
    bg: "#f6f5f2",
    ink: "#0a0a0a",
    panel: "#ffffff",
    well: "#f6f5f2",
    paper: "#fbfaf7",
    paperInk: "#0a0a0a",
    onAccent: "#0a0a0a",
    shadow: "0 1px 2px rgba(0,0,0,0.05), 0 40px 80px -48px rgba(0,0,0,0.25)",
  },
} as const;

const ACCENT = "#ff8a4c";

type Bezier = readonly [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];
const EASE_COUNT: Bezier = [0.16, 1, 0.3, 1];

// Header entrance, then every panel state's own choreography, in seconds:
// container → text → figures → data → progress.
const T = {
  eyebrow: 0,
  heading: 0.06,
  intro: 0.14,
  panel: 0.22,
  block: 0.6,
  /** Inside a panel state, after it becomes active. */
  first: 0.08,
  step: 0.06,
  figure: 0.16,
  data: 0.3,
  progress: 0.45,
  count: 0.9,
  swap: 0.5,
} as const;

/** 12px rise out of an 8px blur; `custom` is the start time in seconds. */
const RISE: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)", transition: { duration: 0.2 } },
  // A null start time snaps: things that render finished never animate.
  show: (delay: number | null) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: delay === null ? { duration: 0 } : { duration: T.block, ease: EASE, delay } }),
};
const FADE: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } };

const MONO = "font-mono text-[11px] uppercase";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fs-ink)";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FeatureStickyScroll({
  eyebrow = "How Ferry works",
  heading = "Get paid like you have",
  headingMuted = "an accounts team.",
  intro = "Ferry is invoicing for freelancers who would rather be doing the work. Four steps, most of which happen while you’re asleep.",
  steps = DEFAULT_STEPS,
  brand = "Ferry",
  currency = "£",
  client = "Halcyon Coffee Ltd",
  project = "Brand refresh",
  invoiceNumber = "0142",
  items = DEFAULT_ITEMS,
  pots = DEFAULT_POTS,
  accent = ACCENT,
  theme = "dark",
  step,
}: FeatureStickyScrollProps) {
  const reduce = useReducedMotion() ?? false;
  const headingId = useId();
  const { active, stepsRef, stepRefs, goTo } = useActiveStep(steps.length, reduce);
  // A changed `step` prop glides to that step; the value present at mount does nothing.
  const lastStep = useRef(step);
  useEffect(() => {
    if (step === lastStep.current) return;
    lastStep.current = step;
    if (step !== undefined) goTo(step);
    // `goTo` is rebuilt every render; only a new `step` should scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  // The pinned panel's first state plays once the panel itself has risen in.
  const [panelLive, setPanelLive] = useState(false);

  const total = items.reduce((a, b) => a + b.amount, 0);
  const data: PanelData = { brand, currency, client, project, invoiceNumber, items, pots, total, tabs: steps.map((s) => s.tab) };
  const p = PALETTE[theme];
  const vars = {
    "--fs-bg": p.bg,
    "--fs-ink": p.ink,
    "--fs-panel": p.panel,
    "--fs-well": p.well,
    "--fs-paper": p.paper,
    "--fs-paper-ink": p.paperInk,
    "--fs-accent": accent,
    "--fs-on-accent": p.onAccent,
    "--fs-shadow": p.shadow,
    colorScheme: theme,
  } as CSSProperties;

  return (
    <section style={vars} className="@container relative bg-(--fs-bg) text-(--fs-ink)" aria-labelledby={headingId}>
      <div className="mx-auto max-w-7xl px-5 @xl:px-8 @5xl:px-12">
        <Header id={headingId} eyebrow={eyebrow} heading={heading} muted={headingMuted} intro={intro} reduce={reduce} />

        <div className="grid gap-10 pb-20 @5xl:grid-cols-12 @5xl:gap-8 @5xl:pb-0">
          {/* Sticky visual (wide containers) */}
          <div className="hidden @5xl:col-span-6 @5xl:block">
            <div className="sticky top-0 flex h-screen min-h-[640px] flex-col items-start justify-center py-10">
              <Reveal reduce={reduce} delay={T.panel} className="w-full max-w-[540px]" onReveal={setPanelLive}>
                <Panel data={data} active={active} reduce={reduce} live={panelLive} />
                <StepNav active={active} count={steps.length} label={steps[active]?.tab ?? ""} goTo={goTo} reduce={reduce} />
              </Reveal>
            </div>
          </div>

          {/* Steps */}
          <div className="relative @5xl:col-span-6 @5xl:col-start-7">
            <ProgressRail target={stepsRef} reduce={reduce} />
            <ol ref={stepsRef} className="space-y-16 @5xl:space-y-0">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  data-index={i}
                  className="@5xl:flex @5xl:min-h-screen @5xl:items-center"
                >
                  <StepCopy step={s} index={i} active={i === active} reached={i <= active} reduce={reduce} onGo={() => goTo(i)} />
                  {/* Inline visual (narrow containers) */}
                  <div className="mt-8 @5xl:hidden">
                    <InlinePanel data={data} index={i} reduce={reduce} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll                                                              */
/* ------------------------------------------------------------------ */

/** The step crossing the middle of the viewport is active; `goTo` glides the page there. */
function useActiveStep(count: number, reduce: boolean) {
  const [active, setActive] = useState(0);
  const stepsRef = useRef<HTMLOListElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const els = stepRefs.current.filter((e): e is HTMLLIElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      // A 4% band through the middle of the viewport.
      { rootMargin: "-48% 0px -48% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [count]);

  const goTo = (i: number) => {
    const el = stepRefs.current[Math.max(0, Math.min(count - 1, i))];
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };
  return { active, stepsRef, stepRefs, goTo };
}

/** The vertical rail beside the steps fills with the accent as they scroll past. */
function ProgressRail({ target, reduce }: { target: RefObject<HTMLOListElement | null>; reduce: boolean }) {
  // 0 when the first step reaches the middle of the viewport, 1 when the last one does.
  const { scrollYProgress } = useScroll({ target, offset: ["start 50%", "end 50%"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  return (
    <div aria-hidden="true" className="absolute bottom-[calc(50vh-24px)] left-[15px] top-[calc(50vh-24px)] hidden w-px bg-(--fs-ink)/12 @5xl:block">
      <motion.div className="absolute inset-0 origin-top bg-(--fs-accent)" style={{ scaleY: reduce ? scrollYProgress : smooth }} />
    </div>
  );
}

type Phase = "pending" | "final" | "hidden" | "play";
const APPROACH = "0px 0px 320px 0px";

/**
 * Scroll reveals run once, for things the reader will watch arrive: on screen
 * (or arriving) plays the entrance at `amount` in view. Anything far below the
 * fold at mount renders finished (a full-page screenshot, a deep link), then
 * quietly re-hides and plays when the reader scrolls within 320px of it.
 */
function useScrollReveal<E extends Element>(amount: number, reduce: boolean) {
  const ref = useRef<E>(null);
  const [stage, setStage] = useState<Phase>("pending");
  const inView = useInView(ref, { once: true, amount });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduce || typeof IntersectionObserver === "undefined") return setStage("final");
    if (el.getBoundingClientRect().top < window.innerHeight + 320) return setStage("hidden");
    setStage("final");
    let first = true;
    const io = new IntersectionObserver(
      ([e]) => {
        // The first report only describes the mount position.
        if (first) return void (first = false);
        if (e.isIntersecting) {
          setStage("hidden");
          io.disconnect();
        }
      },
      { rootMargin: APPROACH },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);
  const phase: Phase = stage === "hidden" && inView ? "play" : stage;
  return { ref, phase, shown: phase === "final" || phase === "play" };
}

/** Reveals its children once: a rise out of a blur, or a short fade under reduced motion. */
function Reveal({ children, reduce, delay = 0, className = "", onReveal }: { children: ReactNode; reduce: boolean; delay?: number; className?: string; onReveal?: (shown: boolean) => void }) {
  const { ref, phase, shown } = useScrollReveal<HTMLDivElement>(0.25, reduce);
  useEffect(() => {
    if (shown) onReveal?.(true);
  }, [shown, onReveal]);
  return (
    <motion.div ref={ref} variants={reduce ? FADE : RISE} custom={phase === "final" ? null : delay} initial="hidden" animate={shown ? "show" : "hidden"} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

function Header({ id, eyebrow, heading, muted, intro, reduce }: { id: string; eyebrow: string; heading: string; muted: string; intro: string; reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const v = reduce ? FADE : RISE;
  return (
    <motion.header
      ref={ref}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className="grid gap-8 pb-12 pt-20 @xl:pt-24 @5xl:grid-cols-12 @5xl:items-end @5xl:pb-8 @5xl:pt-32"
    >
      <div className="@5xl:col-span-8">
        <motion.p variants={v} custom={T.eyebrow} className={`${MONO} flex items-center gap-2.5 tracking-[0.18em] text-(--fs-ink)/65`}>
          <span className="size-1.5 rounded-full bg-(--fs-accent)" aria-hidden="true" />
          {eyebrow}
        </motion.p>
        <motion.h2
          id={id}
          variants={v}
          custom={T.heading}
          className="mt-6 max-w-[16ch] text-balance font-sans text-[clamp(2.5rem,1.3rem+4.4vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.055em]"
        >
          {heading} <span className="text-(--fs-ink)/65">{muted}</span>
        </motion.h2>
      </div>
      <motion.p variants={v} custom={T.intro} className="max-w-[40ch] text-[16px] leading-[1.65] text-(--fs-ink)/65 @5xl:col-span-4 @5xl:pb-3">
        {intro}
      </motion.p>
    </motion.header>
  );
}

function StepCopy({ step, index, active, reached, reduce, onGo }: { step: Step; index: number; active: boolean; reached: boolean; reduce: boolean; onGo: () => void }) {
  const n = String(index + 1).padStart(2, "0");
  return (
    <Reveal reduce={reduce} className="relative @5xl:pl-16">
      <button
        type="button"
        onClick={onGo}
        data-demo={`step-${index + 1}`}
        aria-label={`Go to step ${index + 1}: ${step.tab}`}
        aria-current={active ? "step" : undefined}
        className={`absolute left-0 top-0 hidden size-[31px] items-center justify-center rounded-full border bg-(--fs-bg) font-mono text-[11px] tabular-nums transition-[color,border-color,transform] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 active:scale-95 active:duration-100 ${FOCUS} @5xl:flex ${
          reached ? "border-(--fs-accent) text-(--fs-ink)" : "border-(--fs-ink)/20 text-(--fs-ink)/65 hover:border-(--fs-ink)/45 hover:text-(--fs-ink)/80"
        }`}
      >
        {index + 1}
      </button>
      <p className={`${MONO} tracking-[0.16em] text-(--fs-ink)/65`}>
        {n} — {step.tab}
      </p>
      <h3
        className={`mt-4 max-w-[18ch] text-balance font-display text-[clamp(1.85rem,1.3rem+1.8vw,2.75rem)] font-semibold leading-[1.02] tracking-[-0.035em] transition-colors duration-[400ms] ${
          active ? "@5xl:text-(--fs-ink)" : "@5xl:text-(--fs-ink)/65"
        }`}
      >
        {step.title}
      </h3>
      <p className={`mt-5 max-w-[46ch] text-[16px] leading-[1.65] transition-colors duration-[400ms] @xl:text-[17px] ${active ? "text-(--fs-ink)/70" : "text-(--fs-ink)/70 @5xl:text-(--fs-ink)/65"}`}>
        {step.body}
      </p>
      <p className={`mt-6 inline-flex items-center gap-2.5 border-t border-(--fs-ink)/12 pt-4 ${MONO} tracking-[0.12em] text-(--fs-ink)/65`}>
        <span className="size-1.5 rounded-full bg-(--fs-ink)/40" aria-hidden="true" />
        {step.detail}
      </p>
    </Reveal>
  );
}

/** Under the sticky panel: previous/next and "Step 02 / 04", with the step name sliding in on change. */
function StepNav({ active, count, label, goTo, reduce }: { active: number; count: number; label: string; goTo: (i: number) => void; reduce: boolean }) {
  return (
    <div className={`mt-6 flex w-full items-center justify-between gap-4 ${MONO} tracking-[0.14em] text-(--fs-ink)/65`}>
      <span className="flex items-center gap-3">
        <span className="flex gap-1">
          {[-1, 1].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => goTo(active + d)}
              data-demo={d < 0 ? "step-prev" : "step-next"}
              disabled={d < 0 ? active === 0 : active === count - 1}
              aria-label={d < 0 ? "Previous step" : "Next step"}
              className={`flex size-8 items-center justify-center rounded-full border border-(--fs-ink)/12 text-(--fs-ink)/70 transition-[background-color,color,transform,opacity] duration-150 hover:bg-(--fs-ink)/[0.06] hover:text-(--fs-ink) active:scale-90 disabled:opacity-30 disabled:active:scale-100 ${FOCUS}`}
            >
              <svg viewBox="0 0 16 16" className={`size-3.5 ${d < 0 ? "rotate-180" : ""}`} fill="none" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </span>
        <span aria-live="polite">
          Step <span className="tabular-nums text-(--fs-ink)">{String(active + 1).padStart(2, "0")}</span> / {String(count).padStart(2, "0")}
        </span>
      </span>
      <motion.span
        key={active}
        initial={reduce ? false : { opacity: 0, y: 6, filter: "blur(2px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        {label}
      </motion.span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product panel                                                       */
/* ------------------------------------------------------------------ */

type PanelData = {
  brand: string;
  currency: string;
  client: string;
  project: string;
  invoiceNumber: string;
  items: LineItem[];
  pots: { label: string; share: number }[];
  total: number;
  tabs: string[];
};

const STATES = [TrackState, InvoiceState, PaidState, PotsState];

const money = (c: string, n: number, cents = false) =>
  `${c}${n.toLocaleString("en-GB", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;

/** Narrow containers: each step shows its own state, playing it when it scrolls into view. */
function InlinePanel({ data, index, reduce }: { data: PanelData; index: number; reduce: boolean }) {
  const { ref, shown } = useScrollReveal<HTMLDivElement>(0.35, reduce);
  return (
    <div ref={ref}>
      <Panel data={data} active={index} reduce={reduce} only={index} live={shown} />
    </div>
  );
}

function Panel({ data, active, reduce, only, live = true }: { data: PanelData; active: number; reduce: boolean; only?: number; live?: boolean }) {
  const lid = useId();
  const shown = only === undefined ? STATES.map((_, i) => i) : [only % STATES.length];
  const current = active % STATES.length;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[22px] border border-(--fs-ink)/10 bg-(--fs-panel) shadow-(--fs-shadow)"
      role="img"
      aria-label={`${data.brand} app: ${data.tabs[current] ?? ""}`}
    >
      {/* App bar with tabs; the underline slides between states */}
      <div className="flex items-center justify-between gap-4 border-b border-(--fs-ink)/[0.08] px-5 @xl:px-6">
        <span className="flex items-center gap-2 py-4 font-display text-[15px] font-semibold tracking-[-0.02em]">
          <FerryMark />
          {data.brand}
        </span>
        <div className="flex gap-4 overflow-hidden @xl:gap-5" aria-hidden="true">
          {data.tabs.map((t, i) => (
            <span
              key={t}
              className={`relative whitespace-nowrap py-4 text-[12px] transition-colors duration-[400ms] ${i === current ? "text-(--fs-ink)" : "text-(--fs-ink)/65"} ${only !== undefined && i !== current ? "hidden @md:inline" : ""}`}
            >
              {t}
              {i === current && (
                <motion.span
                  layoutId={only === undefined ? `${lid}-tab` : undefined}
                  className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-(--fs-ink)"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="relative h-[520px]">
        {shown.map((i) => {
          const State = STATES[i];
          const on = i === current;
          return (
            // States cross-fade in place with a 16px offset and a little blur, so the eye can follow.
            <motion.div
              key={i}
              className="absolute inset-0 p-5 @xl:p-6"
              initial={false}
              animate={{ opacity: on ? 1 : 0, y: on || reduce ? 0 : i < current ? -16 : 16, filter: on || reduce ? "blur(0px)" : "blur(4px)" }}
              transition={{ duration: reduce ? 0 : T.swap, ease: EASE }}
              style={{ pointerEvents: on ? "auto" : "none" }}
              aria-hidden={!on}
            >
              <motion.div className="h-full" initial="hidden" animate={on && live ? "show" : "hidden"}>
                <State data={data} on={on && live} reduce={reduce} />
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function FerryMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="var(--fs-ink)" />
      <path d="M4 12.5c2 1.4 4 1.4 6 0s4-1.4 6 0" stroke="var(--fs-panel)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M6.5 10V7.5h7V10" stroke="var(--fs-panel)" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

type StateProps = { data: PanelData; on: boolean; reduce: boolean };

/** A block inside a panel state: replays its rise every time the state becomes active. */
function Block({ at, reduce, className = "", children }: { at: number; reduce: boolean; className?: string; children: ReactNode }) {
  return (
    <motion.div variants={reduce ? FADE : RISE} custom={at} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * A figure that counts up from zero out of a blur each time `on` turns true,
 * then follows later changes (instantly with `jump`, e.g. a ticking clock).
 * Motion values write the text and filter, so nothing re-renders per frame.
 */
function Count({ value, on, reduce, format, delay = T.figure, jump = false, className = "" }: { value: number; on: boolean; reduce: boolean; format: (v: number) => string; delay?: number; jump?: boolean; className?: string }) {
  const n = useMotionValue(on || reduce ? value : 0);
  const settle = useMotionValue(on || reduce ? 1 : 0);
  const wasOn = useRef(on);

  useEffect(() => {
    if (reduce) {
      n.jump(value);
      settle.jump(1);
      return;
    }
    if (!on) {
      wasOn.current = false;
      return;
    }
    if (!wasOn.current) {
      // Becoming active: count up from zero again.
      wasOn.current = true;
      n.jump(0);
      settle.jump(0);
      const a = animate(n, value, { duration: T.count, delay, ease: EASE_COUNT });
      const b = animate(settle, 1, { duration: T.count * 0.8, delay, ease: EASE });
      return () => {
        a.stop();
        b.stop();
        // Interrupted mid-count (a value tick): land the blur rather than leave it.
        settle.jump(1);
      };
    }
    if (jump) return void n.jump(value);
    const a = animate(n, value, { duration: 0.45, ease: EASE });
    return () => a.stop();
    // `delay` and `jump` are fixed per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, on, reduce]);

  const text = useTransform(n, format);
  const filter = useTransform(settle, [0, 1], ["blur(8px)", "blur(0px)"]);
  const opacity = useTransform(settle, [0, 0.35], [0, 1]);
  return (
    <motion.span className={`inline-block tabular-nums ${className}`} style={{ filter, opacity }}>
      {text}
    </motion.span>
  );
}

/** A bar or pot that fills from its base once its block has landed. */
function Fill({ on, reduce, to, delay, className = "", style }: { on: boolean; reduce: boolean; to: number; delay: number; className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      className={`origin-bottom ${className}`}
      style={{ height: `${to * 100}%`, ...style }}
      initial={false}
      animate={{ scaleY: on || reduce ? 1 : 0 }}
      transition={on && !reduce ? { duration: 0.8, delay, ease: EASE } : { duration: 0 }}
    />
  );
}

const clock = (s: number) => {
  const t = Math.floor(s);
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((v) => String(v).padStart(2, "0")).join(":");
};
const TIMER_START = 2 * 3600 + 14 * 60 + 37;

/* 1. Track: a running timer, today's entries, the week in bars */
function TrackState({ data, on, reduce }: StateProps) {
  const [secs, setSecs] = useState(TIMER_START);
  useEffect(() => {
    if (!on || reduce) return;
    // Starts ticking once the fast-forward from zero has landed.
    let id = 0;
    const start = window.setTimeout(() => {
      id = window.setInterval(() => setSecs((s) => s + 1), 1000);
    }, (T.figure + T.count) * 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [on, reduce]);
  const week = [6.5, 7.2, 5.1, 8, 3.4];
  const entries = [
    { label: "Logo revisions", time: "1h 40m" },
    { label: "Client call", time: "45m" },
    { label: "Packaging mockups", time: "3h 05m" },
  ];
  return (
    <div className="flex h-full flex-col">
      <Block at={T.first} reduce={reduce} className="rounded-[16px] border border-(--fs-ink)/10 bg-(--fs-well) p-5">
        <div className="flex items-center justify-between">
          <p className={`flex items-center gap-2 ${MONO} tracking-[0.14em]`}>
            <span className="relative flex size-2">
              {on && !reduce ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--fs-accent) opacity-60" /> : null}
              <span className="relative inline-flex size-2 rounded-full bg-(--fs-accent)" />
            </span>
            Running
          </p>
          <p className="truncate pl-3 text-[12px] text-(--fs-ink)/65">
            {data.client.replace(/ Ltd$/, "")} · {data.project}
          </p>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          {/* The clock fast-forwards from 00:00:00, then ticks a second at a time. */}
          <p className="font-display text-[clamp(2.75rem,2rem+2.4vw,3.75rem)] font-medium leading-none tracking-[-0.04em]">
            <Count value={secs} on={on} reduce={reduce} format={clock} jump />
          </p>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-(--fs-accent)" aria-hidden="true">
            <span className="flex gap-[5px]">
              <span className="h-4 w-[4px] rounded-[1px] bg-(--fs-on-accent)" />
              <span className="h-4 w-[4px] rounded-[1px] bg-(--fs-on-accent)" />
            </span>
          </span>
        </div>
      </Block>

      <ul className="mt-5 divide-y divide-(--fs-ink)/[0.08]">
        {entries.map((e, i) => (
          <motion.li key={e.label} variants={reduce ? FADE : RISE} custom={T.figure + i * T.step} className="flex items-center justify-between py-3 text-[14px]">
            <span className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-(--fs-ink)/30" />
              {e.label}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-(--fs-ink)/65">{e.time}</span>
          </motion.li>
        ))}
      </ul>

      <Block at={T.data} reduce={reduce} className="mt-auto">
        <div className="flex items-baseline justify-between">
          <p className={`${MONO} tracking-[0.14em] text-(--fs-ink)/65`}>This week</p>
          <p className="font-mono text-[12px] tabular-nums text-(--fs-ink)/70">30h 12m</p>
        </div>
        <div className="mt-3 grid h-[84px] grid-cols-5 items-end gap-2.5">
          {week.map((h, i) => (
            <div key={i} className="flex h-full flex-col justify-end">
              {/* Today in full ink, the rest at 18%. */}
              <Fill on={on} reduce={reduce} to={h / 8} delay={T.progress + i * T.step} className={`rounded-[4px] ${i === week.length - 1 ? "bg-(--fs-ink)" : "bg-(--fs-ink)/18"}`} />
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2.5 text-center font-mono text-[10px] uppercase text-(--fs-ink)/65">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </Block>
    </div>
  );
}

/* 2. Invoice: a paper document assembling its line items */
function InvoiceState({ data, on, reduce }: StateProps) {
  const name = data.client.replace(/ Ltd$/, "");
  return (
    <div className="flex h-full flex-col">
      <Block at={T.first} reduce={reduce} className="relative flex-1 rounded-[10px] border border-(--fs-ink)/[0.06] bg-(--fs-paper) p-5 text-(--fs-paper-ink) shadow-[0_24px_40px_-24px_rgba(0,0,0,0.35)] @xl:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-[26px] font-semibold leading-none tracking-[-0.035em]">Invoice</p>
            <p className="mt-1.5 font-mono text-[11px] tabular-nums opacity-65">№ {data.invoiceNumber} · 7 Oct 2026</p>
          </div>
          <span className="rounded-full border border-current/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]">Draft</span>
        </div>
        <motion.div variants={reduce ? FADE : RISE} custom={T.figure} className="mt-5 grid grid-cols-2 gap-4 text-[12px] leading-[1.5]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-65">Bill to</p>
            <p className="mt-1 font-medium">{data.client}</p>
            <p className="opacity-60">14 Wharf Road, Bristol</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-65">Due</p>
            <p className="mt-1 font-medium">21 Oct 2026</p>
            <p className="opacity-60">Net 14</p>
          </div>
        </motion.div>
        <ul className="mt-5 border-t border-current/15">
          {data.items.map((it, i) => (
            <motion.li
              key={it.label}
              variants={reduce ? FADE : RISE}
              custom={T.data + i * T.step}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b border-current/10 py-2 text-[13px]"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{it.label}</span>
                <span className="font-mono text-[11px] opacity-65">{it.qty}</span>
              </span>
              <span className="font-mono text-[13px] tabular-nums">{money(data.currency, it.amount)}</span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-65">Total</span>
          <span className="font-display text-[30px] font-semibold tracking-[-0.03em]">
            <Count value={data.total} on={on} reduce={reduce} delay={T.progress} format={(v) => money(data.currency, v, true)} />
          </span>
        </div>
      </Block>
      <Block at={T.progress + 0.1} reduce={reduce} className="mt-4 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] text-(--fs-ink)/65">Rates from your contract with {name}</p>
        <span className="inline-flex h-10 shrink-0 items-center rounded-full bg-(--fs-accent) px-4 text-[13px] font-semibold text-(--fs-on-accent)">Send invoice</span>
      </Block>
    </div>
  );
}

/* 3. Paid: the money arrives, with the invoice's little life story */
function PaidState({ data, on, reduce }: StateProps) {
  const timeline = [
    { label: "Sent", when: "Tue 7 Oct, 09:12" },
    { label: "Opened", when: "Tue 7 Oct, 11:40" },
    { label: "Reminder skipped", when: "Not needed", skipped: true },
    { label: "Paid", when: "Thu 9 Oct, 16:03", last: true },
  ];
  const drawn = on || reduce ? 1 : 0;
  const draw = (delay: number) => (on && !reduce ? { duration: 0.55, delay, ease: EASE } : { duration: 0 });
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-center pt-3 text-center">
        {/* The ring draws round, then the tick draws through it. */}
        <svg viewBox="0 0 72 72" className="size-[72px] -rotate-90" aria-hidden="true">
          <circle cx="36" cy="36" r="34" fill="none" stroke="var(--fs-ink)" strokeOpacity="0.1" strokeWidth="3" />
          <motion.circle cx="36" cy="36" r="34" fill="none" stroke="var(--fs-accent)" strokeWidth="3" strokeLinecap="round" initial={false} animate={{ pathLength: drawn, opacity: drawn }} transition={draw(T.first)} />
          <motion.path
            d="M22 37.5l9.5 9.5L51 27"
            transform="rotate(90 36 36)"
            fill="none"
            stroke="var(--fs-ink)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: drawn, opacity: drawn }}
            transition={draw(T.first + 0.4)}
          />
        </svg>
        <p className="mt-5 font-display text-[clamp(2.5rem,2rem+1.8vw,3.25rem)] font-semibold leading-none tracking-[-0.045em]">
          <Count value={data.total} on={on} reduce={reduce} format={(v) => money(data.currency, v, true)} />
        </p>
        <motion.p variants={reduce ? FADE : RISE} custom={T.figure + 0.1} className="mt-2.5 text-[14px] text-(--fs-ink)/65">
          from {data.client} · <span className="text-(--fs-ink)">12 days early</span>
        </motion.p>
      </div>
      <Block at={T.data} reduce={reduce} className="mt-auto rounded-[16px] border border-(--fs-ink)/10 bg-(--fs-well) px-5 py-2">
        <ol>
          {timeline.map((t, i) => (
            <motion.li
              key={t.label}
              variants={reduce ? FADE : RISE}
              custom={T.data + 0.08 + i * T.step}
              className="flex items-center justify-between gap-4 border-b border-(--fs-ink)/[0.08] py-3 last:border-b-0"
            >
              <span className="flex items-center gap-3 text-[14px]">
                <span className={`size-2 rounded-full ${t.last ? "bg-(--fs-accent)" : t.skipped ? "border border-(--fs-ink)/30" : "bg-(--fs-ink)/40"}`} />
                <span className={t.skipped ? "text-(--fs-ink)/65 line-through decoration-(--fs-ink)/30" : ""}>{t.label}</span>
              </span>
              <span className={`font-mono text-[12px] tabular-nums ${t.last ? "text-(--fs-ink)" : "text-(--fs-ink)/65"}`}>{t.when}</span>
            </motion.li>
          ))}
        </ol>
      </Block>
    </div>
  );
}

/* 4. Set aside: the payment pours into three pots */
function PotsState({ data, on, reduce }: StateProps) {
  const set = data.pots.reduce((a, p) => a + p.share, 0);
  const all = [...data.pots.map((p) => ({ ...p, mine: false })), { label: "Yours", share: Math.max(0, 1 - set), mine: true }];
  return (
    <div className="flex h-full flex-col">
      <Block at={T.first} reduce={reduce} className="flex items-baseline justify-between">
        <p className={`${MONO} tracking-[0.14em] text-(--fs-ink)/65`}>Split on arrival</p>
        <p className="font-mono text-[12px] tabular-nums text-(--fs-ink)/70">{money(data.currency, data.total, true)}</p>
      </Block>
      <div className="mt-5 grid flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${all.length}, minmax(0, 1fr))` }}>
        {all.map((p, i) => (
          <Pot key={p.label} {...p} amount={data.total * p.share} currency={data.currency} on={on} reduce={reduce} index={i} />
        ))}
      </div>
      <Block at={T.progress + 0.2} reduce={reduce} className="mt-5 border-t border-(--fs-ink)/[0.08] pt-4 text-[13px] leading-[1.5] text-(--fs-ink)/65">
        Your January tax bill is <span className="text-(--fs-ink)">fully covered</span>, with {money(data.currency, 312)} to spare.
      </Block>
    </div>
  );
}

function Pot({ label, share, amount, currency, mine, on, reduce, index }: { label: string; share: number; amount: number; currency: string; mine: boolean; on: boolean; reduce: boolean; index: number }) {
  const at = T.figure + index * T.step;
  return (
    <motion.div variants={reduce ? FADE : RISE} custom={at} className="flex min-w-0 flex-col">
      <div className="relative flex flex-1 flex-col justify-end overflow-hidden rounded-[14px] border border-(--fs-ink)/10 bg-(--fs-well)">
        {/* measuring ticks */}
        <div className="absolute inset-x-0 top-0 flex h-full flex-col justify-between py-3" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((t) => (
            <span key={t} className="ml-2 h-px w-2 bg-(--fs-ink)/12" />
          ))}
        </div>
        {/* Pots fill once they've landed; yours is the one in the accent. */}
        <Fill
          on={on}
          reduce={reduce}
          to={Math.max(0.08, share)}
          delay={T.progress + index * T.step}
          className={`relative ${mine ? "bg-(--fs-accent)" : "bg-(--fs-ink)/22"}`}
          style={{ boxShadow: "inset 0 1px 0 color-mix(in oklab, white 45%, transparent)" }}
        />
        <span className={`absolute left-3 top-3 font-mono text-[11px] tabular-nums ${mine ? "text-(--fs-ink)" : "text-(--fs-ink)/65"}`}>{Math.round(share * 100)}%</span>
      </div>
      <p className="mt-3 text-[13px] text-(--fs-ink)/65">{label}</p>
      <p className="truncate font-display text-[19px] font-semibold tracking-[-0.03em]">
        <Count value={amount} on={on} reduce={reduce} delay={T.progress + index * T.step} format={(v) => money(currency, Math.round(v))} />
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo content                                                        */
/* ------------------------------------------------------------------ */

const DEFAULT_STEPS: Step[] = [
  {
    tab: "Track",
    title: "Hit start. Forget it’s running.",
    body: "One timer in your menu bar, tagged to the client and the project. If you wander off, Ferry asks before it bills anyone for your lunch.",
    detail: "Idle detection after 6 minutes",
  },
  {
    tab: "Invoice",
    title: "The invoice writes itself.",
    body: "Hours turn into line items, rates come from the contract, and the PDF looks like you hired a designer. We did, so you don’t have to.",
    detail: "Drafted on the 1st, or whenever you say",
  },
  {
    tab: "Paid",
    title: "Paid by card, bank or a firm reminder.",
    body: "Clients pay in two taps. If they don’t, Ferry nudges them on days 3, 7 and 14, so you never type “just following up” again.",
    detail: "Median time to paid: 4.2 days",
  },
  {
    tab: "Set aside",
    title: "Tax money goes where you can’t spend it.",
    body: "Every payment is split the moment it lands: tax, pension and the part that’s actually yours. January stops being a horror film.",
    detail: "Pots held at a regulated partner bank",
  },
];

const DEFAULT_ITEMS: LineItem[] = [
  { label: "Brand refresh", qty: "24 h × 120", amount: 2880 },
  { label: "Packaging mockups", qty: "10 h × 120", amount: 1200 },
  { label: "Client workshops", qty: "2 h × 100", amount: 200 },
];

const DEFAULT_POTS = [
  { label: "Tax", share: 0.25 },
  { label: "Pension", share: 0.1 },
];

export type FeatureStickyScrollDemoProps = Partial<FeatureStickyScrollProps>;

/** The featured instance: overrides from the Customize panel win over the defaults. */
export default function FeatureStickyScrollDemo(overrides: FeatureStickyScrollDemoProps = {}) {
  return <FeatureStickyScroll {...overrides} />;
}
