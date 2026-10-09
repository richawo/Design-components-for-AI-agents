"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

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
  /** Chart height in px at desktop widths (mobile uses 72% of it). */
  height?: number;
};

const RANGES: { key: RangeKey; label: string; caption: string }[] = [
  { key: "1D", label: "1D", caption: "Today" },
  { key: "1W", label: "1W", caption: "Past week" },
  { key: "1M", label: "1M", caption: "Past month" },
  { key: "3M", label: "3M", caption: "Past 3 months" },
  { key: "1Y", label: "1Y", caption: "Past year" },
  { key: "ALL", label: "All", caption: "All time" },
];

const UP = "#34d399";
const DOWN = "#fb7185";
const SAMPLES = 140;

export function ChartPortfolio({
  name = "Northwind Growth Index",
  ticker = "NWGI",
  exchange = "NASDAQ",
  currency = "USD",
  locale = "en-US",
  data,
  defaultRange = "1M",
  height = 320,
}: ChartPortfolioProps) {
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const series = useMemo(() => ({ ...demoData(), ...data }) as Record<RangeKey, Point[]>, [data]);
  const [range, setRange] = useState<RangeKey>(defaultRange);
  const [hover, setHover] = useState<number | null>(null);

  // Measure the plot so the SVG is drawn in real pixels at every width.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Entrance: the first time the card is mostly in view, the line rises from
  // the floor in a wave from left to right, volume grows up with it, and the
  // figures count up out of a blur. Once, and never with reduced motion.
  const sectionRef = useRef<HTMLElement>(null);
  const [intro, setIntro] = useState(0);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (reduce) {
      setIntro(1);
      setEntered(true);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setEntered(true);
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / 1500);
          setIntro(k);
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [reduce]);
  const rise = useCallback(
    (i: number) => {
      if (intro >= 1) return 1;
      const k = Math.min(1, Math.max(0, intro * 1.6 - (i / (SAMPLES - 1)) * 0.6));
      return 1 - Math.pow(1 - k, 3);
    },
    [intro],
  );

  const h = width < 520 ? Math.round(height * 0.72) : height;
  const volH = width < 520 ? 28 : 40;
  const padTop = 16;
  const padRight = width < 520 ? 0 : 56;
  const plotW = width - padRight;
  const plotH = h - volH - padTop - 22;

  // Resample every range to the same number of points so the line can morph.
  const target = useMemo(() => resample(series[range], SAMPLES), [series, range]);
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (reduce || from === target) {
      fromRef.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 650);
      const e = 1 - Math.pow(1 - k, 4);
      setShown(target.map((p, i) => ({ t: p.t, v: from[i].v + (p.v - from[i].v) * e, vol: from[i].vol + (p.vol - from[i].vol) * e })));
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target, reduce]);

  const open = target[0].v;
  const last = target[target.length - 1].v;
  const [min, max] = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of target) {
      lo = Math.min(lo, p.v);
      hi = Math.max(hi, p.v);
    }
    const pad = (hi - lo) * 0.12 || 1;
    return [lo - pad, hi + pad];
  }, [target]);
  const maxVol = useMemo(() => Math.max(...target.map((p) => p.vol)), [target]);

  const x = useCallback((i: number) => (i / (SAMPLES - 1)) * plotW, [plotW]);
  const y = useCallback((v: number) => padTop + (1 - (v - min) / (max - min)) * plotH, [min, max, plotH]);

  const pts = shown.map((p, i) => [x(i), y(min + (p.v - min) * rise(i))] as const);
  const line = monotonePath(pts);
  const area = `${line} L${plotW},${padTop + plotH} L0,${padTop + plotH} Z`;

  const active = hover ?? SAMPLES - 1;
  const value = hover === null ? last : target[hover].v;
  const delta = value - open;
  const pct = (delta / open) * 100;
  const up = delta >= 0;
  const trend = last >= open ? UP : DOWN;
  const cursorX = x(active);

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale, currency]);
  const axis = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }), [locale, currency]);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i <= 3; i++) out.push(min + ((max - min) * (i + 0.5)) / 4);
    return out;
  }, [min, max]);
  const xLabels = useMemo(() => {
    const n = width < 520 ? 3 : 5;
    return Array.from({ length: n }, (_, i) => {
      const idx = Math.round((i / (n - 1)) * (SAMPLES - 1));
      return { idx, label: formatTime(target[idx].t, range, locale) };
    });
  }, [target, range, locale, width]);

  const pickIndex = (clientX: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = Math.min(Math.max(clientX - rect.left, 0), plotW);
    return Math.round((px / plotW) * (SAMPLES - 1));
  };

  const caption = RANGES.find((r) => r.key === range)!.caption;
  const tipLeft = Math.min(Math.max(cursorX, 64), plotW - 64);

  return (
    <section ref={sectionRef} className="@container relative w-full overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0b0b0c] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_80px_-30px_rgba(0,0,0,0.9)] @xl:p-7">
      <style>{`@keyframes cp-dot-in{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[80%] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl transition-colors duration-700"
        style={{ background: trend }}
      />

      <header className="relative flex flex-col gap-5 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.14] to-white/[0.02] font-mono text-[10px] font-semibold tracking-tight">
              {ticker.slice(0, 2)}
            </span>
            <p className="truncate text-sm font-medium text-white/80">{name}</p>
            <span className="hidden shrink-0 font-mono text-[11px] text-white/35 @md:inline">
              {ticker} · {exchange}
            </span>
          </div>
          <p className="mt-3 font-sans text-[clamp(2rem,1.6rem+1.6vw,2.75rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
            {/* Scrubbing is instant; range changes count to the new value. */}
            <Ticker value={value} instant={hover !== null || !!reduce} entered={entered} duration={1300} format={(v) => money.format(v)} />
          </p>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm tabular-nums">
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: up ? UP : DOWN }}>
              <svg viewBox="0 0 10 10" className={`size-2.5 ${up ? "" : "rotate-180"}`} aria-hidden="true">
                <path d="M5 1.5 9 8H1z" fill="currentColor" />
              </svg>
              <span>
                <Ticker value={Math.abs(delta)} instant={hover !== null || !!reduce} entered={entered} delay={150} format={(v) => money.format(v)} /> ({up ? "+" : "−"}
                <Ticker value={Math.abs(pct)} instant={hover !== null || !!reduce} entered={entered} delay={150} format={(v) => v.toFixed(2)} />
                %)
              </span>
            </span>
            <span className="text-white/40">{hover === null ? caption : formatTime(target[hover].t, range, locale, true)}</span>
          </p>
        </div>

        <div role="radiogroup" aria-label="Time range" className="flex w-full rounded-full border border-white/[0.08] bg-white/[0.03] p-1 @2xl:w-auto">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="radio"
              aria-checked={range === r.key}
              onClick={() => {
                setHover(null);
                setRange(r.key);
              }}
              className={`relative h-8 flex-1 rounded-full px-3 font-mono text-[11px] font-medium transition-[color,transform] duration-150 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white @2xl:flex-none ${range === r.key ? "text-black" : "text-white/55 hover:text-white"}`}
            >
              {range === r.key && (
                <motion.span
                  layoutId={`${uid}-range`}
                  className="absolute inset-0 rounded-full bg-white shadow-[0_1px_8px_rgba(255,255,255,0.25)]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{r.label}</span>
            </button>
          ))}
        </div>
      </header>

      <div
        ref={wrapRef}
        className="relative mt-6 touch-none select-none outline-none"
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
            setHover((hv) => {
              const cur = hv ?? SAMPLES - 1;
              return Math.min(SAMPLES - 1, Math.max(0, cur + (e.key === "ArrowRight" ? step : -step)));
            });
          }
          if (e.key === "Escape") setHover(null);
        }}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={h} className="absolute inset-0 overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={trend} stopOpacity="0.28" />
              <stop offset="70%" stopColor={trend} stopOpacity="0.04" />
              <stop offset="100%" stopColor={trend} stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${uid}-past`}>
              <rect x="0" y="0" width={hover === null ? plotW : cursorX} height={h} />
            </clipPath>
            <clipPath id={`${uid}-future`}>
              <rect x={hover === null ? plotW : cursorX} y="0" width={plotW} height={h} />
            </clipPath>
            <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1="0" x2={plotW} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
              {padRight > 0 && (
                <text x={width} y={y(t) + 4} textAnchor="end" className="fill-white/35 font-mono text-[10.5px] tabular-nums">
                  {axis.format(t)}
                </text>
              )}
            </g>
          ))}

          <line x1="0" x2={plotW} y1={y(open)} y2={y(open)} stroke="rgba(255,255,255,0.22)" strokeDasharray="2 4" />

          <g clipPath={`url(#${uid}-past)`}>
            <path d={area} fill={`url(#${uid}-fill)`} opacity={Math.min(1, intro * 1.25)} />
            <path d={line} fill="none" stroke={trend} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          <g clipPath={`url(#${uid}-future)`} opacity="0.32">
            <path d={line} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinejoin="round" />
          </g>

          {shown.map((p, i) => {
            if (i % 2) return null;
            const bh = (p.vol / maxVol) * volH * rise(i);
            const isActive = hover !== null && Math.abs(i - hover) <= 1;
            return (
              <rect
                key={i}
                x={x(i) - 1}
                y={h - 22 - bh}
                width={Math.max(1.5, plotW / SAMPLES)}
                height={bh}
                rx="1"
                fill={isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.11)"}
              />
            );
          })}

          {xLabels.map((l, i) => (
            <text
              key={l.idx}
              x={x(l.idx)}
              y={h - 4}
              textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
              className="fill-white/35 font-mono text-[10.5px]"
            >
              {l.label}
            </text>
          ))}

          {hover !== null && (
            <g>
              <line x1={cursorX} x2={cursorX} y1={padTop - 6} y2={h - 22} stroke="rgba(255,255,255,0.28)" />
              <circle cx={cursorX} cy={y(target[hover].v)} r="9" fill={trend} opacity="0.45" filter={`url(#${uid}-glow)`} />
              <circle cx={cursorX} cy={y(target[hover].v)} r="4.5" fill="#0b0b0c" stroke={trend} strokeWidth="2" />
            </g>
          )}
          {hover === null && intro >= 1 && (
            <g className="motion-safe:animate-[cp-dot-in_420ms_cubic-bezier(0.22,1,0.36,1)]" style={{ transformOrigin: `${x(SAMPLES - 1)}px ${y(shown[SAMPLES - 1].v)}px` }}>
              <circle cx={x(SAMPLES - 1)} cy={y(shown[SAMPLES - 1].v)} r="3.5" fill={trend} />
              <circle cx={x(SAMPLES - 1)} cy={y(shown[SAMPLES - 1].v)} r="3.5" fill={trend} className="motion-safe:animate-ping" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
            </g>
          )}
        </svg>

        {hover !== null && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute -top-1 -translate-x-1/2 rounded-md border border-white/10 bg-[#161618]/95 px-2 py-1 font-mono text-[10.5px] text-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur"
            style={{ left: tipLeft }}
          >
            {formatTime(target[hover].t, range, locale, true)}
          </motion.div>
        )}
      </div>

      <footer className="relative mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] @xl:grid-cols-4">
        {(
          [
            ["Open", open, (v: number) => money.format(v)],
            ["High", Math.max(...target.map((p) => p.v)), (v: number) => money.format(v)],
            ["Low", Math.min(...target.map((p) => p.v)), (v: number) => money.format(v)],
            ["Volume", target.reduce((a, p) => a + p.vol, 0), (v: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(v)],
          ] as const
        ).map(([k, n, fmt], i) => (
          <div key={k} className="bg-[#0b0b0c] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">{k}</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-white/85">
              <Ticker value={n} instant={!!reduce} entered={entered} delay={500 + i * 90} duration={900} format={fmt} />
            </p>
          </div>
        ))}
      </footer>
    </section>
  );
}

/**
 * A figure that counts to each new value (450ms ease-out) unless `instant`.
 * On entrance it counts up from zero while a blur clears, after `delay`.
 */
function Ticker({
  value,
  instant,
  format,
  entered = true,
  delay = 0,
  duration = 450,
}: {
  value: number;
  instant: boolean;
  format: (v: number) => string;
  entered?: boolean;
  delay?: number;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const [blur, setBlur] = useState(0);
  const [hidden, setHidden] = useState(!entered);
  const ref = useRef(value);
  const introDone = useRef(entered);
  useEffect(() => {
    if (!entered) {
      setHidden(true);
      return;
    }
    if (instant && introDone.current) {
      ref.current = value;
      setShown(value);
      return;
    }
    const first = !introDone.current;
    introDone.current = true;
    const from = first ? 0 : ref.current;
    const ms = first ? duration : 450;
    let raf = 0;
    let t0 = 0;
    const timer = setTimeout(
      () => {
        setHidden(false);
        t0 = performance.now();
        const step = (now: number) => {
          const k = Math.min(1, (now - t0) / ms);
          const e = 1 - Math.pow(1 - k, first ? 4 : 3);
          const v = from + (value - from) * e;
          ref.current = v;
          setShown(v);
          if (first) setBlur((1 - e) * 8);
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      first ? delay : 0,
    );
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, instant, entered, delay, duration]);
  return (
    <span
      className="inline-block will-change-[filter]"
      style={{ filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined, opacity: hidden ? 0 : 1 - blur / 16 }}
    >
      {format(shown)}
    </span>
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
  const spec: Record<RangeKey, [number, number, number, number]> = {
    "1D": [78, 5 * 60e3, 0.0016, 11],
    "1W": [120, 60 * 60e3, 0.004, 23],
    "1M": [150, 4.8 * 3600e3, 0.009, 37],
    "3M": [150, 14.4 * 3600e3, 0.013, 51],
    "1Y": [180, 48.7 * 3600e3, 0.019, 67],
    "ALL": [200, 182 * 3600e3, 0.03, 89],
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

/** Demo: the chart on a dark stage. */
export default function ChartPortfolioDemo() {
  return (
    <div className="flex min-h-[640px] w-full items-center justify-center bg-black px-4 py-10 sm:px-10">
      <div className="w-full max-w-4xl">
        <ChartPortfolio />
      </div>
    </div>
  );
}
