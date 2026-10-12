"use client";
import { type CSSProperties, useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
                <input
                  type="checkbox"
                  data-demo={`complete-${i}`}
                  checked={checked.includes(task.id)}
                  onChange={() => toggle(task.id)}
                  className="peer sr-only"
                  aria-label={`Complete ${task.title}`}
                />
                <span
                  className={`grid h-5 w-5 place-items-center rounded border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--ink)] ${checked.includes(task.id) ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--panel)]" : "border-[var(--muted)]"}`}
                >
                  {checked.includes(task.id) && (
                    <Check size={13} aria-hidden="true" />
                  )}
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
