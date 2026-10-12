"use client";
import { type CSSProperties, useId, useState } from "react";
import { Target } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)] disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none";
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

export type TargetMetric = {
  id: string;
  label: string;
  actual: number;
  target: number;
  ceiling: number;
  unit: string;
};
export type BulletPeriod = {
  id: string;
  label: string;
  metrics: TargetMetric[];
};
export type BulletTargetsProps = {
  title?: string;
  periods?: BulletPeriod[];
  defaultPeriod?: string;
  onPeriodChange?: (id: string) => void;
  theme?: "dark" | "light";
};
const defaults: BulletPeriod[] = [
  {
    id: "oct",
    label: "October",
    metrics: [
      {
        id: "docs",
        label: "Docs published",
        actual: 42,
        target: 50,
        ceiling: 70,
        unit: "docs",
      },
      {
        id: "reviews",
        label: "Reviews completed",
        actual: 28,
        target: 24,
        ceiling: 40,
        unit: "reviews",
      },
      {
        id: "response",
        label: "First reply within 1h",
        actual: 86,
        target: 90,
        ceiling: 100,
        unit: "%",
      },
    ],
  },
  {
    id: "sep",
    label: "September",
    metrics: [
      {
        id: "docs",
        label: "Docs published",
        actual: 51,
        target: 50,
        ceiling: 70,
        unit: "docs",
      },
      {
        id: "reviews",
        label: "Reviews completed",
        actual: 22,
        target: 24,
        ceiling: 40,
        unit: "reviews",
      },
      {
        id: "response",
        label: "First reply within 1h",
        actual: 92,
        target: 90,
        ceiling: 100,
        unit: "%",
      },
    ],
  },
];
const safe = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
const number = (n: number) =>
  n >= 1e6
    ? n.toExponential(1)
    : new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
export function BulletTargets({
  title = "A little closer to the target.",
  periods = defaults,
  defaultPeriod = "oct",
  onPeriodChange,
  theme = "dark",
}: BulletTargetsProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState(defaultPeriod);
  const period = periods.find((p) => p.id === selected) ?? periods[0];
  return (
    <section
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-2xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2
          id={id}
          className="max-w-xs font-serif text-3xl leading-tight tracking-[-.03em]"
        >
          {title}
        </h2>
        <div
          role="group"
          aria-label="Reporting period"
          className="flex flex-wrap gap-1"
        >
          {periods.map((p, i) => (
            <button
              type="button"
              key={`${p.id}-${i}`}
              data-demo={`bullet-period-${i}`}
              aria-pressed={period?.id === p.id}
              onClick={() => {
                setSelected(p.id);
                onPeriodChange?.(p.id);
              }}
              className={`${control} border ${period?.id === p.id ? "border-[var(--ink)]" : "border-transparent"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8 space-y-7">
        {period?.metrics.map((metric, i) => {
          const actual = safe(metric.actual),
            target = safe(metric.target),
            max = Math.max(1, safe(metric.ceiling), actual, target);
          return (
            <div key={`${metric.id}-${i}`}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h3 className="text-sm font-medium">{metric.label}</h3>
                <span className="whitespace-nowrap font-mono text-lg tabular-nums">
                  {number(actual)}
                  <span className={`ml-1 text-xs ${muted}`}>{metric.unit}</span>
                </span>
              </div>
              <div
                role="img"
                aria-label={`${metric.label}: ${number(actual)} ${metric.unit}, target ${number(target)}, scale 0 to ${number(max)}`}
                className="relative h-8 bg-[var(--wash)]"
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1/2 border-r border-[var(--line)] bg-[var(--line)] opacity-40"
                />
                <motion.div
                  aria-hidden="true"
                  initial={{ width: reduced ? `${(actual / max) * 100}%` : 0 }}
                  animate={{ width: `${(actual / max) * 100}%` }}
                  transition={{ duration: reduced ? 0 : 0.45 }}
                  className="absolute inset-y-2 left-0 bg-[var(--ink)]"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-0.5 bg-[var(--ink)] shadow-[0_0_0_2px_var(--panel)]"
                  style={{
                    left: `min(calc(100% - 2px), ${(target / max) * 100}%)`,
                  }}
                />
              </div>
              <div
                className={`mt-2 flex justify-between gap-3 font-mono text-[11px] ${muted}`}
              >
                <span>0</span>
                <span>Target {number(target)}</span>
                <span>{number(max)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {!period?.metrics.length && (
        <p className={`py-12 text-sm ${muted}`}>No targets in this period.</p>
      )}
      <p
        className={`mt-7 flex items-center gap-2 border-t border-[var(--line)] pt-4 text-xs ${muted}`}
      >
        <Target size={14} aria-hidden="true" />
        The thin marker is the target. The solid bar is the result.
      </p>
    </section>
  );
}

export default function BulletTargetsDemo(
  overrides: Partial<BulletTargetsProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <BulletTargets {...overrides} />
    </div>
  );
}
