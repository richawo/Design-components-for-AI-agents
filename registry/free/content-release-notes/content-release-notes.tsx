"use client";
import { type CSSProperties, useLayoutEffect, useSyncExternalStore, useId, useRef, useState } from "react";
import { Plus, Wrench, ChevronDown } from "lucide-react";
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

export type ReleaseChange = { kind: "feature" | "fix"; text: string };
export type ReleaseNote = {
  id: string;
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: ReleaseChange[];
};
export type ReleaseNotesProps = {
  title?: string;
  releases?: ReleaseNote[];
  initialCount?: number;
  theme?: "dark" | "light";
};
const defaults: ReleaseNote[] = [
  {
    id: "v24",
    version: "2.4",
    date: "2026-10-11",
    title: "A calmer place to work.",
    summary:
      "This release gives the important things more room and makes the small interactions easier to trust.",
    changes: [
      { kind: "feature", text: "A focused reading view for longer documents." },
      {
        kind: "fix",
        text: "Keyboard focus now returns to the right place after closing a panel.",
      },
    ],
  },
  {
    id: "v23",
    version: "2.3",
    date: "2026-09-28",
    title: "Find your way back.",
    summary:
      "Search remembers the context, and your recent work is always one step away.",
    changes: [
      { kind: "feature", text: "Recent searches and saved scopes." },
      {
        kind: "fix",
        text: "Long document titles wrap cleanly on smaller screens.",
      },
    ],
  },
  {
    id: "v22",
    version: "2.2",
    date: "2026-09-12",
    title: "Better together.",
    summary: "A lighter review flow for teams working in the same space.",
    changes: [
      {
        kind: "feature",
        text: "Comments can link directly to a selected passage.",
      },
      {
        kind: "fix",
        text: "Invitations report expired links before you submit.",
      },
    ],
  },
];
export function ReleaseNotes({
  title = "The work keeps moving.",
  releases = defaults,
  initialCount = 2,
  theme = "dark",
}: ReleaseNotesProps) {
  const id = useId();
  const { reduced, entrance } = useLiveEntrance();
  const [filter, setFilter] = useState<"all" | "feature" | "fix">("all");
  const [expanded, setExpanded] = useState(false);
  const count = Number.isFinite(initialCount)
    ? Math.max(1, Math.floor(initialCount))
    : 2;
  const matching = releases.filter(
    (r) => filter === "all" || r.changes.some((c) => c.kind === filter),
  );
  const visible = expanded ? matching : matching.slice(0, count);
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      style={colors(theme)}
      aria-labelledby={id}
      data-release-notes-reader=""
      className="@container w-full max-w-3xl bg-[var(--panel)] p-6 text-[var(--ink)] @lg:p-8"
    >
      <style>{`
        [data-release-notes-reader] ::selection {
          background: var(--ink);
          color: var(--panel);
        }
      `}</style>
      <h2
        id={id}
        className="max-w-sm font-serif text-4xl leading-tight tracking-[-.03em]"
      >
        {title}
      </h2>
      <div
        role="group"
        aria-label="Release change type"
        className="my-6 flex flex-wrap gap-1"
      >
        {(
          [
            ["all", "Everything"],
            ["feature", "Features"],
            ["fix", "Fixes"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            data-demo={`release-${key}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`${control} border px-2! ${filter === key ? "border-[var(--ink)]" : "border-transparent"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div id={`${id}-list`} className="space-y-7">
        {visible.map((release, order) => (
          <ReleaseEntry key={release.id} release={release} filter={filter} order={order} reduced={reduced} />
        ))}
      </div>
      {!matching.length && (
        <p
          role="status"
          className={`border-t border-[var(--line)] py-10 text-sm ${muted}`}
        >
          No releases match this filter.
        </p>
      )}
      {matching.length > count && (
        <button
          type="button"
          data-demo="older-releases"
          aria-expanded={expanded}
          aria-controls={`${id}-list`}
          onClick={() => setExpanded(current => !current)}
          className={`${control} mt-7 w-full justify-between! border-t border-[var(--line)] px-0 pt-4`}
        >
          {expanded
            ? "Show fewer releases"
            : `Show ${matching.length - count} older release${matching.length - count === 1 ? "" : "s"}`}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={expanded ? "rotate-180" : ""}
          />
        </button>
      )}
    </motion.section>
  );
}


function ReleaseEntry({ release, filter, order, reduced }: {
  release: ReleaseNote;
  filter: "all" | "feature" | "fix";
  order: number;
  reduced: boolean;
}) {
  const entrance = useAnimationControls();
  const previousFilter = useRef(filter);
  useLayoutEffect(() => {
    const changedFilter = previousFilter.current !== filter;
    previousFilter.current = filter;
    entrance.stop();
    if (reduced) entrance.set({ opacity: 1, y: 0 });
    else {
      if (changedFilter) entrance.set({ opacity: 0, y: 4 });
      void entrance.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, delay: Math.min(order, 4) * 0.04 },
      });
    }
    return () => entrance.stop();
  }, [entrance, reduced, order, filter]);
  return (
    <motion.article
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      className="grid gap-4 border-t border-[var(--line)] pt-6 @lg:grid-cols-[96px_minmax(0,1fr)]"
    >
      <div>
        <p className="font-display text-3xl tracking-tight">
          {release.version}
        </p>
        <time
          dateTime={release.date}
          className={`mt-2 block font-mono text-xs ${muted}`}
        >
          {release.date}
        </time>
      </div>
      <div>
        <h3 className="text-lg font-medium tracking-tight">
          {release.title}
        </h3>
        <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
          {release.summary}
        </p>
        <ul className="mt-4 space-y-3">
          {release.changes
            .filter((c) => filter === "all" || c.kind === filter)
            .map((change, j) => (
              <li key={j} className="flex gap-3 text-sm leading-relaxed">
                {change.kind === "feature" ? (
                  <Plus
                    size={15}
                    className={`mt-1 shrink-0 ${muted}`}
                    aria-hidden="true"
                  />
                ) : (
                  <Wrench
                    size={15}
                    className={`mt-1 shrink-0 ${muted}`}
                    aria-hidden="true"
                  />
                )}
                <span>
                  <span className="sr-only">
                    {change.kind === "feature" ? "Feature: " : "Fix: "}
                  </span>
                  {change.text}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </motion.article>
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

export default function ReleaseNotesDemo(
  overrides: Partial<ReleaseNotesProps> = {},
) {
  return (
    <div
      className="flex min-h-[1120px] w-full items-start justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <ReleaseNotes {...overrides} />
    </div>
  );
}
