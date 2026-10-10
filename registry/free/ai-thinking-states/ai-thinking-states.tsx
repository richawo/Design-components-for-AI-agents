"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type AiThinkingVariant = "shimmer" | "matrix" | "steps";

export type AiThinkingStatesProps = {
  /** shimmer runs a highlight along the label; matrix pulses a 3×3 dot grid; steps lights three ticks in turn. */
  variant?: AiThinkingVariant;
  /** The honest state in plain words, such as “Searching 12 sources…”. Cross-fades when it changes. */
  label?: string;
  /**
   * Every state the indicator will show, so the line keeps its width while it cycles. The widest one
   * sets the width. A label outside this list still renders, but the width then follows it.
   */
  reserve?: readonly string[];
  /** Multiplies the tempo. 2 runs twice as fast, 0.5 at half speed. Changing it keeps each element's place in its loop. */
  speed?: number;
  /** sm sits inside a button or a dense row; md sits inside a message. */
  size?: "sm" | "md";
  /** Freezes the indicator on the frame it is showing. */
  paused?: boolean;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ink for the lit dot, the comet's head and the shimmer's highlight; body for the settled label and the
 * tick glyph; base for the shimmer's resting text and the comet's tail; rest for unlit dots.
 */
const PALETTE = {
  dark: { ink: "#f4f4f5", body: "#c6c6cc", base: "#8a8a93", rest: "#45454d" },
  light: { ink: "#18181b", body: "#3f3f46", base: "#71717a", rest: "#c4c4ca" },
} as const;

const SIZES = {
  sm: { text: "text-[13px] leading-5", gap: 8, dot: 3, pitch: 2, tickW: 2, tickH: 7, tickGap: 3 },
  md: { text: "text-[15px] leading-6", gap: 10, dot: 4, pitch: 3, tickW: 2, tickH: 8, tickGap: 4 },
} as const;

type Size = (typeof SIZES)[keyof typeof SIZES];

/** One full loop per variant, in ms. `speed` is applied as a playback rate, not baked into the cycle. */
const CYCLE_MS = { shimmer: 2200, matrix: 1200, steps: 1500 } as const;

/** The ring of the 3×3 grid, clockwise from the top left, as grid indices. */
const RING = [0, 1, 2, 5, 8, 7, 6, 3];
/** Each grid cell's place on the ring, or -1 for the centre. */
const RING_POS = Array.from({ length: 9 }, (_, i) => RING.indexOf(i));
/** The centre lights halfway round, so it answers the sweep rather than leading it. */
const CORE_PHASE = 0.5;
/** Still frame under reduced motion: the top row as a short comet, head first. */
const STILL_COMET = ["var(--ats-ink)", "var(--ats-body)", "var(--ats-base)"] as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SWAP = { duration: 0.26, ease: EASE_OUT } as const;

const LABEL_CLASS = "block font-sans font-medium tracking-[-0.01em]";
const NO_LABELS: readonly string[] = [];

/**
 * Keyframes and state rules, namespaced to the component and injected once per document (React 19
 * dedupes a `<style precedence>` by href). Tempo and play state are variables set on the root, so
 * `paused` freezes every loop on its current frame. Negative delays (phase − 1) start each element
 * mid-loop, so nothing waits on mount.
 */
const CSS = `
@keyframes ats-sweep { from { background-position: 100% 50%; } to { background-position: 0% 50%; } }
@keyframes ats-dot {
  0% { background-color: var(--ats-rest); transform: scale(0.82); }
  18% { background-color: var(--ats-ink); transform: scale(1); }
  30% { background-color: var(--ats-body); transform: scale(0.92); }
  42% { background-color: var(--ats-base); transform: scale(0.86); }
  50%, 100% { background-color: var(--ats-rest); transform: scale(0.82); }
}
@keyframes ats-tick {
  0% { opacity: 0.28; }
  16% { opacity: 1; }
  33%, 100% { opacity: 0.28; }
}
.ats-shimmer { color: var(--ats-base); }
.ats-live .ats-shimmer {
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  background-image: linear-gradient(100deg, var(--ats-base) 0%, var(--ats-base) 44%, var(--ats-ink) 50%, var(--ats-base) 56%, var(--ats-base) 100%);
  background-size: 250% 100%;
  background-repeat: no-repeat;
  animation: ats-sweep var(--ats-cycle) linear infinite;
  animation-play-state: var(--ats-play);
}
.ats-dot { background-color: var(--ats-rest); }
.ats-live .ats-dot.is-ring,
.ats-live .ats-dot.is-core {
  animation: ats-dot var(--ats-cycle) ease-in-out infinite both;
  animation-play-state: var(--ats-play);
  animation-delay: calc(var(--ats-cycle) * (var(--ats-phase) - 1));
}
.ats-tick { background-color: var(--ats-body); opacity: 0.28; }
.ats-live .ats-tick {
  animation: ats-tick var(--ats-cycle) ease-in-out infinite both;
  animation-play-state: var(--ats-play);
  animation-delay: calc(var(--ats-cycle) * (var(--ats-phase) - 1));
}
@supports not ((background-clip: text) or (-webkit-background-clip: text)) {
  .ats-live .ats-shimmer { color: var(--ats-ink); background: none; animation: none; }
}
`;

/* ------------------------------------------------------------------ */
/* Indicators                                                           */
/* ------------------------------------------------------------------ */

/** A 3×3 grid whose outer ring lights in turn: a three-dot comet with a slower centre. */
function DotMatrix({ size, reduce }: { size: Size; reduce: boolean }) {
  const box = size.dot * 3 + size.pitch * 2;
  return (
    <span aria-hidden="true" className="grid shrink-0 grid-cols-3" style={{ width: box, height: box, gap: size.pitch }}>
      {RING_POS.map((pos, i) => {
        const core = pos < 0;
        const still = reduce && pos >= 0 && pos < STILL_COMET.length ? STILL_COMET[pos] : undefined;
        const phase = core ? CORE_PHASE : pos / RING.length;
        return (
          <span
            key={i}
            className={`ats-dot rounded-full ${core ? "is-core" : "is-ring"}`}
            style={{ width: size.dot, height: size.dot, backgroundColor: still, "--ats-phase": phase } as CSSProperties}
          />
        );
      })}
    </span>
  );
}

/**
 * Three short ticks that light one at a time, in body colour. They carry no fill and no total, so
 * they read as "still working" rather than as a meter, and never out-shine the text beside them.
 */
function StepTicks({ size, reduce }: { size: Size; reduce: boolean }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center" style={{ gap: size.tickGap }}>
      {[0, 1, 2].map((k) => (
        <span
          key={k}
          className="ats-tick rounded-full"
          style={{
            width: size.tickW,
            height: size.tickH,
            opacity: reduce ? (k === 0 ? 1 : 0.35) : undefined,
            "--ats-phase": k / 3,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** True for the animations this component owns, so the tempo never touches a motion.dev transition. */
function isOwnAnimation(animation: Animation): animation is CSSAnimation {
  return typeof CSSAnimation !== "undefined" && animation instanceof CSSAnimation && animation.animationName.startsWith("ats-");
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

/**
 * A working indicator for an AI reply. The label is the source of truth: the component
 * shows whatever state it is given and never invents progress.
 */
export function AiThinkingStates({
  variant = "shimmer",
  label = "Reading files…",
  reserve = NO_LABELS,
  speed = 1,
  size = "md",
  paused = false,
  theme = "dark",
  className = "",
}: AiThinkingStatesProps) {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLSpanElement>(null);
  const palette = PALETTE[theme];
  const dim = SIZES[size];
  const tempo = Math.min(4, Math.max(0.25, speed));
  const vars = {
    "--ats-ink": palette.ink,
    "--ats-body": palette.body,
    "--ats-base": palette.base,
    "--ats-rest": palette.rest,
    "--ats-cycle": `${CYCLE_MS[variant]}ms`,
    "--ats-play": paused ? "paused" : "running",
    gap: dim.gap,
  } as CSSProperties;
  // Loops only exist when motion is allowed; reduced motion keeps the still frames.
  const live = reduce ? "" : "ats-live";
  const glyph = variant !== "shimmer";
  const labelColour = variant === "shimmer" ? undefined : { color: "var(--ats-body)" };

  // Tempo is a playback rate on the running loops. Changing the cycle instead would move every
  // element to a new point in its loop; a rate keeps each one exactly where it is.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof root.getAnimations !== "function") return;
    for (const animation of root.getAnimations({ subtree: true })) {
      if (isOwnAnimation(animation)) animation.playbackRate = tempo;
    }
  });

  return (
    <span
      ref={rootRef}
      data-variant={variant}
      data-tempo={tempo}
      className={`ats-root inline-flex max-w-full items-center align-middle ${live} ${dim.text} ${glyph ? "ms-[0.5em]" : ""} ${className}`}
      style={vars}
    >
      <style href="ats-thinking-states" precedence="default">
        {CSS}
      </style>
      {variant === "matrix" && <DotMatrix size={dim} reduce={reduce} />}
      {variant === "steps" && <StepTicks size={dim} reduce={reduce} />}
      <span aria-hidden="true" className="relative inline-grid max-w-full">
        {/* Every reserved state sits in the same grid cell, invisible, so the width never follows the label. */}
        {reserve.map((text) => (
          <span key={text} className={`${LABEL_CLASS} invisible col-start-1 row-start-1`}>
            {text}
          </span>
        ))}
        {/* Old and new labels share that cell too, so the line never reflows while it cross-fades. */}
        <AnimatePresence initial={false}>
          <motion.span
            key={label}
            className={`${LABEL_CLASS} col-start-1 row-start-1`}
            style={labelColour}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.16, ease: EASE_IN } }}
            transition={reduce ? { duration: 0.15 } : SWAP}
          >
            {variant === "shimmer" ? <span className="ats-shimmer">{label}</span> : label}
          </motion.span>
        </AnimatePresence>
      </span>
      {/* The state is announced once per change, from a single polite region. */}
      <span role="status" className="sr-only">
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: a reply being written, a button that stops it, and the variant switch.           */
/* ------------------------------------------------------------------ */

const DEMO_PHASES = ["Reading files…", "Searching 12 sources…", "Writing…"] as const;
const PHASE_MS = 2400;
const STOPPED_TEXT = "Stopped · draft kept";

const VARIANTS: { value: AiThinkingVariant; label: string }[] = [
  { value: "shimmer", label: "Shimmer" },
  { value: "matrix", label: "Matrix" },
  { value: "steps", label: "Steps" },
];

const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

const STAGE = {
  dark: {
    page: "#000000",
    surface: "#0e0e10",
    line: "#232327",
    rule: "#1b1b1e",
    body: "#c6c6cc",
    meta: "#8a8a93",
    ink: "#f4f4f5",
    chip: "#1b1b1e",
    chipOn: "#2a2a30",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 32px 80px -32px rgba(0,0,0,0.9)",
  },
  light: {
    page: "#f4f4f5",
    surface: "#ffffff",
    line: "#e4e4e7",
    rule: "#efeff1",
    body: "#3f3f46",
    meta: "#71717a",
    ink: "#18181b",
    chip: "#f0f0f2",
    chipOn: "#ffffff",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
  },
} as const;

export default function AiThinkingStatesDemo({ variant: forcedVariant, label: forcedLabel, ...overrides }: Partial<AiThinkingStatesProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const theme = overrides.theme ?? "dark";
  const paused = overrides.paused ?? false;
  const [variant, setVariant] = useState<AiThinkingVariant>(forcedVariant ?? "shimmer");
  const [phase, setPhase] = useState(0);
  // Bumped on every variant pick, so the phase clock restarts from that click.
  const [clock, setClock] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [stopHover, setStopHover] = useState(false);
  // The phase holds on its first state until the demo's first pick, so every run opens on "Reading files…"
  // rather than wherever a mount-time timer happened to be.
  const [started, setStarted] = useState(false);

  // The panel control sets the variant; a click in the stage changes it in place.
  useEffect(() => {
    setVariant(forcedVariant ?? "shimmer");
  }, [forcedVariant]);

  // A pinned label, a stopped reply, pause or reduced motion all hold the cycle still.
  const cycling = !reduce && !paused && !stopped && started && forcedLabel === undefined;
  useEffect(() => {
    if (!cycling) return;
    const id = window.setInterval(() => setPhase((n) => (n + 1) % DEMO_PHASES.length), PHASE_MS);
    return () => window.clearInterval(id);
    // `clock` restarts the interval after a click; it is not read inside the effect.
  }, [cycling, clock]);

  // Each pick is a beat of the demo: the phase moves on and the timer restarts, so every click lands a cross-fade.
  const pickVariant = (next: AiThinkingVariant) => {
    setStarted(true);
    setStopped(false);
    if (next === variant) return;
    setVariant(next);
    setPhase((n) => (n + 1) % DEMO_PHASES.length);
    setClock((c) => c + 1);
  };

  const label = forcedLabel ?? DEMO_PHASES[phase];
  const s = STAGE[theme];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12 sm:px-8" style={{ background: s.page }}>
      <motion.article
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT }}
        className="@container w-full max-w-[540px] rounded-[20px] border p-5 @md:p-8"
        style={{ background: s.surface, borderColor: s.line, boxShadow: s.shadow }}
      >
        <p className="font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: s.meta }}>
          Research run · 14:02
        </p>
        <p className="mt-5 text-[15px] leading-7 text-pretty" style={{ color: s.body }}>
          Three Q3 reports cover churn, so I’m checking each figure against its source before drafting the board summary.{" "}
          {stopped ? (
            <motion.span
              data-demo="stopped"
              initial={reduce ? false : { opacity: 0, filter: "blur(3px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={SWAP}
              className="inline-block"
            >
              {STOPPED_TEXT}
            </motion.span>
          ) : (
            <AiThinkingStates variant={variant} label={label} reserve={DEMO_PHASES} {...overrides} />
          )}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t pt-5" style={{ borderColor: s.rule }}>
          <p className="text-[13px] leading-5" style={{ color: s.meta }}>
            {stopped ? "Resume picks up from this point." : "Stop keeps the draft so far."}
          </p>
          <button
            type="button"
            data-demo="stop"
            onClick={() => setStopped((v) => !v)}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setStopHover(true);
            }}
            onPointerLeave={() => setStopHover(false)}
            className="inline-flex h-11 items-center gap-2.5 rounded-[10px] px-3.5 text-[13px] font-medium transition-[background-color,scale] duration-[90ms] ease-out active:scale-[0.97] @md:h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            style={{ background: stopHover ? s.chipOn : s.chip, boxShadow: `inset 0 0 0 1px ${s.line}`, color: s.ink }}
          >
            {stopped ? (
              <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5" style={{ fill: s.ink }}>
                <path d="M2 1 L9 5 L2 9 Z" />
              </svg>
            ) : (
              <span aria-hidden="true" className="block size-2.5 rounded-[2px]" style={{ background: s.ink }} />
            )}
            <span>{stopped ? "Resume" : "Stop"}</span>
          </button>
        </div>
      </motion.article>

      <div role="group" aria-label="Indicator variant" className="relative inline-flex rounded-[11px] p-1" style={{ background: s.surface, boxShadow: `inset 0 0 0 1px ${s.line}` }}>
        {VARIANTS.map((v) => {
          const on = v.value === variant;
          return (
            <button
              key={v.value}
              type="button"
              data-demo={`variant-${v.value}`}
              aria-pressed={on}
              onClick={() => pickVariant(v.value)}
              className="relative min-h-11 rounded-[8px] px-3.5 text-[13px] font-medium transition-colors duration-150 ease-out sm:min-h-0 sm:py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              style={{ color: on ? s.ink : s.meta }}
            >
              {on && <motion.span layoutId="ats-variant" className="absolute inset-0 rounded-[8px]" style={{ background: s.chipOn }} transition={SPRING_UI} />}
              <span className="relative">{v.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
