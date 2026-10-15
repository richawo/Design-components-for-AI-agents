"use client";
import { type CSSProperties, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)] disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none";
const muted = "text-[var(--muted)]";
const CSS = `
/* @controls check prefix=sc */
.sc-ctl-check {
  --c-ink: var(--sc-ctl-accent, var(--sc-ctl-ink, currentColor));
  --c-on: var(--sc-ctl-surface, Canvas);
  --c-line: var(--sc-ctl-line, color-mix(in srgb, currentColor 30%, transparent));
  position: relative;
  display: inline-grid;
  flex: none;
  width: 18px;
  height: 18px;
  vertical-align: middle;
  transition: transform 0.1s cubic-bezier(0.22, 1, 0.36, 1);
}
.sc-ctl-check > input {
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
  .sc-ctl-check > input:hover:not(:disabled):not(:checked):not(:indeterminate) { border-color: color-mix(in srgb, var(--c-ink) 62%, transparent); background: color-mix(in srgb, var(--c-ink) 6%, transparent); }
}
.sc-ctl-check > input:is(:checked, :indeterminate) { border-color: var(--c-ink); background: var(--c-ink); }
.sc-ctl-check > input:focus { outline: none; }
.sc-ctl-check > input:focus-visible { outline: 2px solid var(--sc-ctl-ink, currentColor); outline-offset: 2px; }
.sc-ctl-check > input:disabled { cursor: not-allowed; }
.sc-ctl-check:has(> input:disabled) { opacity: 0.4; }
.sc-ctl-check:has(> input:active:not(:disabled)) { transform: scale(0.88); }
.sc-ctl-check > svg {
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
.sc-ctl-check > svg path { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 0.12s cubic-bezier(0.4, 0, 1, 1); }
.sc-ctl-check > input:checked:not(:indeterminate) + svg [data-mark="check"],
.sc-ctl-check > input:indeterminate + svg [data-mark="dash"] { stroke-dashoffset: 0; transition: stroke-dashoffset 0.22s cubic-bezier(0.65, 0, 0.35, 1) 0.04s; }
@media (prefers-reduced-motion: reduce) {
  .sc-ctl-check, .sc-ctl-check > svg path { transition: none !important; }
  .sc-ctl-check:has(> input:active:not(:disabled)) { transform: none; }
}
@media (forced-colors: active) {
  .sc-ctl-check > input { -webkit-appearance: auto; appearance: auto; }
  .sc-ctl-check > svg { display: none; }
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
    "--sc-ctl-ink": "var(--ink)",
    "--sc-ctl-surface": "var(--panel)",
  } as CSSProperties;
}

export type SetupTask = {
  id: string;
  title: string;
  description: string;
  duration: string;
};
export type SetupChecklistProps = {
  title?: string;
  description?: string;
  tasks?: SetupTask[];
  completed?: string[];
  defaultCompleted?: string[];
  onChange?: (completed: string[]) => void;
  theme?: "dark" | "light";
};
const defaults: SetupTask[] = [
  {
    id: "profile",
    title: "Make it yours",
    description: "Choose a workspace name and add the people who will use it.",
    duration: "2 min",
  },
  {
    id: "sources",
    title: "Add your first source",
    description:
      "Start with one useful document. You can build the library as you go.",
    duration: "3 min",
  },
  {
    id: "question",
    title: "Ask a real question",
    description: "Try something you would otherwise search for manually.",
    duration: "1 min",
  },
];
export function SetupChecklist({
  title = "A good place to start.",
  description = "Three small steps to a useful workspace.",
  tasks = defaults,
  completed,
  defaultCompleted = ["profile"],
  onChange,
  theme = "dark",
}: SetupChecklistProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [local, setLocal] = useState(defaultCompleted);
  const [open, setOpen] = useState("sources");
  const checked = completed ?? local;
  const count = tasks.filter((t) => checked.includes(t.id)).length;
  const ratio = tasks.length ? count / tasks.length : 0;
  function toggle(key: string) {
    const next = checked.includes(key)
      ? checked.filter((x) => x !== key)
      : [...checked, key];
    setLocal(next);
    onChange?.(next);
  }
  return (
    <section
      aria-labelledby={id}
      style={colors(theme)}
      className="@container w-full max-w-xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
    >
      <style>{CSS}</style>
      <div className="flex items-start gap-5 p-6">
        <div
          role="img"
          aria-label={`${count} of ${tasks.length} steps complete`}
          className="relative h-16 w-16 shrink-0"
        >
          <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            className="h-full w-full -rotate-90"
          >
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="var(--line)"
              strokeWidth="3"
            />
            <motion.circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={176}
              animate={{ strokeDashoffset: 176 * (1 - ratio) }}
              transition={{ duration: reduced ? 0 : 0.4 }}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-mono text-sm">
            {count}/{tasks.length}
          </span>
        </div>
        <div className="min-w-0">
          <h2
            id={id}
            className="font-serif text-3xl leading-tight tracking-[-.03em]"
          >
            {title}
          </h2>
          <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
            {description}
          </p>
        </div>
      </div>
      <ul className="border-t border-[var(--line)]">
        {tasks.map((task, i) => (
          <li
            key={`${task.id}-${i}`}
            className="border-b border-[var(--line)] last:border-b-0"
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <label className="relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-[var(--wash)]">
                <span className="sc-ctl-check">
                  <input
                    type="checkbox"
                    data-demo={`complete-${i}`}
                    checked={checked.includes(task.id)}
                    onChange={() => toggle(task.id)}
                    aria-label={`Complete ${task.title}`}
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
              </label>
              <button
                type="button"
                data-demo={`setup-task-${i}`}
                aria-expanded={open === task.id}
                aria-controls={`${id}-${i}`}
                onClick={() => setOpen(open === task.id ? "" : task.id)}
                className={`${control} min-w-0 flex-1 justify-between! px-1 text-left`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {task.title}
                  </span>
                  <span className={`font-mono text-[11px] ${muted}`}>
                    {task.duration}
                  </span>
                </span>
                <ChevronDown
                  size={15}
                  className="shrink-0"
                  aria-hidden="true"
                />
              </button>
            </div>
            <p
              id={`${id}-${i}`}
              hidden={open !== task.id}
              className={`px-6 pb-5 pl-[76px] text-sm leading-relaxed ${muted}`}
            >
              {task.description}
            </p>
          </li>
        ))}
      </ul>
      <p
        role="status"
        className={`border-t border-[var(--line)] px-6 py-4 text-xs ${muted}`}
      >
        {tasks.length
          ? count === tasks.length
            ? "Everything on your list is complete."
            : `${tasks.length - count} steps left. Pick up wherever you like.`
          : "No setup tasks configured."}
      </p>
    </section>
  );
}

export default function SetupChecklistDemo(
  overrides: Partial<SetupChecklistProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <SetupChecklist {...overrides} />
    </div>
  );
}
