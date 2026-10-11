"use client";
import { type CSSProperties, useId, useState } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

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
export function RadioCards({
  label = "How should the assistant respond?",
  options = defaults,
  value,
  defaultValue = "explained",
  onChange,
  theme = "dark",
}: RadioCardsProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [local, setLocal] = useState(defaultValue);
  const selected = value ?? local;
  return (
    <fieldset
      style={colors(theme)}
      className="@container w-full max-w-3xl border-0 bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <legend className="sr-only">{label}</legend>
      <p className="mb-6 text-xl font-medium tracking-tight">{label}</p>
      <div className="grid gap-3 @xl:grid-cols-3">
        {options.map((option, i) => (
          <label
            key={`${option.id}-${i}`}
            className={`relative block cursor-pointer rounded-xl border p-5 transition-transform active:scale-[.98] motion-reduce:transform-none ${option.disabled ? "cursor-not-allowed opacity-40" : "hover:bg-[var(--wash)]"} ${selected === option.id ? "border-[var(--ink)]" : "border-[var(--line)]"}`}
          >
            <input
              type="radio"
              name={id}
              data-demo={`option-${i}`}
              value={option.id}
              checked={selected === option.id}
              disabled={option.disabled}
              onChange={() => {
                setLocal(option.id);
                onChange?.(option.id);
              }}
              className="peer sr-only"
            />
            <span className="pointer-events-none absolute inset-[-4px] rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)]" />
            <div className="mb-8 flex items-center justify-between">
              <ArrowUpRight size={22} aria-hidden="true" />
              <span className="grid h-6 w-6 place-items-center rounded-full border border-[var(--line)]">
                {selected === option.id && (
                  <motion.span
                    initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Check size={14} aria-hidden="true" />
                  </motion.span>
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
    </fieldset>
  );
}

export default function RadioCardsDemo(
  overrides: Partial<RadioCardsProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <RadioCards {...overrides} />
    </div>
  );
}
