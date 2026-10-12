"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "motion/react";

export type FooterAsciiLink = { label: string; href: string; external?: boolean };

export type FooterAsciiWordmarkProps = {
  /** The giant word, rendered as a field of characters. Short and without descenders reads best. */
  wordmark?: string;
  /** Lines used instead when the footer is narrower than 560px, so the mark stays legible. */
  stacked?: string[];
  /** Small mono line above the sign-off. */
  kicker?: string;
  signOff?: string;
  links?: FooterAsciiLink[];
  legal?: string;
  legalLinks?: FooterAsciiLink[];
  /** Field colour. */
  ink?: string;
  /** The one accent: the hottest scrambling glyphs under the lens, and the hint dot. */
  accent?: string;
  /** Density ramp, lightest first. The first character is empty space. */
  ramp?: string;
  /** Glyphs the lens scrambles through. */
  glyphs?: string;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULTS = { ink: "#ece9e2", accent: "#ff7a3d", ramp: " .·:-=+*#%@", glyphs: "/\\|<>{}[]=+*#%&$@01?" } as const;

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Entrance timeline, in seconds. The top rule draws, the sign-off and links
 * stagger in, then the field sweeps on, and the legal bar lands last.
 */
const T = {
  rule: 0,
  kicker: 0.06,
  signOff: 0.12,
  links: 0.2,
  linkStep: 0.035,
  field: 0.3,
  bottom: 0.6,
  bottomStep: 0.05,
  dur: 0.6,
  drawDur: 0.8,
} as const;

/** Share of a block that must be on screen before it reveals. */
const REVEAL_AMOUNT = 0.25;

/** Field tuning. Everything is in device pixels unless named otherwise. */
const FIELD = {
  /** Cell font size, CSS px, as a share of the width and clamped. */
  fontPerWidth: 1 / 150,
  fontMin: 6.5,
  fontMax: 10,
  lineHeight: 1.22,
  /** Below this width (CSS px) the stacked lines are used. */
  stackBelow: 560,
  /** Word rasterisation: size, tracking and the scratch canvas baseline. */
  rasterSize: 200,
  rasterTracking: "-8px",
  rasterBaseline: 240,
  rasterHeight: 320,
  rasterPad: 120,
  /** Samples across each cell when measuring coverage. */
  samples: 4,
  /** Coverage below this is empty space (a faint dot). */
  empty: 0.04,
  emptyAlpha: 0.07,
  /** Light falls toward the floor of each line. */
  floorDensity: 0.34,
  floorLight: 0.3,
  /** First-view sweep. */
  revealMs: 1000,
  /** A new glyph set sweeps across the resting field once, so the change shows without the lens. */
  resweepMs: 900,
  /** Lens radius, CSS px. */
  lensShare: 0.085,
  lensMin: 84,
  lensMax: 150,
  lensFollow: 0.22,
  lensIn: 0.12,
  lensOut: 0.07,
  /** Idle shimmer: a band crosses every `period` seconds, taking `cross` of them. */
  shimmerPeriod: 10,
  shimmerCross: 6.5,
} as const;

const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.dur, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: T.drawDur, ease: EASE, delay } }),
};
const pop: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: (delay: number) => ({ opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE, delay } }),
};
/** Reduced motion: reveal immediately, without transforms, blur or stagger. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
};

const GUTTER = "mx-auto w-full max-w-[1440px] px-5 @2xl:px-10";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-white/70";

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Scroll reveal for one block. A block waits until a quarter of it is on
 * screen, but never runs ahead of its slot in the shared timeline: blocks that
 * arrive together play in order, and one scrolled to later starts at once
 * instead of waiting out its slot. Returns the block's delay, or null while hidden.
 */
function useReveal(ref: RefObject<Element | null>, slot: number, clock: RefObject<number | null>) {
  const inView = useInView(ref, { once: true, amount: REVEAL_AMOUNT });
  const [start, setStart] = useState<number | null>(null);
  useEffect(() => {
    if (!inView) return;
    const now = performance.now() / 1000;
    clock.current ??= now;
    setStart(Math.max(0, slot - (now - clock.current)));
  }, [inView, slot, clock]);
  return start;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FooterAsciiWordmark({
  wordmark = "fieldnote",
  stacked = ["field", "note"],
  kicker = "Fieldnote · Brooklyn, NY",
  signOff = "Production notes for teams of one to fifty. Written by people who still get paged.",
  links = [
    { label: "Docs", href: "#docs" },
    { label: "Changelog", href: "#changelog" },
    { label: "Pricing", href: "#pricing" },
    { label: "Status", href: "#status" },
    { label: "Careers", href: "#careers" },
    { label: "GitHub", href: "#github", external: true },
  ],
  legal = "© 2026 Fieldnote Systems, Inc.",
  legalLinks = [
    { label: "Privacy", href: "#privacy" },
    { label: "Terms", href: "#terms" },
  ],
  ink = DEFAULTS.ink,
  accent = DEFAULTS.accent,
  ramp = DEFAULTS.ramp,
  glyphs = DEFAULTS.glyphs,
  className = "",
}: FooterAsciiWordmarkProps) {
  const reduce = !!useReducedMotion();
  const clock = useRef<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topAt = useReveal(topRef, 0, clock);
  const fieldAt = useReveal(fieldRef, T.field, clock);
  const bottomAt = useReveal(bottomRef, T.bottom, clock);

  const v = reduce ? fade : reveal;
  const at = (start: number | null, offset: number) => (start ?? 0) + offset;
  const state = (start: number | null) => (start === null ? "hidden" : "show");

  return (
    <footer style={{ "--fa-accent": accent } as CSSProperties} className={`@container relative isolate overflow-hidden bg-black text-white ${className}`}>
      <motion.div ref={topRef} initial="hidden" animate={state(topAt)} className={GUTTER}>
        <div className="relative flex flex-col gap-8 pb-10 pt-10 @2xl:pb-12 @2xl:pt-12 @4xl:flex-row @4xl:items-end @4xl:justify-between @4xl:gap-12 @4xl:pb-14 @4xl:pt-14">
          <motion.span aria-hidden="true" variants={reduce ? fade : drawX} custom={at(topAt, T.rule)} className="absolute inset-x-0 top-0 h-px origin-left bg-white/[0.08]" />
          <div>
            <motion.p variants={v} custom={at(topAt, T.kicker)} className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/65">
              {kicker}
            </motion.p>
            <motion.p variants={v} custom={at(topAt, T.signOff)} className="mt-3 max-w-[34ch] text-pretty text-[17px] leading-[1.5] tracking-[-0.01em] text-white/80">
              {signOff}
            </motion.p>
          </div>
          <nav aria-label="Footer">
            <ul className="group/links -mx-2 grid grid-cols-3 gap-x-1 @lg:flex @lg:flex-wrap @4xl:justify-end">
              {links.map((l, i) => (
                <motion.li key={l.label} variants={v} custom={at(topAt, T.links + i * T.linkStep)}>
                  <a
                    href={l.href}
                    target={l.external ? "_blank" : undefined}
                    rel={l.external ? "noreferrer" : undefined}
                    className={`inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[14.5px] text-white/65 transition-[color] duration-150 group-has-[a:hover]/links:text-white/65 hover:text-white! focus-visible:text-white! focus-visible:outline-offset-0 active:translate-y-px @4xl:min-h-9 ${FOCUS}`}
                  >
                    {l.label}
                    {l.external ? (
                      <>
                        <span aria-hidden="true" className="text-[11px] opacity-60">
                          ↗
                        </span>
                        <span className="sr-only">(opens in a new tab)</span>
                      </>
                    ) : null}
                  </a>
                </motion.li>
              ))}
            </ul>
          </nav>
        </div>
      </motion.div>

      <div ref={fieldRef}>
        <AsciiField
          lines={[wordmark]}
          stacked={stacked}
          label={wordmark}
          ink={ink}
          accent={accent}
          ramp={ramp}
          glyphs={glyphs}
          start={fieldAt}
          reduce={reduce}
        />
      </div>

      <motion.div ref={bottomRef} initial="hidden" animate={state(bottomAt)} className={GUTTER}>
        <div className="flex flex-col gap-2 py-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/65 @2xl:flex-row @2xl:items-center @2xl:justify-between">
          <div className="flex flex-col gap-1 @lg:flex-row @lg:items-center @lg:gap-5">
            <motion.span variants={v} custom={at(bottomAt, 0)}>
              {legal}
            </motion.span>
            <span className="-mx-2 flex @lg:mx-0 @lg:gap-5">
              {legalLinks.map((l, i) => (
                <motion.a
                  key={l.label}
                  href={l.href}
                  variants={v}
                  custom={at(bottomAt, (i + 1) * T.bottomStep)}
                  className={`inline-flex min-h-11 items-center rounded-sm px-2 transition-[color] duration-150 hover:text-white focus-visible:outline-offset-2 active:translate-y-px @lg:px-0 @2xl:min-h-8 ${FOCUS}`}
                >
                  {l.label}
                </motion.a>
              ))}
            </span>
          </div>
          {!reduce ? (
            <motion.span
              aria-hidden="true"
              variants={v}
              custom={at(bottomAt, (legalLinks.length + 1) * T.bottomStep)}
              className="hidden items-center gap-2 text-white/65 @2xl:inline-flex"
            >
              <motion.span variants={pop} custom={at(bottomAt, (legalLinks.length + 3) * T.bottomStep)} className="inline-block size-1.5 rounded-full bg-(--fa-accent)" />
              <span className="[@media(hover:hover)]:hidden">Drag across the mark</span>
              <span className="hidden [@media(hover:hover)]:inline">Move across the mark</span>
            </motion.span>
          ) : null}
        </div>
      </motion.div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Field: pure helpers                                                 */
/* ------------------------------------------------------------------ */

/** Integer hash → [0, 1). Stable per cell and tick, so scrambles are deterministic. */
function hash(n: number) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Ink = { t: HTMLCanvasElement; x0: number; y0: number; w: number; h: number; asc: number; desc: number };

/**
 * Renders a word once on a scratch canvas and scans its pixels for the true
 * ink box, so the fit never depends on font metrics or tracking support.
 */
function rasterise(word: string, family: string): Ink {
  const t = document.createElement("canvas");
  const tc = t.getContext("2d", { willReadFrequently: true })!;
  const font = `800 ${FIELD.rasterSize}px ${family}`;
  tc.font = font;
  t.width = Math.ceil(tc.measureText(word).width + FIELD.rasterPad * 2);
  t.height = FIELD.rasterHeight;
  tc.font = font;
  if ("letterSpacing" in tc) tc.letterSpacing = FIELD.rasterTracking;
  tc.fillStyle = "#fff";
  tc.textBaseline = "alphabetic";
  tc.fillText(word, FIELD.rasterPad, FIELD.rasterBaseline);
  const px = tc.getImageData(0, 0, t.width, t.height).data;
  let x0 = t.width, x1 = -1, y0 = t.height, y1 = -1;
  for (let y = 0; y < t.height; y++) {
    for (let x = 0; x < t.width; x++) {
      if (px[(y * t.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { t, x0: 0, y0: 0, w: 1, h: 1, asc: 1, desc: 0 };
  return { t, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, asc: FIELD.rasterBaseline - y0, desc: y1 + 1 - FIELD.rasterBaseline };
}

/** Everything a frame needs: the grid, per-cell coverage and grain, and the cached atlas and resting field. */
type Field = {
  dpr: number;
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  ox: number;
  cov: Float32Array;
  seed: Float32Array;
  /** Per-row light falloff toward each line's floor. */
  fade: Float32Array;
  stamp: Uint32Array;
  atlas: HTMLCanvasElement;
  base: HTMLCanvasElement;
  glyph: Glyphs;
};

/** Glyph indices into the atlas. -1 is empty space. */
type Glyphs = { ramp: number[]; scramble: number[]; charset: string[] };

function indexGlyphs(ramp: string, glyphs: string): Glyphs {
  const rampChars = [...ramp];
  const scrambleChars = [...glyphs];
  const charset = Array.from(new Set([...rampChars, ...scrambleChars])).filter((c) => c !== " ");
  const at = new Map(charset.map((c, i) => [c, i]));
  return {
    charset,
    ramp: rampChars.map((c) => (c === " " ? -1 : (at.get(c) ?? -1))),
    scramble: scrambleChars.map((c) => at.get(c) ?? 0),
  };
}

/** Ramp level for a coverage value. */
const levelOf = (f: Field, v: number) => (v < FIELD.empty ? 1 : Math.min(f.glyph.ramp.length - 1, 1 + Math.round(Math.pow(v, 0.85) * (f.glyph.ramp.length - 2))));

/** Ink alpha: coverage, a little per-cell grain, and light that falls off toward the floor. */
const alphaOf = (f: Field, v: number, i: number) =>
  v < FIELD.empty ? FIELD.emptyAlpha : Math.min(1, (0.3 + 0.66 * Math.pow(v, 0.9) + (f.seed[i] - 0.5) * 0.12) * (f.fade[Math.floor(i / f.cols)] ?? 1));

/**
 * Samples the words into a character grid sized to the canvas. The ink is
 * aligned to `frame` (the content column), while the grid runs full bleed.
 */
function buildField(opts: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  inkLeft: number;
  inkWidth: number;
  words: string[];
  displayFamily: string;
  monoFamily: string;
  glyph: Glyphs;
  ink: string;
  accent: string;
}): Field {
  const { canvas, ctx, width: W, words, glyph, ink, accent } = opts;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fs = Math.round(clamp(W * FIELD.fontPerWidth, FIELD.fontMin, FIELD.fontMax) * dpr);
  ctx.font = `500 ${fs}px ${opts.monoFamily}`;
  const cw = Math.max(2, Math.ceil(ctx.measureText("M").width));
  const ch = Math.round(fs * FIELD.lineHeight);
  const cols = Math.floor((W * dpr) / cw);
  const ox = Math.floor((W * dpr - cols * cw) / 2);

  const inks = words.map((w) => rasterise(w, opts.displayFamily));
  const asc = Math.max(...inks.map((k) => k.asc));
  const desc = Math.max(...inks.map((k) => k.desc));
  const widest = Math.max(...inks.map((k) => k.w));
  const inkLeft = Math.max(0, opts.inkLeft * dpr - ox);
  const inkWidth = Math.min(cols * cw - inkLeft, opts.inkWidth * dpr);
  const scale = inkWidth / widest; // device px per source px
  const lineRows = Math.ceil(((asc + desc) * scale) / ch);
  const gap = 1;
  const rows = 2 + lineRows * words.length + gap * (words.length - 1);

  // Sample grid: a few samples across each cell, roughly square.
  const SX = FIELD.samples;
  const SY = Math.max(FIELD.samples, Math.round((FIELD.samples * ch) / cw));
  const r = document.createElement("canvas");
  r.width = cols * SX;
  r.height = rows * SY;
  const rc = r.getContext("2d", { willReadFrequently: true })!;
  rc.setTransform(SX / cw, 0, 0, SY / ch, 0, 0); // draw in device px
  rc.imageSmoothingQuality = "high";
  inks.forEach((k, li) => {
    const top = (1 + li * (lineRows + gap)) * ch;
    const extra = lineRows * ch - (asc + desc) * scale;
    const baselineY = top + extra / 2 + asc * scale;
    rc.drawImage(k.t, k.x0, k.y0, k.w, k.h, inkLeft, baselineY - k.asc * scale, k.w * scale, k.h * scale);
  });
  const data = rc.getImageData(0, 0, r.width, r.height).data;

  // Each line gets its own light: 0 at its cap line, 1 at its floor.
  const rowPos = new Float32Array(rows);
  words.forEach((_, li) => {
    const top = 1 + li * (lineRows + gap);
    for (let y = 0; y < lineRows; y++) rowPos[top + y] = y / Math.max(1, lineRows - 1);
  });
  rowPos[rows - 1] = 1;
  const fade = Float32Array.from(rowPos, (p) => 1 - FIELD.floorLight * Math.pow(p, 1.4));
  const cov = new Float32Array(cols * rows);
  const seed = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let sum = 0;
      for (let sy = 0; sy < SY; sy++) {
        const row = (cy * SY + sy) * r.width;
        for (let sx = 0; sx < SX; sx++) sum += data[(row + cx * SX + sx) * 4 + 3];
      }
      const i = cy * cols + cx;
      // Density thins toward the floor, so the ramp reads top to bottom.
      cov[i] = (sum / (SX * SY * 255)) * (1 - FIELD.floorDensity * Math.pow(rowPos[cy], 1.3));
      seed[i] = hash(i * 2654435761);
    }
  }

  // Canvas at device resolution.
  canvas.width = Math.round(W * dpr);
  canvas.height = rows * ch;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${(rows * ch) / dpr}px`;

  // Glyph atlas, drawn once at device resolution: row 0 in ink, row 1 in accent.
  const atlas = document.createElement("canvas");
  atlas.width = glyph.charset.length * cw;
  atlas.height = ch * 2;
  const ac = atlas.getContext("2d")!;
  ac.font = `500 ${fs}px ${opts.monoFamily}`;
  ac.textAlign = "center";
  ac.textBaseline = "middle";
  glyph.charset.forEach((c, gi) => {
    ac.fillStyle = ink;
    ac.fillText(c, gi * cw + cw / 2, ch / 2 + 0.5);
    ac.fillStyle = accent;
    ac.fillText(c, gi * cw + cw / 2, ch + ch / 2 + 0.5);
  });

  const field: Field = { dpr, cols, rows, cw, ch, ox, cov, seed, fade, stamp: new Uint32Array(cols * rows), atlas, base: document.createElement("canvas"), glyph };

  // The resting field, cached so a frame only redraws the cells that change.
  field.base.width = canvas.width;
  field.base.height = canvas.height;
  const bc = field.base.getContext("2d")!;
  for (let i = 0; i < cols * rows; i++) {
    const g = glyph.ramp[levelOf(field, cov[i])];
    if (g >= 0) drawCell(bc, field, i, g, 0, alphaOf(field, cov[i], i));
  }
  bc.globalAlpha = 1;
  return field;
}

/** One cell is one drawImage from the atlas at integer device pixels. */
function drawCell(c: CanvasRenderingContext2D, f: Field, i: number, g: number, row: number, a: number) {
  c.globalAlpha = a;
  c.drawImage(f.atlas, g * f.cw, row * f.ch, f.cw, f.ch, f.ox + (i % f.cols) * f.cw, Math.floor(i / f.cols) * f.ch, f.cw, f.ch);
}

const clearCell = (c: CanvasRenderingContext2D, f: Field, cx: number, cy: number) => c.clearRect(f.ox + cx * f.cw, cy * f.ch, f.cw, f.ch);

/**
 * First view: cells resolve in a noisy left-to-right sweep, scrambling (accent at the very edge) as they land.
 * With `rest`, cells the sweep hasn't reached show their resting glyph instead of nothing (a re-sweep).
 */
function drawReveal(c: CanvasRenderingContext2D, f: Field, progress: number, t: number, rest = false) {
  const e = 1 - Math.pow(1 - progress, 3);
  const tick = Math.floor(t * 16);
  const { scramble, ramp } = f.glyph;
  for (let i = 0; i < f.cols * f.rows; i++) {
    const v = f.cov[i];
    const at = ((i % f.cols) / f.cols) * 0.55 + f.seed[i] * 0.45;
    const d = e * 1.25 - at;
    if (d < 0) {
      const g = rest ? ramp[levelOf(f, v)] : -1;
      if (g >= 0) drawCell(c, f, i, g, 0, alphaOf(f, v, i));
      continue;
    }
    if (d < 0.18 && v > FIELD.empty) {
      drawCell(c, f, i, scramble[Math.floor(hash(i * 31 + tick) * scramble.length)], d < 0.07 ? 1 : 0, 0.9);
    } else {
      const g = ramp[levelOf(f, v)];
      if (g >= 0) drawCell(c, f, i, g, 0, alphaOf(f, v, i));
    }
  }
}

/** The lens: density rises, glyphs brighten and scramble; the hottest ink turns accent. */
function drawLens(c: CanvasRenderingContext2D, f: Field, lens: { x: number; y: number; s: number }, t: number, touch: (i: number) => void) {
  const R = clamp((c.canvas.width / f.dpr) * FIELD.lensShare, FIELD.lensMin, FIELD.lensMax) * f.dpr;
  const { scramble, ramp } = f.glyph;
  const c0 = Math.max(0, Math.floor((lens.x - R - f.ox) / f.cw));
  const c1 = Math.min(f.cols - 1, Math.ceil((lens.x + R - f.ox) / f.cw));
  const r0 = Math.max(0, Math.floor((lens.y - R) / f.ch));
  const r1 = Math.min(f.rows - 1, Math.ceil((lens.y + R) / f.ch));
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const dx = f.ox + (cx + 0.5) * f.cw - lens.x;
      const dy = (cy + 0.5) * f.ch - lens.y;
      const q = (dx * dx + dy * dy) / (R * R);
      if (q >= 1) continue;
      const i = cy * f.cols + cx;
      touch(i);
      const strength = (1 - q) * (1 - q) * lens.s;
      const v = f.cov[i];
      const vv = Math.min(1, v + strength * (0.3 + 0.55 * v));
      let g = ramp[levelOf(f, vv)];
      let row = 0;
      const tick = Math.floor(t * 9 + f.seed[i] * 9);
      if ((v > FIELD.empty || strength > 0.32) && hash(i * 7919 + tick) < Math.pow(strength, 1.3) * 0.85) {
        g = scramble[Math.floor(hash(i * 131 + tick * 17) * scramble.length)];
        row = strength > 0.45 && v > FIELD.empty ? 1 : 0;
      }
      clearCell(c, f, cx, cy);
      if (g < 0) continue;
      const a = vv < FIELD.empty ? FIELD.emptyAlpha + strength * 0.25 : Math.min(1, alphaOf(f, vv, i) + strength * 0.4);
      drawCell(c, f, i, g, row, a);
    }
  }
}

/** The one ambient signal: a soft diagonal band crosses the ink every ten seconds. */
function drawShimmer(c: CanvasRenderingContext2D, f: Field, idle: number, t: number, touch: (i: number) => boolean) {
  const ph = (t % FIELD.shimmerPeriod) / FIELD.shimmerCross;
  if (ph >= 1) return;
  const { scramble, ramp } = f.glyph;
  const bw = Math.max(6, f.cols * 0.06);
  const bx = -bw * 3 + ph * (f.cols + bw * 6 + f.rows);
  const c0 = Math.max(0, Math.floor(bx - bw * 2.2 - f.rows * 0.45));
  const c1 = Math.min(f.cols - 1, Math.ceil(bx + bw * 2.2));
  const tick = Math.floor(t * 6);
  for (let cy = 0; cy < f.rows; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const i = cy * f.cols + cx;
      const v = f.cov[i];
      if (v < 0.08) continue;
      const u = (cx - bx + cy * 0.45) / bw;
      const s = Math.exp(-u * u) * idle;
      if (s < 0.03 || !touch(i)) continue;
      let g = ramp[levelOf(f, v)];
      if (hash(i * 977 + tick) < s * s * 0.14) g = scramble[Math.floor(hash(i * 13 + tick) * scramble.length)];
      clearCell(c, f, cx, cy);
      drawCell(c, f, i, g, 0, Math.min(1, alphaOf(f, v, i) + s * 0.28));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Field: React                                                        */
/* ------------------------------------------------------------------ */

/** Follows `value`, but only after it has held still for `ms`. The first value is returned immediately. */
function useSettled(value: string, ms: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value === settled) return;
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, settled, ms]);
  return settled;
}

type Pointer = { x: number; y: number; on: boolean; touch: boolean };

/**
 * The lens pointer. Mouse moves place it; on touch, pointer down places it
 * and horizontal drags move it, while vertical drags still scroll the page.
 */
function useLensPointer() {
  const pointer = useRef<Pointer>({ x: 0, y: 0, on: false, touch: false });
  const place = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current.x = e.clientX - r.left;
    pointer.current.y = e.clientY - r.top;
  };
  const lift = () => {
    pointer.current.on = false;
    pointer.current.touch = false;
  };
  const handlers = {
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" && !pointer.current.touch) return;
      place(e);
      pointer.current.on = true;
    },
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse") return;
      place(e);
      pointer.current.touch = true;
      pointer.current.on = true;
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse") lift();
    },
    onPointerCancel: lift,
    onPointerLeave: lift,
  };
  return { pointer, handlers };
}

type FieldProps = {
  lines: string[];
  stacked: string[];
  label: string;
  ink: string;
  accent: string;
  ramp: string;
  glyphs: string;
  /** Seconds until the first-view sweep starts, or null while the field is still hidden. */
  start: number | null;
  reduce: boolean;
};

/**
 * The field. Built once per width into a cached resting layer; each frame
 * blits it and redraws only the cells the reveal, lens or shimmer touch.
 * The loop runs only while the field is on screen and the tab is visible.
 */
function AsciiField({ lines, stacked, label, ink, accent, ramp, glyphs, start, reduce }: FieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayProbe = useRef<HTMLSpanElement>(null);
  const monoProbe = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const { pointer, handlers } = useLensPointer();
  // Read by the loop each frame; the effect below doesn't need to restart when it changes.
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  }, [start]);
  // The first-view sweep plays once per mount; later rebuilds (new text, ink, ramp) draw the new field straight away.
  const revealed = useRef(false);
  // The glyph set the field was last built with, so a change can re-sweep instead of hiding until the lens arrives.
  const builtGlyphs = useRef(glyphs);
  // Text edits re-rasterise the field, so wait for a pause in typing. The first value applies at once.
  const linesKey = useSettled(lines.join("\n"), 150);
  const stackedKey = useSettled(stacked.join("\n"), 150);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx || !displayProbe.current || !monoProbe.current) return;
    const displayFamily = getComputedStyle(displayProbe.current).fontFamily;
    const monoFamily = getComputedStyle(monoProbe.current).fontFamily;
    const glyph = indexGlyphs(ramp, glyphs);
    let field: Field | null = null;

    const build = () => {
      const W = wrap.clientWidth;
      if (!W) return;
      // The ink aligns to the content column above; the dot field runs full bleed.
      const wr = wrap.getBoundingClientRect();
      const fr = frameRef.current?.getBoundingClientRect() ?? wr;
      const words = W < FIELD.stackBelow && stackedKey ? stackedKey.split("\n") : linesKey.split("\n");
      field = buildField({ canvas, ctx, width: W, inkLeft: fr.left - wr.left, inkWidth: fr.width, words, displayFamily, monoFamily, glyph, ink, accent });
      setReady(true);
    };

    const st = { lx: 0, ly: 0, s: 0, revealAt: 0, sweepAt: 0, frame: 0, raf: 0, visible: false, t0: performance.now() };
    if (revealed.current && builtGlyphs.current !== glyphs) st.sweepAt = st.t0;
    builtGlyphs.current = glyphs;

    const render = (now: number) => {
      const f = field;
      if (!f) return;
      const t = (now - st.t0) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;

      if (reduce) {
        ctx.drawImage(f.base, 0, 0);
        return;
      }
      // Hold blank until the block's slot in the footer's timeline.
      if (startRef.current === null && !revealed.current) return;
      if (!st.revealAt) st.revealAt = now + (startRef.current ?? 0) * 1000;
      const progress = revealed.current ? 1 : clamp((now - st.revealAt) / FIELD.revealMs, 0, 1);
      if (progress >= 1) revealed.current = true;
      if (progress < 1) {
        drawReveal(ctx, f, progress, t);
        ctx.globalAlpha = 1;
        return;
      }
      if (st.sweepAt && now < st.sweepAt + FIELD.resweepMs) {
        drawReveal(ctx, f, (now - st.sweepAt) / FIELD.resweepMs, t, true);
        ctx.globalAlpha = 1;
        return;
      }

      const p = pointer.current;
      const target = p.on ? 1 : 0;
      const px = p.x * f.dpr;
      const py = p.y * f.dpr;
      if (st.s < 0.01 && target) {
        st.lx = px;
        st.ly = py;
      }
      st.lx += (px - st.lx) * FIELD.lensFollow;
      st.ly += (py - st.ly) * FIELD.lensFollow;
      st.s += (target - st.s) * (target ? FIELD.lensIn : FIELD.lensOut);

      ctx.drawImage(f.base, 0, 0);
      const frame = ++st.frame;
      // A per-frame stamp so the lens and shimmer never draw the same cell twice.
      const touch = (i: number) => {
        if (f.stamp[i] === frame) return false;
        f.stamp[i] = frame;
        return true;
      };
      if (st.s > 0.004) drawLens(ctx, f, { x: st.lx, y: st.ly, s: st.s }, t, touch);
      const idle = 1 - st.s;
      if (idle > 0.05) drawShimmer(ctx, f, idle, t, touch);
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      st.raf = 0;
      render(now);
      if (!reduce && st.visible && !document.hidden) st.raf = requestAnimationFrame(loop);
    };
    const play = () => {
      if (!st.raf && !reduce && st.visible && !document.hidden) st.raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };

    let live = true;
    const rebuild = () => {
      if (!live) return;
      build();
      if (reduce) render(performance.now());
    };
    rebuild();
    document.fonts?.load(`800 100px ${displayFamily}`).then(() => document.fonts.load(`500 12px ${monoFamily}`)).then(rebuild, rebuild);

    let rq = 0;
    let lastW = wrap.clientWidth;
    const ro = new ResizeObserver(() => {
      if (wrap.clientWidth === lastW) return;
      lastW = wrap.clientWidth;
      cancelAnimationFrame(rq);
      rq = requestAnimationFrame(rebuild);
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(
      ([e]) => {
        st.visible = e.isIntersecting;
        if (st.visible) play();
        else stop();
      },
      { threshold: 0.15 },
    );
    io.observe(wrap);
    const onVis = () => (document.hidden ? stop() : play());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      live = false;
      stop();
      cancelAnimationFrame(rq);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [linesKey, stackedKey, ink, accent, ramp, glyphs, reduce, pointer]);

  return (
    <div ref={wrapRef} data-demo="wordmark" className="relative w-full touch-pan-y select-none" style={ready ? undefined : { aspectRatio: "5.4 / 1" }} {...handlers}>
      {/* An invisible copy of the content column, measured so the ink lines up with the text above. */}
      <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 ${GUTTER}`}>
        <div ref={frameRef} className="h-px" />
      </div>
      <span ref={displayProbe} aria-hidden="true" className="pointer-events-none absolute font-display opacity-0" />
      <span ref={monoProbe} aria-hidden="true" className="pointer-events-none absolute font-mono opacity-0" />
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${label} wordmark drawn in characters`}
        // A deliberate test and devtools hook: the canvas keeps these settings only as pixels,
        // so they are mirrored here for anything that inspects the markup.
        data-ink={ink}
        data-ramp={ramp}
        data-glyphs={glyphs}
        className={`block transition-opacity duration-500 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/**
 * Demo: the footer at the end of a quiet page. Overrides are spread onto the
 * featured instance. A new `wordmark` brings its own stacked lines (split in
 * half) unless `stacked` is passed too, so narrow widths stay legible.
 */
export default function FooterAsciiWordmarkDemo({ wordmark, stacked, ...overrides }: Partial<FooterAsciiWordmarkProps> = {}) {
  const word = (wordmark ?? "").trim();
  const half = Math.ceil(word.length / 2);
  const lines = stacked ?? (word ? (word.length >= 6 ? [word.slice(0, half), word.slice(half)] : []) : undefined);
  return (
    <div className="flex min-h-dvh flex-col justify-end bg-black">
      <FooterAsciiWordmark {...overrides} wordmark={word || undefined} stacked={lines} />
    </div>
  );
}
