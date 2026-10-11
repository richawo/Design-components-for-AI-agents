"use client";
import { type CSSProperties, useId, useState } from "react";
import { Plus, Minus } from "lucide-react";
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

export type AccordionEntry = { id: string; question: string; answer: string };
export type AccordionIndexProps = {
  title?: string;
  kicker?: string;
  items?: AccordionEntry[];
  defaultOpen?: string;
  onOpenChange?: (id: string | null) => void;
  theme?: "dark" | "light";
};
const defaults: AccordionEntry[] = [
  {
    id: "ownership",
    question: "What arrives in the handover?",
    answer:
      "The working source, the design decisions and a clear map of what comes next. You own the files and can keep building with your own team.",
  },
  {
    id: "timeline",
    question: "How long does a sprint take?",
    answer:
      "Two focused weeks. We start with the hardest question, share working prototypes throughout and leave time to test the details on real devices.",
  },
  {
    id: "changes",
    question: "What if the brief changes?",
    answer:
      "We discuss the tradeoff before changing course. A small adjustment fits the sprint; a new direction gets a revised scope and a clear estimate.",
  },
];
export function AccordionIndex({
  title = "A few useful answers.",
  kicker = "Before we begin",
  items = defaults,
  defaultOpen = "ownership",
  onOpenChange,
  theme = "dark",
}: AccordionIndexProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<string | null>(defaultOpen);
  return (
    <section
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-2xl bg-[var(--panel)] p-6 text-[var(--ink)] @md:p-10"
    >
      <p
        className={`mb-4 font-mono text-xs uppercase tracking-[.12em] ${muted}`}
      >
        {kicker}
      </p>
      <h2
        id={id}
        className="mb-8 max-w-md font-serif text-[clamp(2rem,6cqw,3rem)] leading-[1.05] tracking-[-.03em]"
      >
        {title}
      </h2>
      {items.length ? (
        items.map((item, i) => {
          const expanded = open === item.id;
          const panel = `${id}-${i}`;
          return (
            <div
              key={`${item.id}-${i}`}
              className="border-t border-[var(--line)]"
            >
              <h3>
                <button
                  type="button"
                  data-demo={`question-${i}`}
                  id={`${panel}-trigger`}
                  aria-expanded={expanded}
                  aria-controls={panel}
                  onClick={() => {
                    const next = expanded ? null : item.id;
                    setOpen(next);
                    onOpenChange?.(next);
                  }}
                  className={`${control} w-full justify-start gap-4 rounded-none px-0 py-5 text-left`}
                >
                  <span
                    className={`self-start pt-0.5 font-mono text-xs ${muted}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-base font-medium">
                    {item.question}
                  </span>
                  {expanded ? (
                    <Minus size={18} className="shrink-0" aria-hidden="true" />
                  ) : (
                    <Plus size={18} className="shrink-0" aria-hidden="true" />
                  )}
                </button>
              </h3>
              <div
                id={panel}
                role="region"
                aria-labelledby={`${panel}-trigger`}
                hidden={!expanded}
              >
                <motion.p
                  key={expanded ? "open" : "closed"}
                  initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduced ? 0.1 : 0.24 }}
                  className={`max-w-lg pb-6 pl-8 text-[15px] leading-7 ${muted}`}
                >
                  {item.answer}
                </motion.p>
              </div>
            </div>
          );
        })
      ) : (
        <p className={muted}>No questions published yet.</p>
      )}
      <div className="border-t border-[var(--line)]" />
    </section>
  );
}

export default function AccordionIndexDemo(
  overrides: Partial<AccordionIndexProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <AccordionIndex {...overrides} />
    </div>
  );
}
