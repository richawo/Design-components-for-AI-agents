"use client";
import { type CSSProperties, useLayoutEffect, useSyncExternalStore, useId, useState } from "react";
import { animate, motion, useAnimationControls, useMotionValue, useTransform } from "motion/react";

const control = [
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm",
  "font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)]",
  "disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2",
  "focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed",
  "disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none",
].join(" ");
const muted = "text-[var(--muted)]";
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    overflowWrap: "anywhere",
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--line": theme === "dark" ? "#333333" : "#d4d4d4",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
  } as CSSProperties;
}

export type SlopeSeries = {
  id: string;
  label: string;
  before: number;
  after: number;
};
export type SlopeComparisonProps = {
  title?: string;
  beforeLabel?: string;
  afterLabel?: string;
  unit?: string;
  series?: SlopeSeries[];
  onSelect?: (series: SlopeSeries) => void;
  theme?: "dark" | "light";
};
const defaults: SlopeSeries[] = [
  { id: "search", label: "Search", before: 46, after: 64 },
  { id: "editor", label: "Editor", before: 58, after: 70 },
  { id: "sharing", label: "Sharing", before: 38, after: 52 },
  { id: "exports", label: "Exports", before: 32, after: 28 },
];
const safe = (n: number) => (Number.isFinite(n) ? n : 0);
const format = (n: number) =>
  Math.abs(n) >= 1e6
    ? n.toExponential(1)
    : new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
function AnimatedFigure({ value, reduced, demo }: { value: number; reduced: boolean; demo: string }) {
  const current = useMotionValue(value);
  const display = useTransform(current, format);
  useLayoutEffect(() => {
    current.stop();
    // Very large observations stay exact and never overflow interpolation.
    if (reduced || Math.abs(value - current.get()) > 1e12) {
      current.set(value);
      return;
    }
    const playback = animate(current, value, { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
    return () => playback.stop();
  }, [current, value, reduced]);
  return <motion.span data-demo={demo}>{display}</motion.span>;
}

export function SlopeComparison({
  title = "Where adoption moved.",
  beforeLabel = "September",
  afterLabel = "October",
  unit = "%",
  series = defaults,
  onSelect,
  theme = "dark",
}: SlopeComparisonProps) {
  const id = useId();
  const { reduced, entrance } = useLiveEntrance();
  const [selected, setSelected] = useState(series[0]?.id);
  const active = series.find((s) => s.id === selected) ?? series[0];
  const numbers = series.flatMap((s) => [safe(s.before), safe(s.after)]);
  const low = Math.min(0, ...numbers);
  const high = Math.max(1, ...numbers);
  const span = high - low;
  const y = (n: number) => 230 - ((safe(n) - low) / span) * 200;
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-2xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <h2 id={id} className="font-serif text-3xl tracking-[-.03em]">
        {title}
      </h2>
      <div className="mt-6 flex justify-between gap-4">
        <div>
          <p className={`text-xs ${muted}`}>{beforeLabel}</p>
          <p className="mt-2 font-display text-3xl tabular-nums">
            <AnimatedFigure value={active ? safe(active.before) : 0} reduced={reduced} demo="slope-before-value" />
            <span className={`ml-1 inline-block max-w-full text-sm leading-relaxed ${muted}`}>{unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className={`text-xs ${muted}`}>{afterLabel}</p>
          <p className="mt-2 font-display text-3xl tabular-nums">
            <AnimatedFigure value={active ? safe(active.after) : 0} reduced={reduced} demo="slope-after-value" />
            <span className={`ml-1 inline-block max-w-full text-sm leading-relaxed ${muted}`}>{unit}</span>
          </p>
        </div>
      </div>
      {Number.isFinite(span) && series.length ? (
        <svg
          viewBox="0 0 600 260"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            active
              ? `${active.label}: ${format(safe(active.before))}${unit} in ${beforeLabel}, ${format(safe(active.after))}${unit} in ${afterLabel}`
              : "No comparison data"
          }
          className="my-4 h-56 w-full overflow-visible"
        >
          <path
            d="M 10 20 V 240 M 590 20 V 240"
            fill="none"
            stroke="var(--line)"
            vectorEffect="non-scaling-stroke"
          />
          {series.map((s, i) => (
            <g key={`${s.id}-${i}`} opacity={active?.id === s.id ? 1 : 0.5}>
              <motion.path
                key={String(reduced)}
                initial={{ pathLength: reduced ? 1 : 0 }}
                animate={{
                  pathLength: 1,
                  d: `M 10 ${y(s.before)} L 590 ${y(s.after)}`,
                }}
                transition={{ duration: reduced ? 0 : 0.45 }}
                d={`M 10 ${y(s.before)} L 590 ${y(s.after)}`}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={active?.id === s.id ? 2 : 1}
                strokeDasharray={active?.id === s.id ? undefined : "4 5"}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx="10" cy={y(s.before)} r="4" fill="var(--ink)" />
              <circle cx="590" cy={y(s.after)} r="4" fill="var(--ink)" />
            </g>
          ))}
        </svg>
      ) : (
        <p className={`py-12 text-sm ${muted}`}>
          {series.length
            ? "The numeric range is too large to plot."
            : "No comparison data."}
        </p>
      )}
      <div
        role="group"
        aria-label="Highlighted series"
        className="grid gap-2 border-t border-[var(--line)] pt-4 @sm:grid-cols-2"
      >
        {series.map((s, i) => (
          <button
            type="button"
            data-demo={`slope-${i}`}
            key={`${s.id}-${i}`}
            aria-pressed={active?.id === s.id}
            onClick={() => {
              setSelected(s.id);
              onSelect?.({ ...s });
            }}
            className={`${control} justify-between! border ${active?.id === s.id ? "border-[var(--ink)]" : "border-[var(--line)]"}`}
          >
            <span>{s.label}</span>
            <span className={`font-mono text-xs ${muted}`}>
              {format(safe(s.before))} → {format(safe(s.after))}
            </span>
          </button>
        ))}
      </div>
    </motion.section>
  );
}

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
function useLiveEntrance() {
  const reduced = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
  const entrance = useAnimationControls();
  useLayoutEffect(() => {
    entrance.stop();
    if (reduced) entrance.set({ opacity: 1, y: 0 });
    else void entrance.start({ opacity: 1, y: 0, transition: { duration: 0.32 } });
    return () => entrance.stop();
  }, [entrance, reduced]);
  return { reduced, entrance };
}

export default function SlopeComparisonDemo(
  overrides: Partial<SlopeComparisonProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <SlopeComparison {...overrides} />
    </div>
  );
}
