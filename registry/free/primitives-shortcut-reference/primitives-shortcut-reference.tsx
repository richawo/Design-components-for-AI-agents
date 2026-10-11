"use client";
import { type CSSProperties, useId, useState } from "react";
import { Search, Keyboard, X } from "lucide-react";
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

export type ShortcutEntry = {
  id: string;
  label: string;
  keys: string[];
  group: string;
};
export type ShortcutReferenceProps = {
  title?: string;
  items?: ShortcutEntry[];
  searchPlaceholder?: string;
  theme?: "dark" | "light";
};
const defaults: ShortcutEntry[] = [
  {
    id: "search",
    label: "Search everywhere",
    keys: ["⌘", "K"],
    group: "Navigation",
  },
  {
    id: "switch",
    label: "Switch workspace",
    keys: ["⌘", "⇧", "P"],
    group: "Navigation",
  },
  { id: "new", label: "New document", keys: ["⌘", "N"], group: "Writing" },
  {
    id: "preview",
    label: "Toggle preview",
    keys: ["⌘", "⇧", "V"],
    group: "Writing",
  },
  { id: "save", label: "Save changes", keys: ["⌘", "S"], group: "Writing" },
];
export function ShortcutReference({
  title = "Make yourself quicker.",
  items = defaults,
  searchPlaceholder = "Find a shortcut",
  theme = "dark",
}: ShortcutReferenceProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const visible = items.filter((s) =>
    `${s.label} ${s.group} ${s.keys.join(" ")}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const groups = [...new Set(visible.map((s) => s.group))];
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={colors(theme)}
      aria-labelledby={id}
      className="w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <Keyboard size={28} strokeWidth={1.3} aria-hidden="true" />
      <h2 id={id} className="mt-4 font-serif text-3xl tracking-[-.03em]">
        {title}
      </h2>
      <div className="my-6 flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 focus-within:ring-2 focus-within:ring-[var(--ink)]">
        <Search size={16} aria-hidden="true" className={muted} />
        <input
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          data-demo="shortcut-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--muted)]"
        />
        {query && (
          <button
            type="button"
            data-demo="clear-query"
            aria-label="Clear shortcut search"
            onClick={() => setQuery("")}
            className={`${control} -mr-3 p-0`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="min-h-64">
        {groups.map((group) => (
          <section key={group} aria-label={group} className="mb-5">
            <h3
              className={`mb-2 font-mono text-xs uppercase tracking-wider ${muted}`}
            >
              {group}
            </h3>
            <dl>
              {visible
                .filter((s) => s.group === group)
                .map((s, i) => (
                  <div
                    key={`${s.id}-${i}`}
                    className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-2"
                  >
                    <dt className="text-sm">{s.label}</dt>
                    <dd className="flex flex-wrap gap-1">
                      {s.keys.map((key, j) => (
                        <kbd
                          key={j}
                          className="grid min-h-7 min-w-7 place-items-center rounded border border-[var(--line)] bg-[var(--wash)] px-1.5 font-mono text-xs shadow-[0_2px_0_var(--line)]"
                        >
                          {key}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
        {!visible.length && (
          <p role="status" className={`py-8 text-center text-sm ${muted}`}>
            No matching shortcuts.
          </p>
        )}
      </div>
    </motion.section>
  );
}

export default function ShortcutReferenceDemo(
  overrides: Partial<ShortcutReferenceProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <ShortcutReference {...overrides} />
    </div>
  );
}
