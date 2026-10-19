"use client";
import { type CSSProperties, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ArrowRight } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";

const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)] disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none";
const muted = "text-[var(--muted)]";
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    overflowWrap: "anywhere",
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--control-line": "#737373",
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
const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
function useCardEntry() {
  const reduced = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
  const entrance = useAnimationControls();
  useLayoutEffect(() => {
    entrance.stop();
    const target = { opacity: 1, y: 0 };
    if (reduced) entrance.set(target);
    else void entrance.start({ ...target, transition: { duration: 0.32 } });
    return () => entrance.stop();
  }, [entrance, reduced]);
  return { reduced, entrance };
}

function useEntry(reduced: boolean, duration: number) {
  const controls = useAnimationControls();
  useLayoutEffect(() => {
    controls.stop();
    const target = { opacity: 1, y: 0 };
    if (reduced) controls.set(target);
    else void controls.start({ ...target, transition: { duration } });
    return () => controls.stop();
  }, [controls, reduced, duration]);
  return controls;
}

function CompletionFill({ ratio, reduced }: { ratio: number; reduced: boolean }) {
  const controls = useAnimationControls();
  const first = useRef(true);
  useLayoutEffect(() => {
    controls.stop();
    const target = { width: `${ratio * 100}%` };
    if (reduced) controls.set(target);
    else void controls.start({ ...target, transition: { duration: 0.35, delay: first.current ? 0.16 : 0 } });
    first.current = false;
    return () => controls.stop();
  }, [controls, ratio, reduced]);
  return <motion.div initial={{ width: 0 }} animate={controls} className="h-full bg-[var(--ink)]" />;
}
function MilestoneDetail({ label, detail, reduced }: { label: string; detail: string; reduced: boolean }) {
  const entrance = useEntry(reduced, 0.24);
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 4 }}
      animate={entrance}
      role="status"
      className="mt-6 border-t border-[var(--line)] pt-5"
    >
      <p className="text-sm font-medium">{label}</p>
      <p className={`mt-2 min-h-12 text-sm leading-relaxed ${muted}`}>{detail}</p>
    </motion.div>
  );
}

export function MilestoneProgress({
  title = "Studio sprint",
  steps = defaults,
  current = 1,
  onStepChange,
  theme = "dark",
}: MilestoneProgressProps) {
  const id = useId();
  const { reduced, entrance } = useCardEntry();
  const index = Math.min(
    steps.length,
    Math.max(0, Number.isFinite(current) ? Math.floor(current) : 0),
  );
  const active = steps[index];
  const ratio = steps.length ? index / steps.length : 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="min-w-0 text-xl font-medium tracking-tight">
          {title}
        </h2>
        <span className={`shrink-0 whitespace-nowrap font-mono text-xs tabular-nums ${muted}`}>
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
        <CompletionFill ratio={ratio} reduced={reduced} />
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              data-demo={`step-${i}`}
              disabled={!onStepChange}
              aria-current={i === index ? "step" : undefined}
              onClick={() => onStepChange?.(i)}
              className={`${control} w-full justify-start gap-4 px-2 py-2 text-left disabled:opacity-100`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-xs ${i < index ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--panel)]" : "border-[var(--control-line)]"}`}
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
      <MilestoneDetail
        key={active ? `step:${active.id}` : steps.length ? "complete" : "empty"}
        label={active?.label ?? (steps.length ? "All milestones complete" : "No milestones yet")}
        detail={active?.detail ?? (steps.length ? "Every stage is finished. Ready for what comes next." : "Add steps to describe your workflow.")}
        reduced={reduced}
      />
    </motion.section>
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
