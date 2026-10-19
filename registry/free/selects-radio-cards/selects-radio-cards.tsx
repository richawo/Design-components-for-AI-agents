"use client";
import { type CSSProperties, useId, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";

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

export type RadioCardOption = {
  id: string;
  label: string;
  description: string;
  meta?: string;
  disabled?: boolean;
};
export type RadioCardsProps = {
  label?: string;
  options?: RadioCardOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  theme?: "dark" | "light";
};
const defaults: RadioCardOption[] = [
  {
    id: "focused",
    label: "Focused",
    description: "One precise answer. Keep the working notes out of the way.",
    meta: "For quick decisions",
  },
  {
    id: "explained",
    label: "Explained",
    description: "Show the reasoning, sources and useful alternatives.",
    meta: "For deeper questions",
  },
  {
    id: "exploratory",
    label: "Exploratory",
    description: "Investigate the edges and bring back a few directions.",
    meta: "For early ideas",
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

function SelectionMark({ reduced }: { reduced: boolean }) {
  const controls = useAnimationControls();
  useLayoutEffect(() => {
    controls.stop();
    const target = { opacity: 1, scale: 1 };
    if (reduced) controls.set(target);
    else void controls.start({ ...target, transition: { duration: 0.16 } });
    return () => controls.stop();
  }, [controls, reduced]);
  return (
    <motion.span initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }} animate={controls}>
      <Check size={14} aria-hidden="true" />
    </motion.span>
  );
}

export function RadioCards({
  label = "How should the assistant respond?",
  options = defaults,
  value,
  defaultValue = "explained",
  onChange,
  theme = "dark",
}: RadioCardsProps) {
  const id = useId();
  const { reduced, entrance } = useCardEntry();
  const [local, setLocal] = useState(defaultValue);
  const selected = value ?? local;
  const readOnly = value !== undefined && !onChange;
  return (
    <motion.fieldset
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      style={colors(theme)}
      className="@container w-full max-w-3xl border-0 bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <legend className="sr-only">{label}</legend>
      <p className="mb-6 text-xl font-medium tracking-tight">{label}</p>
      <div className="grid gap-3 @xl:grid-cols-3">
        {options.map((option, i) => (
          <label
            key={option.id}
            className={`relative block rounded-xl border p-5 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none ${option.disabled ? "cursor-not-allowed opacity-40" : readOnly ? "cursor-default" : "cursor-pointer hover:bg-[var(--wash)] active:scale-[.98]"} ${selected === option.id ? "border-[var(--ink)]" : "border-[var(--line)]"}`}
          >
            <input
              type="radio"
              name={id}
              data-demo={`option-${i}`}
              value={option.id}
              checked={selected === option.id}
              disabled={option.disabled || readOnly}
              onChange={() => {
                if (option.disabled || readOnly) return;
                setLocal(option.id);
                onChange?.(option.id);
              }}
              className="peer sr-only"
            />
            <span className="pointer-events-none absolute inset-[-4px] rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)]" />
            <div className="mb-8 flex items-center justify-between">
              <ArrowUpRight size={22} aria-hidden="true" />
              <span className="grid h-6 w-6 place-items-center rounded-full border border-[var(--control-line)]">
                {selected === option.id && (
                  <SelectionMark reduced={reduced} />
                )}
              </span>
            </div>
            <span className="block text-lg font-medium">{option.label}</span>
            <span className={`mt-2 block text-sm leading-relaxed ${muted}`}>
              {option.description}
            </span>
            {option.meta && (
              <span
                className={`mt-6 block border-t border-[var(--line)] pt-3 font-mono text-xs ${muted}`}
              >
                {option.meta}
              </span>
            )}
          </label>
        ))}
      </div>
      {!options.length && <p className={muted}>No options available.</p>}
    </motion.fieldset>
  );
}

export default function RadioCardsDemo(
  overrides: Partial<RadioCardsProps> = {},
) {
  return (
    <div
      className="flex min-h-[max(560px,100dvh)] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <RadioCards {...overrides} />
    </div>
  );
}
