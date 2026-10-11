"use client";
import { type CSSProperties, useId, useState } from "react";
import { Eye, EyeOff, Check, Circle } from "lucide-react";
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

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};
export type PasswordChecklistProps = {
  label?: string;
  hint?: string;
  value?: string;
  defaultValue?: string;
  rules?: PasswordRule[];
  disabled?: boolean;
  onChange?: (value: string) => void;
  theme?: "dark" | "light";
};
const rulesDefault: PasswordRule[] = [
  {
    id: "length",
    label: "At least 12 characters",
    test: (v) => v.length >= 12,
  },
  {
    id: "letter",
    label: "A letter and a number",
    test: (v) => /[a-z]/i.test(v) && /[0-9]/.test(v),
  },
  {
    id: "symbol",
    label: "At least one symbol",
    test: (v) => /[^a-z0-9\s]/i.test(v),
  },
];
export function PasswordChecklist({
  label = "Choose a password",
  hint = "Use a unique phrase you have not used elsewhere.",
  value,
  defaultValue = "",
  rules = rulesDefault,
  disabled = false,
  onChange,
  theme = "dark",
}: PasswordChecklistProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [local, setLocal] = useState(defaultValue);
  const [visible, setVisible] = useState(false);
  const password = value ?? local;
  const passed = rules.map((r) => r.test(password));
  const count = passed.filter(Boolean).length;
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={colors(theme)}
      className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <label htmlFor={id} className="text-xl font-medium tracking-tight">
        {label}
      </label>
      <p id={`${id}-hint`} className={`mt-2 text-sm leading-relaxed ${muted}`}>
        {hint}
      </p>
      <div className="mt-6 flex rounded-lg border border-[var(--line)] focus-within:ring-2 focus-within:ring-[var(--ink)]">
        <input
          id={id}
          data-demo="password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          disabled={disabled}
          value={password}
          aria-describedby={`${id}-hint ${id}-rules`}
          onChange={(e) => {
            setLocal(e.target.value);
            onChange?.(e.target.value);
          }}
          className="min-h-12 min-w-0 flex-1 rounded-l-lg bg-transparent px-3 text-base outline-none disabled:opacity-40"
        />
        <button
          type="button"
          disabled={disabled}
          data-demo="visibility"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          className={control}
        >
          {visible ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      <div aria-hidden="true" className="mt-5 flex gap-1.5">
        {rules.map((rule, i) => (
          <span
            key={`${rule.id}-${i}`}
            className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--wash)]"
          >
            <motion.span
              animate={{ width: passed[i] ? "100%" : "0%" }}
              transition={{ duration: reduced ? 0 : 0.25 }}
              className="block h-full bg-[var(--ink)]"
            />
          </span>
        ))}
      </div>
      <ul id={`${id}-rules`} className="mt-5 space-y-3">
        {rules.map((rule, i) => (
          <li
            key={`${rule.id}-${i}`}
            className={`flex items-center gap-3 text-sm ${passed[i] ? "" : muted}`}
          >
            {passed[i] ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Circle size={16} aria-hidden="true" />
            )}
            <span className="sr-only">{passed[i] ? "Met: " : "Not met: "}</span>
            {rule.label}
          </li>
        ))}
      </ul>
      <p
        role="status"
        className={`mt-6 border-t border-[var(--line)] pt-4 font-mono text-xs ${muted}`}
      >
        {rules.length
          ? `${count} of ${rules.length} requirements met`
          : "No password requirements configured"}
      </p>
    </motion.section>
  );
}

export default function PasswordChecklistDemo(
  overrides: Partial<PasswordChecklistProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <PasswordChecklist {...overrides} />
    </div>
  );
}
