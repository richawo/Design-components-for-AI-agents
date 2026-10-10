"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type AgentState = "thinking" | "searching" | "writing" | "listening" | "syncing" | "done" | "error" | "idle";

export type PixelStatusProps = {
  state: AgentState;
  /** Rendered size in px (the glyph is a 9×9 grid). */
  size?: number;
  /** Override the state’s colour. Work-in-progress states use currentColor, so they follow your text. */
  color?: string;
  /** Show the unlit grid behind the glyph. */
  grid?: boolean;
  /** Accessible label; defaults to the state name. */
  label?: string;
  /** Change this value to replay the animation from its first frame. */
  replay?: number;
  /** Hold the glyph dark (grid only) until true: lets a glyph power on once it has arrived. */
  active?: boolean;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const N = 9; // cells per side
const FPS = 10; // stepped on purpose: smooth tweening would break the pixel feel
const CELL = 10; // viewBox units per cell
const DOT = { small: { size: 8.4, radius: 1.2 }, large: { size: 7.6, radius: 1.8 }, smallBelow: 28, glowFrom: 40 } as const;
const LIT = { floor: 0.25, gridOpacity: 0.07, glowOpacity: 0.55, glowBlur: 2.4 } as const;

/**
 * Monochrome first: work in progress is drawn in currentColor (white on dark, ink on light),
 * idle is a quiet grey, and only the outcomes carry colour, because they mean something.
 */
export const STATE_COLORS: Record<AgentState, string> = {
  thinking: "currentColor",
  searching: "currentColor",
  writing: "currentColor",
  listening: "currentColor",
  syncing: "currentColor",
  done: "#34d399",
  error: "#f87171",
  idle: "#a1a1aa",
};

const LABELS: Record<AgentState, string> = {
  thinking: "Thinking",
  searching: "Searching",
  writing: "Writing",
  listening: "Listening",
  syncing: "Syncing",
  done: "Done",
  error: "Needs attention",
  idle: "Idle",
};

/* ------------------------------------------------------------------ */
/* Glyphs                                                               */
/* ------------------------------------------------------------------ */

type Px = Map<number, number>; // index → intensity 0–1
const at = (x: number, y: number) => y * N + x;
const put = (m: Px, x: number, y: number, v = 1) => {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  m.set(at(x, y), Math.max(m.get(at(x, y)) ?? 0, v));
};

// A 16-cell square loop around the centre, clockwise from the top-left.
const LOOP: [number, number][] = [
  [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [6, 3], [6, 4], [6, 5],
  [6, 6], [5, 6], [4, 6], [3, 6], [2, 6], [2, 5], [2, 4], [2, 3],
];
// A 20-cell ring of radius ~3.4 for the sync arrows.
const RING: [number, number][] = [
  [4, 1], [5, 1], [6, 2], [7, 3], [7, 4], [7, 5], [6, 6], [5, 7], [4, 7], [3, 7],
  [2, 6], [1, 5], [1, 4], [1, 3], [2, 2], [3, 1],
];
const CHECK: [number, number][] = [[1, 4], [2, 5], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2]];
const LENS: [number, number][] = [[2, 1], [3, 1], [4, 1], [1, 2], [5, 2], [1, 3], [5, 3], [1, 4], [5, 4], [2, 5], [3, 5], [4, 5]];

/** Each glyph is a pure function of the frame number, so it is cheap and deterministic. */
function glyph(state: AgentState, f: number): Px {
  const m: Px = new Map();
  switch (state) {
    case "thinking": {
      // A comet circles a steady core.
      put(m, 4, 4, 0.55);
      const head = f % LOOP.length;
      for (let k = 0; k < 5; k++) {
        const [x, y] = LOOP[(head - k + LOOP.length) % LOOP.length];
        put(m, x, y, [1, 0.6, 0.35, 0.18, 0.08][k]);
      }
      break;
    }
    case "searching": {
      // The lens drifts on a small loop; a glint crosses the glass.
      const path: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
      const [ox, oy] = path[Math.floor(f / 6) % 4];
      for (const [x, y] of LENS) put(m, x + ox, y + oy);
      for (let k = 0; k < 3; k++) put(m, 5 + k + ox, 5 + k + oy, k === 0 ? 0.7 : 1);
      const g = f % 12;
      if (g < 4) put(m, 2 + Math.min(g, 2) + ox, 2 + Math.max(0, g - 2) + oy, 0.85);
      break;
    }
    case "writing": {
      // Three lines type out left to right, with a blinking block cursor.
      const lines: [number, number][] = [[2, 7], [4, 5], [6, 6]];
      const total = lines.reduce((a, [, len]) => a + len, 0);
      const cycle = total + 14;
      let n = Math.min(total, f % cycle);
      let cx = 1;
      let cy = 2;
      for (const [y, len] of lines) {
        const typed = Math.min(len, n);
        for (let x = 0; x < typed; x++) put(m, 1 + x, y, 0.8);
        if (n > 0 || typed > 0) {
          cx = 1 + typed;
          cy = y;
        }
        n -= typed;
        if (n <= 0) break;
      }
      if (Math.floor(f / 4) % 2 === 0) put(m, Math.min(N - 1, cx), cy, 1);
      break;
    }
    case "listening": {
      // A mirrored voice waveform around the middle row.
      for (let i = 0; i < 4; i++) {
        const x = 1 + i * 2;
        const h = Math.round(1 + 3 * Math.abs(Math.sin(f * 0.45 + i * 1.3) * Math.cos(f * 0.21 + i * 0.7)));
        for (let k = -h; k <= h; k++) put(m, x, 4 + k, k === 0 ? 1 : 1 - Math.abs(k) * 0.14);
      }
      break;
    }
    case "syncing": {
      // Two arcs chase each other round the ring, each with a brighter head.
      const len = RING.length;
      for (const start of [0, len / 2]) {
        const head = (f + start) % len;
        for (let k = 0; k < 6; k++) {
          const [x, y] = RING[(head - k + len) % len];
          put(m, x, y, k === 0 ? 1 : 0.75 - k * 0.1);
        }
      }
      put(m, 4, 4, 0.25);
      break;
    }
    case "done": {
      // The check draws once, then holds; a ring flashes as it lands.
      const drawn = Math.min(CHECK.length, f);
      for (let i = 0; i < drawn; i++) put(m, CHECK[i][0], CHECK[i][1]);
      const flash = f - CHECK.length;
      if (flash >= 0 && flash < 6) for (const [x, y] of RING) put(m, x, y, 0.5 - flash * 0.08);
      break;
    }
    case "error": {
      // An exclamation that shakes every three seconds.
      const phase = f % 30;
      const dx = phase < 6 ? [0, -1, 1, -1, 1, 0][phase] : 0;
      for (let y = 1; y <= 5; y++) put(m, 4 + dx, y, 1);
      put(m, 4 + dx, 7, 1);
      break;
    }
    case "idle": {
      // A sleep light: a soft core that breathes in and out every 4s, with a
      // halo that only appears near the top of the breath. Calm, unmistakably
      // "on but waiting", and never fully dark.
      const b = 0.5 - 0.5 * Math.cos((2 * Math.PI * (f % 40)) / 40);
      const core = 0.22 + 0.78 * b;
      put(m, 4, 4, core);
      for (const [x, y] of [[3, 4], [5, 4], [4, 3], [4, 5]] as const) put(m, x, y, core * 0.62);
      for (const [x, y] of [[3, 3], [5, 3], [3, 5], [5, 5]] as const) put(m, x, y, core * 0.32);
      if (b > 0.55) {
        const halo = (b - 0.55) / 0.45;
        for (const [x, y] of [[2, 4], [6, 4], [4, 2], [4, 6]] as const) put(m, x, y, halo * 0.22);
      }
      break;
    }
  }
  return m;
}

/** A representative still for reduced motion. */
const STILL: Record<AgentState, number> = { thinking: 3, searching: 2, writing: 11, listening: 4, syncing: 3, done: 99, error: 10, idle: 20 };

const DARK: Px = new Map();

/* ------------------------------------------------------------------ */
/* PixelStatus                                                          */
/* ------------------------------------------------------------------ */

/**
 * A 10fps frame clock that paints straight into the SVG, so animating never re-renders React.
 * Paused offscreen and in hidden tabs; one still frame with reduced motion.
 */
function usePixelClock(ref: RefObject<SVGSVGElement | null>, state: AgentState, replay: number, active: boolean, paint: (lit: Px) => void) {
  const latest = useRef(paint);
  useEffect(() => {
    latest.current = paint;
  });

  useEffect(() => {
    if (!active) {
      latest.current(DARK);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      latest.current(glyph(state, STILL[state]));
      return;
    }
    let frame = 0;
    latest.current(glyph(state, frame));
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (ref.current) io.observe(ref.current);
    const id = window.setInterval(() => {
      if (!visible || document.hidden) return;
      frame += 1;
      latest.current(glyph(state, frame));
    }, 1000 / FPS);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [ref, state, replay, active]);
}

export function PixelStatus({ state, size = 24, color, grid = true, label, replay = 0, active = true, className = "" }: PixelStatusProps) {
  const ref = useRef<SVGSVGElement>(null);
  const dots = useRef<(SVGRectElement | null)[]>([]);
  const glows = useRef<(SVGRectElement | null)[]>([]);
  const filterId = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-glow`;
  const c = color ?? STATE_COLORS[state];
  const dot = size < DOT.smallBelow ? DOT.small : DOT.large;
  const glow = size >= DOT.glowFrom;
  const inset = (CELL - dot.size) / 2;

  /** One cell’s look: lit in the state colour, unlit as a faint grid dot, or nothing. */
  const look = (v: number | undefined) =>
    v !== undefined ? { fill: c, opacity: LIT.floor + v * (1 - LIT.floor) } : { fill: "currentColor", opacity: grid ? LIT.gridOpacity : 0 };

  usePixelClock(ref, state, replay, active, (lit) => {
    for (let i = 0; i < N * N; i++) {
      const v = lit.get(i);
      const { fill, opacity } = look(v);
      dots.current[i]?.setAttribute("fill", fill);
      dots.current[i]?.setAttribute("opacity", String(opacity));
      glows.current[i]?.setAttribute("opacity", String(v ?? 0));
    }
  });

  // The first paint renders from props (frame 0, or dark); every later frame is written by the clock.
  const first = active ? glyph(state, 0) : DARK;
  return (
    <svg ref={ref} viewBox={`0 0 ${N * CELL} ${N * CELL}`} width={size} height={size} role="img" aria-label={label ?? LABELS[state]} className={`shrink-0 ${className}`}>
      {glow && (
        <>
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={LIT.glowBlur} />
            </filter>
          </defs>
          <g filter={`url(#${filterId})`} opacity={LIT.glowOpacity} fill={c}>
            {Array.from({ length: N * N }, (_, i) => (
              <rect
                key={i}
                ref={(el) => {
                  glows.current[i] = el;
                }}
                x={(i % N) * CELL}
                y={Math.floor(i / N) * CELL}
                width={CELL}
                height={CELL}
                opacity={first.get(i) ?? 0}
              />
            ))}
          </g>
        </>
      )}
      {Array.from({ length: N * N }, (_, i) => (
        <rect
          key={i}
          ref={(el) => {
            dots.current[i] = el;
          }}
          x={(i % N) * CELL + inset}
          y={Math.floor(i / N) * CELL + inset}
          width={dot.size}
          height={dot.size}
          rx={dot.radius}
          {...look(first.get(i))}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery: the set, plus a glyph used inline in a live agent run       */
/* ------------------------------------------------------------------ */

const PALETTE = {
  surface: "#0b0b0c",
  tile: "#0b0b0c",
  tileHover: "#111113",
  line: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.06)",
  ink: "#f4f4f5",
  muted: "#a1a1aa",
  faint: "#8a8a93",
  pill: "rgba(255,255,255,0.03)",
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 12, // px
  blur: 8, // px
  block: 0.45,
  step: 0.06, // eyebrow → title → run pill
  tilesAt: 0.2,
  tileStep: 0.04, // reading order, left to right, top to bottom
  powerOn: 0.12, // a glyph lights once its tile is nearly down
  runStepMs: 2600,
  copiedMs: 1400,
  fade: 0.15,
} as const;

const STATES: { state: AgentState; note: string }[] = [
  { state: "thinking", note: "Planning before acting" },
  { state: "searching", note: "Reading docs or the web" },
  { state: "writing", note: "Producing code or prose" },
  { state: "listening", note: "Voice input is live" },
  { state: "syncing", note: "Pushing or pulling changes" },
  { state: "done", note: "Draws once, then holds" },
  { state: "error", note: "Shakes every three seconds" },
  { state: "idle", note: "Waiting for the next task" },
];

/** What the run row says when a state is held (the other three have no step in the run). */
const HELD_TEXT: Record<AgentState, string> = {
  thinking: "Planning the migration",
  searching: "Reading the Postgres 17 release notes",
  writing: "Writing 0042_split_orders.sql",
  listening: "Listening for the next instruction",
  syncing: "Pushing branch orders-split",
  done: "Migration ready for review",
  error: "Tests failed: 2 need attention",
  idle: "Waiting for the next task",
};

const RUN: { state: AgentState; text: string }[] = [
  { state: "thinking", text: "Planning the migration" },
  { state: "searching", text: "Reading the Postgres 17 release notes" },
  { state: "writing", text: "Writing 0042_split_orders.sql" },
  { state: "syncing", text: "Pushing branch orders-split" },
  { state: "done", text: "Migration ready for review" },
];

function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

/** False until `delay` seconds after `play`. Reduced motion: as soon as play is true. */
function useAfter(play: boolean, delay: number, reduce: boolean) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!play || done) return;
    const t = setTimeout(() => setDone(true), reduce ? 0 : delay * 1000);
    return () => clearTimeout(t);
  }, [play, delay, reduce, done]);
  return done;
}

/** Steps through the demo run, starting once the gallery has arrived. */
function useRunStep(start: boolean, reduce: boolean, held?: AgentState) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!start || reduce || held) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % (RUN.length + 1)), MOTION.runStepMs);
    return () => window.clearInterval(id);
  }, [start, reduce, held]);
  return held ? { state: held, text: HELD_TEXT[held] } : RUN[Math.min(step, RUN.length - 1)];
}

export type PixelAgentStatusProps = {
  /** Hold the run row on this state instead of stepping through the demo run. */
  state?: AgentState;
  /** Glyph size in the gallery tiles, in px. */
  size?: number;
  /** Tint for the work-in-progress glyphs; done and error keep their outcome colours. */
  color?: string;
  /** Show the faint unlit dots behind each tile’s glyph. */
  grid?: boolean;
  className?: string;
};

export function PixelAgentStatus({ state: heldState, size = 96, color, grid = true, className = "" }: PixelAgentStatusProps) {
  const held = heldState && heldState in HELD_TEXT ? heldState : undefined; // anything else (e.g. "auto") resumes the run
  const reduce = useReducedMotion() ?? false;
  const root = useRef<HTMLElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });
  const lastTile = MOTION.tilesAt + (STATES.length - 1) * MOTION.tileStep + MOTION.block;
  const settled = useAfter(play, lastTile, reduce);
  const current = useRunStep(settled, reduce, held);
  const pillLive = useAfter(play, MOTION.step * 3 + MOTION.powerOn, reduce);

  return (
    <motion.section
      ref={root}
      {...enter(play, 0, reduce)}
      style={{ background: PALETTE.surface, borderColor: PALETTE.line, color: PALETTE.ink, "--pas-hover": PALETTE.tileHover } as CSSProperties}
      className={`@container w-full rounded-[22px] border p-5 font-sans antialiased shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] @xl:p-7 ${className}`}
    >
      <header className="flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between">
        <div>
          <motion.p {...enter(play, MOTION.step, reduce)} className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: PALETTE.faint }}>
            Pixel status · 9×9
          </motion.p>
          <motion.h2 {...enter(play, MOTION.step * 2, reduce)} className="mt-2 text-balance text-[clamp(1.5rem,1.1rem+1.6cqi,2rem)] font-medium tracking-[-0.035em]">
            Eight states your agent can be in.
          </motion.h2>
        </div>
        {/* Inline usage: the glyph at text size in a live run row. */}
        <motion.div
          {...enter(play, MOTION.step * 3, reduce)}
          className="flex min-w-0 items-center gap-3 overflow-hidden rounded-full border py-2 pl-2.5 pr-4 @2xl:max-w-[60%]"
          style={{ borderColor: PALETTE.line, background: PALETTE.pill }}
          aria-live="polite"
        >
          <PixelStatus state={current.state} size={18} grid={false} active={pillLive} />
          <span className="shrink-0 text-[13px]" style={{ color: PALETTE.faint }}>
            Atlas ·
          </span>
          <span className="relative block min-w-0 flex-1">
            {/* Each step slides up and out of focus as the next arrives. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={current.text}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(3px)", transition: { duration: 0.2, ease: EASE_IN } }}
                transition={{ duration: 0.32, ease: EASE_OUT }}
                className="block truncate text-[13px]"
                style={{ color: PALETTE.muted }}
              >
                {current.text}
                {current.state !== "done" ? "…" : ""}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.div>
      </header>

      {/* Hairlines come from each tile’s own 1px ring (into the 1px gap), so they arrive with the tiles instead of sitting there as an empty grey panel. */}
      <ul className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border @2xl:grid-cols-4" style={{ borderColor: PALETTE.divider }}>
        {STATES.map(({ state, note }, i) => {
          const delay = MOTION.tilesAt + i * MOTION.tileStep;
          return (
            <motion.li key={state} {...enter(play, delay, reduce)} style={{ background: PALETTE.tile, boxShadow: `0 0 0 1px ${PALETTE.divider}` }}>
              <Tile state={state} note={note} reduce={reduce} powerOnAt={delay + MOTION.powerOn} play={play} size={size} color={color} grid={grid} />
            </motion.li>
          );
        })}
      </ul>
    </motion.section>
  );
}

/** A gallery tile: its glyph powers on as the tile lands; hover replays it, click copies its usage. */
function Tile({
  state,
  note,
  reduce,
  powerOnAt,
  play,
  size,
  color,
  grid,
}: {
  state: AgentState;
  note: string;
  reduce: boolean;
  powerOnAt: number;
  play: boolean;
  size: number;
  color?: string;
  grid: boolean;
}) {
  const [replay, setReplay] = useState(0);
  const [copied, setCopied] = useState(false);
  const on = useAfter(play, powerOnAt, reduce);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const snippet = `<PixelStatus state="${state}" />`;
  return (
    <button
      type="button"
      data-demo={`tile-${state}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && setReplay((r) => r + 1)}
      onFocus={() => setReplay((r) => r + 1)}
      onClick={() => {
        void navigator.clipboard?.writeText(snippet).catch(() => undefined);
        setCopied(true);
        setReplay((r) => r + 1);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), MOTION.copiedMs);
      }}
      aria-label={`${LABELS[state]}: copy ${snippet}`}
      className="group relative flex w-full flex-col p-4 text-left transition-[background-color,transform] duration-150 hover:bg-[var(--pas-hover)] focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/70 active:scale-[0.985] @xl:p-5"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${STATE_COLORS[state]}, transparent)`, color: PALETTE.muted }}
      />
      <span className="flex aspect-[5/4] items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" style={{ color: PALETTE.ink }}>
        <PixelStatus state={state} size={size} grid={grid} color={STATE_COLORS[state] === "currentColor" ? color : undefined} replay={replay} active={on} />
      </span>
      <span className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium tracking-[-0.01em]">{LABELS[state]}</span>
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: STATE_COLORS[state], color: PALETTE.muted }} aria-hidden="true" />
      </span>
      <span className="mt-1 text-[12.5px] leading-snug" style={{ color: PALETTE.faint }}>
        {note}
      </span>
      <span className="relative mt-3 block h-4 overflow-hidden font-mono text-[10.5px]" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? "copied" : "code"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className={`block ${copied ? "text-white" : "text-white/35 transition-colors group-hover:text-white/60"}`}
          >
            {copied ? "Copied snippet" : `state="${state}"`}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

/** Demo: the set on a dark stage. */
export default function PixelAgentStatusDemo(overrides: Partial<PixelAgentStatusProps> = {}) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-black px-4 py-10 sm:px-10">
      <div className="w-full max-w-5xl">
        <PixelAgentStatus {...overrides} />
      </div>
    </div>
  );
}
