"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Transition, type Variants } from "motion/react";
import { Search } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TileCopy = { label: string; title: string; body: string };
type Metric = { name: string; total: string; delta: string; points: number[] };
type Query = { q: string; answer: string; detail: string };
type Setting = { label: string; detail: string; on: boolean };
type AlertPreview = { sender: string; channel: string; time: string; message: string; quiet: string; watch: number };
type City = { name: string; lon: number; lat: number; visitors: number };
type Span = { className?: string };

export type TrendTileProps = TileCopy & Span & { dates: [string, string, string]; metrics: Metric[] };
export type StatTileProps = TileCopy & Span & { value: number; unit: string; comparison: { name: string; value: string; share: number }[] };
export type HeatmapTileProps = TileCopy & Span & { peakLabel: string };
export type SearchTileProps = TileCopy & Span & { queries: Query[] };
export type AlertsTileProps = TileCopy & Span & { settings: Setting[]; preview: AlertPreview };
export type MapTileProps = TileCopy & Span & { liveLabel: string; cities: City[] };

export type BentoGridProps = {
  /** Near-black (default) or warm paper. */
  theme?: "dark" | "light";
  /** The one signal colour: the chart's "now" dot, the peak cell, live cities. */
  accent?: string;
  /** Optional section header. Omit `heading` and the grid stands on its own. */
  eyebrow?: string;
  heading?: string;
  /** Muted second clause of the heading. */
  headingMuted?: string;
  intro?: string;
  link?: { label: string; href: string };
  /** Line-chart tile. Each metric needs the same number of points (7–30). */
  trend?: TrendTileProps;
  /** Inverted tile with one big number that counts up. */
  stat?: StatTileProps;
  /** Weekday × hour activity heatmap. */
  heatmap?: HeatmapTileProps;
  /** Search bar that types each query, then shows its answer. */
  search?: SearchTileProps;
  /** Settings card. Rows are real switches; they flip on their own until someone touches one. */
  alerts?: AlertsTileProps;
  /** Deep tile: a dot-matrix world map with pulsing cities. */
  map?: MapTileProps;
  /** Compose your own grid from the exported tiles instead of the default six. */
  children?: ReactNode;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    page: "#0a0a0a",
    tile: "#101010",
    ink: "#f4f4f2",
    // Solid, not translucent: neighbouring tiles' rings overlap in the gap.
    rule: "#222222",
    // The stat tile flips to the ink colour; the map sinks a step darker.
    invert: "#f4f4f2",
    invertInk: "#0a0a0a",
    deep: "#060606",
    deepInk: "#f4f4f2",
    field: "#161616",
    card: "#1b1b1b",
    cardInk: "#f4f4f2",
  },
  light: {
    page: "#f6f5f2",
    tile: "#fbfaf8",
    ink: "#141412",
    rule: "#e2e1dd",
    invert: "#141412",
    invertInk: "#f6f5f2",
    deep: "#141412",
    deepInk: "#f6f5f2",
    field: "#ffffff",
    card: "#141412",
    cardInk: "#f6f5f2",
  },
} as const;

const ACCENT = "#d5f56a";

type Bezier = readonly [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];
/** Lines and sweeps start slow and land softly, like a pen. */
const EASE_DRAW: Bezier = [0.45, 0, 0.2, 1];
/** Counting eases out harder so the last digits settle rather than spin. */
const EASE_COUNT: Bezier = [0.16, 1, 0.3, 1];

// One timeline per tile, in seconds after the tile starts: container → text →
// figures → data → progress. Tiles in a row start TILE_STEP apart, and rows
// further down the viewport start later, so the grid reads top-left first.
const T = {
  tileStep: 0.07,
  rowLag: 0.22,
  rise: 0.6,
  text: 0.08,
  textStep: 0.05,
  figure: 0.24,
  data: 0.3,
  draw: 0.7,
  count: 0.9,
  progress: 0.62,
  tick: 0.45,
} as const;

/**
 * Rise 12px out of an 8px blur. `custom` is the start time in seconds, or
 * null to snap (a tile that renders finished). Hiding is always instant: it
 * only ever happens off screen, before an entrance.
 */
const RISE: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)", transition: { duration: 0 } },
  show: (delay: number | null) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: delay === null ? { duration: 0 } : { duration: T.rise, ease: EASE, delay },
  }),
};

/** Tiles land first and carry no blur of their own, so it never compounds with their contents'. */
const LAND: Variants = {
  hidden: { opacity: 0, y: 16, transition: { duration: 0 } },
  show: (delay: number | null) => ({ opacity: 1, y: 0, transition: delay === null ? { duration: 0 } : { duration: T.rise, ease: EASE, delay } }),
};

const MONO = "font-mono uppercase";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--bn-ink)";

/* ------------------------------------------------------------------ */
/* Grid                                                                */
/* ------------------------------------------------------------------ */

export function BentoGrid({
  theme = "dark",
  accent = ACCENT,
  eyebrow,
  heading,
  headingMuted,
  intro,
  link,
  trend = DEFAULTS.trend,
  stat = DEFAULTS.stat,
  heatmap = DEFAULTS.heatmap,
  search = DEFAULTS.search,
  alerts = DEFAULTS.alerts,
  map = DEFAULTS.map,
  children,
}: BentoGridProps) {
  const p = PALETTE[theme];
  const vars = {
    "--bn-page": p.page,
    "--bn-tile": p.tile,
    "--bn-ink": p.ink,
    "--bn-rule": p.rule,
    "--bn-invert": p.invert,
    "--bn-invert-ink": p.invertInk,
    "--bn-deep": p.deep,
    "--bn-deep-ink": p.deepInk,
    "--bn-field": p.field,
    "--bn-card": p.card,
    "--bn-card-ink": p.cardInk,
    "--bn-accent": accent,
    colorScheme: theme,
  } as CSSProperties;
  const headingId = useId();

  return (
    <section style={vars} aria-labelledby={heading ? headingId : undefined} aria-label={heading ? undefined : "Product features"} className="@container bg-(--bn-page) text-(--bn-ink)">
      <style>{KEYFRAMES}</style>
      <div className="mx-auto max-w-7xl px-4 py-10 @xl:px-8 @xl:py-16 @5xl:px-12 @5xl:py-20">
        {heading ? <GridHeader id={headingId} eyebrow={eyebrow} heading={heading} muted={headingMuted} intro={intro} link={link} /> : null}
        {/* One sheet of hairlines: each tile's 1px ring fills the 1px gap, so the
            rules arrive with their tiles instead of sitting there as a grey slab. */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[22px] border border-(--bn-rule) @3xl:grid-cols-2 @5xl:grid-cols-6">
          {children ?? (
            <>
              <TrendTile {...trend} className="@3xl:col-span-2 @5xl:col-span-4" />
              <StatTile {...stat} className="@5xl:col-span-2" />
              <HeatmapTile {...heatmap} className="@5xl:col-span-3" />
              <SearchTile {...search} className="@5xl:col-span-3" />
              <AlertsTile {...alerts} className="@5xl:col-span-2" />
              <MapTile {...map} className="@3xl:col-span-2 @5xl:col-span-4" />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function GridHeader({ id, eyebrow, heading, muted, intro, link }: { id: string; eyebrow?: string; heading: string; muted?: string; intro?: string; link?: { label: string; href: string } }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.header
      ref={ref}
      initial={reduce ? false : "hidden"}
      animate={inView || reduce ? "show" : "hidden"}
      className="grid gap-6 pb-10 @3xl:grid-cols-12 @3xl:items-end @3xl:pb-14"
    >
      <div className="@3xl:col-span-7">
        {eyebrow ? (
          <motion.p variants={RISE} custom={0} className={`flex items-center gap-2.5 ${MONO} text-[11px] tracking-[0.16em] text-(--bn-ink)/55`}>
            <span className="size-1.5 rounded-full bg-(--bn-ink)" aria-hidden="true" />
            {eyebrow}
          </motion.p>
        ) : null}
        <motion.h2
          id={id}
          variants={RISE}
          custom={0.06}
          className="mt-5 text-balance font-display text-[clamp(2.5rem,1.4rem+4.6vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
        >
          {heading} {muted ? <span className="opacity-40">{muted}</span> : null}
        </motion.h2>
      </div>
      <div className="@3xl:col-span-5 @3xl:pb-2">
        {intro ? (
          <motion.p variants={RISE} custom={0.12} className="max-w-[46ch] text-[16px] leading-[1.6] text-(--bn-ink)/70">
            {intro}
          </motion.p>
        ) : null}
        {link ? (
          <motion.a
            variants={RISE}
            custom={0.18}
            href={link.href}
            className={`group mt-5 inline-flex items-center gap-2 text-[15px] font-semibold underline decoration-(--bn-ink)/25 decoration-[1.5px] underline-offset-[6px] transition-[text-decoration-color,transform] duration-150 hover:decoration-(--bn-ink) active:scale-[0.97] focus-visible:rounded-sm ${FOCUS}`}
          >
            {link.label}
            <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">
              →
            </span>
          </motion.a>
        ) : null}
      </div>
    </motion.header>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal: when, and in what order, a tile plays its entrance          */
/* ------------------------------------------------------------------ */

/**
 * "pending" until the first layout pass decides; "final" renders finished;
 * "hidden" waits just off screen; "play" runs the entrance.
 */
type Phase = "pending" | "final" | "hidden" | "play";

const APPROACH = "0px 0px 320px 0px";

/**
 * Entrances only play for tiles the viewer will watch arrive: tiles on screen
 * at mount, or tiles that approach from below later. Anything else (a deep
 * link, a full-page screenshot) renders finished. Everything starts hidden in
 * the server HTML, so tiles on screen never flash their final state first.
 * `live` gates the ambient loops, so they pause whenever the tile is off screen.
 */
function useReveal(order = 0) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [stage, setStage] = useState<Phase>("pending");
  const [base, setBase] = useState(order * T.tileStep);
  const entered = useInView(ref, { once: true, amount: 0.25 });
  const onScreen = useInView(ref, { amount: 0.05 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduce || typeof IntersectionObserver === "undefined") return setStage("final");
    const r = el.getBoundingClientRect();
    const visible = (Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / (r.height || 1);
    if (visible >= 0.25) {
      // Lower rows on screen at mount start a little later, so the grid reads top to bottom.
      setBase(order * T.tileStep + (Math.max(0, r.top) / window.innerHeight) * T.rowLag);
      return setStage("hidden");
    }
    setStage("final");
    let first = true;
    const io = new IntersectionObserver(
      ([e]) => {
        // The first report describes the mount position: already in the
        // approach zone means it stays finished rather than vanishing.
        if (first) {
          first = false;
          if (e.isIntersecting) io.disconnect();
          return;
        }
        if (e.isIntersecting) {
          setStage("hidden");
          io.disconnect();
        }
      },
      { rootMargin: APPROACH },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce, order]);

  const phase: Phase = stage === "hidden" && entered ? "play" : stage;
  const shown = phase === "final" || phase === "play";
  /** Start time for `offset` on this tile's timeline, or null to snap. */
  const at = (offset: number) => (phase === "play" ? base + offset : null);
  return { ref, reduce, phase, shown, at, live: onScreen && shown && !reduce };
}

type Reveal = ReturnType<typeof useReveal>;

/** Transition for one-off values: plays on the timeline, snaps otherwise. */
const timed = (r: Reveal, offset: number, duration: number, ease: Bezier | "linear" = EASE): Transition => {
  const delay = r.at(offset);
  return delay === null ? { duration: 0 } : { duration, delay, ease };
};

/* ------------------------------------------------------------------ */
/* Shared tile chrome                                                  */
/* ------------------------------------------------------------------ */

const SURFACE: Record<"tile" | "invert" | "deep", CSSProperties> = {
  tile: { "--bn-surface": "var(--bn-tile)" } as CSSProperties,
  // Re-pointing --bn-ink inside the tile flips every ink-based utility at once.
  invert: { "--bn-surface": "var(--bn-invert)", "--bn-ink": "var(--bn-invert-ink)" } as CSSProperties,
  deep: { "--bn-surface": "var(--bn-deep)", "--bn-ink": "var(--bn-deep-ink)" } as CSSProperties,
};

function Tile({ reveal, surface = "tile", className = "", children }: { reveal: Reveal; surface?: keyof typeof SURFACE; className?: string; children: ReactNode }) {
  return (
    <motion.article
      ref={reveal.ref}
      style={SURFACE[surface]}
      initial="hidden"
      animate={reveal.shown ? "show" : "hidden"}
      variants={LAND}
      custom={reveal.at(0)}
      className={`flex min-w-0 flex-col gap-8 bg-(--bn-surface) p-6 text-(--bn-ink) shadow-[0_0_0_1px_var(--bn-rule)] @xl:p-8 ${className}`}
    >
      {children}
    </motion.article>
  );
}

function TileHead({ reveal, label, title, body }: TileCopy & { reveal: Reveal }) {
  return (
    <div>
      <motion.p variants={RISE} custom={reveal.at(T.text)} className={`${MONO} text-[11px] tracking-[0.14em] text-(--bn-ink)/55`}>
        {label}
      </motion.p>
      <motion.h3
        variants={RISE}
        custom={reveal.at(T.text + T.textStep)}
        className="mt-3 text-balance font-display text-[22px] font-semibold leading-[1.1] tracking-[-0.03em] @xl:text-[24px]"
      >
        {title}
      </motion.h3>
      <motion.p variants={RISE} custom={reveal.at(T.text + T.textStep * 2)} className="mt-2 max-w-[44ch] text-pretty text-[15px] leading-[1.55] text-(--bn-ink)/68">
        {body}
      </motion.p>
    </div>
  );
}

/**
 * A figure that counts up from zero out of a light blur on entrance, then
 * eases between later values. Driven by motion values, so counting never
 * re-renders the tile. `replay` counts from zero again when it mounts (used
 * when a figure is swapped for another).
 */
function CountUp({
  value,
  format,
  reveal,
  offset = T.figure,
  replay = false,
  className = "",
}: {
  value: number;
  format: (v: number) => string;
  reveal: Reveal;
  offset?: number;
  replay?: boolean;
  className?: string;
}) {
  const { phase, reduce, shown } = reveal;
  const fromZero = replay && !reduce;
  const n = useMotionValue(!shown || fromZero ? 0 : value);
  const settle = useMotionValue(!shown || fromZero ? 0 : 1);
  // What the next visible update does: snap, count from zero (entrance or replay) or tick.
  const next = useRef<"snap" | "entrance" | "replay" | "tick">(fromZero ? "replay" : "snap");
  // The blur settle outlives value changes, so a tick mid-entrance can't leave it stuck.
  const settling = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!shown) {
      n.jump(0);
      settle.jump(0);
      next.current = phase === "hidden" ? "entrance" : "snap";
      return;
    }
    const mode = next.current;
    next.current = "tick";
    if (mode === "snap") {
      n.jump(value);
      settle.jump(1);
      return;
    }
    if (mode === "tick") {
      // A settle cut short (a remount mid-entrance) finishes here instead of leaving the figure blurred.
      if (settle.get() < 1 && !settling.current) settling.current = animate(settle, 1, { duration: T.tick, ease: EASE });
      const tick = animate(n, value, { duration: T.tick, ease: EASE });
      return () => tick.stop();
    }
    const delay = mode === "entrance" ? (reveal.at(offset) ?? 0) : 0;
    settling.current?.stop();
    settling.current = animate(settle, 1, { duration: T.count * 0.8, delay, ease: EASE });
    const count = animate(n, value, { duration: T.count, delay, ease: EASE_COUNT });
    return () => count.stop();
    // `reveal.at` and `offset` are fixed once the tile is staged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, phase]);
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
    <motion.span className={`inline-block tabular-nums ${className}`} style={{ filter, opacity }}>
      {text}
    </motion.span>
  );
}

/** Splits "$61.4k" into "$", 61.4 and "k" so formatted totals can count too. */
function parseFigure(s: string) {
  const m = s.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const [, pre, num, post] = m;
  const decimals = num.split(".")[1]?.length ?? 0;
  const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: num.includes(",") });
  return { value: Number(num.replace(/,/g, "")), format: (v: number) => `${pre}${fmt.format(v)}${post}` };
}

function Figure({ text, ...rest }: { text: string; reveal: Reveal; offset?: number; replay?: boolean; className?: string }) {
  const parsed = useMemo(() => parseFigure(text), [text]);
  if (!parsed) return <span className={rest.className}>{text}</span>;
  return <CountUp value={parsed.value} format={parsed.format} {...rest} />;
}

/* ------------------------------------------------------------------ */
/* 01 Trend: a line chart that draws itself, then morphs between metrics */
/* ------------------------------------------------------------------ */

const CW = 640;
const CH = 220;
const CHART_PAD = 24;
const METRIC_CYCLE_MS = 4200;

function smoothPath(pts: [number, number][]) {
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    // Catmull-Rom to Bézier: a sixth of the neighbouring chord keeps curves soft without overshoot.
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r(c1[0])},${r(c1[1])} ${r(c2[0])},${r(c2[1])} ${r(p2[0])},${r(p2[1])}`;
  }
  return d;
}

function project(points: number[]): [number, number][] {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  return points.map((p, i) => [(i / (points.length - 1)) * CW, CHART_PAD + (1 - (p - min) / span) * (CH - CHART_PAD * 2)]);
}

export function TrendTile({ label, title, body, dates, metrics, className = "" }: TrendTileProps) {
  const reveal = useReveal(0);
  const { reduce, live, phase } = reveal;
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  // After the first switch, each new total counts up from zero as it swaps in.
  const [switched, setSwitched] = useState(false);
  const gid = useId().replace(/:/g, "");
  const select = (i: number | ((n: number) => number)) => {
    setActive(i);
    setSwitched(true);
  };

  // Cycle metrics while on screen, until someone picks one.
  useEffect(() => {
    if (!live || touched || metrics.length < 2) return;
    const id = setInterval(() => select((n) => (n + 1) % metrics.length), METRIC_CYCLE_MS);
    return () => clearInterval(id);
  }, [live, touched, metrics.length]);

  const m = metrics[active];
  const { line, area, last } = useMemo(() => {
    const pts = project(m.points);
    const l = smoothPath(pts);
    return { line: l, area: `${l} L${CW},${CH} L0,${CH} Z`, last: pts[pts.length - 1] };
  }, [m]);
  const drawEnd = T.data + T.draw;
  const morph = { duration: reduce ? 0 : 0.9, ease: EASE };

  return (
    <Tile reveal={reveal} className={className}>
      <div className="flex flex-col gap-6 @5xl:flex-row @5xl:items-start @5xl:justify-between">
        <TileHead reveal={reveal} {...{ label, title, body }} />
        <motion.div
          variants={RISE}
          custom={reveal.at(T.text + T.textStep * 3)}
          role="group"
          aria-label="Metric"
          className="flex shrink-0 flex-wrap gap-1 self-start rounded-full border border-(--bn-ink)/10 bg-(--bn-ink)/[0.03] p-1"
        >
          {metrics.map((mm, i) => (
            <button
              key={mm.name}
              type="button"
              aria-pressed={i === active}
              onClick={() => {
                select(i);
                setTouched(true);
              }}
              className={`relative h-9 rounded-full px-3.5 text-[13px] font-medium transition-[color,transform] duration-150 active:scale-[0.97] ${FOCUS} ${i === active ? "text-(--bn-surface)" : "text-(--bn-ink)/60 hover:text-(--bn-ink)"}`}
            >
              {i === active && (
                <motion.span layoutId={`${gid}-pill`} className="absolute inset-0 rounded-full bg-(--bn-ink)" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />
              )}
              <span className="relative">{mm.name}</span>
            </button>
          ))}
        </motion.div>
      </div>

      <div className="mt-auto">
        <div className="mb-4 flex items-baseline gap-3" aria-live="polite">
          {/* Re-keyed per metric: each new total counts up out of the blur again. */}
          <span className="font-display text-[34px] font-semibold leading-none tracking-[-0.04em]">
            <Figure key={m.name} text={m.total} reveal={reveal} replay={switched} />
          </span>
          <motion.span
            variants={RISE}
            custom={reveal.at(T.figure + 0.06)}
            className="rounded-full border border-(--bn-ink)/15 px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums"
          >
            {m.delta}
          </motion.span>
          <motion.span variants={RISE} custom={reveal.at(T.figure + 0.1)} className={`${MONO} text-[11px] tracking-[0.12em] text-(--bn-ink)/50`}>
            {m.points.length} days
          </motion.span>
        </div>
        <div className="relative">
          <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" className="block h-[170px] w-full @xl:h-[200px]" aria-hidden="true">
            <defs>
              <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--bn-ink)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--bn-ink)" stopOpacity="0" />
              </linearGradient>
              <clipPath id={`${gid}-reveal`}>
                {/* The line "draws" by widening this clip, so the stroke can stay non-scaling (pathLength breaks with it). */}
                <motion.rect x="-4" y="-8" height={CH + 16} initial={false} animate={{ width: reveal.shown ? CW + 8 : 0 }} transition={timed(reveal, T.data, T.draw, EASE_DRAW)} />
              </clipPath>
            </defs>
            <motion.g variants={RISE} custom={reveal.at(T.figure)} stroke="var(--bn-ink)" vectorEffect="non-scaling-stroke">
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" x2={CW} y1={CH * f} y2={CH * f} strokeOpacity="0.08" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
              ))}
              <line x1="0" x2={CW} y1={CH - 0.5} y2={CH - 0.5} strokeOpacity="0.18" vectorEffect="non-scaling-stroke" />
            </motion.g>
            <g clipPath={`url(#${gid}-reveal)`}>
              <motion.path initial={false} animate={{ d: area }} transition={morph} fill={`url(#${gid}-fill)`} />
              <motion.path initial={false} animate={{ d: line }} transition={morph} fill="none" stroke="var(--bn-ink)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
          {/* The "now" dot lives in HTML, placed by percentage, so the stretched SVG never distorts it. */}
          <motion.span
            aria-hidden="true"
            className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-(--bn-surface) bg-(--bn-accent) shadow-[0_0_0_1px_var(--bn-accent)]"
            initial={false}
            animate={{ left: `${(last[0] / CW) * 100}%`, top: `${(last[1] / CH) * 100}%`, scale: reveal.shown ? 1 : 0 }}
            transition={{ ...morph, scale: phase === "play" ? { delay: reveal.at(drawEnd - 0.1) ?? 0, type: "spring", stiffness: 500, damping: 30 } : { duration: 0 } }}
          />
        </div>
        <motion.div variants={RISE} custom={reveal.at(T.data)} className={`mt-3 flex justify-between ${MONO} text-[11px] tracking-[0.1em] text-(--bn-ink)/50`}>
          {dates.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </motion.div>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/* 02 Stat: the inverted tile, one number counting up                  */
/* ------------------------------------------------------------------ */

const intFormat = (v: number) => Math.round(v).toLocaleString("en-US");

export function StatTile({ label, title, body, value, unit, comparison, className = "" }: StatTileProps) {
  const reveal = useReveal(1);
  const { phase } = reveal;
  return (
    <Tile reveal={reveal} surface="invert" className={`justify-between gap-10 ${className}`}>
      <motion.p variants={RISE} custom={reveal.at(T.text)} className={`${MONO} text-[11px] tracking-[0.14em] text-(--bn-ink)/60`}>
        {label}
      </motion.p>
      <div>
        <p className="flex items-baseline font-display font-semibold leading-[0.85] tracking-[-0.06em]">
          <CountUp value={value} format={intFormat} reveal={reveal} className="text-[clamp(5.5rem,4rem+5vw,8.5rem)]" />
          <motion.span variants={RISE} custom={reveal.at(T.figure + 0.12)} className="ml-1 text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] tracking-[-0.04em]">
            {unit}
          </motion.span>
        </p>
        <motion.h3 variants={RISE} custom={reveal.at(T.text + T.textStep)} className="mt-5 font-display text-[20px] font-semibold tracking-[-0.025em]">
          {title}
        </motion.h3>
        <motion.p variants={RISE} custom={reveal.at(T.text + T.textStep * 2)} className="mt-1.5 max-w-[34ch] text-[15px] leading-[1.55] text-(--bn-ink)/70">
          {body}
        </motion.p>
        <motion.dl variants={RISE} custom={reveal.at(T.data)} className="mt-7 space-y-3 border-t border-(--bn-ink)/15 pt-5">
          {comparison.map((c, i) => (
            <div key={c.name}>
              <div className={`flex justify-between ${MONO} text-[11px] tracking-[0.1em]`}>
                <dt className="text-(--bn-ink)/70">{c.name}</dt>
                <dd className="tabular-nums">{c.value}</dd>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--bn-ink)/10">
                {/* Meters fill once the tile has landed; the slow one is slow on purpose. */}
                <motion.div
                  className="h-full origin-left rounded-full bg-(--bn-ink)"
                  style={{ width: `${Math.max(c.share, 2)}%` }}
                  initial={false}
                  animate={{ scaleX: reveal.shown ? 1 : 0 }}
                  transition={timed(reveal, T.progress + i * 0.08, i === 0 ? 0.35 : 1.4, i === 0 ? EASE : "linear")}
                />
              </div>
            </div>
          ))}
        </motion.dl>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Heatmap: weekday × hour, cells keep ticking                      */
/* ------------------------------------------------------------------ */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PEAK = { day: 1, hour: 10 };
const HEAT_TICK_MS = 650;
/** Five ink strengths, least to most. */
const HEAT = ["bg-(--bn-ink)/[0.06]", "bg-(--bn-ink)/[0.16]", "bg-(--bn-ink)/[0.34]", "bg-(--bn-ink)/[0.6]", "bg-(--bn-ink)"];

/** A believable week: a morning and an afternoon hump, quieter weekends, a busy Tuesday. */
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

export function HeatmapTile({ label, title, body, peakLabel, className = "" }: HeatmapTileProps) {
  const reveal = useReveal(0);
  const { live, phase } = reveal;
  const base = useMemo(() => DAYS.map((_, d) => Array.from({ length: 24 }, (_, h) => baseLevel(d, h))), []);
  const [bump, setBump] = useState<{ d: number; h: number; k: number } | null>(null);

  useEffect(() => {
    if (!live) return;
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      setBump({ d: Math.floor(Math.random() * 7), h: 7 + Math.floor(Math.random() * 15), k });
    }, HEAT_TICK_MS);
    return () => clearInterval(id);
  }, [live]);

  // Cells fill in a diagonal wave from the top-left. CSS transitions on 168
  // plain spans are far cheaper than 168 animated components.
  const wave = (d: number, h: number) => `${(reveal.at(T.data) ?? 0) + (h + d * 2) * 0.012}s`;

  return (
    <Tile reveal={reveal} className={className}>
      <TileHead reveal={reveal} {...{ label, title, body }} />
      <div className="mt-auto" role="img" aria-label={`Sessions by weekday and hour. ${peakLabel}.`}>
        <div data-show={reveal.shown} className="group grid grid-cols-[28px_1fr] gap-x-2 gap-y-[3px]">
          {base.map((row, d) => (
            <div key={DAYS[d]} className="contents">
              <motion.span variants={RISE} custom={reveal.at(T.figure + d * 0.02)} className={`self-center ${MONO} text-[10px] tracking-[0.06em] text-(--bn-ink)/50`}>
                {DAYS[d].slice(0, 2)}
              </motion.span>
              <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
                {row.map((lvl, h) => {
                  const isPeak = d === PEAK.day && h === PEAK.hour;
                  const isBump = bump?.d === d && bump?.h === h;
                  return (
                    <span
                      key={isBump ? `${h}-${bump.k}` : h}
                      style={{ transitionDelay: wave(d, h) }}
                      className={`aspect-square rounded-[3px] opacity-0 scale-50 transition-[opacity,scale] duration-0 group-data-[show=true]:scale-100 group-data-[show=true]:opacity-100 ${phase === "play" ? "group-data-[show=true]:duration-[400ms]" : ""} ${
                        isPeak ? "bg-(--bn-accent) ring-1 ring-inset ring-(--bn-ink)/25" : HEAT[isBump ? Math.min(4, lvl + 2) : lvl]
                      } ${isBump ? "animate-[bn-pop_500ms_cubic-bezier(0.22,1,0.36,1)]" : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <span />
          <motion.div variants={RISE} custom={reveal.at(T.data)} className={`mt-2 flex justify-between ${MONO} text-[10px] tracking-[0.06em] text-(--bn-ink)/50`}>
            {["00", "06", "12", "18", "23"].map((h) => (
              <span key={h}>{h}</span>
            ))}
          </motion.div>
        </div>
        <motion.div variants={RISE} custom={reveal.at(T.progress)} className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-(--bn-ink)/10 pt-4">
          <span className={`inline-flex items-center gap-2 ${MONO} text-[11px] tracking-[0.1em]`}>
            <span className="size-2.5 rounded-[2px] bg-(--bn-accent)" aria-hidden="true" />
            {peakLabel}
          </span>
          <span className={`flex items-center gap-1.5 ${MONO} text-[10px] tracking-[0.08em] text-(--bn-ink)/50`} aria-hidden="true">
            Less
            {HEAT.map((c) => (
              <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
            ))}
            More
          </span>
        </motion.div>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Search: types a question, shows the answer, starts over          */
/* ------------------------------------------------------------------ */

const TYPE = { min: 38, jitter: 50, think: 380, hold: 2600, erase: 18, eraseChars: 3, next: 220 } as const;

type SearchPhase = "typing" | "answer" | "clearing";

/** The typing loop: one timer at a time, always cleared, and only while the tile is on screen. */
function useTypingLoop(queries: Query[], live: boolean, reduce: boolean) {
  const [qi, setQi] = useState(0);
  // Starts on a finished answer so a still frame (or reduced motion) still tells the story.
  const [typed, setTyped] = useState(queries[0].q.length);
  const [phase, setPhase] = useState<SearchPhase>("answer");
  const len = queries[qi].q.length;

  useEffect(() => {
    if (reduce || !live) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (typed < len) t = setTimeout(() => setTyped((n) => n + 1), TYPE.min + Math.random() * TYPE.jitter);
      else t = setTimeout(() => setPhase("answer"), TYPE.think);
    } else if (phase === "answer") {
      t = setTimeout(() => setPhase("clearing"), TYPE.hold);
    } else if (typed > 0) {
      t = setTimeout(() => setTyped((n) => Math.max(0, n - TYPE.eraseChars)), TYPE.erase);
    } else {
      t = setTimeout(() => {
        setQi((n) => (n + 1) % queries.length);
        setPhase("typing");
      }, TYPE.next);
    }
    return () => clearTimeout(t);
  }, [live, reduce, phase, typed, len, queries.length]);

  return { query: queries[qi], qi, typed, phase };
}

export function SearchTile({ label, title, body, queries, className = "" }: SearchTileProps) {
  const reveal = useReveal(1);
  const { reduce, live } = reveal;
  const { query, qi, typed, phase } = useTypingLoop(queries, live, reduce);

  return (
    <Tile reveal={reveal} className={className}>
      <TileHead reveal={reveal} {...{ label, title, body }} />
      <ul className="sr-only">
        {queries.map((x) => (
          <li key={x.q}>
            “{x.q}”: {x.answer}, {x.detail}
          </li>
        ))}
      </ul>
      <div className="mt-auto" aria-hidden="true">
        <motion.div
          variants={RISE}
          custom={reveal.at(T.figure)}
          className="flex h-14 items-center gap-3 rounded-[14px] border border-(--bn-ink)/15 bg-(--bn-field) px-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.28)]"
        >
          <Search className="size-[18px] shrink-0 text-(--bn-ink)/60" strokeWidth={2} />
          <p className="min-w-0 flex-1 truncate text-[15px]">
            {query.q.slice(0, typed)}
            <span className="ml-px inline-block h-[18px] w-[2px] translate-y-[3px] animate-pulse bg-(--bn-ink) motion-reduce:animate-none" />
          </p>
          <kbd className="hidden shrink-0 rounded-md border border-(--bn-ink)/15 px-1.5 py-0.5 font-mono text-[11px] text-(--bn-ink)/55 @sm:inline">⌘K</kbd>
        </motion.div>
        <motion.div variants={RISE} custom={reveal.at(T.data)} className="relative mt-3 h-[92px]">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "answer" ? (
              <motion.div
                key={qi}
                initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                transition={{ duration: 0.4, ease: EASE }}
                className="absolute inset-0 flex items-center justify-between gap-4 rounded-[14px] border border-(--bn-ink)/[0.08] bg-(--bn-card) px-5 text-(--bn-card-ink)"
              >
                <div className="min-w-0">
                  <p className={`${MONO} text-[10px] tracking-[0.14em] opacity-55`}>Answer</p>
                  <p className="mt-1 truncate font-display text-[19px] font-semibold tracking-[-0.02em]">{query.answer}</p>
                  <p className="truncate text-[13px] opacity-60">{query.detail}</p>
                </div>
                <MiniBars seed={qi} />
              </motion.div>
            ) : (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className={`absolute inset-0 flex items-center gap-2 rounded-[14px] border border-dashed border-(--bn-ink)/15 px-5 ${MONO} text-[11px] tracking-[0.12em] text-(--bn-ink)/45`}
              >
                {phase === "typing" ? "Listening" : "Next question"}
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1 animate-pulse rounded-full bg-current motion-reduce:animate-none" style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </Tile>
  );
}

/** Seven bars that grow from the baseline; the last (this week) carries the accent. */
function MiniBars({ seed }: { seed: number }) {
  const bars = [0.35, 0.5, 0.42, 0.62, 0.55, 0.8, 1].map((b, i) => Math.max(0.2, Math.min(1, b + Math.sin(seed * 3 + i) * 0.12)));
  return (
    <div className="hidden h-12 shrink-0 items-end gap-1 @sm:flex">
      {bars.map((b, i) => (
        <motion.span
          key={i}
          className={`w-2 origin-bottom rounded-[2px] ${i === bars.length - 1 ? "bg-(--bn-accent)" : "bg-current opacity-30"}`}
          style={{ height: `${b * 100}%` }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 + i * 0.04 }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Alerts: real switches that flip themselves until touched         */
/* ------------------------------------------------------------------ */

const FLIP_ORDER = [1, 3, 3, 1, 2, 2];
const FLIP_MS = 1700;

export function AlertsTile({ label, title, body, settings, preview, className = "" }: AlertsTileProps) {
  const reveal = useReveal(0);
  const { reduce, live } = reveal;
  const [state, setState] = useState(() => settings.map((s) => s.on));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!live || touched) return;
    let step = 0;
    const id = setInterval(() => {
      const i = FLIP_ORDER[step % FLIP_ORDER.length] % settings.length;
      step += 1;
      setState((s) => s.map((v, j) => (j === i ? !v : v)));
    }, FLIP_MS);
    return () => clearInterval(id);
  }, [live, touched, settings.length]);

  const toggle = (i: number) => {
    setTouched(true);
    setState((st) => st.map((v, j) => (j === i ? !v : v)));
  };

  return (
    <Tile reveal={reveal} className={className}>
      <TileHead reveal={reveal} {...{ label, title, body }} />
      <div className="mt-auto space-y-3">
        <motion.div variants={RISE} custom={reveal.at(T.figure)} className="relative h-[96px]" aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            {state[preview.watch] ? (
              <motion.div
                key="msg"
                initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                transition={{ duration: 0.4, ease: EASE }}
                className="absolute inset-0 flex gap-3 rounded-[14px] border border-(--bn-ink)/12 bg-(--bn-field) p-3.5"
              >
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-(--bn-ink) text-(--bn-surface)">
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
                    <path d="M8 1.5 13.5 14 8 10.6 2.5 14Z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 text-[13px]">
                    <span className="font-semibold">{preview.sender}</span>
                    <span className="truncate font-mono text-[11px] text-(--bn-ink)/50">
                      {preview.channel} · {preview.time}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-[1.45] text-(--bn-ink)/75">{preview.message}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="quiet"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.15 } }}
                className={`absolute inset-0 flex items-center justify-center rounded-[14px] border border-dashed border-(--bn-ink)/15 px-4 ${MONO} text-[11px] tracking-[0.1em] text-(--bn-ink)/45`}
              >
                {preview.quiet}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <div className="overflow-hidden rounded-[14px] border border-(--bn-ink)/12 bg-(--bn-field)">
          {settings.map((s, i) => (
            <motion.button
              key={s.label}
              variants={RISE}
              custom={reveal.at(T.data + i * T.textStep)}
              type="button"
              role="switch"
              aria-checked={state[i]}
              onClick={() => toggle(i)}
              className="flex min-h-[60px] w-full items-center justify-between gap-4 border-t border-(--bn-ink)/[0.08] px-4 py-3 text-left transition-[background-color] duration-150 first:border-t-0 hover:bg-(--bn-ink)/[0.03] focus-visible:bg-(--bn-ink)/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--bn-ink) active:bg-(--bn-ink)/[0.06]"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium leading-tight">{s.label}</span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-(--bn-ink)/55">{s.detail}</span>
              </span>
              <Switch on={state[i]} reduce={reduce} />
            </motion.button>
          ))}
        </div>
      </div>
    </Tile>
  );
}

function Switch({ on, reduce }: { on: boolean; reduce: boolean }) {
  return (
    <span aria-hidden="true" className={`flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-200 ${on ? "justify-end bg-(--bn-ink)" : "justify-start bg-(--bn-ink)/15"}`}>
      <motion.span
        layout
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
        className={`size-4 rounded-full ${on ? "bg-(--bn-surface)" : "bg-(--bn-field) shadow-[0_1px_2px_rgba(0,0,0,0.3)]"}`}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 06 Map: the deep tile, a dot-matrix world with pulsing cities       */
/* ------------------------------------------------------------------ */

// Rough continent outlines as "lon,lat" pairs. Coarse on purpose: they're sampled into a dot grid.
const LAND_OUTLINES: Record<string, string> = {
  "North America": "-166,68 -156,71 -140,70 -128,70 -115,68 -95,70 -82,69 -76,64 -66,60 -62,54 -56,51 -66,45 -70,42 -75,38 -77,35 -81,31 -80,26 -82,25 -83,29 -89,30 -95,29 -97,25 -97,21 -94,18 -91,19 -87,21 -88,16 -84,15 -83,10 -78,8 -80,7 -84,9 -87,13 -92,15 -96,16 -105,20 -106,23 -112,29 -110,23 -115,30 -117,33 -121,35 -124,40 -124,46 -125,49 -130,54 -137,58 -146,61 -152,59 -158,57 -162,60 -166,62",
  "Arctic islands": "-120,72 -96,74 -80,73 -68,77 -62,81 -90,81 -110,77 -122,75",
  Greenland: "-55,60 -44,60 -36,65 -22,70 -19,76 -22,80 -34,83 -58,82 -70,78 -60,75 -55,69 -52,64",
  Iceland: "-24,64 -14,64 -13,66 -22,66.5",
  "South America": "-78,8 -72,12 -63,11 -52,5 -50,0 -44,-2 -35,-6 -37,-12 -39,-17 -41,-22 -48,-26 -53,-33 -57,-36 -62,-39 -65,-42 -66,-47 -69,-51 -71,-54 -74,-52 -74,-46 -73,-38 -71,-30 -70,-20 -76,-14 -80,-7 -81,-3 -80,1",
  "Europe and Asia":
    "-9,37 -9,43 -2,43.5 -1.5,46 -4.5,48 -1.5,48.8 1.5,50.2 2,51 5,53 8,54 8,57 11,59 7,58 5,61 10,64 15,68 20,70 28,71 40,68 44,68 55,69 68,70 80,73 100,77 112,74 130,72 142,72 160,70 176,68 180,65 176,62 164,60 160,55 156,51 154,59 142,59 136,54 140,48 136,43 130,42 129,36 126,35 126,38 121,40 118,38 122,36 120,32 122,30 120,26 116,23 110,21 106,20 108,16 109,12 105,9 103,10 100,13 99,9 101,6 103,2 101,3 98,8 98,14 95,17 92,21 89,22 86,20 80,15 80,10 77,8 74,14 72,20 70,22 67,25 61,25 57,26 56,24 59,23 57,19 52,16 45,13 43,14 39,21 35,28 34,31 35,34 36,36 30,36.5 27,37 26,40 29,41 23,40 22,37 20,40 19,42 15,45 13,45.5 16,41 18,40 16,38 15,40 12,42 9,44 5,43 3,42 0,39 -1,37 -5,36",
  "Great Britain": "-5.5,50 1.5,51 1.7,52.8 0,54 -1.5,55.5 -2,57.5 -4,58.6 -6,58 -5.5,56 -4.8,54.6 -3,53.4 -4.6,52.8 -5,51.6",
  Ireland: "-10,51.6 -6,52 -6,54 -7.5,55.3 -10,54.2",
  Africa: "-17,15 -17,21 -13,27 -10,30 -9,33 -6,35.8 3,36.8 10,37 11,33 16,31 20,31 25,32 32,31.3 34,28 38,20 39,16 43,12 51,11.8 50,9 47,5 42,-1 40,-6 40,-15 36,-20 35,-24 32,-28 28,-33 20,-35 18,-32 15,-27 12,-18 13,-11 12,-5 9,-1 9,4 5,4.5 1,6 -4,5 -8,4.5 -11,7 -13,9 -16.5,12.5",
  Madagascar: "44,-25 47,-25 50.5,-15 49.5,-12 44,-17",
  "Sri Lanka": "80,6 82,7 81.5,9.5 79.8,9",
  Honshu: "130,31 134,33.5 140,35 141,38 141.5,41 140,41 139.5,38 136,37 132.5,35.5 130,33.6",
  Hokkaido: "140,42 145.5,43.5 142,45.5 140.5,43.5",
  Philippines: "120,18.5 122.5,18.5 124,13 126.5,7 125,6 122,7 121,12",
  "Sumatra and Java": "95,5.5 98,4 104,-3 106,-6 114,-8 120,-9 118,-7.5 110,-6.5 106,-5.5 104,-1 100,1",
  Borneo: "109,1.5 111,-3 116,-4 119,1 117,7 114,4",
  "New Guinea": "131,-1 138,-2 145,-5 150,-10 142,-9 136,-4.5",
  Australia: "114,-22 113.5,-26 115,-34 118,-35 123,-34 129,-31.5 135,-34 138,-35.5 140,-38 146,-39 150,-37.5 153,-32 153.5,-25 150,-22 146,-19 145.5,-15 143,-11 141.5,-13 140,-17.5 136,-15 137,-12 132,-11.5 130,-13 126,-14 122,-17 119,-20",
  "New Zealand": "172.5,-34.5 178.5,-37.5 176,-41.5 174,-41 171,-44 167,-46.5 170,-46 172.5,-42 174.5,-39",
};
// Water inside those outlines: Hudson Bay, the Black and Caspian seas, the Gulf.
const WATER_OUTLINES = ["-94,59 -86,64 -80,63 -78,56 -82,52 -90,57", "28,41.3 41,41.5 41,46.5 31,46.6", "47,37 54,37 54,45 49,46.5 47,42", "48,30 50,26 56,24 56,26.5 52,28 50,30"];

const MAP_TOP = 80;
const MAP_BOTTOM = -56;
const MAP_H = MAP_TOP - MAP_BOTTOM;
const MAP_STEP = 2.5;
const MAP_TICK_MS = 1100;
const RING_S = 2.4;

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

/** Samples the outlines on a 2.5° grid into map coordinates (x = lon + 180, y = 80 − lat). */
function landDots() {
  const land = Object.values(LAND_OUTLINES).map(parse);
  const water = WATER_OUTLINES.map(parse);
  const dots: [number, number][] = [];
  for (let lat = MAP_TOP - MAP_STEP / 2; lat > MAP_BOTTOM; lat -= MAP_STEP) {
    for (let lon = -180 + MAP_STEP / 2; lon < 180; lon += MAP_STEP) {
      const p: [number, number] = [lon, lat];
      if (!land.some((poly) => inside(p, poly)) || water.some((poly) => inside(p, poly))) continue;
      dots.push([lon + 180, MAP_TOP - lat]);
    }
  }
  return dots;
}

/** Live visitor counts: a random city gains a few every tick, others occasionally lose one. */
function useLiveCounts(cities: City[], live: boolean) {
  const [counts, setCounts] = useState(() => cities.map((c) => c.visitors));
  const [flash, setFlash] = useState(-1);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const i = Math.floor(Math.random() * cities.length);
      setFlash(i);
      setCounts((cs) => cs.map((v, j) => (j === i ? v + 1 + Math.floor(Math.random() * 4) : Math.random() < 0.15 ? Math.max(1, v - 1) : v)));
    }, MAP_TICK_MS);
    return () => clearInterval(id);
  }, [live, cities.length]);
  return { counts, flash };
}

export function MapTile({ label, title, body, liveLabel, cities, className = "" }: MapTileProps) {
  const reveal = useReveal(1);
  const { reduce, live, phase } = reveal;
  const dots = useMemo(landDots, []);
  const clipId = `${useId().replace(/:/g, "")}-sweep`;
  const { counts, flash } = useLiveCounts(cities, live);
  const total = counts.reduce((a, b) => a + b, 0);
  const top = useMemo(
    () =>
      counts
        .map((v, i) => ({ v, i }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 4),
    [counts],
  );
  const sweepEnd = T.data + T.draw;

  return (
    <Tile reveal={reveal} surface="deep" className={`gap-6 ${className}`}>
      <div className="flex flex-col gap-6 @xl:flex-row @xl:items-start @xl:justify-between">
        <TileHead reveal={reveal} {...{ label, title, body }} />
        <div className="shrink-0 @xl:text-right" aria-live="off">
          <p className="font-display text-[40px] font-semibold leading-none tracking-[-0.04em]">
            <CountUp value={total} format={intFormat} reveal={reveal} />
          </p>
          <motion.p variants={RISE} custom={reveal.at(T.figure + 0.08)} className={`mt-2 inline-flex items-center gap-2 ${MONO} text-[11px] tracking-[0.14em] text-(--bn-ink)/60`}>
            <span className="relative flex size-2">
              {live ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--bn-accent) opacity-70" /> : null}
              <span className="relative inline-flex size-2 rounded-full bg-(--bn-accent)" />
            </span>
            {liveLabel}
          </motion.p>
        </div>
      </div>

      <div className="relative -mx-2 mt-auto @xl:mx-0">
        <svg viewBox={`0 0 360 ${MAP_H}`} className="block h-auto w-full" role="img" aria-label={`World map of live sessions: ${cities.map((c) => c.name).join(", ")}.`}>
          <defs>
            <clipPath id={clipId}>
              {/* The world sweeps in west to east, like the day. */}
              <motion.rect x="0" y="0" height={MAP_H} initial={false} animate={{ width: reveal.shown ? 360 : 0 }} transition={timed(reveal, T.data, T.draw, EASE_DRAW)} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`} fill="var(--bn-ink)" fillOpacity={0.2}>
            {dots.map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={0.82} />
            ))}
          </g>
          {cities.map((c, i) => {
            const x = c.lon + 180;
            const y = MAP_TOP - c.lat;
            // Each city lands as the sweep passes over it.
            const landAt = T.data + (x / 360) * T.draw;
            return (
              <g key={c.name}>
                {live && (
                  <motion.circle
                    cx={x}
                    cy={y}
                    fill="none"
                    stroke="var(--bn-accent)"
                    strokeWidth={0.6}
                    initial={{ r: 1.6, opacity: 0 }}
                    animate={{ r: [1.6, 7], opacity: [0.9, 0] }}
                    transition={{ duration: RING_S, repeat: Infinity, ease: "easeOut", delay: (reveal.at(sweepEnd) ?? 0) + ((i * 0.37) % RING_S) }}
                  />
                )}
                <motion.circle
                  cx={x}
                  cy={y}
                  fill="var(--bn-accent)"
                  initial={false}
                  animate={{ r: !reveal.shown ? 0 : flash === i && live ? [1.7, 3, 1.7] : 1.7 }}
                  transition={phase === "play" && flash === -1 ? { delay: reveal.at(landAt) ?? 0, type: "spring", stiffness: 500, damping: 22 } : { duration: reduce ? 0 : 0.6, ease: EASE }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <ol className="grid grid-cols-2 gap-x-6 border-t border-(--bn-ink)/12 pt-5 @xl:grid-cols-4">
        {top.map(({ v, i }, rank) => (
          <motion.li
            layout={!reduce}
            key={cities[i].name}
            variants={RISE}
            custom={reveal.at(T.progress + rank * T.textStep)}
            className="flex items-baseline justify-between gap-3 py-1.5 @xl:block"
          >
            <span className="flex items-baseline gap-2 text-[14px] text-(--bn-ink)/85">
              <span className="font-mono text-[10px] text-(--bn-ink)/45">{String(rank + 1).padStart(2, "0")}</span>
              {cities[i].name}
            </span>
            <span className="font-mono text-[13px] tabular-nums text-(--bn-ink)/70 @xl:mt-1 @xl:block @xl:pl-[22px]">{v.toLocaleString("en-US")}</span>
          </motion.li>
        ))}
      </ol>
    </Tile>
  );
}

const KEYFRAMES = `@keyframes bn-pop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}`;

/* ------------------------------------------------------------------ */
/* Demo content                                                        */
/* ------------------------------------------------------------------ */

const DEFAULTS = {
  trend: {
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
  stat: {
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
  heatmap: {
    label: "03 / Rhythm",
    title: "Know when they show up",
    body: "A week of sessions, hour by hour. Turns out Tuesday at ten is your Black Friday.",
    peakLabel: "Peak · Tue 10:00",
  },
  search: {
    label: "04 / Ask",
    title: "Ask it like you’d ask a person",
    body: "No SQL and no ticket for the data team. Type the question the way you’d say it out loud.",
    queries: [
      { q: "signups from Lisbon last week", answer: "1,284 signups", detail: "+18% on the week before" },
      { q: "why did churn spike on tuesday?", answer: "Checkout errors, 2:10–5:40pm", detail: "412 sessions hit a failed payment" },
      { q: "top referrers to /pricing in october", answer: "newsletter.fieldnote.co", detail: "31% of visits, up from 9%" },
    ],
  },
  alerts: {
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
  map: {
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
} satisfies Required<Pick<BentoGridProps, "trend" | "stat" | "heatmap" | "search" | "alerts" | "map">>;

/** Demo: the grid on its own, no marketing header. */
export default function BentoGridDemo() {
  return <BentoGrid />;
}
