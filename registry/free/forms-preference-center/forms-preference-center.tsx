"use client";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)] disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none";
const muted = "text-[var(--muted)]";
const CSS = `
/* @controls check prefix=pc */
.pc-ctl-check {
  --c-ink: var(--pc-ctl-accent, var(--pc-ctl-ink, currentColor));
  --c-on: var(--pc-ctl-surface, Canvas);
  --c-line: var(--pc-ctl-line, color-mix(in srgb, currentColor 30%, transparent));
  position: relative;
  display: inline-grid;
  flex: none;
  width: 18px;
  height: 18px;
  vertical-align: middle;
  transition: transform 0.1s cubic-bezier(0.22, 1, 0.36, 1);
}
.pc-ctl-check > input {
  -webkit-appearance: none;
  appearance: none;
  color: inherit;
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  margin: 0;
  border: 1.5px solid var(--c-line);
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.16s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}
@media (hover: hover) {
  .pc-ctl-check > input:hover:not(:disabled):not(:checked):not(:indeterminate) { border-color: color-mix(in srgb, var(--c-ink) 62%, transparent); background: color-mix(in srgb, var(--c-ink) 6%, transparent); }
}
.pc-ctl-check > input:is(:checked, :indeterminate) { border-color: var(--c-ink); background: var(--c-ink); }
.pc-ctl-check > input:focus { outline: none; }
.pc-ctl-check > input:focus-visible { outline: 2px solid var(--pc-ctl-ink, currentColor); outline-offset: 2px; }
.pc-ctl-check > input:disabled { cursor: not-allowed; }
.pc-ctl-check:has(> input:disabled) { opacity: 0.4; }
.pc-ctl-check:has(> input:active:not(:disabled)) { transform: scale(0.88); }
.pc-ctl-check > svg {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  pointer-events: none;
  fill: none;
  stroke: var(--c-on);
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.pc-ctl-check > svg path { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 0.12s cubic-bezier(0.4, 0, 1, 1); }
.pc-ctl-check > input:checked:not(:indeterminate) + svg [data-mark="check"],
.pc-ctl-check > input:indeterminate + svg [data-mark="dash"] { stroke-dashoffset: 0; transition: stroke-dashoffset 0.22s cubic-bezier(0.65, 0, 0.35, 1) 0.04s; }
@media (prefers-reduced-motion: reduce) {
  .pc-ctl-check, .pc-ctl-check > svg path { transition: none !important; }
  .pc-ctl-check:has(> input:active:not(:disabled)) { transform: none; }
}
@media (forced-colors: active) {
  .pc-ctl-check > input { -webkit-appearance: auto; appearance: auto; }
  .pc-ctl-check > svg { display: none; }
}
/* @controls end */
`;
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    overflowWrap: "anywhere",
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--line": theme === "dark" ? "#333333" : "#d4d4d4",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
    "--pc-ctl-ink": "var(--ink)",
    "--pc-ctl-surface": "var(--panel)",
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
      <style>{CSS}</style>
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
              <span className="pc-ctl-check">
                <input
                  type="checkbox"
                  data-demo={`preference-${i}`}
                  checked={selected.includes(option.id)}
                  disabled={option.required}
                  aria-disabled={pending || undefined}
                  onChange={() => {
                    // Locked while saving without the faded disabled look, so the list doesn't flicker on every save.
                    if (!pending) toggle(option.id);
                  }}
                />
                <svg viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    data-mark="check"
                    pathLength={1}
                    d="M4.5 9.4l3 2.9 6-6.6"
                  />
                  <path data-mark="dash" pathLength={1} d="M5 9h8" />
                </svg>
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
