"use client";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { Check, Bell } from "lucide-react";
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

export type PreferenceOption = {
  id: string;
  label: string;
  description: string;
  required?: boolean;
};
export type PreferenceCenterProps = {
  title?: string;
  description?: string;
  options?: PreferenceOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  onSave?: (value: string[]) => void | Promise<void>;
  errorMessage?: string;
  theme?: "dark" | "light";
};
const defaults: PreferenceOption[] = [
  {
    id: "essential",
    label: "Account essentials",
    description:
      "Security notices, billing receipts and changes that affect your account.",
    required: true,
  },
  {
    id: "digest",
    label: "The weekly digest",
    description: "A considered summary of the work your team shipped.",
  },
  {
    id: "product",
    label: "Product notes",
    description: "New capabilities and the occasional useful tip.",
  },
];
export function PreferenceCenter({
  title = "Keep the useful things.",
  description = "Choose which updates reach your inbox.",
  options = defaults,
  value,
  defaultValue = ["essential", "digest"],
  onChange,
  onSave,
  errorMessage = "Preferences could not be saved. Try again.",
  theme = "dark",
}: PreferenceCenterProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [local, setLocal] = useState(defaultValue);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const selected = [
    ...new Set([
      ...(value ?? local),
      ...options.filter((o) => o.required).map((o) => o.id),
    ]),
  ];
  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((x) => x !== key)
      : [...selected, key];
    setLocal(next);
    setNotice("");
    onChange?.(next);
  }
  async function save() {
    if (!onSave || busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice("");
    try {
      await onSave([...selected]);
      if (alive.current) setNotice("Preferences saved.");
    } catch {
      if (alive.current) setNotice(errorMessage);
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby={id}
      style={colors(theme)}
      className="@container w-full max-w-xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <Bell size={24} strokeWidth={1.3} aria-hidden="true" />
      <h2 id={id} className="mt-5 font-serif text-3xl tracking-[-.03em]">
        {title}
      </h2>
      <p className={`mt-2 text-sm ${muted}`}>{description}</p>
      <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {options.map((option, i) => (
          <label
            key={`${option.id}-${i}`}
            className={`flex min-h-20 items-center gap-5 py-5 ${pending || option.required ? "cursor-default" : "cursor-pointer"}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{option.label}</span>
              <span className={`mt-1 block text-sm leading-relaxed ${muted}`}>
                {option.description}
              </span>
              {option.required && (
                <span className={`mt-2 block font-mono text-[11px] ${muted}`}>
                  Always on
                </span>
              )}
            </span>
            <span className="relative grid h-11 w-11 shrink-0 place-items-center">
              <input
                type="checkbox"
                data-demo={`preference-${i}`}
                checked={selected.includes(option.id)}
                disabled={pending || option.required}
                onChange={() => toggle(option.id)}
                className="peer sr-only"
              />
              <span
                className={`grid h-6 w-6 place-items-center rounded-md border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--ink)] ${selected.includes(option.id) ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--panel)]" : "border-[var(--muted)]"}`}
              >
                {selected.includes(option.id) && (
                  <Check size={15} aria-hidden="true" />
                )}
              </span>
            </span>
          </label>
        ))}
      </div>
      {!options.length && (
        <p className={`py-6 text-sm ${muted}`}>No preferences available.</p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className={`text-xs ${muted}`}>
          {notice}
        </p>
        <button
          type="button"
          data-demo="save-preferences"
          disabled={pending || !onSave}
          aria-busy={pending}
          onClick={() => void save()}
          className={`${control} border border-[var(--line)]`}
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </motion.section>
  );
}
export default function PreferenceCenterDemo(
  overrides: Partial<PreferenceCenterProps> = {},
) {
  return (
    <div
      className="flex min-h-[720px] items-center justify-center p-4 sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <PreferenceCenter
        onSave={() => new Promise((resolve) => setTimeout(resolve, 400))}
        {...overrides}
      />
    </div>
  );
}
