"use client";
import {
  type CSSProperties, useLayoutEffect, useSyncExternalStore, type PointerEvent, type MouseEvent,
  useCallback, useEffect, useId, useRef, useState,
} from "react";
import { Minus, Plus } from "lucide-react";
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
  const { reduced, entrance } = useLiveEntrance();
  const lower = Number.isFinite(min) ? min : 0;
  const upper = Math.max(lower, Number.isFinite(max) ? max : lower + 100);
  const increment = Number.isFinite(step) && step > 0 ? step : 1;
  const clamp = (n: number) =>
    Math.min(upper, Math.max(lower, Number.isFinite(n) ? n : lower));
  const [local, setLocal] = useState(() => clamp(defaultValue));
  const current = clamp(value ?? local);
  const readOnly = value !== undefined && !onChange;
  const unavailable = disabled || readOnly;
  const [draft, setDraft] = useState<string | null>(null);
  function update(n: number) {
    if (unavailable) return;
    const next =
      n === Infinity
        ? upper
        : n === -Infinity
          ? lower
          : clamp(n);
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
  const span = upper - lower;
  const ratio = upper > lower
    ? Number.isFinite(span)
      ? (current - lower) / span
      : (current / 2 - lower / 2) / (upper / 2 - lower / 2)
    : 0;
  const base = draft !== null && draft.trim() && Number.isFinite(Number(draft))
    ? clamp(Number(draft))
    : current;
  const hold = useStepHold((direction) => update(steppedValue(base, direction * increment)), !unavailable);
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      transition={{ duration: reduced ? 0.1 : 0.32 }}
      style={colors(theme)}
      aria-labelledby={id}
      className="ns-root @container w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)] shadow-2xl shadow-black/10"
    >
      <style>{stepperCss}</style>
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
      <div
        className="ns-ctl-stepper my-8"
        role="group"
        aria-label={`${label} adjustment`}
        data-wide-value={String(draft ?? current).length > 5 || undefined}
        style={{ "--ns-digits": Math.max(1, String(draft ?? current).length) } as CSSProperties}
      >
        <button
          type="button"
          data-demo="decrease"
          aria-label={`Decrease ${label}`}
          className={`${control} border border-[var(--line)] p-0`}
          disabled={unavailable || current <= lower}
          {...hold(-1)}
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
            readOnly={readOnly}
            value={draft ?? current}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (unavailable || e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") setDraft(null);
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                update(
                  steppedValue(base, (e.key === "ArrowUp" ? increment : -increment) * (e.shiftKey ? 10 : 1)),
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
          disabled={unavailable || current >= upper}
          {...hold(1)}
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
          key={reduced ? "static" : "moving"}
          data-demo="ruler-indicator"
          initial={false}
          animate={{ left: `${ratio * 100}%` }}
          transition={{ duration: reduced ? 0 : 0.24 }}
          className="absolute bottom-0 h-7 w-0.5 -translate-x-1/2 bg-[var(--ink)]"
        />
      </div>
    </motion.section>
  );
}

function decimalPlaces(value: number) {
  const [coefficient, exponent = "0"] = Math.abs(value).toString().split("e");
  return Math.max(0, (coefficient.split(".")[1]?.length ?? 0) - Number(exponent));
}

function steppedValue(value: number, delta: number) {
  const next = value + delta;
  if (!Number.isFinite(next)) return next;
  // Round arithmetic noise to the precision of the actual operands. Typed
  // values and exact bounds do not pass through this arithmetic-only path.
  const digits = Math.max(decimalPlaces(value), decimalPlaces(delta));
  return digits <= 100 ? Number(next.toFixed(digits)) : next;
}

function useStepHold(onStep: (direction: number) => void, enabled: boolean) {
  const owner = useRef<number | null>(null);
  const step = useRef(onStep);
  step.current = onStep;
  const delay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const repeat = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = useCallback(() => {
    clearTimeout(delay.current);
    clearInterval(repeat.current);
    delay.current = undefined;
    repeat.current = undefined;
    owner.current = null;
  }, []);
  useEffect(() => {
    const release = (event: { pointerId: number; button: number }) => {
      if (event.pointerId === owner.current && event.button <= 0) stop();
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", stop);
    return () => {
      stop();
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", stop);
    };
  }, [stop]);
  useEffect(() => { if (!enabled) stop(); }, [enabled, stop]);
  return (direction: number) => ({
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (!enabled || event.button !== 0) return;
      stop();
      owner.current = event.pointerId;
      step.current(direction);
      delay.current = setTimeout(() => {
        step.current(direction);
        repeat.current = setInterval(() => step.current(direction), 60);
      }, 400);
    },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      if (enabled && event.detail === 0) step.current(direction);
    },
  });
}

const stepperCss = `
/* @controls stepper prefix=ns */
.ns-ctl-stepper {
  --c-line: var(--ns-ctl-line, color-mix(in srgb, currentColor 18%, transparent));
  display: inline-flex;
  align-items: stretch;
  height: 36px;
  border: 1px solid var(--c-line);
  border-radius: 9px;
  background: color-mix(in srgb, currentColor 3%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
  transition: border-color 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}
.ns-ctl-stepper:has(> input:focus-visible) { outline: 2px solid var(--ns-ctl-ink, currentColor); outline-offset: 2px; }
.ns-ctl-stepper > button {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: color-mix(in srgb, currentColor 64%, transparent);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.14s cubic-bezier(0.22, 1, 0.36, 1), color 0.14s cubic-bezier(0.22, 1, 0.36, 1);
}
.ns-ctl-stepper > button > svg { width: 14px; height: 14px; transition: transform 0.1s cubic-bezier(0.22, 1, 0.36, 1); }
@media (hover: hover) {
  .ns-ctl-stepper > button:hover:not(:disabled) { background: color-mix(in srgb, currentColor 7%, transparent); color: currentColor; }
}
.ns-ctl-stepper > button:active:not(:disabled) > svg { transform: scale(0.82); }
.ns-ctl-stepper > button:focus { outline: none; }
.ns-ctl-stepper > button:focus-visible { outline: 2px solid var(--ns-ctl-ink, currentColor); outline-offset: -2px; }
.ns-ctl-stepper > button:disabled { cursor: not-allowed; opacity: 0.35; }
.ns-ctl-stepper > input {
  -moz-appearance: textfield;
  appearance: textfield;
  min-width: 0;
  width: calc(var(--ns-ctl-ch, 4) * 1ch + 8px);
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: center;
  outline: none;
}
.ns-ctl-stepper > input::-webkit-inner-spin-button,
.ns-ctl-stepper > input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ns-ctl-stepper:has(> input:disabled) { opacity: 0.4; }
.ns-ctl-stepper:has(> input:disabled) > button:disabled { opacity: 1; }
@media (pointer: coarse) {
  .ns-ctl-stepper { height: 44px; }
  .ns-ctl-stepper > button { width: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .ns-ctl-stepper > button > svg { transition: none; transform: none !important; }
}
/* @controls end */
.ns-root { --ns-ctl-ink:var(--ink); --ns-ctl-surface:var(--panel); --ns-ctl-line:var(--line); }
/* The canonical buttons surround this component's large figure and ruler. */
.ns-root .ns-ctl-stepper {
  display:grid; grid-template-columns:44px minmax(0,1fr) 44px; gap:12px;
  height:auto; align-items:center; border:0; background:transparent; box-shadow:none;
}
.ns-root .ns-ctl-stepper > button { width:44px; height:44px; border:1px solid var(--line); }
/* Long exact values keep their complete figure above the controls. */
.ns-root .ns-ctl-stepper[data-wide-value] > div { display:contents; }
.ns-root .ns-ctl-stepper[data-wide-value] input {
  grid-row:1; grid-column:1 / -1;
  font-size:clamp(1rem,calc(100cqw / var(--ns-digits) * 1.45),3.75rem);
}
.ns-root .ns-ctl-stepper[data-wide-value] p { grid-row:2; grid-column:2; margin-top:0; }
.ns-root .ns-ctl-stepper[data-wide-value] > button { grid-row:2; }
.ns-root .ns-ctl-stepper[data-wide-value] > button:first-child { grid-column:1; }
.ns-root .ns-ctl-stepper[data-wide-value] > button:last-child { grid-column:3; }

`;

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
