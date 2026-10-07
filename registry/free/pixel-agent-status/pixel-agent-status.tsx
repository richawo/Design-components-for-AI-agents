"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export type AgentState = "thinking" | "searching" | "writing" | "listening" | "syncing" | "done" | "error" | "idle";

export type PixelStatusProps = {
  state: AgentState;
  /** Rendered size in px (the glyph is a 9×9 grid). */
  size?: number;
  /** Override the state's colour. */
  color?: string;
  /** Show the unlit grid behind the glyph. */
  grid?: boolean;
  /** Accessible label; defaults to the state name. */
  label?: string;
  /** Change this value to replay the animation from its first frame. */
  replay?: number;
  className?: string;
};

const N = 9;
const FPS = 10;

/** Default colours: warm for work in progress, semantic for outcomes. */
export const STATE_COLORS: Record<AgentState, string> = {
  thinking: "#ff7a45",
  searching: "#ffb38a",
  writing: "#f4efe9",
  listening: "#ff7a45",
  syncing: "#9cc9ff",
  done: "#34d399",
  error: "#fb7185",
  idle: "#8a8580",
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
const Z: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]];

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
      // A z rises and fades, then a beat of rest.
      const p = (f % 30) / 22;
      if (p <= 1) {
        const ox = 1 + Math.round(p * 3);
        const oy = 5 - Math.round(p * 4);
        const a = Math.sin(Math.PI * p) * 0.95;
        for (const [x, y] of Z) put(m, ox + x, oy + y, a);
      }
      put(m, 1, 7, 0.35);
      put(m, 2, 7, 0.35);
      break;
    }
  }
  return m;
}

/** A representative still for reduced motion. */
const STILL: Record<AgentState, number> = { thinking: 3, searching: 2, writing: 11, listening: 4, syncing: 3, done: 99, error: 10, idle: 11 };

/** One shared 10fps clock per mounted glyph, paused offscreen and in hidden tabs. */
function useFrame(ref: RefObject<Element | null>, state: AgentState, replay = 0) {
  const [f, setF] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setF(STILL[state]);
      return;
    }
    setF(0);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (ref.current) io.observe(ref.current);
    const id = window.setInterval(() => {
      if (visible && !document.hidden) setF((n) => n + 1);
    }, 1000 / FPS);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [ref, state, replay]);
  return f;
}

export function PixelStatus({ state, size = 24, color, grid = true, label, replay = 0, className = "" }: PixelStatusProps) {
  const ref = useRef<SVGSVGElement>(null);
  const f = useFrame(ref, state, replay);
  const lit = glyph(state, f);
  const c = color ?? STATE_COLORS[state];
  const id = useId().replace(/:/g, "");
  const cell = 10;
  const dot = size < 28 ? 8.4 : 7.6;
  const r = size < 28 ? 1.2 : 1.8;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${N * cell} ${N * cell}`}
      width={size}
      height={size}
      role="img"
      aria-label={label ?? LABELS[state]}
      className={`shrink-0 ${className}`}
    >
      {size >= 40 && (
        <defs>
          <filter id={`${id}-g`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
      )}
      {grid &&
        Array.from({ length: N * N }, (_, i) =>
          lit.has(i) ? null : (
            <rect key={`g${i}`} x={(i % N) * cell + (cell - dot) / 2} y={Math.floor(i / N) * cell + (cell - dot) / 2} width={dot} height={dot} rx={r} fill="currentColor" opacity={0.07} />
          ),
        )}
      {size >= 40 && (
        <g filter={`url(#${id}-g)`} opacity={0.55}>
          {[...lit].map(([i, v]) => (
            <rect key={`b${i}`} x={(i % N) * cell} y={Math.floor(i / N) * cell} width={cell} height={cell} fill={c} opacity={v} />
          ))}
        </g>
      )}
      {[...lit].map(([i, v]) => (
        <rect key={i} x={(i % N) * cell + (cell - dot) / 2} y={Math.floor(i / N) * cell + (cell - dot) / 2} width={dot} height={dot} rx={r} fill={c} opacity={0.25 + v * 0.75} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: the set, plus the glyphs used inline in an agent run           */
/* ------------------------------------------------------------------ */

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

const RUN: { state: AgentState; text: string }[] = [
  { state: "thinking", text: "Planning the migration" },
  { state: "searching", text: "Reading the Postgres 17 release notes" },
  { state: "writing", text: "Writing 0042_split_orders.sql" },
  { state: "syncing", text: "Pushing branch orders-split" },
  { state: "done", text: "Migration ready for review" },
];

export function PixelAgentStatus() {
  const reduce = !!useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % (RUN.length + 1)), 2600);
    return () => window.clearInterval(id);
  }, []);
  const current = RUN[Math.min(step, RUN.length - 1)];

  return (
    <section className="@container w-full rounded-[22px] border border-white/[0.08] bg-[#0b0b0c] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] @xl:p-7">
      <header className="flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Pixel status · 9×9</p>
          <h2 className="mt-2 text-balance font-sans text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-medium tracking-[-0.035em]">Eight states your agent can be in.</h2>
        </div>
        {/* Inline usage: the glyph at text size in a live run row. */}
        <div className="flex min-w-0 items-center gap-3 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03] py-2 pl-2.5 pr-4 @2xl:max-w-[60%]" aria-live="polite">
          <PixelStatus state={current.state} size={18} grid={false} />
          <span className="text-[13px] text-white/40">Atlas ·</span>
          <span className="relative block min-w-0 flex-1">
            {/* Each step slides up and out of focus as the next arrives. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={current.text}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(3px)", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="block truncate text-[13px] text-white/75"
              >
                {current.text}
                {current.state !== "done" ? "…" : ""}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
      </header>

      <ul className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] @2xl:grid-cols-4">
        {STATES.map(({ state, note }) => (
          <li key={state} className="bg-[#0b0b0c]">
            <Tile state={state} note={note} reduce={reduce} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A gallery tile: hover replays the glyph, click copies its usage. */
function Tile({ state, note, reduce }: { state: AgentState; note: string; reduce: boolean }) {
  const [replay, setReplay] = useState(0);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const snippet = `<PixelStatus state="${state}" />`;
  return (
    <button
      type="button"
      onPointerEnter={(e) => e.pointerType === "mouse" && setReplay((r) => r + 1)}
      onFocus={() => setReplay((r) => r + 1)}
      onClick={() => {
        void navigator.clipboard?.writeText(snippet).catch(() => undefined);
        setCopied(true);
        setReplay((r) => r + 1);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1400);
      }}
      aria-label={`${LABELS[state]}: copy ${snippet}`}
      className="group relative flex w-full flex-col p-4 text-left transition-[background-color,transform] duration-150 hover:bg-[#101012] focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/70 active:scale-[0.985] @xl:p-5"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${STATE_COLORS[state]}, transparent)` }}
      />
      <span className="flex aspect-[5/4] items-center justify-center text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]">
        <PixelStatus state={state} size={96} replay={replay} />
      </span>
      <span className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium tracking-[-0.01em] text-white/90">{LABELS[state]}</span>
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: STATE_COLORS[state] }} aria-hidden="true" />
      </span>
      <span className="mt-1 text-[12.5px] leading-snug text-white/45">{note}</span>
      <span className="relative mt-3 block h-4 overflow-hidden font-mono text-[10.5px]" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? "copied" : "code"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`block ${copied ? "text-[#34d399]" : "text-white/30 transition-colors group-hover:text-white/55"}`}
          >
            {copied ? "Copied snippet" : `state="${state}"`}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

/** Demo: the set on a dark stage. */
export default function PixelAgentStatusDemo() {
  return (
    <div className="flex min-h-[720px] w-full items-center justify-center bg-black px-4 py-10 sm:px-10">
      <div className="w-full max-w-5xl">
        <PixelAgentStatus />
      </div>
    </div>
  );
}
