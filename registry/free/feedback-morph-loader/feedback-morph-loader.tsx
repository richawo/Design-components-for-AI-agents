"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ types */

export type MorphLoaderStatus = "idle" | "loading" | "success" | "error";
export type MorphLoaderShape = "circle" | "square" | "triangle" | "diamond" | "hexagon";

export type MorphLoaderProps = {
  /** idle rests on the first shape, loading morphs through `shapes`, success folds into a check, error into a cross. */
  status?: MorphLoaderStatus;
  /** Rendered size in px. The drawing scales; the stroke stays `strokeWidth` px at every size. */
  size?: number;
  /** Stroke weight in px at the rendered size. */
  strokeWidth?: number;
  /** Loop speed multiplier. 1 morphs one shape every 0.9 s. */
  speed?: number;
  /** The shapes the loop morphs through, in order. Two or more. */
  shapes?: MorphLoaderShape[];
  /** Ink while idle or loading. Defaults to the text colour. */
  color?: string;
  /** Ink of the check. */
  successColor?: string;
  /** Ink of the cross. */
  errorColor?: string;
  /** Announced while loading, e.g. "Uploading brand-kit.zip". */
  label?: string;
  /** Announced on success. */
  successLabel?: string;
  /** Announced on error. */
  errorLabel?: string;
  /** Announce status changes through a polite live region. Turn off when a parent already announces them. */
  announce?: boolean;
  /** Called once the fold into a check or cross has landed. */
  onSettled?: (status: "success" | "error") => void;
  className?: string;
};

/* ------------------------------------------------------------------ tokens */

const DEFAULT_SHAPES: MorphLoaderShape[] = ["circle", "square", "triangle"];
const SUCCESS = "#6fd08c";
const ERROR = "#ff7a6b";
/** Points per half-stroke. Every shape and glyph is resampled to exactly this, so any two can be interpolated. */
const N = 36;
/** The drawing lives in a 24-unit box, like an icon. */
const BOX = 24;
const C = BOX / 2;
/** Shape radius in box units: leaves room for the round caps of a 3px stroke at 16px. */
const R = 7.4;
/** One shape per segment: it holds, then morphs into the next. */
const SEGMENT_MS = 900;
const HOLD = 0.32;
/** The loop turns once every this many ms, so even a held shape reads as working. */
const TURN_MS = 2600;
/** Fold into a glyph, and back out of one. */
const FOLD_MS = 460;
const UNFOLD_MS = 320;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ geometry */

type Pt = readonly [number, number];
type Stroke = Float32Array; // N points as x0, y0, x1, y1, …

const polygon = (sides: number, phase: number, radius = R): Pt[] =>
  Array.from({ length: sides }, (_, i) => {
    const a = phase + (i / sides) * Math.PI * 2;
    return [C + Math.cos(a) * radius, C + Math.sin(a) * radius] as const;
  });

const TOP = -Math.PI / 2;

/**
 * Closed outlines, each starting at the top centre and running clockwise, so
 * point i of one shape sits near point i of the next and the morph never
 * crosses itself. Polygons are sized for equal visual weight, not equal radius.
 */
const OUTLINES: Record<Exclude<MorphLoaderShape, "circle">, Pt[]> = {
  // Starts mid top edge, so the square's top is flat like the circle's.
  square: [[C, C - 6.4], [C + 6.4, C - 6.4], [C + 6.4, C + 6.4], [C - 6.4, C + 6.4], [C - 6.4, C - 6.4]],
  triangle: polygon(3, TOP, R + 1.1).map(([x, y]) => [x, y + 1.6] as const),
  diamond: polygon(4, TOP, R + 0.6),
  hexagon: polygon(6, TOP, R + 0.3),
};

type Sampler = (s: number) => Pt;

function polylineSampler(points: Pt[]): Sampler {
  const closed = [...points, points[0]];
  const lengths = [0];
  for (let i = 1; i < closed.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(closed[i][0] - closed[i - 1][0], closed[i][1] - closed[i - 1][1]));
  }
  const total = lengths[lengths.length - 1];
  return (s) => {
    const d = (((s % 1) + 1) % 1) * total;
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < d) i++;
    const t = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    const a = closed[i - 1];
    const b = closed[i];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
}

const SAMPLERS: Record<MorphLoaderShape, Sampler> = {
  circle: (s) => [C + Math.cos(TOP + s * Math.PI * 2) * R, C + Math.sin(TOP + s * Math.PI * 2) * R],
  square: polylineSampler(OUTLINES.square),
  triangle: polylineSampler(OUTLINES.triangle),
  diamond: polylineSampler(OUTLINES.diamond),
  hexagon: polylineSampler(OUTLINES.hexagon),
};

/**
 * Half `h` of a shape: h = 0 is the right half (top → bottom), h = 1 the left
 * (bottom → top). `gap` trims both ends, opening the outline into two arcs
 * that chase each other, which is what makes a shape read as a loader.
 */
function half(shape: MorphLoaderShape, h: 0 | 1, gap: number, angle: number, out: Stroke) {
  const sample = SAMPLERS[shape];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let i = 0; i < N; i++) {
    const [x, y] = sample(h * 0.5 + gap + ((0.5 - 2 * gap) * i) / (N - 1));
    const dx = x - C;
    const dy = y - C;
    out[i * 2] = C + dx * cos - dy * sin;
    out[i * 2 + 1] = C + dx * sin + dy * cos;
  }
}

function segment(a: Pt, b: Pt): Stroke {
  const out = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    out[i * 2] = a[0] + (b[0] - a[0]) * t;
    out[i * 2 + 1] = a[1] + (b[1] - a[1]) * t;
  }
  return out;
}

/**
 * The glyphs are two strokes, mapped onto the halves they sit closest to: the
 * right half folds into the check's long leg and the left half into its short
 * one, both meeting at the check's corner (the outline's bottom).
 */
const CHECK_CORNER: Pt = [10.4, 16.1];
const GLYPHS: Record<"success" | "error", [Stroke, Stroke]> = {
  success: [segment([17.4, 8.4], CHECK_CORNER), segment(CHECK_CORNER, [6.7, 12.4])],
  error: [segment([16.6, 7.4], [7.4, 16.6]), segment([16.6, 16.6], [7.4, 7.4])],
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function toPath(p: Stroke) {
  let d = `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  for (let i = 1; i < N; i++) d += `L${p[i * 2].toFixed(2)} ${p[i * 2 + 1].toFixed(2)}`;
  return d;
}

/* ------------------------------------------------------------------ engine */

/** Writes the two strokes straight to the DOM from one rAF loop, which only runs while something moves. */
function useMorph(
  refs: { a: RefObject<SVGPathElement | null>; b: RefObject<SVGPathElement | null>; root: RefObject<HTMLElement | null> },
  status: MorphLoaderStatus,
  shapes: MorphLoaderShape[],
  speed: number,
  reduce: boolean,
  onSettled: ((s: "success" | "error") => void) | undefined,
) {
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const shapesKey = shapes.join(",");
  const state = useRef({
    out: [new Float32Array(N * 2), new Float32Array(N * 2)] as [Stroke, Stroke],
    from: [new Float32Array(N * 2), new Float32Array(N * 2)] as [Stroke, Stroke],
    live: [new Float32Array(N * 2), new Float32Array(N * 2)] as [Stroke, Stroke],
    blendStart: -1,
    blendMs: 0,
    loopStart: 0,
    painted: false,
  });

  useEffect(() => {
    const s = state.current;
    const list = shapes.length >= 2 ? shapes : DEFAULT_SHAPES;
    const settling = status === "success" || status === "error";
    let raf = 0;
    let visible = true;

    const paint = () => {
      refs.a.current?.setAttribute("d", toPath(s.out[0]));
      refs.b.current?.setAttribute("d", toPath(s.out[1]));
    };

    /** The pose this status wants at time `now`, written into s.live. */
    const target = (now: number) => {
      if (settling) {
        const g = GLYPHS[status];
        s.live[0].set(g[0]);
        s.live[1].set(g[1]);
        return;
      }
      if (status === "idle" || reduce) {
        // A still, slightly open outline: at rest, or loading without motion.
        const gap = status === "idle" ? 0 : 0.06;
        half(list[0], 0, gap, 0, s.live[0]);
        half(list[0], 1, gap, 0, s.live[1]);
        return;
      }
      // rAF timestamps can trail the performance.now() the loop started at, so elapsed time is floored at 0.
      const elapsed = Math.max(0, now - s.loopStart) * speed;
      const t = elapsed / SEGMENT_MS;
      const k = Math.floor(t);
      const f = t - k;
      const m = easeInOut(Math.min(1, Math.max(0, (f - HOLD) / (1 - HOLD))));
      const angle = (elapsed / TURN_MS) * Math.PI * 2;
      // The arcs open while the shape travels and close as it lands.
      const gap = 0.025 + 0.075 * Math.sin(Math.PI * m);
      const fromShape = list[k % list.length];
      const toShape = list[(k + 1) % list.length];
      for (const h of [0, 1] as const) {
        half(fromShape, h, gap, angle, scratchA);
        half(toShape, h, gap, angle, scratchB);
        const o = s.live[h];
        for (let i = 0; i < N * 2; i++) o[i] = scratchA[i] + (scratchB[i] - scratchA[i]) * m;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      target(now);
      const p = s.blendStart < 0 ? 1 : Math.min(1, (now - s.blendStart) / s.blendMs);
      const e = settling ? easeInOut(p) : easeOut(p);
      for (const h of [0, 1] as const) {
        const o = s.out[h];
        const f = s.from[h];
        const l = s.live[h];
        for (let i = 0; i < N * 2; i++) o[i] = f[i] + (l[i] - f[i]) * e;
      }
      paint();
      if (p >= 1 && s.blendStart >= 0) {
        s.blendStart = -1;
        if (settling) settledRef.current?.(status);
      }
      const looping = status === "loading" && !reduce;
      if ((looping || s.blendStart >= 0) && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    // Start from wherever the strokes are now, so a change mid-morph never jumps.
    const now = performance.now();
    if (s.painted && !reduce) {
      s.from[0].set(s.out[0]);
      s.from[1].set(s.out[1]);
      s.blendStart = now;
      s.blendMs = settling ? FOLD_MS : UNFOLD_MS;
    } else {
      target(now);
      s.from[0].set(s.live[0]);
      s.from[1].set(s.live[1]);
      s.blendStart = -1;
    }
    if (status === "loading") s.loopStart = now;
    s.painted = true;
    raf = requestAnimationFrame(frame);

    const root = refs.root.current;
    const io = root
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !raf) raf = requestAnimationFrame(frame);
        })
      : null;
    if (root) io?.observe(root);
    const onVisibility = () => {
      if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // shapesKey stands in for the array, so a new array with the same shapes doesn't restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, shapesKey, speed, reduce]);
}

const scratchA = new Float32Array(N * 2);
const scratchB = new Float32Array(N * 2);

/* ------------------------------------------------------------------ component */

export function MorphLoader({
  status = "loading",
  size = 20,
  strokeWidth = 1.75,
  speed = 1,
  shapes = DEFAULT_SHAPES,
  color = "currentColor",
  successColor = SUCCESS,
  errorColor = ERROR,
  label = "Loading",
  successLabel = "Done",
  errorLabel = "Failed",
  announce = true,
  onSettled,
  className = "",
}: MorphLoaderProps) {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLSpanElement>(null);
  const aRef = useRef<SVGPathElement>(null);
  const bRef = useRef<SVGPathElement>(null);
  useMorph({ a: aRef, b: bRef, root: rootRef }, status, shapes, Math.max(0.1, speed), reduce, onSettled);

  // The three inks live on the root as custom properties, so a stylesheet can retheme every loader on a page.
  const ink = status === "success" ? "var(--morph-loader-success)" : status === "error" ? "var(--morph-loader-error)" : "var(--morph-loader-ink)";
  const spoken = status === "success" ? successLabel : status === "error" ? errorLabel : status === "loading" ? label : "";
  const stroke = (strokeWidth * BOX) / Math.max(8, size);

  return (
    <span
      ref={rootRef}
      data-status={status}
      data-speed={speed}
      data-shapes={shapes.join(" ")}
      className={`relative inline-flex shrink-0 align-middle ${className}`}
      style={{ width: size, height: size, "--morph-loader-ink": color, "--morph-loader-success": successColor, "--morph-loader-error": errorColor } as CSSProperties}
    >
      <svg
        viewBox={`0 0 ${BOX} ${BOX}`}
        width={size}
        height={size}
        aria-hidden="true"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`overflow-visible transition-[stroke,opacity] duration-200 ${status === "idle" ? "opacity-45" : "opacity-100"}`}
        style={{ stroke: ink, strokeWidth: stroke } as CSSProperties}
      >
        <path ref={aRef} />
        <path ref={bRef} />
      </svg>
      {announce ? (
        <span role="status" aria-live="polite" className="sr-only">
          {spoken}
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ demo */

type Step = { id: string; label: string; meta: string; ms: number; failsFirst?: boolean };

const STEPS: Step[] = [
  { id: "render", label: "Render 18 pages", meta: "0.8 s", ms: 820 },
  { id: "images", label: "Optimise 46 images", meta: "3.1 MB saved", ms: 820 },
  { id: "purge", label: "Purge the edge cache", meta: "212 PoPs", ms: 900, failsFirst: true },
  { id: "notify", label: "Email 2,481 subscribers", meta: "sent", ms: 820 },
];

/** A beat between the click and the first step, so the reset to "queued" reads before anything loads. */
const START_MS = 260;
const RETRY_GAP_MS = 120;

const STAGE = {
  bg: "#050506",
  card: "#111113",
  ink: "#f4f4f5",
  muted: "#a1a1aa",
  faint: "#8a8a93",
} as const;

const rise: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  show: (i: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE_OUT, delay: 0.06 + i * 0.055 }, transitionEnd: { filter: "none" } }),
};
const fade: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } };

type Phase = "live" | "running" | "failed" | "done";
type Run = { steps: Record<string, MorphLoaderStatus>; phase: Phase };

const allSteps = (status: MorphLoaderStatus) => Object.fromEntries(STEPS.map((s) => [s.id, status]));
/** The card opens on the last release, already live, so a click is what starts the next run. */
const LIVE_RUN: Run = { steps: allSteps("success"), phase: "live" };

/** Runs the steps one after another, failing the one marked failsFirst on the first pass only. */
function useRun() {
  const [run, setRun] = useState<Run>(LIVE_RUN);
  const timers = useRef<number[]>([]);
  const failed = useRef(false);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const runFrom = (index: number, delay: number) => {
    let at = delay;
    for (let i = index; i < STEPS.length; i++) {
      const step = STEPS[i];
      const fails = step.failsFirst && !failed.current;
      timers.current.push(window.setTimeout(() => setRun((r) => ({ phase: "running", steps: { ...r.steps, [step.id]: "loading" } })), at));
      at += step.ms;
      if (fails) {
        timers.current.push(
          window.setTimeout(() => {
            failed.current = true;
            setRun((r) => ({ phase: "failed", steps: { ...r.steps, [step.id]: "error" } }));
          }, at),
        );
        return;
      }
      const last = i === STEPS.length - 1;
      timers.current.push(window.setTimeout(() => setRun((r) => ({ phase: last ? "done" : "running", steps: { ...r.steps, [step.id]: "success" } })), at));
    }
  };

  const publish = () => {
    clear();
    failed.current = false;
    setRun({ steps: allSteps("idle"), phase: "running" });
    runFrom(0, START_MS);
  };

  const retry = () => {
    const index = STEPS.findIndex((s) => run.steps[s.id] === "error");
    if (index < 0) return;
    clear();
    runFrom(index, RETRY_GAP_MS);
  };

  return { run, publish, retry };
}

const COPY: Record<Phase, { eyebrow: string; title: string; sub: string }> = {
  live: { eyebrow: "Release · v4.1", title: "v4.1 is live", sub: "Published yesterday, 18:04 · 3.2 s" },
  running: { eyebrow: "Release · v4.2", title: "Publishing the changelog", sub: "Four steps · about 3 s" },
  failed: { eyebrow: "Release · v4.2", title: "The edge cache didn’t clear", sub: "3 of 4 steps · nothing is live yet" },
  done: { eyebrow: "Release · v4.2", title: "v4.2 is live", sub: "4 of 4 steps · 3.4 s" },
};

const PHASE_OF: Record<MorphLoaderStatus, Phase> = { idle: "live", loading: "running", success: "done", error: "failed" };

/** The tunables every loader on the stage shares, so the Customize panel reads across the whole card. */
type Palette = Pick<MorphLoaderProps, "speed" | "successColor" | "errorColor" | "shapes">;

function StepRow({ step, status, index, palette }: { step: Step; status: MorphLoaderStatus; index: number; palette: Palette }) {
  return (
    <motion.li variants={rise} custom={4 + index} className="flex min-h-11 items-center gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0">
      <span className="grid size-6 place-items-center" style={{ color: STAGE.muted }}>
        <MorphLoader {...palette} status={status} size={16} strokeWidth={1.6} announce={false} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] leading-5 tracking-[-0.01em] transition-colors duration-200" style={{ color: status === "idle" ? STAGE.faint : STAGE.ink }}>
        {step.label}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: status === "error" ? (palette.errorColor ?? ERROR) : STAGE.faint }}>
        {status === "error" ? "timed out" : status === "loading" ? "running" : status === "success" ? step.meta : "queued"}
      </span>
    </motion.li>
  );
}

const BUTTON = "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium tracking-[-0.01em] outline-none transition-[background-color,scale,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111113] active:scale-[0.97]";

/** Demo: a publish run on a quiet card. The featured loader (the specimen) takes the Customize overrides. */
export default function MorphLoaderDemo({ status: forced, ...overrides }: Partial<MorphLoaderProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLElement>(null);
  const inView = useInView(stageRef, { once: true, amount: 0.3 });
  const { run, publish, retry } = useRun();
  const v = reduce ? fade : rise;

  const phase = forced ? PHASE_OF[forced] : run.phase;
  const overall: MorphLoaderStatus = forced ?? (run.phase === "running" ? "loading" : run.phase === "failed" ? "error" : "success");
  const copy = COPY[phase];
  const done = STEPS.filter((s) => run.steps[s.id] === "success").length;
  const palette: Palette = { speed: overrides.speed, successColor: overrides.successColor, errorColor: overrides.errorColor, shapes: overrides.shapes };
  const running = run.phase === "running";

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-14 sm:px-8" style={{ background: STAGE.bg }}>
      <motion.section ref={stageRef} aria-label="Publish run" initial="hidden" animate={inView ? "show" : "hidden"} className="@container w-full max-w-[600px]">
        <motion.div
          variants={v}
          custom={0}
          className="rounded-[18px] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.04),0_40px_80px_-30px_rgba(0,0,0,0.9)] @md:p-7"
          style={{ background: STAGE.card }}
        >
          <div className="flex items-center gap-5 @md:gap-6">
            <motion.div
              variants={v}
              custom={1}
              data-demo="specimen"
              className="grid size-[88px] shrink-0 place-items-center rounded-[14px] bg-white/[0.025] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] @md:size-[104px]"
              style={{ color: STAGE.ink }}
            >
              <MorphLoader size={52} strokeWidth={2.4} label={copy.title} successLabel={copy.title} errorLabel={copy.title} {...overrides} status={overall} />
            </motion.div>
            <div className="min-w-0">
              <motion.p variants={v} custom={2} className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: STAGE.faint }}>
                {copy.eyebrow}
              </motion.p>
              <motion.div variants={v} custom={3} className="relative mt-2 min-h-[56px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={copy.title}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.26, ease: EASE_OUT } }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
                  >
                    <h2 className="text-balance font-display text-[clamp(1.25rem,0.9rem+2.2cqi,1.75rem)] font-medium leading-[1.1] tracking-[-0.03em]" style={{ color: STAGE.ink }}>
                      {copy.title}
                    </h2>
                    <p className="mt-1.5 text-[13px] tabular-nums leading-5" style={{ color: STAGE.muted }}>
                      {copy.sub}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>
          </div>

          <ul aria-label="Steps" className="mt-6">
            {STEPS.map((step, i) => (
              <StepRow key={step.id} step={step} status={run.steps[step.id]} index={i} palette={palette} />
            ))}
          </ul>

          <motion.div variants={v} custom={9} className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
            <p className="font-mono text-[11px] tabular-nums" style={{ color: STAGE.faint }}>
              {done} / {STEPS.length} done
            </p>
            {run.phase === "failed" ? (
              <button type="button" data-demo="retry" onClick={retry} className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${BUTTON} bg-[#f4f4f5] text-[#0b0b0c] hover:bg-white`}>
                Retry step 3
              </button>
            ) : (
              <button
                type="button"
                data-demo="publish"
                disabled={running}
                onClick={publish}
                className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 ${BUTTON} text-[#f4f4f5] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
              >
                {running ? (
                  <>
                    <MorphLoader {...palette} size={14} strokeWidth={1.5} announce={false} />
                    Publishing
                  </>
                ) : run.phase === "live" ? (
                  "Publish v4.2"
                ) : (
                  "Publish again"
                )}
              </button>
            )}
          </motion.div>
        </motion.div>
      </motion.section>
    </div>
  );
}
