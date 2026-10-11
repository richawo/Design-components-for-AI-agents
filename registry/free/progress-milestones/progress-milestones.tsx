"use client";
import { type CSSProperties, useId, useState } from "react";
import { Check, ArrowRight } from "lucide-react";
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

export type Milestone = { id: string; label: string; detail: string };
export type MilestoneProgressProps = {
  title?: string;
  steps?: Milestone[];
  current?: number;
  onStepChange?: (index: number) => void;
  theme?: "dark" | "light";
};
const defaults: Milestone[] = [
  {
    id: "brief",
    label: "Brief",
    detail: "The scope is agreed and the right people are in the room.",
  },
  {
    id: "prototype",
    label: "Prototype",
    detail: "A working direction, ready to test with real content.",
  },
  {
    id: "review",
    label: "Review",
    detail: "Check the edge cases, polish the details and sign off.",
  },
  {
    id: "handover",
    label: "Handover",
    detail: "Source files, notes and a clear path for the next release.",
  },
];
export function MilestoneProgress({
  title = "Studio sprint",
  steps = defaults,
  current = 1,
  onStepChange,
  theme = "dark",
}: MilestoneProgressProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const index = Math.min(
    steps.length,
    Math.max(0, Number.isFinite(current) ? Math.floor(current) : 0),
  );
  const active = steps[index];
  const ratio = steps.length ? index / steps.length : 0;
  return (
    <section
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-xl font-medium tracking-tight">
          {title}
        </h2>
        <span className={`font-mono text-xs ${muted}`}>
          {index} / {steps.length}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${title} completion`}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="my-6 h-1 overflow-hidden rounded-full bg-[var(--wash)]"
      >
        <motion.div
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: reduced ? 0 : 0.35 }}
          className="h-full bg-[var(--ink)]"
        />
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={`${s.id}-${i}`}>
            <button
              type="button"
              data-demo={`step-${i}`}
              disabled={!onStepChange}
              aria-current={i === index ? "step" : undefined}
              onClick={() => onStepChange?.(i)}
              className={`${control} w-full justify-start gap-4 px-2 text-left disabled:opacity-100`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-xs ${i < index ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--panel)]" : "border-[var(--line)]"}`}
              >
                {i < index ? <Check size={14} aria-hidden="true" /> : i + 1}
              </span>
              <span className={`flex-1 ${i > index ? muted : ""}`}>
                {s.label}
              </span>
              {i === index && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>
      <motion.div
        key={index}
        initial={{ opacity: 0, y: reduced ? 0 : 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.1 : 0.24 }}
        className="mt-6 border-t border-[var(--line)] pt-5"
      >
        <p className="text-sm font-medium">
          {active?.label ??
            (steps.length ? "All milestones complete" : "No milestones yet")}
        </p>
        <p className={`mt-2 min-h-12 text-sm leading-relaxed ${muted}`}>
          {active?.detail ??
            (steps.length
              ? "Every stage is finished. Ready for what comes next."
              : "Add steps to describe your workflow.")}
        </p>
      </motion.div>
    </section>
  );
}
export default function MilestoneProgressDemo(
  overrides: Partial<MilestoneProgressProps> = {},
) {
  const [current, setCurrent] = useState(1);
  return (
    <div
      className="flex min-h-[620px] items-center justify-center p-4 sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <MilestoneProgress
        current={current}
        onStepChange={setCurrent}
        {...overrides}
      />
    </div>
  );
}
