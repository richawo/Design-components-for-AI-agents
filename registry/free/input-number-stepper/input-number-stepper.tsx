"use client";
import { type CSSProperties, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)] active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none";
const muted = "text-[var(--muted)]";
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--line": theme === "dark" ? "#333333" : "#d4d4d4",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
  } as CSSProperties;
}

export type NumberStepperProps = {
  label?: string;
  description?: string;
  unit?: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
  theme?: "dark" | "light";
};
export function NumberStepper({
  label = "Parallel runs",
  description = "Set how many tasks your workspace can run at once.",
  unit = "workers",
  value,
  defaultValue = 4,
  min = 1,
  max = 16,
  step = 1,
  disabled = false,
  onChange,
  theme = "dark",
}: NumberStepperProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const lower = Number.isFinite(min) ? min : 0;
  const upper = Math.max(lower, Number.isFinite(max) ? max : lower + 100);
  const increment = Number.isFinite(step) && step > 0 ? step : 1;
  const clamp = (n: number) =>
    Math.min(upper, Math.max(lower, Number.isFinite(n) ? n : lower));
  const [local, setLocal] = useState(() => clamp(defaultValue));
  const current = clamp(value ?? local);
  const [draft, setDraft] = useState<string | null>(null);
  function update(n: number) {
    const next = clamp(Number(n.toFixed(10)));
    setLocal(next);
    setDraft(null);
    if (next !== current) onChange?.(next);
  }
  function commit() {
    if (draft !== null)
      update(
        draft.trim() && Number.isFinite(Number(draft))
          ? Number(draft)
          : current,
      );
  }
  const ratio = upper > lower ? (current - lower) / (upper - lower) : 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.1 : 0.32 }}
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)] shadow-2xl shadow-black/10"
    >
      <div className="flex items-start justify-between gap-4">
        <label
          id={id}
          htmlFor={`${id}-value`}
          className="text-lg font-medium tracking-tight"
        >
          {label}
        </label>
        <span className={`font-mono text-xs ${muted}`}>
          {lower}–{upper}
        </span>
      </div>
      <p
        id={`${id}-help`}
        className={`mt-2 max-w-xs text-sm leading-relaxed ${muted}`}
      >
        {description}
      </p>
      <div className="my-8 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3">
        <button
          type="button"
          data-demo="decrease"
          aria-label={`Decrease ${label}`}
          className={`${control} border border-[var(--line)] p-0`}
          disabled={disabled || current <= lower}
          onClick={() => update(current - increment)}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <input
            id={`${id}-value`}
            type="text"
            inputMode="decimal"
            role="spinbutton"
            aria-valuemin={lower}
            aria-valuemax={upper}
            aria-valuenow={current}
            aria-describedby={`${id}-help`}
            disabled={disabled}
            value={draft ?? current}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") setDraft(null);
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                update(
                  current + (e.key === "ArrowUp" ? increment : -increment),
                );
              }
              if (e.key === "Home" || e.key === "End") {
                e.preventDefault();
                update(e.key === "Home" ? lower : upper);
              }
            }}
            className="w-full min-w-0 rounded bg-transparent text-center font-display text-6xl leading-tight tracking-[-.06em] tabular-nums outline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--ink)] disabled:opacity-40"
          />
          <p className={`mt-1 text-xs ${muted}`}>{unit}</p>
        </div>
        <button
          type="button"
          data-demo="increase"
          aria-label={`Increase ${label}`}
          className={`${control} border border-[var(--line)] p-0`}
          disabled={disabled || current >= upper}
          onClick={() => update(current + increment)}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
      <div
        aria-hidden="true"
        className="relative flex h-7 items-end justify-between gap-1 overflow-hidden"
      >
        {Array.from({ length: 33 }, (_, i) => (
          <span
            key={i}
            className="w-px shrink-0 bg-[var(--line)]"
            style={{ height: i % 4 === 0 ? 20 : 10 }}
          />
        ))}
        <motion.span
          animate={{ left: `${ratio * 100}%` }}
          transition={{ duration: reduced ? 0 : 0.24 }}
          className="absolute bottom-0 h-7 w-0.5 -translate-x-1/2 bg-[var(--ink)]"
        />
      </div>
    </motion.section>
  );
}

export default function NumberStepperDemo(
  overrides: Partial<NumberStepperProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <NumberStepper {...overrides} />
    </div>
  );
}
