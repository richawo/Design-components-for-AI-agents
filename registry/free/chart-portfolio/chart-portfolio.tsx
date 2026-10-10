"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type MotionValue, type Variants } from "motion/react";

export type Point = { t: number; v: number; vol: number };
export type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export type ChartPortfolioProps = {
  name?: string;
  ticker?: string;
  exchange?: string;
  currency?: string;
  locale?: string;
  /** Series per range. Omit to use generated demo data. */
  data?: Partial<Record<RangeKey, Point[]>>;
  defaultRange?: RangeKey;
  /** Chart height in px at desktop widths (narrow containers use 72% of it). */
  height?: number;
  /** Near-black card (default) or white. */
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const RANGES: { key: RangeKey; label: string; caption: string }[] = [
  { key: "1D", label: "1D", caption: "Today" },
  { key: "1W", label: "1W", caption: "Past week" },
  { key: "1M", label: "1M", caption: "Past month" },
  { key: "3M", label: "3M", caption: "Past 3 months" },
  { key: "1Y", label: "1Y", caption: "Past year" },
  { key: "ALL", label: "All", caption: "All time" },
];

// Green and red are the data here (up and down), so they stay; everything else is ink.
const PALETTE = {
  dark: {
    surface: "#0b0b0c",
    ink: "#ffffff",
    raised: "#161618",
    up: "#34d399",
    down: "#fb7185",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 30px 80px -30px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    ink: "#0b0b0c",
    raised: "#ffffff",
    up: "#059669",
    down: "#e11d48",
    shadow: "0 1px 2px rgba(0,0,0,0.06), 0 24px 60px -30px rgba(0,0,0,0.22)",
  },
} as const;

type Bezier = readonly [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];
const EASE_COUNT: Bezier = [0.16, 1, 0.3, 1];

/** Every range is resampled to this many points so any two can morph. */
const SAMPLES = 140;
const NARROW = 520;
const AXIS_BAND = 22;
const PAD_TOP = 16;

// The entrance, in seconds: card → identity → price → change and range control
// → chart (gridlines, then the line rises in a wave) → stats → live dot.
const T = {
  card: 0,
  name: 0.06,
  price: 0.12,
  change: 0.18,
  control: 0.14,
  axes: 0.2,
  rise: 0.24,
  riseDur: 1.0,
  stats: 0.42,
  statStep: 0.06,
  count: 0.9,
  tick: 0.45,
  morph: 0.65,
  block: 0.6,
} as const;

/** 12px rise out of an 8px blur; `custom` is the start time in seconds. */
const RISE: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.block, ease: EASE, delay } }),
};
/** The card itself carries no blur, so it never compounds with its contents'. */
const LAND: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: T.block, ease: EASE } },
};
/** Reduced motion keeps only a short fade. */
const FADE: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cp-ink)";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChartPortfolio({
  name = "Northwind Growth Index",
  ticker = "NWGI",
  exchange = "NASDAQ",
  currency = "USD",
  locale = "en-US",
  data,
  defaultRange = "1M",
  height = 320,
  theme = "dark",
}: ChartPortfolioProps) {
  const uid = useId().replace(/:/g, "");
  const reduce = !!useReducedMotion();
  const series = useMemo(() => ({ ...demoData(), ...data }) as Record<RangeKey, Point[]>, [data]);
  const [range, setRange] = useState<RangeKey>(defaultRange);
  const [hover, setHover] = useState<number | null>(null);

  // Entrance: once, when 35% of the card is in view. Server HTML starts in
  // the pre-entrance state, so nothing flashes before it plays.
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.35 });
  const entered = inView || reduce;
  const intro = useIntro(entered, reduce);

  const [wrapRef, width] = useWidth<HTMLDivElement>(720);
  const narrow = width < NARROW;
  const h = narrow ? Math.round(height * 0.72) : height;
  const volH = narrow ? 28 : 40;
  const padRight = narrow ? 0 : 56;
  const plotW = width - padRight;
  const plotH = h - volH - PAD_TOP - AXIS_BAND;

  const target = useMemo(() => resample(series[range], SAMPLES), [series, range]);
  const morph = useMorph(target, reduce);
  const geo = { plotW, plotH, h, volH };
  const { line, area, volume, endX, endY } = useChartPaths(morph, intro, geo);
  // The line waits on the floor invisibly, then appears the moment it starts to rise.
  const lineOpacity = useTransform(intro, [0, 0.06], [0, 1]);

  const open = target[0].v;
  const last = target[SAMPLES - 1].v;
  const { lo, hi } = morph.toDomain.current;
  const x = (i: number) => (i / (SAMPLES - 1)) * plotW;
  const y = (v: number) => PAD_TOP + (1 - (v - lo) / (hi - lo)) * plotH;

  const value = hover === null ? last : target[hover].v;
  const delta = value - open;
  const pct = (delta / open) * 100;
  const up = delta >= 0;
  const trend = last >= open ? "var(--cp-up)" : "var(--cp-down)";
  const cursorX = hover === null ? plotW : x(hover);
  // Scrubbing is instant; range changes and leaving the plot count to the new value.
  const instant = hover !== null;

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale, currency]);
  const axis = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }), [locale, currency]);
  const compact = useMemo(() => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }), [locale]);
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * (i + 0.5)) / 4);
  const xLabels = useMemo(() => {
    const n = narrow ? 3 : 5;
    return Array.from({ length: n }, (_, i) => {
      const idx = Math.round((i / (n - 1)) * (SAMPLES - 1));
      return { idx, label: formatTime(target[idx].t, range, locale) };
    });
  }, [target, range, locale, narrow]);
  const stats = useMemo(
    () => [
      { label: "Open", value: open, format: (v: number) => money.format(v) },
      { label: "High", value: Math.max(...target.map((p) => p.v)), format: (v: number) => money.format(v) },
      { label: "Low", value: Math.min(...target.map((p) => p.v)), format: (v: number) => money.format(v) },
      { label: "Volume", value: target.reduce((a, p) => a + p.vol, 0), format: (v: number) => compact.format(v) },
    ],
    [target, open, money, compact],
  );

  const pickIndex = (clientX: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = Math.min(Math.max(clientX - rect.left, 0), plotW);
    return Math.round((px / plotW) * (SAMPLES - 1));
  };
  const caption = RANGES.find((r) => r.key === range)!.caption;
  const p = PALETTE[theme];
  const vars = { "--cp-surface": p.surface, "--cp-ink": p.ink, "--cp-raised": p.raised, "--cp-up": p.up, "--cp-down": p.down, boxShadow: p.shadow, colorScheme: theme } as CSSProperties;
  const rise = reduce ? FADE : RISE;

  return (
    <motion.section
      ref={rootRef}
      style={vars}
      variants={reduce ? FADE : LAND}
      initial="hidden"
      animate={entered ? "show" : "hidden"}
      className="@container relative w-full overflow-hidden rounded-[22px] border border-(--cp-ink)/[0.08] bg-(--cp-surface) p-5 text-(--cp-ink) @xl:p-7"
    >
      <header className="relative flex flex-col gap-5 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div>
          <motion.div variants={rise} custom={T.name} className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-(--cp-ink)/10 bg-(--cp-ink)/[0.06] font-mono text-[10px] font-semibold tracking-tight">
              {ticker.slice(0, 2)}
            </span>
            <p className="truncate text-sm font-medium text-(--cp-ink)/80">{name}</p>
            <span className="hidden shrink-0 font-mono text-[11px] text-(--cp-ink)/40 @md:inline">
              {ticker} · {exchange}
            </span>
          </motion.div>
          <p className="mt-3 font-sans text-[clamp(2rem,1.6rem+1.6vw,2.75rem)] font-medium leading-none tracking-[-0.04em]">
            <Ticker value={value} instant={instant} entered={entered} reduce={reduce} delay={T.price} format={(v) => money.format(v)} />
          </p>
          <motion.p variants={rise} custom={T.change} className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm tabular-nums">
            <span className="inline-flex items-center gap-1 font-medium transition-colors duration-200" style={{ color: up ? "var(--cp-up)" : "var(--cp-down)" }}>
              <svg viewBox="0 0 10 10" className={`size-2.5 transition-transform duration-200 ${up ? "" : "rotate-180"}`} aria-hidden="true">
                <path d="M5 1.5 9 8H1z" fill="currentColor" />
              </svg>
              <span>
                <Ticker value={Math.abs(delta)} instant={instant} entered={entered} reduce={reduce} delay={T.change} format={(v) => money.format(v)} /> ({up ? "+" : "−"}
                <Ticker value={Math.abs(pct)} instant={instant} entered={entered} reduce={reduce} delay={T.change} format={(v) => v.toFixed(2)} />
                %)
              </span>
            </span>
            <span className="text-(--cp-ink)/45">{hover === null ? caption : formatTime(target[hover].t, range, locale, true)}</span>
          </motion.p>
        </div>

        <motion.div variants={rise} custom={T.control}>
          <RangeControl value={range} uid={uid} reduce={reduce} onChange={(k) => {
              setHover(null);
              setRange(k);
            }} />
        </motion.div>
      </header>

      <div
        ref={wrapRef}
        data-demo="plot"
        className="relative mt-6 touch-none select-none rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-(--cp-ink)/30"
        style={{ height: h }}
        tabIndex={0}
        role="img"
        aria-label={`${name} price chart, ${caption.toLowerCase()}. Opened at ${money.format(open)}, now ${money.format(last)}. Use arrow keys to inspect.`}
        onPointerMove={(e) => setHover(pickIndex(e.clientX))}
        onPointerDown={(e) => setHover(pickIndex(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            setHover((hv) => Math.min(SAMPLES - 1, Math.max(0, (hv ?? SAMPLES - 1) + (e.key === "ArrowRight" ? step : -step))));
          }
          if (e.key === "Escape") setHover(null);
        }}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={h} className="absolute inset-0 overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={trend} stopOpacity="0.2" />
              <stop offset="70%" stopColor={trend} stopOpacity="0.03" />
              <stop offset="100%" stopColor={trend} stopOpacity="0" />
            </linearGradient>
            {/* Past and future of the cursor: the future fades to a ghost line. */}
            <clipPath id={`${uid}-past`}>
              <rect x="0" y="0" width={cursorX} height={h} />
            </clipPath>
            <clipPath id={`${uid}-future`}>
              <rect x={cursorX} y="0" width={plotW} height={h} />
            </clipPath>
          </defs>

          <motion.g variants={reduce ? FADE : RISE} custom={T.axes}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1="0" x2={plotW} y1={y(t)} y2={y(t)} stroke="var(--cp-ink)" strokeOpacity="0.06" />
                {padRight > 0 && (
                  <text x={width} y={y(t) + 4} textAnchor="end" className="fill-(--cp-ink)/40 font-mono text-[10.5px] tabular-nums">
                    {axis.format(t)}
                  </text>
                )}
              </g>
            ))}
            <line x1="0" x2={plotW} y1={y(open)} y2={y(open)} stroke="var(--cp-ink)" strokeOpacity="0.22" strokeDasharray="2 4" />
            {xLabels.map((l, i) => (
              <text
                key={l.idx}
                x={x(l.idx)}
                y={h - 4}
                textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
                className="fill-(--cp-ink)/40 font-mono text-[10.5px]"
              >
                {l.label}
              </text>
            ))}
          </motion.g>

          <motion.path d={volume} fill="var(--cp-ink)" fillOpacity="0.11" />
          {hover !== null && <VolumeHighlight points={target} index={hover} maxVol={morph.maxVol} x={x} h={h} volH={volH} plotW={plotW} />}

          <motion.g clipPath={`url(#${uid}-past)`} style={{ opacity: lineOpacity }}>
            <motion.path d={area} fill={`url(#${uid}-fill)`} style={{ opacity: intro }} />
            <motion.path d={line} fill="none" stroke={trend} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          </motion.g>
          <g clipPath={`url(#${uid}-future)`} opacity="0.32">
            <motion.path d={line} fill="none" stroke="var(--cp-ink)" strokeOpacity="0.7" strokeWidth="1.5" strokeLinejoin="round" />
          </g>

          {/* Kept mounted while scrubbing so it doesn't replay its entrance. */}
          <g opacity={hover === null ? 1 : 0}>
            <LiveDot x={endX} y={endY} color={trend} entered={entered} reduce={reduce} />
          </g>
          {hover !== null && (
            <g>
              <line x1={cursorX} x2={cursorX} y1={PAD_TOP - 6} y2={h - AXIS_BAND} stroke="var(--cp-ink)" strokeOpacity="0.28" />
              <circle cx={cursorX} cy={y(target[hover].v)} r="9" fill={trend} opacity="0.18" />
              <circle cx={cursorX} cy={y(target[hover].v)} r="4.5" fill="var(--cp-surface)" stroke={trend} strokeWidth="2" />
            </g>
          )}
        </svg>

        {hover !== null && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="pointer-events-none absolute -top-1 -translate-x-1/2 rounded-md border border-(--cp-ink)/10 bg-(--cp-raised) px-2 py-1 font-mono text-[10.5px] whitespace-nowrap text-(--cp-ink)/80 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            style={{ left: Math.min(Math.max(cursorX, 64), plotW - 64) }}
          >
            {formatTime(target[hover].t, range, locale, true)}
          </motion.div>
        )}
      </div>

      <footer className="relative mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-(--cp-ink)/[0.07] @xl:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            variants={rise}
            custom={T.stats + i * T.statStep}
            className="bg-(--cp-surface) px-4 py-3 shadow-[0_0_0_1px_color-mix(in_oklab,var(--cp-ink)_7%,var(--cp-surface))]"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-(--cp-ink)/40">{s.label}</p>
            <p className="mt-1 text-sm font-medium text-(--cp-ink)/85">
              <Ticker value={s.value} instant={false} entered={entered} reduce={reduce} delay={T.stats + i * T.statStep + 0.08} format={s.format} />
            </p>
          </motion.div>
        ))}
      </footer>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Range control                                                       */
/* ------------------------------------------------------------------ */

function RangeControl({ value, uid, reduce, onChange }: { value: RangeKey; uid: string; reduce: boolean; onChange: (k: RangeKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Time range" className="flex w-full rounded-full border border-(--cp-ink)/[0.08] bg-(--cp-ink)/[0.03] p-1 @2xl:w-auto">
      {RANGES.map((r) => (
        <button
          key={r.key}
          role="radio"
          aria-checked={value === r.key}
          data-demo={`range-${r.key.toLowerCase()}`}
          onClick={() => onChange(r.key)}
          className={`relative h-8 flex-1 rounded-full px-3 font-mono text-[11px] font-medium transition-[color,transform] duration-150 active:scale-[0.95] ${FOCUS} @2xl:flex-none ${value === r.key ? "text-(--cp-surface)" : "text-(--cp-ink)/55 hover:text-(--cp-ink)"}`}
        >
          {value === r.key && (
            <motion.span layoutId={`${uid}-range`} className="absolute inset-0 rounded-full bg-(--cp-ink)" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />
          )}
          <span className="relative">{r.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Motion: entrance, morph and the paths they drive                    */
/* ------------------------------------------------------------------ */

/** 0 → 1 once the card is in view: the line's rise. A motion value, so it never re-renders the chart. */
function useIntro(entered: boolean, reduce: boolean) {
  const intro = useMotionValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!entered) return;
    if (reduce) return void intro.jump(1);
    const a = animate(intro, 1, { duration: T.riseDur, delay: T.rise, ease: "linear" });
    return () => a.stop();
  }, [entered, reduce, intro]);
  return intro;
}

type Domain = { lo: number; hi: number };

function domainOf(points: Point[]): Domain {
  let lo = Infinity;
  let hi = -Infinity;
  for (const pt of points) {
    lo = Math.min(lo, pt.v);
    hi = Math.max(hi, pt.v);
  }
  const pad = (hi - lo) * 0.12 || 1;
  return { lo: lo - pad, hi: hi + pad };
}

/**
 * Morphs between ranges: `k` runs 0 → 1 from the series (and price domain)
 * on screen to the new one, so the line and its scale glide together.
 */
function useMorph(target: Point[], reduce: boolean) {
  const k = useMotionValue(1);
  const from = useRef(target);
  const to = useRef(target);
  const fromDomain = useRef(domainOf(target));
  const toDomain = useRef(fromDomain.current);
  // Volume is scaled to the destination series; bars ease with the values.
  const maxVol = useMemo(() => Math.max(...target.map((pt) => pt.vol)), [target]);

  if (to.current !== target) {
    // Start from wherever the morph currently is, so a quick second click reverses smoothly.
    const e = easeOutQuart(k.get());
    from.current = to.current.map((pt, i) => ({ t: pt.t, v: lerp(from.current[i].v, pt.v, e), vol: lerp(from.current[i].vol, pt.vol, e) }));
    fromDomain.current = { lo: lerp(fromDomain.current.lo, toDomain.current.lo, e), hi: lerp(fromDomain.current.hi, toDomain.current.hi, e) };
    to.current = target;
    toDomain.current = domainOf(target);
    k.jump(reduce ? 1 : 0);
  }

  useEffect(() => {
    if (k.get() >= 1) return;
    const a = animate(k, 1, { duration: T.morph, ease: "linear" });
    return () => a.stop();
  }, [target, k]);

  return { k, from, to, fromDomain, toDomain, maxVol };
}

/** The line, area and volume as path strings derived from the intro and morph motion values. */
function useChartPaths(morph: ReturnType<typeof useMorph>, intro: MotionValue<number>, { plotW, plotH, h, volH }: { plotW: number; plotH: number; h: number; volH: number }) {
  const floor = PAD_TOP + plotH;
  const points = useTransform(() => {
    const e = easeOutQuart(morph.k.get());
    const t = intro.get();
    const a = morph.from.current;
    const b = morph.to.current;
    const lo = lerp(morph.fromDomain.current.lo, morph.toDomain.current.lo, e);
    const hi = lerp(morph.fromDomain.current.hi, morph.toDomain.current.hi, e);
    return b.map((pt, i) => {
      const v = lerp(a[i].v, pt.v, e);
      const vol = lerp(a[i].vol, pt.vol, e);
      const r = riseAt(i, t);
      const yv = PAD_TOP + (1 - (v - lo) / (hi - lo)) * plotH;
      // Each point rises from the plot floor in a left-to-right wave.
      return { x: (i / (SAMPLES - 1)) * plotW, y: floor + (yv - floor) * r, vol: (vol / morph.maxVol) * volH * r };
    });
  });
  const line = useTransform(points, (pts) => monotonePath(pts.map((pt) => [pt.x, pt.y] as const)));
  const area = useTransform(line, (d) => `${d} L${plotW},${floor} L0,${floor} Z`);
  const volume = useTransform(points, (pts) => {
    const w = Math.max(1.5, plotW / SAMPLES).toFixed(2);
    let d = "";
    for (let i = 0; i < pts.length; i += 2) {
      const bh = pts[i].vol;
      if (bh < 0.05) continue;
      d += `M${(pts[i].x - 1).toFixed(2)},${(h - AXIS_BAND - bh).toFixed(2)}h${w}v${bh.toFixed(2)}h-${w}Z`;
    }
    return d;
  });
  const endX = useTransform(points, (pts) => pts[pts.length - 1].x);
  const endY = useTransform(points, (pts) => pts[pts.length - 1].y);
  return { line, area, volume, endX, endY };
}

/** Wave progress for point i at intro time t: clamp(t·1.6 − i/n·0.6), ease-out cubic. */
function riseAt(i: number, t: number) {
  if (t >= 1) return 1;
  const k = Math.min(1, Math.max(0, t * 1.6 - (i / (SAMPLES - 1)) * 0.6));
  return 1 - Math.pow(1 - k, 3);
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutQuart = (k: number) => 1 - Math.pow(1 - k, 4);

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

function useWidth<E extends HTMLElement>(initial: number) {
  const ref = useRef<E>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Bars under the cursor brighten. */
function VolumeHighlight({ points, index, maxVol, x, h, volH, plotW }: { points: Point[]; index: number; maxVol: number; x: (i: number) => number; h: number; volH: number; plotW: number }) {
  const w = Math.max(1.5, plotW / SAMPLES);
  const bars = [index - 1, index, index + 1].filter((i) => i >= 0 && i < SAMPLES && i % 2 === 0);
  return (
    <>
      {bars.map((i) => {
        const bh = (points[i].vol / maxVol) * volH;
        return <rect key={i} x={x(i) - 1} y={h - AXIS_BAND - bh} width={w} height={bh} rx="1" fill="var(--cp-ink)" fillOpacity="0.7" />;
      })}
    </>
  );
}

/** The resting "now" dot: it lands once the line has risen, then pings (the one ambient signal). */
function LiveDot({ x, y, color, entered, reduce }: { x: MotionValue<number>; y: MotionValue<number>; color: string; entered: boolean; reduce: boolean }) {
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={entered ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
      transition={reduce ? { duration: 0 } : { delay: T.rise + T.riseDur * 0.95, type: "spring", stiffness: 500, damping: 30 }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    >
      <motion.circle cx={x} cy={y} r="3.5" fill={color} />
      {!reduce && <motion.circle cx={x} cy={y} r="3.5" fill={color} className="animate-ping" style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
    </motion.g>
  );
}

/**
 * A figure that counts up from zero out of a blur on entrance (after `delay`),
 * then eases to each new value over 450ms unless `instant`. Motion values
 * write the text and filter directly; nothing re-renders while it counts.
 */
function Ticker({ value, instant, format, entered, reduce, delay = 0 }: { value: number; instant: boolean; format: (v: number) => string; entered: boolean; reduce: boolean; delay?: number }) {
  const n = useMotionValue(entered ? value : 0);
  const settle = useMotionValue(entered ? 1 : 0);
  const waiting = useRef(!entered);
  const settling = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!entered) return;
    if (waiting.current) {
      waiting.current = false;
      if (reduce) {
        n.jump(value);
        settle.jump(1);
        return;
      }
      settling.current = animate(settle, 1, { duration: T.count * 0.8, delay, ease: EASE });
      const count = animate(n, value, { duration: T.count, delay, ease: EASE_COUNT });
      return () => count.stop();
    }
    // A settle cut short (strict-mode remount) finishes rather than leaving the figure blurred.
    if (settle.get() < 1 && !settling.current) settling.current = animate(settle, 1, { duration: T.tick, ease: EASE });
    if (instant || reduce) return void n.jump(value);
    const tick = animate(n, value, { duration: T.tick, ease: EASE });
    return () => tick.stop();
    // `delay` only matters for the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, instant, entered, reduce]);
  useEffect(
    () => () => {
      settling.current?.stop();
      settling.current = null;
    },
    [],
  );

  const text = useTransform(n, format);
  const filter = useTransform(settle, [0, 1], ["blur(8px)", "blur(0px)"]);
  const opacity = useTransform(settle, [0, 0.35], [0, 1]);
  return (
    <motion.span className="inline-block tabular-nums" style={{ filter, opacity }}>
      {text}
    </motion.span>
  );
}

/* ----------------------------------------------------------------- utils */

/** Monotone cubic interpolation (Fritsch–Carlson): smooth, never overshoots. */
function monotonePath(p: readonly (readonly [number, number])[]) {
  const n = p.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(p[i + 1][0] - p[i][0]);
    m.push((p[i + 1][1] - p[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = `M${p[0][0].toFixed(2)},${p[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(p[i][0] + h).toFixed(2)},${(p[i][1] + h * t[i]).toFixed(2)} ${(p[i + 1][0] - h).toFixed(2)},${(p[i + 1][1] - h * t[i + 1]).toFixed(2)} ${p[i + 1][0].toFixed(2)},${p[i + 1][1].toFixed(2)}`;
  }
  return d;
}

function resample(src: Point[], n: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const f = (i / (n - 1)) * (src.length - 1);
    const a = Math.floor(f);
    const b = Math.min(src.length - 1, a + 1);
    const k = f - a;
    return { t: src[a].t + (src[b].t - src[a].t) * k, v: src[a].v + (src[b].v - src[a].v) * k, vol: src[a].vol + (src[b].vol - src[a].vol) * k };
  });
}

function formatTime(t: number, range: RangeKey, locale: string, long = false) {
  const d = new Date(t);
  if (range === "1D") return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (range === "1W") return d.toLocaleDateString(locale, long ? { weekday: "short", day: "numeric", month: "short", hour: "numeric" } : { weekday: "short", day: "numeric" });
  if (range === "1Y" || range === "ALL") return d.toLocaleDateString(locale, long ? { day: "numeric", month: "short", year: "numeric" } : { month: "short", year: "2-digit" });
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", ...(long ? { year: "numeric" } : {}) });
}

/** Deterministic demo data: a seeded random walk per range, ending at the same price. */
function demoData(): Record<RangeKey, Point[]> {
  const end = Date.UTC(2026, 9, 7, 20, 0);
  // [points, step ms, volatility, seed]
  const spec: Record<RangeKey, [number, number, number, number]> = {
    "1D": [78, 5 * 60e3, 0.0016, 11],
    "1W": [120, 60 * 60e3, 0.004, 23],
    "1M": [150, 4.8 * 3600e3, 0.009, 37],
    "3M": [150, 14.4 * 3600e3, 0.013, 51],
    "1Y": [180, 48.7 * 3600e3, 0.019, 67],
    ALL: [200, 182 * 3600e3, 0.03, 89],
  };
  const out = {} as Record<RangeKey, Point[]>;
  for (const key of Object.keys(spec) as RangeKey[]) {
    const [n, step, vol, seed] = spec[key];
    let s = seed;
    const rnd = () => {
      s = (s + 0x6d2b79f5) | 0;
      let r = Math.imul(s ^ (s >>> 15), 1 | s);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
    const walk: number[] = [0];
    for (let i = 1; i < n; i++) walk.push(walk[i - 1] + (rnd() - 0.47) * vol + Math.sin(i / 9) * vol * 0.15);
    const offset = walk[n - 1];
    out[key] = walk.map((w, i) => ({
      t: end - (n - 1 - i) * step,
      v: 4812.4 * Math.exp(w - offset),
      vol: 4e5 + rnd() * 9e5 + (i % 17 === 0 ? 1.2e6 : 0),
    }));
  }
  return out;
}

/** Demo: the chart on a quiet stage. Overrides (the page's Customize panel) go straight to the chart. */
export default function ChartPortfolioDemo(overrides: Partial<ChartPortfolioProps> = {}) {
  return (
    <div className={`flex min-h-[640px] w-full items-center justify-center px-4 py-10 sm:px-10 ${overrides.theme === "light" ? "bg-[#f4f4f5]" : "bg-black"}`}>
      <div className="w-full max-w-4xl">
        <ChartPortfolio {...overrides} />
      </div>
    </div>
  );
}
