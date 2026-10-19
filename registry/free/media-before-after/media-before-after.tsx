"use client";
import { type CSSProperties, type ReactNode, useLayoutEffect, useSyncExternalStore, useId, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";

const muted = "text-[var(--muted)] forced-colors:text-[CanvasText]";
const comparisonHandle = [
  "absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center",
  "rounded-full border border-white bg-[#111] text-white transition-[scale,background-color]",
  "duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
  "[@media(hover:hover)]:[.peer:hover:not(:active)~div_&]:scale-[1.06]",
  "[@media(hover:hover)]:[.peer:hover:not(:active)~div_&]:bg-[#242424]",
  "[.peer:active~div_&]:scale-[0.94] [.peer:active~div_&]:duration-100",
  "motion-reduce:[.peer:active~div_&]:scale-100",
  "motion-reduce:[@media(hover:hover)]:[.peer:hover:not(:active)~div_&]:scale-100",
].join(" ");
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
      className={`absolute inset-0 overflow-hidden ${finished ? "bg-[#eeeeee] text-[#171717]" : "bg-[#181818] text-[#b8b8b8]"}`}
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
      <div className="absolute inset-x-8 top-9 flex justify-between font-mono text-xs uppercase tracking-[.14em]">
        <span>Fieldwork</span>
        <span>Issue 04</span>
      </div>
      <div
        className={`absolute inset-0 grid place-items-center leading-none tracking-[-.1em] ${finished ? "font-serif" : "font-mono"}`}
        style={{ fontSize: "clamp(7rem,40cqw,15rem)" }}
      >
        Aa
      </div>
      <div className="absolute inset-x-8 bottom-9 border-t border-current pt-3 font-mono text-xs uppercase tracking-[.1em]">
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
  const { reduced, entrance } = useLiveEntrance();
  const [local, setLocal] = useState(defaultValue);
  const readOnly = value !== undefined && !onChange;
  const raw = value ?? local;
  const split = Number.isFinite(raw) ? Math.round(Math.min(100, Math.max(0, raw))) : 50;
  return (
    <motion.figure
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      style={colors(theme)}
      className="@container w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]"
    >
      <div className="relative aspect-[4/3] min-h-64 w-full overflow-hidden">
        <div aria-hidden="true" inert className="absolute inset-0">
          {after}
        </div>
        <div
          aria-hidden="true"
          inert
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
          disabled={readOnly}
          min={0}
          max={100}
          value={split}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (value === undefined) setLocal(next);
            onChange?.(next);
          }}
          className={`peer absolute inset-0 z-20 m-0 h-full w-full touch-pan-y opacity-0 forced-colors:opacity-100 ${readOnly ? "cursor-default" : "cursor-ew-resize"}`}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white shadow-[0_0_0_1px_#111] forced-colors:hidden"
          style={{ left: `${split}%` }}
        >
          {!readOnly && <span className={comparisonHandle}>
            <ChevronsLeftRight size={20} />
          </span>}
        </div>
        <div className="pointer-events-none absolute inset-1 z-30 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-white peer-focus-visible:shadow-[0_0_0_2px_#111]" />
      </div>
      <figcaption id={id} className="p-5">
        <div
          className={`mb-3 flex justify-between gap-4 font-mono text-xs ${muted}`}
        >
          <span>{beforeLabel}</span>
          <span>{afterLabel}</span>
        </div>
        <p className="text-base font-medium tracking-tight">{title}</p>
        <p className={`mt-2 text-xs ${muted}`}>
          {readOnly
            ? `${Math.round(split)}% ${beforeLabel}, ${100 - Math.round(split)}% ${afterLabel}.`
            : "Drag the divider, or use the arrow keys."}
        </p>
      </figcaption>
    </motion.figure>
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
