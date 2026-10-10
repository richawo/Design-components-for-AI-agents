"use client";

import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ types */

type Tag = "span" | "p" | "div" | "h1" | "h2" | "h3" | "strong";

export type SlotReelsProps = {
  /** The text. Change it and every character that differs spins into its new value. */
  value?: string;
  /** Milliseconds between one reel starting and the next. */
  stagger?: number;
  /** How long one reel spins, in ms. */
  duration?: number;
  /** Extra glyphs each reel passes, in sets of four. 0 rolls almost straight to the new character. */
  spins?: number;
  /** Which way the reels travel. */
  direction?: "up" | "down";
  /** Pad shorter values on the left (numbers) or the right (words). auto picks right for figures. */
  align?: "auto" | "left" | "right";
  /** Spin every character, not only the ones that changed. Change it to replay. */
  replayKey?: string | number;
  /** Announce the new value through a polite live region once it lands. */
  announce?: boolean;
  /** Element to render. */
  as?: Tag;
  className?: string;
  style?: CSSProperties;
  /** Called when the last reel lands. */
  onSettle?: (value: string) => void;
};

/* ------------------------------------------------------------------ glyphs */

const DIGITS = "0123456789";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";

/** Each character spins through its own class, so a word keeps its shape while it changes. */
function poolFor(ch: string) {
  if (/[0-9]/.test(ch)) return DIGITS;
  if (/[A-Z]/.test(ch)) return UPPER;
  if (/[a-z]/.test(ch)) return LOWER;
  return "";
}

/** Stable integer hash, so a reel's filler glyphs are the same on the server and the client. */
function hash(a: number, b: number, c: number) {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const FIGURES = /^[\s\d.,:%+\-−$€£¥#/]*$/;

/* ------------------------------------------------------------------ tokens */

/** Base filler glyphs per reel, before `spins`. Later reels get a couple more so they read as travelling further. */
const BASE_ROWS = 4;
const ROWS_PER_SPIN = 4;
/** One visible overshoot as a reel lands: the clunk of a real reel catching its stop. */
const LAND_EASE = [0.2, 1.16, 0.34, 1] as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** The window reaches past the line box by this much, so accents and descenders are never clipped at rest. */
const BLEED = "0.16em";
/**
 * While a reel spins, its window fades at the top and bottom like the curve of
 * a drum, so the rows passing through read as depth rather than as clutter
 * above and below the line. At rest there is no mask.
 */
const DRUM = "linear-gradient(to bottom, transparent, #000 0.3em, #000 calc(100% - 0.3em), transparent)";
const DRUM_MASK: CSSProperties = { maskImage: DRUM, WebkitMaskImage: DRUM };

/* ------------------------------------------------------------------ reel */

type Cell = { key: string; from: string; to: string; spin: boolean; order: number };

type ReelProps = {
  cell: Cell;
  run: number;
  stagger: number;
  duration: number;
  spins: number;
  direction: "up" | "down";
  reduce: boolean;
};

/** The glyph strip a reel travels through: where it was, filler from its own class, where it lands, and one past it for the overshoot. */
function stripFor(cell: Cell, run: number, spins: number): string[] {
  if (!cell.spin) return [cell.to];
  const pool = poolFor(cell.to) || poolFor(cell.from) || DIGITS;
  const count = BASE_ROWS + Math.round(spins * ROWS_PER_SPIN) + (cell.order % 3);
  const filler = Array.from({ length: count }, (_, i) => pool[hash(cell.order, i, run) % pool.length]);
  const after = pool[hash(cell.order, count + 1, run) % pool.length];
  return [cell.from, ...filler, cell.to, poolFor(cell.to) ? after : ""];
}

function Reel({ cell, run, stagger, duration, spins, direction, reduce }: ReelProps) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const strip = useMemo(() => stripFor(cell, run, spins), [cell, run, spins]);
  const rows = strip.length;
  const land = cell.spin ? rows - 2 : 0;
  // The strip runs top to bottom for "up" (it rises past the window) and is reversed for "down".
  const ordered = direction === "up" ? strip : [...strip].reverse();
  const startRow = direction === "up" ? 0 : rows - 1;
  const endRow = direction === "up" ? land : rows - 1 - land;
  const pct = (row: number) => `${(-row / rows) * 100}%`;
  const delay = (cell.order * stagger) / 1000;

  // Width follows the landing character, measured in the reel's own font, so proportional type never reflows.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (el) setWidth(el.getBoundingClientRect().width);
  }, [cell.to]);
  useEffect(() => {
    const el = measureRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Fonts load late and containers resize type with cqi, so the width is kept honest.
    const ro = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
    // The measuring span is a different node once the reel has measured itself, so observe it again then.
  }, [width === null]);

  const spinning = cell.spin && !reduce;

  // Until the reel has measured itself (server HTML, first client pass) the character sits in flow, so layout is right from the first paint.
  if (width === null) {
    return (
      <span className="relative inline-block whitespace-pre align-baseline">
        {cell.to}
        <span ref={measureRef} aria-hidden="true" className="invisible absolute left-0 top-0 whitespace-pre">
          {cell.to || "\u200b"}
        </span>
      </span>
    );
  }

  return (
    <motion.span
      className="relative inline-block whitespace-pre align-baseline"
      initial={false}
      animate={{ width }}
      transition={{ duration: spinning ? duration / 1000 : 0, delay: spinning ? delay : 0, ease: EASE_OUT }}
    >
      {/* A zero-width character in flow gives the reel the text's own baseline and line box. */}
      {"\u200b"}
      <span ref={measureRef} aria-hidden="true" className="invisible absolute left-0 top-0 whitespace-pre">
        {cell.to || "\u200b"}
      </span>
      <span className="absolute inset-x-[-0.04em] overflow-hidden" style={{ top: `-${BLEED}`, bottom: `-${BLEED}`, ...(spinning ? DRUM_MASK : null) }}>
        {spinning ? (
          <motion.span
            key={run}
            className="absolute inset-x-[0.04em] flex flex-col items-center"
            style={{ top: BLEED }}
            initial={{ y: pct(startRow), filter: "blur(0px)" }}
            animate={{ y: pct(endRow), filter: ["blur(0px)", "blur(1.4px)", "blur(0px)"] }}
            transition={{
              y: { duration: duration / 1000, delay, ease: LAND_EASE },
              filter: { duration: duration / 1000, delay, times: [0, 0.35, 0.8], ease: "linear" },
            }}
          >
            {ordered.map((g, i) => (
              <span key={i} className="block whitespace-pre text-center" style={{ height: "1lh" }}>
                {g || "\u200b"}
              </span>
            ))}
          </motion.span>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={`${run}-${cell.to}`}
              className="absolute inset-x-[0.04em] block whitespace-pre text-center"
              style={{ top: BLEED, height: "1lh" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.15 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {cell.to}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    </motion.span>
  );
}

/* ------------------------------------------------------------------ component */

/** Pairs the old and new value character by character, padded on the side `align` picks. */
function pairUp(prev: string, next: string, align: "left" | "right", all: boolean): Cell[] {
  const a = Array.from(prev);
  const b = Array.from(next);
  const n = Math.max(a.length, b.length);
  const pad = (s: string[]) => (align === "right" ? [...Array(n - s.length).fill(""), ...s] : [...s, ...Array(n - s.length).fill("")]);
  const from = pad(a);
  const to = pad(b);
  let order = 0;
  return to.map((ch, i) => {
    const spin = (all || from[i] !== ch) && (poolFor(ch) !== "" || poolFor(from[i]) !== "");
    // Keys run from the anchored side, so a value that grows keeps its existing reels in place.
    const key = align === "right" ? `r${n - i}` : `l${i}`;
    return { key, from: from[i], to: ch, spin, order: spin ? order++ : 0 };
  });
}

export function SlotReels({
  value = "Amber Lantern",
  stagger = 45,
  duration = 900,
  spins = 1,
  direction = "up",
  align = "auto",
  replayKey,
  announce = false,
  as = "span",
  className,
  style,
  onSettle,
}: SlotReelsProps) {
  const reduce = useReducedMotion() ?? false;
  const side = align === "auto" ? (FIGURES.test(value) ? "right" : "left") : align;
  const [state, setState] = useState(() => ({ run: 0, cells: pairUp(value, value, side, false), shown: value, settled: value }));
  const settleRef = useRef(onSettle);
  settleRef.current = onSettle;

  // A new value (or a replay) pairs the current text with the next and starts one run of every reel.
  const prevReplay = useRef(replayKey);
  useEffect(() => {
    const replay = prevReplay.current !== replayKey;
    prevReplay.current = replayKey;
    setState((s) => {
      if (!replay && s.shown === value) return s;
      return { run: s.run + 1, cells: pairUp(s.shown, value, side, replay), shown: value, settled: s.settled };
    });
  }, [value, replayKey, side]);

  // Once the last reel has landed, drop the padding cells and the strips, so the DOM is just the text again.
  useEffect(() => {
    if (state.run === 0) return;
    const spinning = state.cells.filter((c) => c.spin).length;
    const total = reduce ? 160 : Math.max(0, spinning - 1) * stagger + duration + 60;
    const id = window.setTimeout(() => {
      setState((s) => (s.run === state.run ? { ...s, cells: pairUp(s.shown, s.shown, side, false), settled: s.shown } : s));
      settleRef.current?.(state.shown);
    }, total);
    return () => window.clearTimeout(id);
  }, [state.run, state.cells, state.shown, stagger, duration, reduce, side]);

  return createElement(
    as,
    { className, style, "data-direction": direction, "data-stagger": stagger, "data-duration": duration, "data-spins": spins },
    <>
      <span className="sr-only">{value}</span>
      {announce ? (
        <span role="status" aria-live="polite" className="sr-only">
          {state.settled}
        </span>
      ) : null}
      <span aria-hidden="true">
        {state.cells.map((cell) => (
          <span key={cell.key}>
            <Reel cell={cell} run={state.run} stagger={stagger} duration={duration} spins={spins} direction={direction} reduce={reduce} />
            {/* Spaces stay wrap opportunities, so a long value breaks between words like normal text. */}
            {cell.to === " " ? <wbr /> : null}
          </span>
        ))}
      </span>
    </>,
  );
}

/* ------------------------------------------------------------------ demo */

type Codename = { name: string; build: string; ship: string };

/** Fictional release names; the sequence is fixed so the demo and its video always land on the same words. */
const CODENAMES: Codename[] = [
  { name: "Amber Lantern", build: "0427", ship: "Thu 15 Oct" },
  { name: "Velvet Static", build: "0431", ship: "Tue 20 Oct" },
  { name: "Copper Meridian", build: "0438", ship: "Mon 26 Oct" },
  { name: "Quiet Harbour", build: "0442", ship: "Fri 30 Oct" },
  { name: "Paper Comet", build: "0450", ship: "Wed 4 Nov" },
  { name: "Signal Orchard", build: "0456", ship: "Tue 10 Nov" },
  { name: "Brass Aviary", build: "0461", ship: "Mon 16 Nov" },
];

const DEFAULT_VALUE = CODENAMES[0].name;
const PASSED_MAX = 3;

const rise: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  show: (i: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE_OUT, delay: 0.08 + i * 0.06 }, transitionEnd: { filter: "none" } }),
};
const fade: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } };

function SpinIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5">
      <path d="M4 6.5 8 2.5l4 4M4 9.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Demo: a release-name picker. The featured reel (the name) takes the Customize overrides; the build line follows its timing. */
export default function SlotReelsDemo({ value: forcedValue, ...overrides }: Partial<SlotReelsProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLElement>(null);
  const inView = useInView(stageRef, { once: true, amount: 0.3 });
  const v = reduce ? fade : rise;
  const [index, setIndex] = useState(0);
  const [passed, setPassed] = useState<string[]>([]);
  const current = CODENAMES[index % CODENAMES.length];
  // A typed value from the Customize panel replaces the picked name; the default keeps the picker in charge.
  const typed = forcedValue !== undefined && forcedValue !== DEFAULT_VALUE ? forcedValue : undefined;
  const timing = { stagger: overrides.stagger, duration: overrides.duration, spins: overrides.spins, direction: overrides.direction };

  const spin = () => {
    setPassed((p) => [current.name, ...p].slice(0, PASSED_MAX));
    setIndex((i) => i + 1);
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#050506] px-5 py-16 text-[#f4f4f5] sm:px-10">
      <motion.section ref={stageRef} aria-label="Release name" initial="hidden" animate={inView ? "show" : "hidden"} className="@container w-full max-w-[960px]">
        <motion.p variants={v} custom={0} className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
          Release name · picked at random
        </motion.p>

        <motion.div variants={v} custom={1} data-demo="name" className="mt-6">
          <SlotReels
            as="h2"
            className="block min-h-[1lh] font-display text-[clamp(2.5rem,0.5rem+8cqi,6.5rem)] font-medium leading-[0.98] tracking-[-0.05em] text-white"
            {...overrides}
            value={typed ?? current.name}
            announce
          />
        </motion.div>

        <motion.p variants={v} custom={2} className="mt-7 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[13px] uppercase tracking-[0.12em] text-white/55 @xl:text-[14px]">
          <span>
            Build <SlotReels value={current.build} {...timing} className="tabular-nums text-white" />
          </span>
          <span>
            Ships <SlotReels value={current.ship.toUpperCase()} {...timing} className="tabular-nums text-white" />
          </span>
        </motion.p>

        <div className="relative mt-12 flex flex-col gap-6 pt-6 @xl:flex-row @xl:items-center @xl:justify-between">
          <motion.span aria-hidden="true" variants={reduce ? fade : { hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.8, ease: EASE_OUT, delay: 0.3 } } }} className="absolute inset-x-0 top-0 h-px origin-left bg-white/[0.09]" />
          <motion.div variants={v} custom={4} className="min-h-[20px] font-mono text-[12px] text-white/40">
            <span className="mr-3 uppercase tracking-[0.14em] text-white/30">Passed on</span>
            <AnimatePresence initial={false}>
              {passed.length === 0 ? (
                <motion.span key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  nothing yet
                </motion.span>
              ) : (
                passed.map((name, i) => (
                  <motion.span
                    key={name}
                    layout
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: -6, filter: "blur(3px)" }}
                    animate={{ opacity: 1 - i * 0.25, x: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className="mr-3 inline-block line-through decoration-white/25"
                  >
                    {name}
                  </motion.span>
                ))
              )}
            </AnimatePresence>
          </motion.div>
          <motion.div variants={v} custom={5} className="flex items-center gap-2">
            <button
              type="button"
              data-demo="spin"
              onClick={spin}
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-[#f4f4f5] px-5 text-[14px] font-medium tracking-[-0.01em] text-[#0b0b0c] outline-none transition-[background-color,scale] duration-150 hover:bg-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050506] active:scale-[0.97]"
            >
              <SpinIcon />
              Spin again
            </button>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
