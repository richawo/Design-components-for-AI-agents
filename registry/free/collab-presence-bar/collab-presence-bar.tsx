"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type PresenceStatus = "editing" | "commenting" | "viewing" | "idle";

export type PresencePerson = {
  id: string;
  name: string;
  status: PresenceStatus;
  /** Where they are. Idle people have no place. */
  place?: string;
};

export type CollabPresenceBarProps = {
  /** The document these people are in. */
  title?: string;
  /** Mono line under the heading. */
  workspace?: string;
  people?: PresencePerson[];
  /** Idle people fade. Turn this off to show only whoever is doing something. */
  showIdle?: boolean;
  /** Called with the person id, or null when follow stops. */
  onFollow?: (id: string | null) => void;
  /** The one accent: the ring around the person you are following. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#111113",
    raised: "#17171a",
    sunken: "#0c0c0e",
    line: "#232327",
    rule: "#1b1b1e",
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    avatar: "#1f1f23",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 32px 64px -32px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    raised: "#f6f6f7",
    sunken: "#fafafa",
    line: "#e4e4e7",
    rule: "#efeff1",
    ink: "#18181b",
    muted: "#52525b",
    faint: "#71717a",
    avatar: "#f0f0f2",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

const STAGE = "#0a0a0b";
const STAGE_LIGHT = "#e9e9ec";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

const MOTION = { rise: 12, blur: 8, block: 0.5, step: 0.06, fade: 0.15 } as const;

const DEMO_PEOPLE: PresencePerson[] = [
  { id: "mara", name: "Mara Ilić", status: "editing", place: "Pricing" },
  { id: "priya", name: "Priya Raman", status: "commenting", place: "Legal" },
  { id: "sam", name: "Sam Okoye", status: "viewing", place: "the headline" },
  { id: "jonas", name: "Jonas Weber", status: "idle" },
];

const VERB: Record<Exclude<PresenceStatus, "idle">, string> = {
  editing: "editing",
  commenting: "commenting in",
  viewing: "reading",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--pb-accent": accent };
  for (const [k, v] of Object.entries(p)) vars[`--pb-${k}`] = v;
  return vars as CSSProperties;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const firstName = (name: string) => name.split(" ")[0] ?? name;

function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

/** Verb, and the place when there is one. Idle is just “idle”. */
function activity(person: PresencePerson): { verb: string; place?: string } {
  if (person.status === "idle" || !person.place) return { verb: "idle" };
  return { verb: VERB[person.status], place: person.place };
}

const activityLabel = (person: PresencePerson) => {
  const { verb, place } = activity(person);
  return place ? `${verb} ${place}` : verb;
};

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pb-ink)]";

function RollingCount({ value }: { value: number }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className="relative inline-flex h-[1em] overflow-hidden align-bottom tabular-nums leading-none">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? { opacity: 0 } : { y: "70%", opacity: 0, filter: "blur(3px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0, filter: "blur(3px)" }}
          transition={{ duration: reduce ? MOTION.fade : 0.32, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function CollabPresenceBar({
  title = "Pricing",
  workspace = "Ledgerline · Website",
  people = DEMO_PEOPLE,
  showIdle = true,
  onFollow,
  accent,
  theme = "dark",
  className = "",
}: CollabPresenceBarProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });
  const palette = PALETTE[theme];
  const visible = showIdle ? people : people.filter((p) => p.status !== "idle");
  const liveId = visible.find((p) => p.status !== "idle")?.id;

  const [following, setFollowing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const onFollowRef = useRef(onFollow);
  onFollowRef.current = onFollow;
  const visibleIds = visible.map((p) => p.id).join("\0");

  useEffect(() => {
    if (following && !visibleIds.split("\0").includes(following)) {
      setFollowing(null);
      onFollowRef.current?.(null);
    }
  }, [following, visibleIds]);

  const focusId = (following && visible.some((p) => p.id === following) ? following : null) ?? (preview && visible.some((p) => p.id === preview) ? preview : null) ?? liveId ?? visible[0]?.id;
  const focus = visible.find((p) => p.id === focusId);

  const follow = (id: string | null) => {
    setFollowing(id);
    onFollow?.(id);
  };

  const onToolbarKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-person]")];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    buttons[(i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };

  return (
    <section
      ref={root}
      aria-labelledby={`${uid}-title`}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full font-sans text-[var(--pb-ink)] antialiased ${className}`}
    >
      <motion.div {...enter(play, 0, reduce)} className="rounded-[14px] border border-[var(--pb-line)] bg-[var(--pb-surface)] shadow-[var(--pb-shadow)]">
        <motion.header {...enter(play, MOTION.step, reduce)} className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 @md:px-6">
          <div className="min-w-0">
            <h2 id={`${uid}-title`} className="truncate font-display text-[18px] font-semibold tracking-[-0.03em]">
              {title}
            </h2>
            <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--pb-faint)]">{workspace}</p>
          </div>
          <p className="flex shrink-0 items-baseline gap-1.5 pt-0.5" aria-label={`${visible.length} here`}>
            <span className="font-display text-[20px] font-semibold tracking-[-0.04em]">
              <RollingCount value={visible.length} />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--pb-faint)]">here</span>
          </p>
        </motion.header>

        <motion.div {...enter(play, MOTION.step * 2, reduce)} className="border-t border-[var(--pb-rule)] px-5 py-4 @md:px-6">
          {visible.length === 0 ? (
            <p className="py-3 text-[14px] text-[var(--pb-faint)]">No one else is in this document.</p>
          ) : (
            <div className="flex flex-col gap-3 @md:flex-row @md:items-center @md:gap-x-5">
              <div role="toolbar" aria-label="People in this document" onKeyDown={onToolbarKey} className="flex items-center gap-1">
                {visible.map((person) => {
                  const on = following === person.id;
                  const dim = person.status === "idle" && !on && preview !== person.id;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      data-person={person.id}
                      data-demo={`person-${person.id}`}
                      aria-pressed={on}
                      aria-label={`${person.name}, ${activityLabel(person)}`}
                      onClick={() => follow(on ? null : person.id)}
                      onPointerEnter={() => setPreview(person.id)}
                      onPointerLeave={() => setPreview((cur) => (cur === person.id ? null : cur))}
                      className={`relative grid size-11 place-items-center rounded-full transition-[opacity,transform] duration-200 active:scale-[0.97] ${dim ? "opacity-50" : "opacity-100"} ${FOCUS_RING}`}
                    >
                      {on && (
                        <motion.span
                          layoutId={`${uid}-follow`}
                          transition={reduce ? { duration: 0 } : SPRING_UI}
                          className="absolute size-9 rounded-full shadow-[0_0_0_2px_var(--pb-accent)]"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className="relative flex size-8 items-center justify-center rounded-full bg-[var(--pb-avatar)] text-[11px] font-semibold tracking-[0.02em] text-[var(--pb-muted)]"
                      >
                        {initials(person.name)}
                      </span>
                      {person.id === liveId && (
                        <motion.span
                          aria-hidden="true"
                          animate={reduce || !play ? { opacity: 1 } : { opacity: [1, 0.35, 1] }}
                          transition={reduce || !play ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute right-1 top-1 size-1.5 rounded-full bg-[var(--pb-ink)] shadow-[0_0_0_2px_var(--pb-surface)]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <AnimatePresence mode="wait" initial={false}>
                  {focus && (
                    <motion.p
                      key={following === focus.id ? `follow-${focus.id}` : focus.id}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(3px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.12, ease: EASE_IN } }}
                      transition={{ duration: reduce ? MOTION.fade : 0.22, ease: EASE_OUT }}
                      className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[15px] leading-[1.4]"
                    >
                      {following === focus.id && (
                        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--pb-faint)]">Following</span>
                      )}
                      <span className="font-medium">{firstName(focus.name)}</span>
                      {following === focus.id && (
                        <span aria-hidden="true" className="text-[var(--pb-faint)]">
                          ·
                        </span>
                      )}
                      <span className="inline-flex items-baseline gap-x-1.5 whitespace-nowrap">
                        <span className="text-[var(--pb-muted)]">{following === focus.id ? activity(focus).verb : `is ${activity(focus).verb}`}</span>
                        {activity(focus).place && <span className="font-medium">{activity(focus).place}</span>}
                      </span>
                    </motion.p>
                  )}
                </AnimatePresence>
                {following && (
                  <button
                    type="button"
                    data-demo="stop"
                    onClick={() => follow(null)}
                    className={`shrink-0 rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--pb-faint)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--pb-raised)] hover:text-[var(--pb-ink)] active:scale-[0.97] ${FOCUS_RING}`}
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
      <span className="sr-only" aria-live="polite">
        {following && focus ? `Following ${focus.name}, ${activityLabel(focus)}` : ""}
      </span>
    </section>
  );
}

export default function CollabPresenceBarDemo(overrides: Partial<CollabPresenceBarProps> = {}) {
  const light = overrides.theme === "light";
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-8" style={{ background: light ? STAGE_LIGHT : STAGE }}>
      <div className="w-full max-w-[560px]">
        <CollabPresenceBar {...overrides} />
      </div>
    </div>
  );
}
