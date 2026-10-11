"use client";
import { type CSSProperties, useId, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
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

export type PaginationWindowProps = {
  label?: string;
  page?: number;
  defaultPage?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  theme?: "dark" | "light";
};
export function PaginationWindow({
  label = "Results",
  page,
  defaultPage = 1,
  pageCount = 24,
  onPageChange,
  theme = "dark",
}: PaginationWindowProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const count = Number.isFinite(pageCount)
    ? Math.max(0, Math.floor(pageCount))
    : 0;
  const [local, setLocal] = useState(defaultPage);
  const raw = page ?? local;
  const current = count
    ? Math.min(count, Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1))
    : 0;
  const pages = [
    ...new Set(
      [1, current - 1, current, current + 1, count].filter(
        (n) => n >= 1 && n <= count,
      ),
    ),
  ].sort((a, b) => a - b);
  function choose(next: number) {
    if (next < 1 || next > count || next === current) return;
    setLocal(next);
    onPageChange?.(next);
  }
  return (
    <motion.nav
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={`${label} pagination`}
      style={colors(theme)}
      className="@container w-full max-w-2xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-[var(--ink)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-1 pb-4">
        <span className="text-sm font-medium">{label}</span>
        <span role="status" className={`font-mono text-xs ${muted}`}>
          {count ? `Page ${current} of ${count}` : "No pages"}
        </span>
      </div>
      <div className="mt-4">
        <ol className="flex flex-wrap justify-center gap-0.5">
          {pages.map((n, i) => (
            <li key={n} className="flex items-center">
              {i > 0 && n - pages[i - 1] > 1 && (
                <span className={`px-1 ${muted}`} aria-hidden="true">
                  …
                </span>
              )}
              <button
                type="button"
                data-demo={`page-${n}`}
                aria-label={`Page ${n}`}
                aria-current={n === current ? "page" : undefined}
                onClick={() => choose(n)}
                className={`${control} relative px-2 font-mono tabular-nums`}
              >
                {n === current && (
                  <motion.span
                    layoutId={`${id}-selected`}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                    className="absolute inset-0 rounded-lg bg-[var(--ink)]"
                  />
                )}
                <span
                  className="relative"
                  style={{ color: n === current ? "var(--panel)" : undefined }}
                >
                  {n}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            data-demo="previous"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => choose(current - 1)}
            className={control}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Previous</span>
          </button>
          <button
            type="button"
            data-demo="next"
            aria-label="Next page"
            disabled={!count || current >= count}
            onClick={() => choose(current + 1)}
            className={control}
          >
            <span>Next</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.nav>
  );
}

export default function PaginationWindowDemo(
  overrides: Partial<PaginationWindowProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <PaginationWindow {...overrides} />
    </div>
  );
}
