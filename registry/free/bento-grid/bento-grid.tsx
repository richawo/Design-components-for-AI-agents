"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { Search } from "lucide-react";

const ease = [0.2, 0.8, 0.2, 1] as const;

type TileCopy = { label: string; title: string; body: string };
type Metric = { name: string; total: string; delta: string; points: number[] };
type Query = { q: string; answer: string; detail: string };
type Setting = { label: string; detail: string; on: boolean };
type AlertPreview = { sender: string; channel: string; time: string; message: string; quiet: string; watch: number };
type City = { name: string; lon: number; lat: number; visitors: number };

export type BentoGridProps = {
  eyebrow?: string;
  /** Plain part of the heading. */
  heading?: string;
  /** Italic serif ending of the heading. */
  headingItalic?: string;
  intro?: string;
  link?: { label: string; href: string };
  /** Line-chart tile. Each metric needs the same number of points (7–30). */
  trend?: TileCopy & { dates: [string, string, string]; metrics: Metric[] };
  /** Accent tile with one big number that counts up. */
  stat?: TileCopy & { value: number; unit: string; comparison: { name: string; value: string; share: number }[] };
  /** Weekday × hour activity heatmap. */
  heatmap?: TileCopy & { peakLabel: string };
  /** Search bar that types each query, then shows its answer. */
  search?: TileCopy & { queries: Query[] };
  /** Settings card. Rows are real switches; they flip on their own until someone touches one. */
  alerts?: TileCopy & { settings: Setting[]; preview: AlertPreview };
  /** Dark tile: a dot-matrix world map with pulsing cities. */
  map?: TileCopy & { liveLabel: string; cities: City[] };
};

const INK = "#141412";
const ACCENT = "#d5f56a";

export function BentoGrid({
  eyebrow = "Northstar — product tour",
  heading = "Analytics that",
  headingItalic = "answer back.",
  intro = "Northstar watches every event, every session and every odd Tuesday, then tells you what changed and why. In a sentence, not a spreadsheet.",
  link = { label: "Take the two-minute tour", href: "#tour" },
  trend = {
    label: "01 / Trends",
    title: "Charts that explain themselves",
    body: "Every line gets a sentence. When signups jump on a Tuesday, Northstar says it was the newsletter, not a miracle.",
    dates: ["Sep 23", "Sep 30", "Oct 6"],
    metrics: [
      { name: "Weekly actives", total: "48,210", delta: "+12.4%", points: [31, 33, 32, 36, 35, 38, 41, 39, 42, 44, 43, 46, 47, 48] },
      { name: "Signups", total: "3,906", delta: "+18.1%", points: [210, 230, 220, 260, 240, 250, 380, 300, 280, 290, 310, 330, 300, 340] },
      { name: "Revenue", total: "$61.4k", delta: "+6.8%", points: [40, 41, 43, 42, 42, 44, 45, 47, 46, 48, 52, 51, 54, 56] },
    ],
  },
  stat = {
    label: "02 / Speed",
    title: "Median answer time",
    body: "Across 2.1 billion events. Long enough to blink, not long enough to refill your coffee.",
    value: 184,
    unit: "ms",
    comparison: [
      { name: "Northstar", value: "0.18s", share: 3 },
      { name: "The old warehouse", value: "9.6s", share: 100 },
    ],
  },
  heatmap = {
    label: "03 / Rhythm",
    title: "Know when they show up",
    body: "A week of sessions, hour by hour. Turns out Tuesday at ten is your Black Friday.",
    peakLabel: "Peak · Tue 10:00",
  },
  search = {
    label: "04 / Ask",
    title: "Ask it like you’d ask a person",
    body: "No SQL and no ticket for the data team. Type the question the way you’d say it out loud.",
    queries: [
      { q: "signups from Lisbon last week", answer: "1,284 signups", detail: "+18% on the week before" },
      { q: "why did churn spike on tuesday?", answer: "Checkout errors, 2:10–5:40pm", detail: "412 sessions hit a failed payment" },
      { q: "top referrers to /pricing in october", answer: "newsletter.fieldnote.co", detail: "31% of visits, up from 9%" },
    ],
  },
  alerts = {
    label: "05 / Alerts",
    title: "Alerts with manners",
    body: "Pings for what matters. Silence for the rest.",
    settings: [
      { label: "Weekly digest", detail: "Mondays 9:00 → #growth", on: true },
      { label: "Anomaly alerts", detail: "When a metric moves 3σ", on: true },
      { label: "Hide internal traffic", detail: "14 IPs, 2 office VPNs", on: true },
      { label: "Text me at 3am", detail: "Only if revenue hits zero", on: false },
    ],
    preview: {
      sender: "Northstar",
      channel: "#growth",
      time: "9:41",
      message: "Signups from Lisbon are up 41% since 9:00. Likely cause: newsletter.fieldnote.co.",
      quiet: "All quiet. Anomaly alerts are off.",
      watch: 1,
    },
  },
  map = {
    label: "06 / Live",
    title: "Everyone, everywhere, right now",
    body: "Sessions by city, updated every second, without melting your laptop.",
    liveLabel: "on site now",
    cities: [
      { name: "San Francisco", lon: -122.4, lat: 37.8, visitors: 412 },
      { name: "New York", lon: -74, lat: 40.7, visitors: 538 },
      { name: "Mexico City", lon: -99.1, lat: 19.4, visitors: 121 },
      { name: "São Paulo", lon: -46.6, lat: -23.5, visitors: 207 },
      { name: "London", lon: -0.1, lat: 51.5, visitors: 644 },
      { name: "Lisbon", lon: -9.1, lat: 38.7, visitors: 189 },
      { name: "Lagos", lon: 3.4, lat: 6.5, visitors: 96 },
      { name: "Berlin", lon: 13.4, lat: 52.5, visitors: 302 },
      { name: "Bengaluru", lon: 77.6, lat: 13, visitors: 275 },
      { name: "Singapore", lon: 103.8, lat: 1.3, visitors: 148 },
      { name: "Tokyo", lon: 139.7, lat: 35.7, visitors: 233 },
      { name: "Sydney", lon: 151.2, lat: -33.9, visitors: 247 },
    ],
  },
}: BentoGridProps) {
  return (
    <section className="bg-[#f6f5f2] text-[#141412]" aria-labelledby="bento-grid-heading">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <header className="grid gap-6 pb-10 md:grid-cols-12 md:items-end md:pb-14">
          <div className="md:col-span-7">
            <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#141412]/55">
              <span className="size-1.5 rounded-full bg-[#141412]" aria-hidden="true" />
              {eyebrow}
            </p>
            <h2
              id="bento-grid-heading"
              className="mt-5 font-display text-[clamp(2.5rem,1.4rem+4.6vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
            >
              {heading} <span className="opacity-40">{headingItalic}</span>
            </h2>
          </div>
          <div className="md:col-span-5 md:pb-2">
            <p className="max-w-[46ch] text-[16px] leading-[1.6] text-[#141412]/70">{intro}</p>
            <a
              href={link.href}
              className="group mt-5 inline-flex items-center gap-2 text-[15px] font-semibold underline decoration-[#141412]/25 decoration-[1.5px] underline-offset-[6px] transition-colors hover:decoration-[#141412] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#141412]"
            >
              {link.label}
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[22px] border border-[#141412]/[0.09] bg-[#141412]/[0.09] md:grid-cols-2 lg:grid-cols-6">
          <TrendTile {...trend} className="md:col-span-2 lg:col-span-4" />
          <StatTile {...stat} className="lg:col-span-2" />
          <HeatmapTile {...heatmap} className="lg:col-span-3" />
          <SearchTile {...search} className="lg:col-span-3" />
          <AlertsTile {...alerts} className="lg:col-span-2" />
          <MapTile {...map} className="md:col-span-2 lg:col-span-4" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Shared tile chrome                                                  */
/* ------------------------------------------------------------------ */

function TileHead({ label, title, body, tone = "light" }: TileCopy & { tone?: "light" | "dark" | "accent" }) {
  const dim = tone === "dark" ? "text-[#f6f5f2]/55" : "text-[#141412]/55";
  const bodyTone = tone === "dark" ? "text-[#f6f5f2]/65" : "text-[#141412]/68";
  return (
    <div>
      <p className={`font-mono text-[11px] uppercase tracking-[0.14em] ${dim}`}>{label}</p>
      <h3 className="mt-3 text-balance font-display text-[22px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[24px]">{title}</h3>
      <p className={`mt-2 max-w-[44ch] text-pretty text-[15px] leading-[1.55] ${bodyTone}`}>{body}</p>
    </div>
  );
}

/**
 * Entrance animations only play for tiles the viewer will actually watch arrive:
 * tiles on screen at mount, or tiles that approach from below later. Anything
 * else (a full-page screenshot, a deep link) renders its finished state.
 * `show` is true when the finished state should be on screen.
 */
function useLive<T extends Element>() {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion() ?? false;
  const [staged, setStaged] = useState(false);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduce || typeof IntersectionObserver === "undefined") return;
    const r = el.getBoundingClientRect();
    const visible = (Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / (r.height || 1);
    if (visible >= 0.3) {
      setStaged(true);
      return;
    }
    let first = true;
    const io = new IntersectionObserver(
      ([e]) => {
        if (first) {
          first = false;
          if (e.isIntersecting) io.disconnect();
          return;
        }
        if (e.isIntersecting) {
          setStaged(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px 320px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  return { ref, inView, reduce, staged, show: !staged || inView };
}

/* ------------------------------------------------------------------ */
/* 01 Trend: a line chart that draws itself, then morphs between metrics */
/* ------------------------------------------------------------------ */

function smoothPath(pts: [number, number][]) {
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r(c1[0])},${r(c1[1])} ${r(c2[0])},${r(c2[1])} ${r(p2[0])},${r(p2[1])}`;
  }
  return d;
}

const CW = 640;
const CH = 220;

function project(points: number[]): [number, number][] {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  return points.map((p, i) => [(i / (points.length - 1)) * CW, 24 + (1 - (p - min) / span) * (CH - 48)]);
}

function TrendTile({ label, title, body, dates, metrics, className = "" }: NonNullable<BentoGridProps["trend"]> & { className?: string }) {
  const { ref, inView, reduce, show } = useLive<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    if (!inView || reduce || touched || metrics.length < 2) return;
    const id = setInterval(() => setActive((n) => (n + 1) % metrics.length), 4200);
    return () => clearInterval(id);
  }, [inView, reduce, touched, metrics.length]);

  const m = metrics[active];
  const pts = project(m.points);
  const line = smoothPath(pts);
  const area = `${line} L${CW},${CH} L0,${CH} Z`;
  const last = pts[pts.length - 1];

  return (
    <article ref={ref} className={`flex flex-col gap-8 bg-[#fbfaf8] p-6 sm:p-8 ${className}`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <TileHead label={label} title={title} body={body} />
        <div className="flex shrink-0 flex-wrap gap-1 rounded-full border border-[#141412]/10 bg-[#f6f5f2] p-1" role="group" aria-label="Metric">
          {metrics.map((mm, i) => (
            <button
              key={mm.name}
              type="button"
              aria-pressed={i === active}
              onClick={() => {
                setActive(i);
                setTouched(true);
              }}
              className="relative h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141412]"
            >
              {i === active && (
                <motion.span
                  layoutId={`${gid}-pill`}
                  className="absolute inset-0 rounded-full bg-[#141412]"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span className={`relative ${i === active ? "text-[#f6f5f2]" : "text-[#141412]/65 hover:text-[#141412]"}`}>{mm.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto">
        <div className="mb-4 flex items-baseline gap-3" aria-live="polite">
          <span className="font-display text-[34px] font-semibold tabular-nums leading-none tracking-[-0.04em]">{m.total}</span>
          <span className="rounded-full bg-[#141412] px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-[#d5f56a]">{m.delta}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#141412]/50">14 days</span>
        </div>
        <div className="relative">
          <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" className="block h-[170px] w-full sm:h-[200px]" aria-hidden="true">
            <defs>
              <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INK} stopOpacity="0.12" />
                <stop offset="100%" stopColor={INK} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={CW} y1={CH * f} y2={CH * f} stroke={INK} strokeOpacity="0.08" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
            ))}
            <line x1="0" x2={CW} y1={CH - 0.5} y2={CH - 0.5} stroke={INK} strokeOpacity="0.18" vectorEffect="non-scaling-stroke" />
            <clipPath id={`${gid}-reveal`}>
              {/* The line "draws" by widening this clip, so the stroke can stay non-scaling. */}
              <motion.rect
                x="-4"
                y="-8"
                height={CH + 16}
                initial={false}
                animate={{ width: show ? CW + 8 : 0 }}
                transition={show && !reduce ? { duration: 1.6, ease: [0.45, 0, 0.2, 1] } : { duration: 0 }}
              />
            </clipPath>
            <g clipPath={`url(#${gid}-reveal)`}>
              <motion.path initial={false} animate={{ d: area }} transition={{ duration: reduce ? 0 : 0.9, ease }} fill={`url(#${gid}-fill)`} />
              <motion.path
                initial={false}
                animate={{ d: line }}
                transition={{ duration: reduce ? 0 : 0.9, ease }}
                fill="none"
                stroke={INK}
                strokeWidth="2.25"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
          <motion.span
            aria-hidden="true"
            className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#141412] bg-[#d5f56a]"
            initial={false}
            animate={{ left: `${(last[0] / CW) * 100}%`, top: `${(last[1] / CH) * 100}%`, scale: show ? 1 : 0 }}
            transition={{
              duration: reduce ? 0 : 0.9,
              ease,
              scale: show && !reduce ? { delay: 1.45, type: "spring", stiffness: 500, damping: 22 } : { duration: 0 },
            }}
          />
        </div>
        <div className="mt-3 flex justify-between font-mono text-[11px] uppercase tracking-[0.1em] text-[#141412]/50">
          {dates.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* 02 Stat: accent tile, one number counting up                        */
/* ------------------------------------------------------------------ */

function StatTile({ label, title, body, value, unit, comparison, className = "" }: NonNullable<BentoGridProps["stat"]> & { className?: string }) {
  const { ref, reduce, staged, show } = useLive<HTMLDivElement>();
  const [n, setN] = useState(value);

  useLayoutEffect(() => {
    if (!staged) {
      setN(value);
      return;
    }
    if (!show) {
      setN(0);
      return;
    }
    if (reduce) {
      setN(value);
      return;
    }
    const c = animate(0, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [staged, show, reduce, value]);

  return (
    <article ref={ref} className={`flex flex-col justify-between gap-10 bg-[#d5f56a] p-6 text-[#141412] sm:p-8 ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#141412]/60">{label}</p>
      <div>
        <p className="flex items-baseline font-display font-semibold leading-[0.85] tracking-[-0.06em]">
          <span className="text-[clamp(5.5rem,4rem+5vw,8.5rem)] tabular-nums">{n}</span>
          <span className="ml-1 text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] tracking-[-0.04em]">{unit}</span>
        </p>
        <h3 className="mt-5 font-display text-[20px] font-semibold tracking-[-0.025em]">{title}</h3>
        <p className="mt-1.5 max-w-[34ch] text-[15px] leading-[1.55] text-[#141412]/72">{body}</p>
        <dl className="mt-7 space-y-3 border-t border-[#141412]/15 pt-5">
          {comparison.map((c, i) => (
            <div key={c.name}>
              <div className="flex justify-between font-mono text-[11px] uppercase tracking-[0.1em]">
                <dt className="text-[#141412]/70">{c.name}</dt>
                <dd className="tabular-nums">{c.value}</dd>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[#141412]/10">
                <motion.div
                  className="h-full rounded-full bg-[#141412]"
                  initial={false}
                  animate={{ width: show ? `${Math.max(c.share, 2)}%` : "0%" }}
                  transition={show && !reduce ? { duration: i === 0 ? 0.4 : 2.4, delay: 0.3, ease: i === 0 ? ease : "linear" } : { duration: 0 }}
                />
              </div>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Heatmap: weekday × hour, cells keep ticking                      */
/* ------------------------------------------------------------------ */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function baseLevel(day: number, hour: number) {
  const weekend = day >= 5;
  const morning = Math.exp(-((hour - (weekend ? 11 : 10)) ** 2) / 6);
  const afternoon = Math.exp(-((hour - (weekend ? 16 : 15)) ** 2) / 8);
  const evening = Math.exp(-((hour - 21) ** 2) / 4) * 0.5;
  let v = (morning * 1.05 + afternoon * 0.85 + evening) * (weekend ? 0.55 : 1);
  if (day === 1) v *= 1.25;
  if (day === 4) v *= 0.85;
  const jitter = (((Math.sin(day * 12.9898 + hour * 78.233) * 43758.5453) % 1) + 1) % 1;
  v += (jitter - 0.5) * 0.18;
  return Math.max(0, Math.min(4, Math.round(v * 3.6)));
}

const HEAT = ["bg-[#141412]/[0.05]", "bg-[#141412]/[0.16]", "bg-[#141412]/[0.34]", "bg-[#141412]/[0.6]", "bg-[#141412]"];

function HeatmapTile({ label, title, body, peakLabel, className = "" }: NonNullable<BentoGridProps["heatmap"]> & { className?: string }) {
  const { ref, inView, reduce, show } = useLive<HTMLDivElement>();
  const base = useMemo(() => DAYS.map((_, d) => Array.from({ length: 24 }, (_, h) => baseLevel(d, h))), []);
  const [bump, setBump] = useState<{ d: number; h: number; k: number } | null>(null);

  useEffect(() => {
    if (!inView || reduce) return;
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      const d = Math.floor(Math.random() * 7);
      const h = 7 + Math.floor(Math.random() * 15);
      setBump({ d, h, k });
    }, 650);
    return () => clearInterval(id);
  }, [inView, reduce]);

  return (
    <article ref={ref} className={`flex flex-col gap-8 bg-[#fbfaf8] p-6 sm:p-8 ${className}`}>
      <TileHead label={label} title={title} body={body} />
      <div className="mt-auto" role="img" aria-label={`Sessions by weekday and hour. ${peakLabel}.`}>
        <div className="grid grid-cols-[28px_1fr] gap-x-2 gap-y-[3px]">
          {base.map((row, d) => (
            <div key={DAYS[d]} className="contents">
              <span className="self-center font-mono text-[10px] uppercase tracking-[0.06em] text-[#141412]/50">{DAYS[d].slice(0, 2)}</span>
              <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
                {row.map((lvl, h) => {
                  const isPeak = d === 1 && h === 10;
                  const isBump = bump?.d === d && bump?.h === h;
                  return (
                    <motion.span
                      key={h}
                      className={`relative aspect-square rounded-[3px] ${isPeak ? "bg-[#d5f56a] ring-2 ring-[#141412] ring-inset" : HEAT[isBump ? Math.min(4, lvl + 2) : lvl]}`}
                      initial={false}
                      animate={show ? { opacity: 1, scale: isBump ? [1, 1.35, 1] : 1 } : { opacity: 0, scale: 0.4 }}
                      transition={!show || reduce ? { duration: 0 } : isBump ? { duration: 0.5, ease } : { duration: 0.4, ease, delay: h * 0.025 + d * 0.04 }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <span />
          <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.06em] text-[#141412]/50">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#141412]/10 pt-4">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em]">
            <span className="size-2.5 rounded-[2px] bg-[#d5f56a] ring-2 ring-[#141412] ring-inset" aria-hidden="true" />
            {peakLabel}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#141412]/50" aria-hidden="true">
            Less
            {HEAT.map((c) => (
              <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
            ))}
            More
          </span>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Search: types a question, shows the answer, starts over          */
/* ------------------------------------------------------------------ */

function SearchTile({ label, title, body, queries, className = "" }: NonNullable<BentoGridProps["search"]> & { className?: string }) {
  const { ref, inView, reduce } = useLive<HTMLDivElement>();
  const [qi, setQi] = useState(0);
  // Starts on a finished answer so a still frame (or reduced motion) still tells the story.
  const [typed, setTyped] = useState(queries[0].q.length);
  const [phase, setPhase] = useState<"typing" | "answer" | "clearing">("answer");
  const q = queries[qi];

  useEffect(() => {
    if (reduce) {
      setTyped(q.q.length);
      setPhase("answer");
      return;
    }
    if (!inView) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (typed < q.q.length) t = setTimeout(() => setTyped((n) => n + 1), 38 + Math.random() * 50);
      else t = setTimeout(() => setPhase("answer"), 380);
    } else if (phase === "answer") {
      t = setTimeout(() => setPhase("clearing"), 2600);
    } else {
      if (typed > 0) t = setTimeout(() => setTyped((n) => Math.max(0, n - 3)), 18);
      else
        t = setTimeout(() => {
          setQi((n) => (n + 1) % queries.length);
          setPhase("typing");
        }, 220);
    }
    return () => clearTimeout(t);
  }, [inView, reduce, phase, typed, q.q.length, queries.length]);

  return (
    <article ref={ref} className={`flex flex-col gap-8 bg-[#fbfaf8] p-6 sm:p-8 ${className}`}>
      <TileHead label={label} title={title} body={body} />
      <ul className="sr-only">
        {queries.map((x) => (
          <li key={x.q}>
            “{x.q}”: {x.answer}, {x.detail}
          </li>
        ))}
      </ul>
      <div className="mt-auto" aria-hidden="true">
        <div className="flex h-14 items-center gap-3 rounded-[14px] border border-[#141412]/15 bg-white px-4 shadow-[0_1px_0_rgba(20,20,18,0.04),0_8px_24px_-12px_rgba(20,20,18,0.18)]">
          <Search className="size-[18px] shrink-0 text-[#141412]/60" strokeWidth={2} />
          <p className="min-w-0 flex-1 truncate text-[15px] text-[#141412]">
            {q.q.slice(0, typed)}
            <span className="ml-px inline-block h-[18px] w-[2px] translate-y-[3px] animate-pulse bg-[#141412] motion-reduce:animate-none" />
          </p>
          <kbd className="hidden shrink-0 rounded-md border border-[#141412]/15 px-1.5 py-0.5 font-mono text-[11px] text-[#141412]/55 sm:inline">⌘K</kbd>
        </div>
        <div className="relative mt-3 h-[92px]">
          <AnimatePresence mode="wait">
            {phase === "answer" ? (
              <motion.div
                key={qi}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.2 } }}
                transition={{ duration: 0.45, ease }}
                className="absolute inset-0 flex items-center justify-between gap-4 rounded-[14px] bg-[#141412] px-5 text-[#f6f5f2]"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#d5f56a]">Answer</p>
                  <p className="mt-1 truncate font-display text-[19px] font-semibold tracking-[-0.02em]">{q.answer}</p>
                  <p className="truncate text-[13px] text-[#f6f5f2]/60">{q.detail}</p>
                </div>
                <MiniBars seed={qi} />
              </motion.div>
            ) : (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col justify-center gap-2.5 rounded-[14px] border border-dashed border-[#141412]/15 px-5"
              >
                <span className="h-2 w-24 rounded-full bg-[#141412]/10" />
                <span className="h-3 w-44 rounded-full bg-[#141412]/[0.07]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}

function MiniBars({ seed }: { seed: number }) {
  const bars = [0.35, 0.5, 0.42, 0.62, 0.55, 0.8, 1].map((b, i) => Math.max(0.2, Math.min(1, b + Math.sin(seed * 3 + i) * 0.12)));
  return (
    <div className="hidden h-12 shrink-0 items-end gap-1 min-[400px]:flex">
      {bars.map((b, i) => (
        <motion.span
          key={i}
          className={`w-2 rounded-[2px] ${i === bars.length - 1 ? "bg-[#d5f56a]" : "bg-[#f6f5f2]/30"}`}
          initial={{ height: 0 }}
          animate={{ height: `${b * 100}%` }}
          transition={{ duration: 0.5, ease, delay: 0.1 + i * 0.04 }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Alerts: real switches that flip themselves until touched         */
/* ------------------------------------------------------------------ */

function AlertsTile({ label, title, body, settings, preview, className = "" }: NonNullable<BentoGridProps["alerts"]> & { className?: string }) {
  const { ref, inView, reduce } = useLive<HTMLDivElement>();
  const [state, setState] = useState(() => settings.map((s) => s.on));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!inView || reduce || touched) return;
    let step = 0;
    const order = [1, 3, 3, 1, 2, 2];
    const id = setInterval(() => {
      const i = order[step % order.length] % settings.length;
      step += 1;
      setState((s) => s.map((v, j) => (j === i ? !v : v)));
    }, 1700);
    return () => clearInterval(id);
  }, [inView, reduce, touched, settings.length]);

  return (
    <article ref={ref} className={`flex flex-col gap-8 bg-[#fbfaf8] p-6 sm:p-8 ${className}`}>
      <TileHead label={label} title={title} body={body} />
      <div className="mt-auto space-y-3">
        <div className="relative h-[96px]" aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            {state[preview.watch] ? (
              <motion.div
                key="msg"
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, transition: { duration: 0.2 } }}
                transition={{ duration: 0.45, ease }}
                className="absolute inset-0 flex gap-3 rounded-[14px] border border-[#141412]/12 bg-white p-3.5"
              >
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#141412]">
                  <svg viewBox="0 0 16 16" className="size-3.5 text-[#d5f56a]" fill="currentColor">
                    <path d="M8 1.5 13.5 14 8 10.6 2.5 14Z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 text-[13px]">
                    <span className="font-semibold">{preview.sender}</span>
                    <span className="truncate font-mono text-[11px] text-[#141412]/50">
                      {preview.channel} · {preview.time}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-[1.45] text-[#141412]/75">{preview.message}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="quiet"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.15 } }}
                className="absolute inset-0 flex items-center justify-center rounded-[14px] border border-dashed border-[#141412]/15 px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[#141412]/45"
              >
                {preview.quiet}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="overflow-hidden rounded-[14px] border border-[#141412]/12 bg-white">
          {settings.map((s, i) => (
            <button
              key={s.label}
              type="button"
              role="switch"
              aria-checked={state[i]}
              onClick={() => {
                setTouched(true);
                setState((st) => st.map((v, j) => (j === i ? !v : v)));
              }}
              className="flex min-h-[60px] w-full items-center justify-between gap-4 border-t border-[#141412]/[0.08] px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-[#f6f5f2] focus-visible:bg-[#f6f5f2] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#141412]"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium leading-tight">{s.label}</span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-[#141412]/55">{s.detail}</span>
              </span>
              <span
                aria-hidden="true"
                className={`flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-300 ${state[i] ? "justify-end bg-[#141412]" : "justify-start bg-[#141412]/15"}`}
              >
                <motion.span
                  layout
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 600, damping: 34 }}
                  className={`size-4 rounded-full ${state[i] ? "bg-[#d5f56a]" : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]"}`}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* 06 Map: dark tile, dot-matrix world with pulsing cities             */
/* ------------------------------------------------------------------ */

// Rough continent outlines as "lon,lat" pairs. Coarse on purpose: they're sampled into a dot grid.
const LAND_OUTLINES: Record<string, string> = {
  "North America": "-166,68 -156,71 -140,70 -128,70 -115,68 -95,70 -82,69 -76,64 -66,60 -62,54 -56,51 -66,45 -70,42 -75,38 -77,35 -81,31 -80,26 -82,25 -83,29 -89,30 -95,29 -97,25 -97,21 -94,18 -91,19 -87,21 -88,16 -84,15 -83,10 -78,8 -80,7 -84,9 -87,13 -92,15 -96,16 -105,20 -106,23 -112,29 -110,23 -115,30 -117,33 -121,35 -124,40 -124,46 -125,49 -130,54 -137,58 -146,61 -152,59 -158,57 -162,60 -166,62",
  "Arctic islands": "-120,72 -96,74 -80,73 -68,77 -62,81 -90,81 -110,77 -122,75",
  "Greenland": "-55,60 -44,60 -36,65 -22,70 -19,76 -22,80 -34,83 -58,82 -70,78 -60,75 -55,69 -52,64",
  "Iceland": "-24,64 -14,64 -13,66 -22,66.5",
  "South America": "-78,8 -72,12 -63,11 -52,5 -50,0 -44,-2 -35,-6 -37,-12 -39,-17 -41,-22 -48,-26 -53,-33 -57,-36 -62,-39 -65,-42 -66,-47 -69,-51 -71,-54 -74,-52 -74,-46 -73,-38 -71,-30 -70,-20 -76,-14 -80,-7 -81,-3 -80,1",
  "Europe and Asia": "-9,37 -9,43 -2,43.5 -1.5,46 -4.5,48 -1.5,48.8 1.5,50.2 2,51 5,53 8,54 8,57 11,59 7,58 5,61 10,64 15,68 20,70 28,71 40,68 44,68 55,69 68,70 80,73 100,77 112,74 130,72 142,72 160,70 176,68 180,65 176,62 164,60 160,55 156,51 154,59 142,59 136,54 140,48 136,43 130,42 129,36 126,35 126,38 121,40 118,38 122,36 120,32 122,30 120,26 116,23 110,21 106,20 108,16 109,12 105,9 103,10 100,13 99,9 101,6 103,2 101,3 98,8 98,14 95,17 92,21 89,22 86,20 80,15 80,10 77,8 74,14 72,20 70,22 67,25 61,25 57,26 56,24 59,23 57,19 52,16 45,13 43,14 39,21 35,28 34,31 35,34 36,36 30,36.5 27,37 26,40 29,41 23,40 22,37 20,40 19,42 15,45 13,45.5 16,41 18,40 16,38 15,40 12,42 9,44 5,43 3,42 0,39 -1,37 -5,36",
  "Great Britain": "-5.5,50 1.5,51 1.7,52.8 0,54 -1.5,55.5 -2,57.5 -4,58.6 -6,58 -5.5,56 -4.8,54.6 -3,53.4 -4.6,52.8 -5,51.6",
  "Ireland": "-10,51.6 -6,52 -6,54 -7.5,55.3 -10,54.2",
  "Africa": "-17,15 -17,21 -13,27 -10,30 -9,33 -6,35.8 3,36.8 10,37 11,33 16,31 20,31 25,32 32,31.3 34,28 38,20 39,16 43,12 51,11.8 50,9 47,5 42,-1 40,-6 40,-15 36,-20 35,-24 32,-28 28,-33 20,-35 18,-32 15,-27 12,-18 13,-11 12,-5 9,-1 9,4 5,4.5 1,6 -4,5 -8,4.5 -11,7 -13,9 -16.5,12.5",
  "Madagascar": "44,-25 47,-25 50.5,-15 49.5,-12 44,-17",
  "Sri Lanka": "80,6 82,7 81.5,9.5 79.8,9",
  "Honshu": "130,31 134,33.5 140,35 141,38 141.5,41 140,41 139.5,38 136,37 132.5,35.5 130,33.6",
  "Hokkaido": "140,42 145.5,43.5 142,45.5 140.5,43.5",
  "Philippines": "120,18.5 122.5,18.5 124,13 126.5,7 125,6 122,7 121,12",
  "Sumatra and Java": "95,5.5 98,4 104,-3 106,-6 114,-8 120,-9 118,-7.5 110,-6.5 106,-5.5 104,-1 100,1",
  "Borneo": "109,1.5 111,-3 116,-4 119,1 117,7 114,4",
  "New Guinea": "131,-1 138,-2 145,-5 150,-10 142,-9 136,-4.5",
  "Australia": "114,-22 113.5,-26 115,-34 118,-35 123,-34 129,-31.5 135,-34 138,-35.5 140,-38 146,-39 150,-37.5 153,-32 153.5,-25 150,-22 146,-19 145.5,-15 143,-11 141.5,-13 140,-17.5 136,-15 137,-12 132,-11.5 130,-13 126,-14 122,-17 119,-20",
  "New Zealand": "172.5,-34.5 178.5,-37.5 176,-41.5 174,-41 171,-44 167,-46.5 170,-46 172.5,-42 174.5,-39",
};
// Water inside those outlines: Hudson Bay, the Black and Caspian seas, the Gulf.
const WATER_OUTLINES = [
  "-94,59 -86,64 -80,63 -78,56 -82,52 -90,57",
  "28,41.3 41,41.5 41,46.5 31,46.6",
  "47,37 54,37 54,45 49,46.5 47,42",
  "48,30 50,26 56,24 56,26.5 52,28 50,30",
];

const parse = (o: string) => o.split(" ").map((pair) => pair.split(",").map(Number) as [number, number]);

function inside([x, y]: [number, number], poly: [number, number][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const MAP_TOP = 80;
const MAP_BOTTOM = -56;
const STEP = 2.5;

function landDots() {
  const land = Object.values(LAND_OUTLINES).map(parse);
  const water = WATER_OUTLINES.map(parse);
  const dots: [number, number][] = [];
  for (let lat = MAP_TOP - STEP / 2; lat > MAP_BOTTOM; lat -= STEP) {
    for (let lon = -180 + STEP / 2; lon < 180; lon += STEP) {
      const p: [number, number] = [lon, lat];
      if (!land.some((poly) => inside(p, poly)) || water.some((poly) => inside(p, poly))) continue;
      dots.push([lon + 180, MAP_TOP - lat]);
    }
  }
  return dots;
}

function MapTile({ label, title, body, liveLabel, cities, className = "" }: NonNullable<BentoGridProps["map"]> & { className?: string }) {
  const { ref, inView, reduce } = useLive<HTMLDivElement>();
  const dots = useMemo(landDots, []);
  const [counts, setCounts] = useState(() => cities.map((c) => c.visitors));
  const [flash, setFlash] = useState(-1);
  const total = counts.reduce((a, b) => a + b, 0);
  const top = useMemo(
    () =>
      counts
        .map((v, i) => ({ v, i }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 4),
    [counts],
  );

  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => {
      const i = Math.floor(Math.random() * cities.length);
      setFlash(i);
      setCounts((cs) => cs.map((v, j) => (j === i ? v + 1 + Math.floor(Math.random() * 4) : Math.random() < 0.15 ? Math.max(1, v - 1) : v)));
    }, 1100);
    return () => clearInterval(id);
  }, [inView, reduce, cities.length]);

  const H = MAP_TOP - MAP_BOTTOM;

  return (
    <article ref={ref} className={`flex flex-col gap-6 bg-[#141412] p-6 text-[#f6f5f2] sm:p-8 ${className}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <TileHead label={label} title={title} body={body} tone="dark" />
        <div className="shrink-0 sm:text-right" aria-live="off">
          <p className="font-display text-[40px] font-semibold tabular-nums leading-none tracking-[-0.04em]">{total.toLocaleString("en-US")}</p>
          <p className="mt-2 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#f6f5f2]/60">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#d5f56a] opacity-70 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-[#d5f56a]" />
            </span>
            {liveLabel}
          </p>
        </div>
      </div>

      <div className="relative -mx-2 mt-auto sm:mx-0">
        <svg
          viewBox={`0 0 360 ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`World map of live sessions: ${cities.map((c) => c.name).join(", ")}.`}
        >
          {dots.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={0.82} fill="#f6f5f2" fillOpacity={0.2} />
          ))}
          {cities.map((c, i) => {
            const x = c.lon + 180;
            const y = MAP_TOP - c.lat;
            return (
              <g key={c.name}>
                {!reduce && inView && (
                  <motion.circle
                    cx={x}
                    cy={y}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={0.6}
                    initial={{ r: 1.6, opacity: 0.9 }}
                    animate={{ r: [1.6, 7], opacity: [0.9, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: (i * 0.37) % 2.4, ease: "easeOut" }}
                  />
                )}
                <motion.circle
                  cx={x}
                  cy={y}
                  fill={ACCENT}
                  initial={false}
                  animate={{ r: flash === i && !reduce ? [1.7, 3, 1.7] : 1.7 }}
                  transition={{ duration: 0.6, ease }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <ol className="grid grid-cols-2 gap-x-6 border-t border-[#f6f5f2]/12 pt-5 sm:grid-cols-4">
        {top.map(({ v, i }, rank) => (
          <motion.li layout={!reduce} key={cities[i].name} className="flex items-baseline justify-between gap-3 py-1.5 sm:block">
            <span className="flex items-baseline gap-2 text-[14px] text-[#f6f5f2]/85">
              <span className="font-mono text-[10px] text-[#f6f5f2]/45">{String(rank + 1).padStart(2, "0")}</span>
              {cities[i].name}
            </span>
            <span className="font-mono text-[13px] tabular-nums text-[#d5f56a] sm:mt-1 sm:block sm:pl-[22px]">{v.toLocaleString("en-US")}</span>
          </motion.li>
        ))}
      </ol>
    </article>
  );
}

export default BentoGrid;

