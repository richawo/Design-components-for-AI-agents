"use client";
import { type CSSProperties, useLayoutEffect, useSyncExternalStore, useId, useState } from "react";
import { ChevronRight, Braces } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";

const control = [
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm",
  "font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)]",
  "disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2",
  "focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed",
  "disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none",
].join(" ");
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

export type InspectValue =
  | null
  | boolean
  | number
  | string
  | InspectValue[]
  | { [key: string]: InspectValue };
export type JsonInspectorProps = {
  title?: string;
  data?: InspectValue;
  rootLabel?: string;
  maxDepth?: number;
  theme?: "dark" | "light";
};
const defaults: InspectValue = {
  id: "run_08k2",
  status: "completed",
  model: "atlas-small",
  usage: { input_tokens: 1248, output_tokens: 326, cached: true },
  tools: [
    { name: "search_docs", duration_ms: 184 },
    { name: "read_file", duration_ms: 32 },
  ],
  error: null,
};
export function JsonInspector({
  title = "Response payload",
  data = defaults,
  rootLabel = "response",
  maxDepth = 12,
  theme = "dark",
}: JsonInspectorProps) {
  const id = useId();
  const { reduced, entrance } = useLiveEntrance();
  const [closed, setClosed] = useState<string[]>([]);
  const cap = Number.isFinite(maxDepth)
    ? Math.min(24, Math.max(1, Math.floor(maxDepth)))
    : 12;
  let rendered = 0;
  function row(
    value: InspectValue,
    label: string,
    path: string,
    depth: number,
    ancestors: Set<object>,
    keys: string[] = [],
  ): React.ReactNode {
    if (rendered++ >= 500) return null;
    const object = value !== null && typeof value === "object";
    const circular = object && ancestors.has(value);
    const limited = depth >= cap;
    const entries =
      object && !circular && !limited ? Object.entries(value) : [];
    const statePath = JSON.stringify(keys);
    const expanded = !closed.includes(statePath);
    const branch = `${id}-${encodeURIComponent(statePath)}`;
    const preview = object
      ? circular
        ? "[Circular]"
        : limited
          ? "[Depth limit]"
          : Array.isArray(value)
            ? `Array (${value.length})`
            : `Object (${Object.keys(value).length})`
      : typeof value === "string"
        ? JSON.stringify(value)
        : String(value);
    return (
      <li key={statePath} className="min-w-0">
        <div className="flex min-h-11 min-w-0 items-start gap-2 py-1">
          {object && entries.length ? (
            <button
              type="button"
              data-demo={`json-${path}`}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
              aria-expanded={expanded}
              aria-controls={branch}
              onClick={() =>
                setClosed(
                  expanded
                    ? [...closed, statePath]
                    : closed.filter((x) => x !== statePath),
                )
              }
              className={`${control} shrink-0 p-0`}
            >
              <ChevronRight
                size={14}
                aria-hidden="true"
                className={`transition-transform duration-150 motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="w-11 shrink-0" />
          )}
          <div className="min-w-0 flex-1 py-3 font-mono text-[13px] leading-relaxed">
            <span className="break-words">{label}</span>
            <span className={muted}>: </span>
            <span className={`break-words ${muted}`}>{preview}</span>
          </div>
        </div>
        {object && entries.length > 0 && (
          <ul
            id={branch}
            hidden={!expanded}
            className="ml-5 border-l border-[var(--line)] pl-2"
          >
            {(expanded ? entries : [])
              .slice(0, 100)
              .map(([key, v], i) =>
                row(
                  v,
                  key,
                  `${path}-${i}`,
                  depth + 1,
                  new Set([...ancestors, value]),
                  [...keys, key],
                ),
              )}
            {entries.length > 100 && (
              <li className={`py-3 font-mono text-xs ${muted}`}>
                {entries.length - 100} more entries omitted
              </li>
            )}
          </ul>
        )}
      </li>
    );
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      style={colors(theme)}
      aria-labelledby={id}
      className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
    >
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
        <Braces size={18} className="shrink-0" aria-hidden="true" />
        <h2 id={id} className="min-w-0 text-base font-medium">
          {title}
        </h2>
      </div>
      <div
        role="region"
        aria-label="JSON contents"
        tabIndex={0}
        className="max-h-[520px] overflow-auto p-3 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--ink)]"
      >
        <ul>{row(data, rootLabel, "root", 0, new Set())}</ul>
        {rendered > 500 && (
          <p
            role="status"
            className={`border-t border-[var(--line)] px-3 py-4 text-xs ${muted}`}
          >
            Display limit reached. Collapse an earlier branch to inspect more
            entries.
          </p>
        )}
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

export default function JsonInspectorDemo(
  overrides: Partial<JsonInspectorProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-start justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <JsonInspector {...overrides} />
    </div>
  );
}
