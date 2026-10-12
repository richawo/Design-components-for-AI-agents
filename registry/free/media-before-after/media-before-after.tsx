"use client";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
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

export type BeforeAfterProps = {
  title?: string;
  beforeLabel?: string;
  afterLabel?: string;
  before?: ReactNode;
  after?: ReactNode;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  theme?: "dark" | "light";
};
function Specimen({ finished }: { finished: boolean }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${finished ? "bg-[#e3dac9] text-[#26231e]" : "bg-[#181818] text-[#b8b8b8]"}`}
    >
      <div className="absolute inset-6 border border-current opacity-30" />
      <div
        className="absolute inset-0 grid grid-cols-4 opacity-15"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="border-r border-current" />
        ))}
      </div>
      <div className="absolute inset-x-8 top-9 flex justify-between font-mono text-[10px] uppercase tracking-[.14em]">
        <span>Fieldwork</span>
        <span>Issue 04</span>
      </div>
      <div
        className={`absolute inset-0 grid place-items-center leading-none tracking-[-.1em] ${finished ? "font-serif" : "font-mono"}`}
        style={{ fontSize: "clamp(7rem,40cqw,15rem)" }}
      >
        Aa
      </div>
      <div className="absolute inset-x-8 bottom-9 border-t border-current pt-3 font-mono text-[10px] uppercase tracking-[.1em]">
        The shape of a quieter idea.
      </div>
    </div>
  );
}
export function BeforeAfter({
  title = "From structure to character",
  beforeLabel = "Wireframe",
  afterLabel = "Final design",
  before = <Specimen finished={false} />,
  after = <Specimen finished />,
  value,
  defaultValue = 48,
  onChange,
  theme = "dark",
}: BeforeAfterProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [local, setLocal] = useState(defaultValue);
  const raw = value ?? local;
  const split = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 50;
  return (
    <motion.figure
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={colors(theme)}
      className="@container w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
    >
      <div className="relative aspect-[4/3] min-h-64 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0">
          {after}
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
        >
          {before}
        </div>
        <input
          type="range"
          data-demo="compare-slider"
          aria-label={`${beforeLabel} and ${afterLabel} comparison`}
          aria-valuetext={`${Math.round(split)} percent ${beforeLabel}`}
          min={0}
          max={100}
          value={split}
          onChange={(e) => {
            const next = Number(e.target.value);
            setLocal(next);
            onChange?.(next);
          }}
          className="peer absolute inset-0 z-20 m-0 h-full w-full cursor-ew-resize touch-pan-y opacity-0"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white shadow-[0_0_0_1px_#111]"
          style={{ left: `${split}%` }}
        >
          <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-[#111] text-white">
            <ChevronsLeftRight size={20} />
          </span>
        </div>
        <div className="pointer-events-none absolute inset-1 z-30 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-white" />
      </div>
      <figcaption id={id} className="p-5">
        <div
          className={`mb-3 flex justify-between gap-4 font-mono text-[11px] ${muted}`}
        >
          <span>{beforeLabel}</span>
          <span>{afterLabel}</span>
        </div>
        <p className="text-base font-medium tracking-tight">{title}</p>
        <p className={`mt-2 text-xs ${muted}`}>
          Drag the divider, or use the arrow keys.
        </p>
      </figcaption>
    </motion.figure>
  );
}

export default function BeforeAfterDemo(
  overrides: Partial<BeforeAfterProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <BeforeAfter {...overrides} />
    </div>
  );
}
