"use client";
import { type CSSProperties, useLayoutEffect, useSyncExternalStore, useId, useState } from "react";
import { Check } from "lucide-react";
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
    "--control-line": theme === "dark" ? "#727272" : "#8a8a8a",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
  } as CSSProperties;
}

export type ColorSwatch = { name: string; hex: string };
export type ColorSwatchesProps = {
  label?: string;
  specimen?: string;
  swatches?: ColorSwatch[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (hex: string) => void;
  theme?: "dark" | "light";
};
const defaults: ColorSwatch[] = [
  { name: "Chalk", hex: "#e5e5e5" },
  { name: "Ochre", hex: "#e7b75b" },
  { name: "Sage", hex: "#9ab4a3" },
  { name: "Terracotta", hex: "#c7785b" },
  { name: "Slate", hex: "#9caec1" },
];
const valid = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex);
function ink(hex: string) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 >
    0.179
    ? "#000000"
    : "#ffffff";
}
export function ColorSwatches({
  label = "Brand colour",
  specimen = "Aa",
  swatches = defaults,
  value,
  defaultValue = "#e7b75b",
  onChange,
  disabled = false,
  theme = "dark",
}: ColorSwatchesProps) {
  const id = useId();
  const { reduced, entrance } = useLiveEntrance();
  const [local, setLocal] = useState(defaultValue);
  const selected = value ?? local;
  const hex = valid(selected) ? selected : "#e5e5e5";
  const options = swatches.filter((s) => valid(s.hex));
  const unavailable = disabled || (value !== undefined && !onChange);
  function choose(next: string) {
    if (
      unavailable ||
      (valid(selected) && next.toLowerCase() === selected.toLowerCase())
    ) return;
    setLocal(next);
    onChange?.(next);
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      style={colors(theme)}
      aria-labelledby={id}
      className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
    >
      <div
        className="flex min-h-48 items-center justify-between gap-4 p-8 transition-colors duration-200 motion-reduce:transition-none"
        style={{ background: hex, color: ink(hex) }}
      >
        <span className="font-serif text-8xl tracking-[-.06em]">
          {specimen}
        </span>
        <span className="self-end font-mono text-xs uppercase">{hex}</span>
      </div>
      <div className="p-6">
        <h2 id={id} className="text-lg font-medium tracking-tight">
          {label}
        </h2>
        <div role="group" aria-label={label} className="mt-4 flex flex-wrap gap-2">
          {options.map((s, i) => (
            <button
              key={`${s.hex}-${i}`}
              type="button"
              data-demo={`swatch-${i}`}
              aria-label={`${s.name}, ${s.hex}`}
              aria-pressed={hex.toLowerCase() === s.hex.toLowerCase()}
              disabled={unavailable}
              onClick={() => choose(s.hex)}
              className={`${control} h-12 w-12 border border-[var(--control-line)] p-0 hover:opacity-80`}
              style={{ background: s.hex, color: ink(s.hex) }}
            >
              {hex.toLowerCase() === s.hex.toLowerCase() && (
                <Check size={20} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <label htmlFor={`${id}-custom`} className={`text-sm ${muted}`}>
            Custom colour
          </label>
          <input
            id={`${id}-custom`}
            type="color"
            data-demo="custom-colour"
            disabled={unavailable}
            value={hex}
            onChange={(e) => choose(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded border border-[var(--control-line)] bg-transparent p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
      </div>
    </motion.section>
  );
}

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

export default function ColorSwatchesDemo(
  overrides: Partial<ColorSwatchesProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <ColorSwatches {...overrides} />
    </div>
  );
}
