"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, animate, motion, useAnimate, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";

export type WaffleGroup = {
  key: string;
  label: string;
  /** One short line under the label in the legend. */
  note?: string;
};

export type WafflePeriod = {
  key: string;
  /** Tab label, e.g. “Q3”. */
  label: string;
  /** Line under the tabs, e.g. “Jul–Sep 2026 · 52,604 tickets”. */
  caption?: string;
  /** One count per group, in group order. Normalised to 100 if they don’t sum to it. */
  counts: number[];
};

export type ChartWaffleProps = {
  title?: string;
  /** Mono line beside the title. */
  subtitle?: string;
  groups?: WaffleGroup[];
  periods?: WafflePeriod[];
  defaultPeriod?: string;
  /** Shown when categories, periods, or the selected period have no usable values. */
  emptyMessage?: string;
  onPeriodChange?: (key: string) => void;
  /** Singular noun for one cell, used in the hover readout and labels. */
  unit?: string;
  /** Fill the grid column by column (bands, like a bar) or row by row. */
  fill?: "columns" | "rows";
  shape?: "square" | "round";
  /** Space between cells, px. */
  gap?: number;
  /** The one colour: the first group, its legend row and the headline figure. */
  accent?: string;
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#0b0b0c",
    well: "#131315",
    ink: "#f5f5f4",
    muted: "#98989f",
    up: "#34d399",
    down: "#fb7185",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 30px 80px -30px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    well: "#f4f4f2",
    ink: "#0b0b0c",
    muted: "#62626b",
    up: "#047857",
    down: "#e11d48",
    shadow: "0 1px 2px rgba(0,0,0,0.06), 0 24px 60px -30px rgba(0,0,0,0.22)",
  },
} as const;

const ACCENT = "#ff7a45";
/** Groups after the first step down the ink, so order reads as weight and the accent means one thing. */
const RAMP = [62, 34, 17, 10];
const CELLS = 100;
const SIDE = 10;

type Bezier = readonly [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];
const EASE_IN: Bezier = [0.4, 0, 1, 1];

const T = {
  title: 0.06,
  tabs: 0.12,
  cells: 0.2,
  cellStep: 0.006,
  headline: 0.3,
  rows: 0.38,
  rowStep: 0.05,
  block: 0.6,
  count: 0.8,
  /** Seconds between neighbouring cells setting off on a period switch. */
  flightStep: 0.004,
} as const;

const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
const SPRING_FLY = { type: "spring", stiffness: 320, damping: 30 } as const;

const RISE: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.block, ease: EASE, delay } }),
};
const LAND: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: T.block, ease: EASE } },
};
const FADE: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } };

/* ------------------------------------------------------------------ */
/* Demo data: Fernway's support desk, four quarters                    */
/* ------------------------------------------------------------------ */

const DEMO_GROUPS: WaffleGroup[] = [
  { key: "agent", label: "Resolved by the agent", note: "No human touched it" },
  { key: "draft", label: "Agent drafted, person sent", note: "Reviewed in under a minute" },
  { key: "human", label: "Handled by a person", note: "Refunds, contracts, anyone upset" },
  { key: "eng", label: "Escalated to engineering", note: "Real bugs, repro attached" },
];

const DEMO_PERIODS: WafflePeriod[] = [
  { key: "q4", label: "Q4 ’25", caption: "Oct–Dec 2025 · 41,208 tickets", counts: [31, 22, 38, 9] },
  { key: "q1", label: "Q1", caption: "Jan–Mar 2026 · 44,930 tickets", counts: [42, 24, 27, 7] },
  { key: "q2", label: "Q2", caption: "Apr–Jun 2026 · 47,115 tickets", counts: [53, 21, 20, 6] },
  { key: "q3", label: "Q3", caption: "Jul–Sep 2026 · 52,604 tickets", counts: [64, 17, 14, 5] },
];

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

/** One cell with an identity, so a period switch can fly it rather than recolour it in place. */
type Unit = { id: number; group: number; slot: number; flights: number };

/** Largest-remainder rounding to exactly 100 cells. */
function normalise(counts: number[]): number[] {
  const clean = counts.map((c) => Number.isFinite(c) ? Math.max(0, c) : 0);
  const maximum = clean.reduce((largest, c) => Math.max(largest, c), 0);
  if (maximum === 0) return clean;
  // Scale before summing so large finite counts cannot overflow the total.
  const scaled = clean.map((c) => c / maximum);
  const total = scaled.reduce((s, c) => s + c, 0);
  const raw = scaled.map((c) => (c / total) * CELLS);
  const out = raw.map(Math.floor);
  let left = CELLS - out.reduce((s, c) => s + c, 0);
  const order = raw.map((r, i) => ({ i, r: r - Math.floor(r) })).sort((a, b) => b.r - a.r);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length].i]++;
  return out;
}

/**
 * Each group keeps as many of its own cells as it still needs (the ones nearest
 * the start); the surplus flies to the groups that grew, nearest first. Then
 * every group takes consecutive slots in its old order, so cells slide rather
 * than shuffle.
 */
function assign(prev: Unit[] | null, counts: number[]): Unit[] {
  if (!prev || prev.length !== counts.reduce((sum, n) => sum + n, 0)) {
    const units: Unit[] = [];
    counts.forEach((n, g) => {
      for (let k = 0; k < n; k++) units.push({ id: units.length, group: g, slot: units.length, flights: 0 });
    });
    return units;
  }
  const bySlot = (a: Unit, b: Unit) => a.slot - b.slot;
  const owned = counts.map((_, g) => prev.filter((u) => u.group === g).sort(bySlot));
  const kept = owned.map((us, g) => us.slice(0, counts[g]));
  const pool = [...prev.filter((u) => u.group >= counts.length), ...owned.flatMap((us, g) => us.slice(counts[g]))].sort(bySlot);
  kept.forEach((us, g) => {
    while (us.length < counts[g] && pool.length) {
      const u = pool.shift() as Unit;
      us.push({ ...u, group: g, flights: u.flights + 1 });
    }
  });
  let slot = 0;
  return kept.flatMap((us) => us.sort(bySlot).map((u) => ({ ...u, slot: slot++ })));
}

const place = (slot: number, fill: "columns" | "rows") =>
  fill === "columns" ? { col: Math.floor(slot / SIDE), row: slot % SIDE } : { col: slot % SIDE, row: Math.floor(slot / SIDE) };

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChartWaffle(props: ChartWaffleProps) {
  const p = PALETTE[props.theme ?? "dark"];
  if (props.groups?.length === 0 || props.periods?.length === 0) {
    return <section className="w-full rounded-[22px] border p-6 font-sans" style={{ background: p.surface, color: p.ink, borderColor: `color-mix(in srgb, ${p.ink} 12%, transparent)`, colorScheme: props.theme ?? "dark" }}>
      <h2 className="text-[15px] font-medium">{props.title ?? "Who closed the ticket"}</h2>
      <p role="status" className="mt-3 text-sm" style={{ color: p.muted }}>{props.emptyMessage ?? "No data for this period."}</p>
    </section>;
  }
  return <WaffleWithData {...props} />;
}

function WaffleWithData({
  title = "Who closed the ticket",
  subtitle = "Per 100 support tickets",
  groups = DEMO_GROUPS,
  periods = DEMO_PERIODS,
  defaultPeriod,
  emptyMessage = "No data for this period.",
  onPeriodChange,
  unit = "ticket",
  fill = "columns",
  shape = "square",
  gap = 4,
  accent = ACCENT,
  theme = "dark",
}: ChartWaffleProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.3 });
  const entered = inView || reduce;

  const [periodKey, setPeriodKey] = useState(defaultPeriod ?? periods[periods.length - 1].key);
  const index = Math.max(0, periods.findIndex((p) => p.key === periodKey));
  const period = periods[index];
  const counts = useMemo(() => normalise(groups.map((_, g) => period.counts[g] ?? 0)), [groups, period]);
  const hasData = counts.some((n) => n > 0);
  const priorCounts = index > 0 ? normalise(groups.map((_, g) => periods[index - 1].counts[g] ?? 0)) : null;
  const previous = priorCounts?.some((n) => n > 0) ? priorCounts : null;

  // Units persist across periods; only a change in counts re-assigns them.
  const [units, setUnits] = useState<Unit[]>(() => assign(null, counts));
  const countsKey = counts.join(",");
  const lastKey = useRef(countsKey);
  useEffect(() => {
    if (lastKey.current === countsKey) return;
    lastKey.current = countsKey;
    setUnits((u) => assign(u, counts));
    // `counts` is fully described by its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey]);

  const [focus, setFocus] = useState<number | null>(null);
  const [hovered, setHovered] = useState<Unit | null>(null);

  const p = PALETTE[theme];
  const vars = { "--cw-surface": p.surface, "--cw-well": p.well, "--cw-ink": p.ink, "--cw-muted": p.muted, "--cw-accent-ink": `color-mix(in srgb, ${accent} 65%, ${p.ink})`, "--cw-up": p.up, "--cw-down": p.down, "--cw-accent": accent, boxShadow: p.shadow, colorScheme: theme } as CSSProperties;
  const colour = (g: number) => (g === 0 ? "var(--cw-accent)" : `color-mix(in srgb, var(--cw-ink) ${RAMP[Math.min(g - 1, RAMP.length - 1)]}%, transparent)`);
  const rise = reduce ? FADE : RISE;
  const lead = groups[0];

  const choose = (k: string) => {
    if (k === periodKey) return;
    setPeriodKey(k);
    onPeriodChange?.(k);
  };

  return (
    <motion.section
      ref={rootRef}
      style={vars}
      variants={reduce ? FADE : LAND}
      initial="hidden"
      animate={entered ? "show" : "hidden"}
      aria-labelledby={`${uid}-title`}
      className="@container relative w-full overflow-hidden rounded-[22px] border border-(--cw-ink)/[0.08] bg-(--cw-surface) font-sans text-(--cw-ink) antialiased"
    >
      <header className="flex flex-col gap-4 px-5 pt-5 @xl:px-7 @xl:pt-7 @3xl:flex-row @3xl:items-start @3xl:justify-between">
        <motion.div variants={rise} custom={T.title} className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id={`${uid}-title`} className="text-[15px] font-medium tracking-[-0.01em] text-(--cw-ink)/90">
              {title}
            </h2>
            <p className="font-mono text-[11px] text-(--cw-muted)">{subtitle}</p>
          </div>
          <div className="relative mt-1.5 h-5 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={period.key}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.14, ease: EASE_IN } }}
                transition={{ duration: 0.24, ease: EASE }}
                className="truncate text-[13px] text-(--cw-muted)"
              >
                {period.caption}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
        {periods.length > 1 && (
          <motion.div variants={rise} custom={T.tabs}>
            <Tabs periods={periods} value={period.key} uid={uid} reduce={reduce} onChange={choose} />
          </motion.div>
        )}
      </header>

      {!hasData ? <p role="status" className="px-5 py-14 text-center text-sm text-(--cw-muted)">{emptyMessage}</p> : <div className="grid grid-cols-1 items-center gap-8 px-5 pb-6 pt-7 @xl:px-7 @3xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] @3xl:gap-12 @3xl:pb-8">
        {/* ------------------------------------------ waffle */}
        <div className="mx-auto w-full max-w-[360px]">
          <div
            role="img"
            aria-label={`${title}, ${period.caption ?? period.label}: ${groups.map((g, i) => `${g.label} ${counts[i]} of 100`).join(", ")}`}
            className="relative aspect-square w-full"
            onPointerLeave={() => {
              setHovered(null);
              setFocus(null);
            }}
          >
            {units.map((u) => {
              const { col, row } = place(u.slot, fill);
              return (
                <Cell
                  key={u.id}
                  unit={u}
                  col={col}
                  row={row}
                  gap={Number.isFinite(gap) ? Math.max(0, Math.min(8, gap)) : 4}
                  round={shape === "round"}
                  colour={colour(u.group)}
                  dim={focus !== null && focus !== u.group}
                  entered={entered}
                  reduce={reduce}
                  enterDelay={T.cells + u.slot * T.cellStep}
                  flightDelay={u.slot * T.flightStep}
                  onEnter={() => {
                    setHovered(u);
                    setFocus(u.group);
                  }}
                />
              );
            })}
          </div>
          <motion.p variants={rise} custom={T.rows} className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[10.5px] text-(--cw-muted)" aria-live="polite">
            <span>
              {hovered ? (
                <>
                  <span className="capitalize">{unit}</span> {hovered.slot + 1} of 100 · <span className="text-(--cw-muted)">{groups[hovered.group]?.label}</span>
                </>
              ) : (
                `1 cell = 1 ${unit} in 100`
              )}
            </span>
            <span className="shrink-0">{fill === "columns" ? "Fills by column" : "Fills by row"}</span>
          </motion.p>
        </div>

        {/* ------------------------------------------ headline + legend */}
        <div className="min-w-0">
          <motion.div variants={rise} custom={T.headline} className="flex items-end gap-3 px-3">
            <p className="font-display text-[clamp(3.25rem,2.2rem+4cqi,5.25rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-(--cw-accent-ink)">
              <Count value={counts[0]} entered={entered} reduce={reduce} delay={T.headline} format={(v) => `${Math.round(v)}`} />
            </p>
            <p className="max-w-[16ch] pb-1.5 text-[14px] leading-[1.35] text-(--cw-muted)">
              of every 100 {unit}s: {lead.label.charAt(0).toLowerCase() + lead.label.slice(1)}
            </p>
          </motion.div>

          <ul className="mt-6 flex flex-col">
            {groups.map((g, i) => (
              <LegendRow
                key={g.key}
                group={g}
                index={i}
                count={counts[i]}
                delta={previous ? counts[i] - previous[i] : null}
                colour={colour(i)}
                active={focus === i}
                dim={focus !== null && focus !== i}
                entered={entered}
                reduce={reduce}
                delay={T.rows + i * T.rowStep}
                onFocus={(on) => setFocus(on ? i : null)}
              />
            ))}
          </ul>
          <motion.p variants={rise} custom={T.rows + groups.length * T.rowStep} className="mt-3 px-3 font-mono text-[10.5px] text-(--cw-muted)">
            {previous ? `Change vs ${periods[index - 1].label}, in ${unit}s per 100` : "Earliest period shown"}
          </motion.p>
        </div>
      </div>}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function Tabs({ periods, value, uid, reduce, onChange }: { periods: WafflePeriod[]; value: string; uid: string; reduce: boolean; onChange: (k: string) => void }) {
  return (
    <div role="group" aria-label="Period" className="flex w-full rounded-full border border-(--cw-ink)/[0.08] bg-(--cw-ink)/[0.03] p-1 @3xl:w-auto">
      {periods.map((p) => (
        <button
          key={p.key}
          type="button"
          data-demo={`period-${p.key}`}
          aria-pressed={p.key === value}
          onClick={() => onChange(p.key)}
          className={`relative min-h-11 flex-1 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-medium transition-[color,transform] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cw-ink) @3xl:flex-none ${p.key === value ? "text-(--cw-surface)" : "text-(--cw-muted) hover:text-(--cw-ink)"}`}
        >
          {p.key === value && <motion.span layoutId={`${uid}-tab`} className="absolute inset-0 rounded-full bg-(--cw-ink)" transition={reduce ? { duration: 0 } : SPRING_UI} />}
          <span className="relative">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Three layers, each with one job: the outer box travels between slots (a
 * transform in units of its own size, so 100 cells move without layout), the
 * middle one dips as a cell changes group mid-flight, the inner one carries
 * colour, focus and the first-view pop.
 */
function Cell({
  unit,
  col,
  row,
  gap,
  round,
  colour,
  dim,
  entered,
  reduce,
  enterDelay,
  flightDelay,
  onEnter,
}: {
  unit: Unit;
  col: number;
  row: number;
  gap: number;
  round: boolean;
  colour: string;
  dim: boolean;
  entered: boolean;
  reduce: boolean;
  enterDelay: number;
  flightDelay: number;
  onEnter: () => void;
}) {
  const [scope, run] = useAnimate<HTMLDivElement>();
  const flights = useRef(unit.flights);
  useEffect(() => {
    if (unit.flights === flights.current) return;
    flights.current = unit.flights;
    if (reduce) return;
    const a = run(scope.current, { scale: [1, 0.55, 1] }, { duration: 0.55, ease: EASE, delay: flightDelay });
    return () => a.stop();
  }, [unit.flights, reduce, flightDelay, run, scope]);

  return (
    <motion.div
      className="absolute left-0 top-0 size-[10%]"
      style={{ padding: gap / 2 }}
      initial={false}
      animate={{ x: `${col * 100}%`, y: `${row * 100}%` }}
      transition={reduce ? { duration: 0 } : { ...SPRING_FLY, delay: flightDelay }}
      onPointerEnter={onEnter}
    >
      <div ref={scope} className="size-full">
        <motion.div
          className={`size-full transition-[background-color] duration-300 ${round ? "rounded-full" : "rounded-[3px]"}`}
          style={{ background: colour, transitionDelay: reduce ? "0ms" : `${Math.round(flightDelay * 1000 + 120)}ms` }}
          initial={{ opacity: 0, scale: reduce ? 1 : 0.4 }}
          animate={entered ? { opacity: dim ? 0.2 : 1, scale: 1 } : { opacity: 0, scale: reduce ? 1 : 0.4 }}
          transition={{ opacity: { duration: 0.18 }, scale: reduce ? { duration: 0 } : { duration: 0.45, ease: EASE, delay: enterDelay } }}
        />
      </div>
    </motion.div>
  );
}

function LegendRow({
  group,
  index,
  count,
  delta,
  colour,
  active,
  dim,
  entered,
  reduce,
  delay,
  onFocus,
}: {
  group: WaffleGroup;
  index: number;
  count: number;
  delta: number | null;
  colour: string;
  active: boolean;
  dim: boolean;
  entered: boolean;
  reduce: boolean;
  delay: number;
  onFocus: (on: boolean) => void;
}) {
  return (
    <motion.li variants={reduce ? FADE : RISE} custom={delay}>
      <button
        type="button"
        data-demo={`legend-${index}`}
        onPointerEnter={(e) => e.pointerType === "mouse" && onFocus(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && onFocus(false)}
        onFocus={() => onFocus(true)}
        onBlur={() => onFocus(false)}
        onClick={() => onFocus(!active)}
        aria-label={`${group.label}: ${count} of 100${delta ? `, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)}` : ""}`}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-xl px-3 py-2.5 text-left transition-[background-color,opacity,transform] duration-150 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--cw-ink)/60 ${active ? "bg-(--cw-ink)/[0.05]" : "hover:bg-(--cw-ink)/[0.03]"} `}
      >
        <span className="flex min-w-0 items-start gap-2.5">
          <span className="mt-[5px] size-2.5 shrink-0 rounded-[3px]" style={{ background: colour }} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[13.5px] leading-snug text-(--cw-ink)/88">{group.label}</span>
            {group.note && <span className="mt-0.5 block text-[12px] leading-snug text-(--cw-muted)">{group.note}</span>}
          </span>
        </span>
        <span className="flex items-baseline gap-3">
          {delta !== null && (
            <span
              className="font-mono text-[11px] tabular-nums text-(--cw-muted)"
              style={index === 0 && delta ? { color: delta > 0 ? "var(--cw-up)" : "var(--cw-down)" } : undefined}
            >
              {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
              {Math.abs(delta)}
            </span>
          )}
          <span className="w-[2.5ch] text-right text-[15px] font-medium tabular-nums text-(--cw-ink)/92">
            <Count value={count} entered={entered} reduce={reduce} delay={delay + 0.08} format={(v) => `${Math.round(v)}`} />
          </span>
        </span>
      </button>
    </motion.li>
  );
}

/** Counts from zero out of a blur on first view, then eases to each new value. */
function Count({ value, entered, reduce, delay, format }: { value: number; entered: boolean; reduce: boolean; delay: number; format: (v: number) => string }) {
  const n = useMotionValue(0);
  const blur = useMotionValue(6);
  const landed = useRef(false);
  useEffect(() => {
    if (!entered) return;
    if (reduce) {
      n.jump(value);
      blur.jump(0);
      return;
    }
    const first = !landed.current;
    landed.current = true;
    const opts = { duration: first ? T.count : 0.6, ease: EASE, delay: first ? delay : 0.12 };
    if (!first) blur.jump(3);
    const a = animate(n, value, opts);
    const b = animate(blur, 0, opts);
    return () => {
      a.stop();
      b.stop();
    };
    // `delay` only matters for the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, entered, reduce]);
  const text = useTransform(n, format);
  const filter = useMotionTemplate`blur(${blur}px)`;
  return (
    <>
      <motion.span aria-hidden="true" className="inline-block tabular-nums" style={{ filter }}>
        {text}
      </motion.span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

/** Demo: the chart on a quiet stage. */
export default function ChartWaffleDemo(overrides: Partial<ChartWaffleProps> = {}) {
  return (
    <div className={`flex min-h-[720px] w-full items-center justify-center px-4 py-10 sm:px-10 ${overrides.theme === "light" ? "bg-[#ececea]" : "bg-black"}`}>
      <div className="w-full max-w-4xl">
        <ChartWaffle {...overrides} />
      </div>
    </div>
  );
}
