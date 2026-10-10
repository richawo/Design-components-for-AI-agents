"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "motion/react";

type Link = { label: string; href: string };

export type CtaHorizonProps = {
  /** Small label above the headline. */
  eyebrow?: string;
  /** Headline. The `muted` substring is set at 45% white and lands as its own beat. */
  headline?: string;
  muted?: string;
  body?: string;
  primary?: Link;
  secondary?: Link;
  /** Three short reassurance notes along the bottom. */
  notes?: [string, string, string];
  /**
   * The one colour of the light. The dither ramps from the panel to this colour
   * and on to a pale core, so a brand hue rebrands the whole horizon. Default is
   * a neutral silver.
   */
  accent?: string;
  /** Size of one dither cell in CSS pixels. 3 reads as texture, 5 as pixel art. */
  cell?: number;
  /** How far the light leans toward a mouse pointer, as a fraction of the panel width. Default 0.12. */
  lean?: number;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const COLOR = {
  page: "#000000",
  panel: "#09090b",
  ink: "#ffffff",
  /** Silver light: monochrome by default, a brand hue when `accent` is set. */
  accent: "#d9d9d6",
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * One timeline, in seconds, from the moment a third of the panel is in view.
 * Panel → eyebrow (its rules draw outward) → headline → body → actions,
 * then the light rises behind them and the notes land last, under it.
 */
const T = {
  panel: 0,
  eyebrow: 0.08,
  headline: 0.14,
  line: 0.07,
  wordStep: 0.015,
  body: 0.3,
  actions: 0.38,
  step: 0.05,
  rise: 0.36,
  riseDur: 0.95,
  notes: 0.62,
  noteStep: 0.06,
  dur: 0.6,
} as const;

/** The light field's tuning, in one place. Distances are fractions of the field. */
const FIELD = {
  /** The horizon sits this many CSS px above the first note. */
  horizonGap: 40,
  /** Light leans this far toward a mouse pointer (fraction of the width), eased by `leanEase` per frame. */
  lean: 0.12,
  leanEase: 0.06,
  /** ±fraction the shimmer scales existing light by. It never adds light where there is none. */
  shimmer: 0.14,
  /** Frame budget: drifting light reads perfectly at 30fps and costs half. */
  frameMs: 32,
  /** The sun's centre below the horizon before and after it rises, in its own vertical radii. */
  sunFrom: 0.78,
  sunTo: 0.28,
} as const;

/** Rise 12px out of an 8px blur; `custom` is the start time. */
const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.dur, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
/** Hairlines draw out from the eyebrow. */
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: 0.6, ease: EASE, delay } }),
};
/** The panel itself: a quiet fade, so the page never flashes a hard edge. */
const panelIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: EASE, delay: T.panel } },
};
/** Reduced motion: one short fade, no transforms or blur. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CtaHorizon({
  eyebrow = "Ready when you are",
  headline = "Ship the version you’d be proud to demo.",
  muted = "proud to demo.",
  body = "Book a 30-minute call. We’ll look at what you have, tell you honestly what we’d change, and send a plan the same day.",
  primary = { label: "Book a call", href: "#contact" },
  secondary = { label: "See pricing", href: "#pricing" },
  notes = ["Replies within one working day", "Two slots open for January", "Teams in 14 countries"],
  accent = COLOR.accent,
  cell = 3,
  lean = FIELD.lean,
}: CtaHorizonProps) {
  const reduce = !!useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLUListElement>(null);
  // Reveal once, when a third of the panel is on screen.
  const inView = useInView(panelRef, { once: true, amount: 0.35 });
  const v = (variants: Variants) => (reduce ? fade : variants);
  const vars = { "--ch-panel": COLOR.panel } as CSSProperties;

  return (
    <section style={vars} className="@container bg-black">
      {/* Padding lives on an inner box: a container can't query its own size. */}
      <div className="p-3 @xl:p-5 @5xl:p-6">
        <motion.div
          ref={panelRef}
          data-demo="panel"
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          variants={v(panelIn)}
          className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-3xl bg-(--ch-panel) text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.06)] @xl:rounded-[32px]"
        >
          <DitherHorizon accent={accent} cell={cell} lean={lean} reduce={reduce} active={inView} anchorRef={notesRef} />

          <div className="relative flex min-h-[560px] flex-col items-center px-6 pb-14 pt-16 text-center @xl:min-h-[640px] @xl:px-12 @xl:pt-24 @5xl:min-h-[700px] @5xl:pt-28">
            <Eyebrow text={eyebrow} v={v} />
            <Headline text={headline} muted={muted} variants={v(reveal)} />
            <motion.p variants={v(reveal)} custom={T.body} className="mt-6 max-w-[48ch] text-balance text-[16px] leading-relaxed text-white/60 @xl:text-[17px]">
              {body}
            </motion.p>
            <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 @xl:w-auto @xl:flex-row">
              <motion.div variants={v(reveal)} custom={T.actions} className="flex w-full @xl:w-auto">
                <PrimaryLink link={primary} />
              </motion.div>
              <motion.div variants={v(reveal)} custom={T.actions + T.step} className="flex w-full @xl:w-auto">
                <SecondaryLink link={secondary} />
              </motion.div>
            </div>

            <ul ref={notesRef} className="mt-auto grid w-full max-w-4xl gap-2 pt-36 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60 @xl:grid-cols-3 @xl:gap-6 @xl:pt-24">
              {notes.map((n, k) => (
                <motion.li key={n} variants={v(reveal)} custom={T.notes + k * T.noteStep} className="flex items-center justify-center [text-shadow:0_1px_12px_rgba(0,0,0,0.8)]">
                  {n}
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

function Eyebrow({ text, v }: { text: string; v: (variants: Variants) => Variants }) {
  return (
    <motion.p variants={v(reveal)} custom={T.eyebrow} className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
      <motion.span aria-hidden="true" variants={v(drawX)} custom={T.eyebrow + 0.1} className="h-px w-6 origin-right bg-white/25" />
      {text}
      <motion.span aria-hidden="true" variants={v(drawX)} custom={T.eyebrow + 0.1} className="h-px w-6 origin-left bg-white/25" />
    </motion.p>
  );
}

/** Two beats: the statement, then the muted close. Words are inline-blocks so the line still balances. */
function Headline({ text, muted, variants }: { text: string; muted: string; variants: Variants }) {
  const i = muted ? text.indexOf(muted) : -1;
  const parts = i < 0 ? [{ text, dim: false }] : [{ text: text.slice(0, i), dim: false }, { text: muted, dim: true }, { text: text.slice(i + muted.length), dim: false }];
  const words = parts.flatMap((part, k) => part.text.split(/\s+/).filter(Boolean).map((word) => ({ word, dim: part.dim, beat: k })));
  return (
    <h2 className="mt-7 max-w-[16ch] text-balance font-display text-[clamp(2.5rem,1.4rem+4.6cqi,5.75rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
      {words.map((w, k) => (
        <span key={k}>
          {k > 0 && !/^[,.;:!?’]/.test(w.word) ? " " : null}
          <motion.span variants={variants} custom={T.headline + w.beat * T.line + k * T.wordStep} className={`inline-block ${w.dim ? "text-white/45" : ""}`}>
            {w.word}
          </motion.span>
        </span>
      ))}
    </h2>
  );
}

/** Hover stays calm: the surface dims a touch and the arrow nudges 2px. Nothing glows, lifts or grows. */
function PrimaryLink({ link }: { link: Link }) {
  return (
    <a
      href={link.href}
      data-demo="primary"
      className={`group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-black shadow-[0_0_0_1px_rgba(255,255,255,0.2)] transition-[background-color,scale] duration-150 ease-out hover:bg-[#ececec] active:scale-[0.98] active:duration-75 @xl:w-auto ${FOCUS}`}
    >
      {link.label}
      <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" fill="none" aria-hidden="true">
        <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

/** Dark glass, so it stays legible if the light ever reaches it. */
function SecondaryLink({ link }: { link: Link }) {
  return (
    <a
      href={link.href}
      data-demo="secondary"
      className={`inline-flex h-12 w-full items-center justify-center rounded-full bg-black/45 px-6 text-[15px] font-medium text-white/85 ring-1 ring-inset ring-white/15 backdrop-blur-md transition-[color,background-color,box-shadow,scale] duration-150 ease-out hover:bg-black/60 hover:text-white hover:ring-white/25 active:scale-[0.98] active:duration-75 @xl:w-auto ${FOCUS}`}
    >
      {link.label}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Dither horizon: ordered (Bayer 8×8) dithering of a light field       */
/* ------------------------------------------------------------------ */

/** Classic recursive Bayer matrix, normalised to (0, 1). */
const BAYER = Float32Array.from(
  [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ].flat(),
  (v) => (v + 0.5) / 64,
);

type RGB = [number, number, number];

function hexToRgb(c: string): RGB {
  const h = c.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as RGB;

/**
 * Five levels from the panel to a pale core, all derived from one accent:
 * panel → faint accent → half accent → accent → accent lifted toward white.
 */
function rampFrom(accent: string): RGB[] {
  const panel = hexToRgb(COLOR.panel);
  const a = hexToRgb(accent);
  return [panel, mix(panel, a, 0.22), mix(panel, a, 0.5), a, mix(a, [255, 255, 255], 0.65)];
}

type FieldFrame = {
  data: Uint8ClampedArray;
  w: number;
  h: number;
  horizon: number;
  levels: RGB[];
  /** Sun centre x in cells. */
  sx: number;
  /** 0 → 1: the sun's climb and the light's strength. */
  rise: number;
  /** Seconds, for the shimmer. 0 for a still frame. */
  t: number;
  shimmer: number;
};

/** Shades one frame of the light field into `data`, one pixel per dither cell. */
function shadeField({ data, w, h, horizon, levels, sx, rise, t, shimmer }: FieldFrame) {
  const L = levels.length - 1;
  const rx = w * 0.5; // a wide, flat glow: light along the horizon, not up into the copy
  const ry = Math.min(h * 0.36, w * 0.26);
  // The sun climbs to just below the line. Measured in its own radii, so it reads the same on a tall phone panel.
  const sy = horizon + ry * (FIELD.sunFrom + (FIELD.sunTo - FIELD.sunFrom) * rise);
  for (let y = 0; y < h; y++) {
    const ground = y > horizon;
    // Below the line the light is a mirrored, broken, much fainter reflection.
    const depth = y - horizon;
    const my = ground ? horizon - depth * 1.8 : y;
    const scan = ground ? (depth % 3 === 0 ? 0.1 : 0.42) * Math.max(0, 1 - depth / (h - horizon + 1)) ** 1.5 : 1;
    const band = Math.exp(-Math.abs(my - horizon) / (h * 0.045)); // haze hugging the horizon
    for (let x = 0; x < w; x++) {
      const dx = (x - sx) / rx;
      const dy = (my - sy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      let v = Math.max(0, 1 - d) ** 2.2 * 1.6 + band * 0.6 * Math.max(0, 1 - Math.abs(x - sx) / (w * 0.62)) ** 1.4;
      // Shimmer scales existing light only, so dark areas stay clean.
      v *= 1 + shimmer * Math.sin(x * 0.21 + t * 1.3) * Math.sin(y * 0.17 - t * 0.9);
      v = Math.min(1, Math.max(0, v * rise * scan));
      // Multi-level ordered dither between adjacent ramp levels.
      const q = v * L;
      const lo = Math.floor(q);
      const c = levels[Math.min(L, lo + (q - lo > BAYER[(y & 7) * 8 + (x & 7)] ? 1 : 0))];
      const o = (y * w + x) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
}

/** A crisp 1-device-pixel hairline on the horizon, brightest under the sun. */
function drawHorizonLine(ctx: CanvasRenderingContext2D, width: number, y: number, thickness: number, centre: number, strength: number) {
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(clamp(centre - 0.38, 0.01, 0.97), "rgba(255,255,255,0)");
  grad.addColorStop(clamp(centre, 0.02, 0.98), `rgba(255,255,255,${(0.7 * strength).toFixed(3)})`);
  grad.addColorStop(clamp(centre + 0.38, 0.03, 0.99), "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, width, thickness);
}

const easeOutExpo = (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));

/**
 * Drives the canvas: sizes it in whole cells, places the horizon above the
 * notes (re-measured by ResizeObserver and when fonts land, not every frame),
 * rises the light once `active` turns true, leans it toward a mouse pointer,
 * and pauses offscreen and in hidden tabs. Reduced motion draws one still frame.
 */
function useDitherField(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  { accent, cell, lean: leanMax, reduce, active }: { accent: string; cell: number; lean: number; reduce: boolean; active: boolean },
) {
  // The rise starts from the reveal, which is a prop; the loop reads it from a ref so it isn't restarted.
  const activeAt = useRef<number | null>(null);
  useEffect(() => {
    if (active && activeAt.current === null) activeAt.current = performance.now();
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const panel = host?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !panel || !ctx) return;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    if (!octx) return;
    const levels = rampFrom(accent);

    let w = 1;
    let h = 1;
    let scale = 1;
    let horizon = 0;
    let img: ImageData | null = null;

    // One dither cell = `cell` CSS px. The canvas covers whole cells and the
    // host clips the overhang, so cells stay square at every size.
    const resize = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.ceil(r.width / cell));
      h = Math.max(1, Math.ceil(r.height / cell));
      scale = cell * dpr;
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.style.width = `${w * cell}px`;
      canvas.style.height = `${h * cell}px`;
      off.width = w;
      off.height = h;
      img = octx.createImageData(w, h);
      placeHorizon();
    };
    // The horizon sits just above the first note, so copy never lands on the sun.
    const placeHorizon = () => {
      const r = host.getBoundingClientRect();
      const anchor = anchorRef.current;
      const a = (anchor?.firstElementChild ?? anchor)?.getBoundingClientRect();
      horizon = a ? Math.max(Math.round(h * 0.5), Math.min(h - 4, Math.floor((a.top - r.top - FIELD.horizonGap) / cell))) : Math.round(h * 0.8);
    };

    // The light leans a little toward a mouse pointer, smoothed.
    let lean = 0;
    let leanTarget = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = canvas.getBoundingClientRect();
      leanTarget = ((e.clientX - r.left) / r.width - 0.5) * leanMax;
    };
    const onLeave = () => (leanTarget = 0);

    const draw = (now: number) => {
      if (!img) return;
      const start = activeAt.current;
      const k = reduce ? 1 : start === null ? 0 : Math.max(0, Math.min(1, ((now - start) / 1000 - T.rise) / T.riseDur));
      const rise = easeOutExpo(k);
      lean += (leanTarget - lean) * FIELD.leanEase;
      const sx = w * (0.5 + lean);
      shadeField({ data: img.data, w, h, horizon, levels, sx, rise, t: reduce ? 0 : now / 1000, shimmer: reduce ? 0 : FIELD.shimmer });
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
      drawHorizonLine(ctx, canvas.width, Math.round((horizon + 1) * scale), Math.max(1, Math.round(scale / cell)), sx / w, rise);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(performance.now());
    });
    ro.observe(host);
    if (anchorRef.current) ro.observe(anchorRef.current);
    resize();
    let live = true;
    // Web fonts can move the notes after first paint without resizing anything observed.
    document.fonts?.ready
      .then(() => {
        if (!live) return;
        placeHorizon();
        if (reduce) draw(performance.now());
      })
      .catch(() => {});

    if (reduce) {
      draw(performance.now());
      return () => {
        live = false;
        ro.disconnect();
      };
    }

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    panel.addEventListener("pointermove", onMove);
    panel.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < FIELD.frameMs) return;
      last = now;
      draw(now);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      panel.removeEventListener("pointermove", onMove);
      panel.removeEventListener("pointerleave", onLeave);
    };
  }, [canvasRef, anchorRef, accent, cell, leanMax, reduce]);
}

function DitherHorizon({
  accent,
  cell,
  lean,
  reduce,
  active,
  anchorRef,
}: {
  accent: string;
  cell: number;
  lean: number;
  reduce: boolean;
  active: boolean;
  /** The horizon sits just above this element (the notes). */
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useDitherField(canvasRef, anchorRef, { accent, cell, lean, reduce, active });
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <canvas ref={canvasRef} data-accent={accent} data-cell={cell} className="absolute left-0 top-0 block [image-rendering:pixelated]" />
      {/* Fade the top of the field into the panel so the copy sits on near-black. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--ch-panel)_0%,color-mix(in_srgb,var(--ch-panel)_92%,transparent)_42%,transparent_72%)]" />
    </div>
  );
}

/**
 * The gallery demo: the same section, with the light leaning further toward the
 * pointer so the sweep reads at a glance, and in-page links held still so the
 * demo cursor (or a visitor) can click them without changing the page hash.
 */
export default function CtaHorizonDemo(overrides: Partial<CtaHorizonProps> = {}) {
  return (
    <div
      onClickCapture={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (a?.getAttribute("href")?.startsWith("#")) e.preventDefault();
      }}
    >
      <CtaHorizon lean={0.28} {...overrides} />
    </div>
  );
}
