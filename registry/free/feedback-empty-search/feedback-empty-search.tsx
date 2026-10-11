"use client";
import { type CSSProperties, useId, useState } from "react";
import { Search, ArrowUpRight, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)] active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none";
const muted = "text-[var(--muted)]";
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--line": theme === "dark" ? "#333333" : "#d4d4d4",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
  } as CSSProperties;
}

export type SearchSuggestion = { label: string; query: string };
export type EmptySearchProps = {
  query?: string;
  title?: string;
  description?: string;
  suggestions?: SearchSuggestion[];
  onSearch?: (query: string) => void;
  onClear?: () => void;
  theme?: "dark" | "light";
};
export function EmptySearch({
  query = "kinetic typography",
  title = "Nothing here. Yet.",
  description = "Try a broader phrase, or start with one of these topics.",
  suggestions = [
    { label: "Typography", query: "typography" },
    { label: "Motion studies", query: "motion" },
    { label: "Editorial layouts", query: "editorial" },
  ],
  onSearch,
  onClear,
  theme = "dark",
}: EmptySearchProps) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby={id}
      style={colors(theme)}
      className="@container w-full max-w-xl bg-[var(--panel)] p-6 text-[var(--ink)] @md:p-10"
    >
      <div aria-hidden="true" className="relative mb-8 h-28 w-40">
        <div className="absolute left-1 top-2 h-24 w-32 -rotate-6 rounded-lg border border-[var(--line)] bg-[var(--wash)]" />
        <div className="absolute left-5 top-0 grid h-24 w-32 rotate-3 place-items-center rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <Search size={30} strokeWidth={1} className={muted} />
        </div>
      </div>
      <h2
        id={id}
        className="font-serif text-4xl leading-tight tracking-[-.03em]"
      >
        {title}
      </h2>
      <p className={`mt-3 break-words text-sm ${muted}`}>
        No results for{" "}
        <span className="font-medium text-[var(--ink)]">“{query}”</span>
      </p>
      <p className={`mt-2 max-w-sm text-sm leading-relaxed ${muted}`}>
        {description}
      </p>
      <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {suggestions.map((s, i) => (
          <button
            type="button"
            data-demo={`suggestion-${i}`}
            key={`${s.query}-${i}`}
            disabled={!onSearch}
            onClick={() => onSearch?.(s.query)}
            className={`${control} w-full justify-between! rounded-none px-0 text-left`}
          >
            <span>{s.label}</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button
        type="button"
        data-demo="clear-search"
        disabled={!onClear}
        onClick={onClear}
        className={`${control} mt-4 px-0 text-[var(--muted)]`}
      >
        <X size={14} aria-hidden="true" />
        Clear search
      </button>
    </motion.section>
  );
}
export default function EmptySearchDemo(
  overrides: Partial<EmptySearchProps> = {},
) {
  const [query, setQuery] = useState("kinetic typography");
  return (
    <div
      className="flex min-h-[620px] items-center justify-center p-4 sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <EmptySearch
        query={query}
        onSearch={setQuery}
        onClear={() => setQuery("")}
        {...overrides}
      />
    </div>
  );
}
