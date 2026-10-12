"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, CircleDot, MessageSquare, Pencil, UserPlus, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type ActivityType = "edit" | "comment" | "status" | "member";
export type ActivityFilter = "all" | ActivityType;

export type ActivityChange =
  /** Prose: rendered as a word-level diff. */
  | { kind: "text"; before: string; after: string }
  /** A single value: before struck through, after highlighted. */
  | { kind: "value"; before: string; after: string }
  /** A workflow state moving between two pills. */
  | { kind: "status"; before: string; after: string }
  /** What someone wrote. */
  | { kind: "quote"; text: string };

export type ActivityEvent = {
  id: string;
  /** Group heading, e.g. “Today”. Events keep the order you pass them in (newest first). */
  day: string;
  /** Optional date shown beside the day, e.g. “Sat 10 Oct”. */
  date?: string;
  time: string;
  actorId: string;
  type: ActivityType;
  /** The verb phrase, e.g. “changed the headline on”. */
  action: string;
  target: string;
  change?: ActivityChange;
};

export type ActivityPerson = { id: string; name: string };

export type CollabActivityFeedProps = {
  title?: string;
  subtitle?: string;
  events?: ActivityEvent[];
  people?: ActivityPerson[];
  /** Show the inline diffs under each event. */
  showDiffs?: boolean;
  density?: "comfortable" | "compact";
  /** Optional: drive the type filter from outside. Leave unset and the chips manage it. */
  filter?: ActivityFilter;
  onFilterChange?: (filter: ActivityFilter) => void;
  /** Optional: drive the person filter from outside (`null` for everyone). */
  person?: string | null;
  onPersonChange?: (personId: string | null) => void;
  /** The one accent: the active filter’s count and the selected person’s ring. Defaults to the theme’s ink. */
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
    added: "#4ade80",
    removed: "#f87171",
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
    faint: "#62626b",
    avatar: "#f0f0f2",
    added: "#15803d",
    removed: "#b91c1c",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = "#0a0a0b";
const STAGE_LIGHT = "#e9e9ec";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 12, // px
  blur: 8, // px
  block: 0.5,
  step: 0.06,
  rowsAt: 0.26,
  rowStep: 0.045,
  refilterStep: 0.03,
  exit: 0.18,
  fade: 0.15, // reduced motion
} as const;

const TYPE_META: Record<ActivityType, { label: string; plural: string; Icon: typeof Pencil }> = {
  edit: { label: "Edit", plural: "Edits", Icon: Pencil },
  comment: { label: "Comment", plural: "Comments", Icon: MessageSquare },
  status: { label: "Status", plural: "Status", Icon: CircleDot },
  member: { label: "People", plural: "People", Icon: UserPlus },
};
const FILTERS: ActivityFilter[] = ["all", "edit", "comment", "status", "member"];

/* ------------------------------------------------------------------ */
/* Demo data: Ledgerline’s website workspace                            */
/* ------------------------------------------------------------------ */

const DEMO_PEOPLE: ActivityPerson[] = [
  { id: "mara", name: "Mara Ilić" },
  { id: "jonas", name: "Jonas Weber" },
  { id: "priya", name: "Priya Raman" },
  { id: "sam", name: "Sam Okoye" },
];

const DEMO_EVENTS: ActivityEvent[] = [
  {
    id: "e1",
    day: "Today",
    date: "Sat 10 Oct",
    time: "09:42",
    actorId: "mara",
    type: "edit",
    action: "rewrote the headline on",
    target: "Pricing",
    change: { kind: "text", before: "Pricing your finance team can actually read.", after: "Pricing your CFO can check in one pass." },
  },
  {
    id: "e2",
    day: "Today",
    date: "Sat 10 Oct",
    time: "09:30",
    actorId: "priya",
    type: "comment",
    action: "commented on",
    target: "Hero headline",
    change: { kind: "quote", text: "Finance is happy with “one pass”. Legal prefers “check” to “verify”." },
  },
  { id: "e3", day: "Today", date: "Sat 10 Oct", time: "09:05", actorId: "jonas", type: "status", action: "moved", target: "Pricing page v3", change: { kind: "status", before: "In review", after: "Approved" } },
  { id: "e4", day: "Yesterday", date: "Fri 9 Oct", time: "17:20", actorId: "mara", type: "edit", action: "changed the price of", target: "Pro", change: { kind: "value", before: "$24 / seat", after: "$29 / seat" } },
  { id: "e5", day: "Yesterday", date: "Fri 9 Oct", time: "15:02", actorId: "sam", type: "member", action: "added Elif Demir as a viewer of", target: "Pricing" },
  { id: "e6", day: "Yesterday", date: "Fri 9 Oct", time: "11:48", actorId: "jonas", type: "edit", action: "renamed", target: "the Team plan", change: { kind: "value", before: "Team", after: "Studio" } },
  {
    id: "e7",
    day: "Yesterday",
    date: "Fri 9 Oct",
    time: "10:15",
    actorId: "priya",
    type: "comment",
    action: "commented on",
    target: "FAQ",
    change: { kind: "quote", text: "Do we say “seat” or “member”? Pick one and I’ll update the invoices to match." },
  },
  { id: "e8", day: "Thursday", date: "8 Oct", time: "16:40", actorId: "sam", type: "status", action: "moved", target: "Pricing page v3", change: { kind: "status", before: "Draft", after: "In review" } },
  {
    id: "e9",
    day: "Thursday",
    date: "8 Oct",
    time: "14:22",
    actorId: "mara",
    type: "edit",
    action: "edited the annual note on",
    target: "Pricing",
    change: { kind: "text", before: "Save 15% when you pay yearly.", after: "Save 20% when you pay for the year upfront." },
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--af-accent": accent };
  for (const [k, v] of Object.entries(p)) vars[`--af-${k}`] = v;
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

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

type DiffPart = { text: string; op: "same" | "add" | "del" };

/** A word-level diff (longest common subsequence over words and the spaces between them). */
function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, op: DiffPart["op"]) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ text, op });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i], "same");
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push(a[i++], "del");
    else push(b[j++], "add");
  }
  while (i < a.length) push(a[i++], "del");
  while (j < b.length) push(b[j++], "add");
  return out;
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--af-ink)]";
const ADDED = "rounded-[4px] bg-[color-mix(in_srgb,var(--af-added)_14%,transparent)] px-0.5 text-[var(--af-ink)]";
const REMOVED = "rounded-[4px] bg-[color-mix(in_srgb,var(--af-removed)_12%,transparent)] px-0.5 text-[var(--af-faint)] line-through decoration-[var(--af-removed)]/70";

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function Change({ change }: { change: ActivityChange }) {
  if (change.kind === "quote") {
    return <blockquote className="border-l-2 border-[var(--af-line)] pl-3 text-[13px] leading-[1.55] text-[var(--af-muted)]">{change.text}</blockquote>;
  }
  if (change.kind === "status") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-[12px]">
        <span className="rounded-full border border-[var(--af-line)] px-2 py-0.5 text-[var(--af-faint)]">{change.before}</span>
        <ArrowRight className="size-3 text-[var(--af-faint)]" strokeWidth={2} aria-label="to" />
        <span className="rounded-full border border-[var(--af-faint)] bg-[var(--af-raised)] px-2 py-0.5 font-medium text-[var(--af-ink)]">{change.after}</span>
      </span>
    );
  }
  if (change.kind === "value") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 font-mono text-[12px] tabular-nums">
        <del className={REMOVED}>
          <span className="sr-only">was </span>
          {change.before}
        </del>
        <ArrowRight className="size-3 text-[var(--af-faint)]" strokeWidth={2} aria-hidden="true" />
        <ins className={`${ADDED} no-underline`}>
          <span className="sr-only">now </span>
          {change.after}
        </ins>
      </span>
    );
  }
  const parts = diffWords(change.before, change.after);
  return (
    <p className="rounded-lg border border-[var(--af-rule)] bg-[var(--af-sunken)] px-3 py-2 text-[13px] leading-[1.6] text-[var(--af-muted)]">
      {parts.map((p, i) =>
        p.op === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.op === "add" ? (
          <ins key={i} className={`${ADDED} no-underline`}>
            {p.text}
          </ins>
        ) : (
          <del key={i} className={REMOVED}>
            {p.text}
          </del>
        ),
      )}
    </p>
  );
}

function EventRow({
  event,
  actor,
  last,
  showDiffs,
  compact,
  play,
  delay,
}: {
  event: ActivityEvent;
  actor: ActivityPerson | undefined;
  last: boolean;
  showDiffs: boolean;
  compact: boolean;
  play: boolean;
  delay: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const entrance = enter(play, delay, reduce);
  const { Icon, label } = TYPE_META[event.type];
  return (
    <motion.li
      layout={reduce ? false : "position"}
      {...entrance}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)", transition: { duration: MOTION.exit, ease: EASE_IN } }}
      transition={{ ...entrance.transition, layout: SPRING_UI }}
      className={`relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 ${compact ? "pb-3" : "pb-5"}`}
    >
      {!last && <span className="absolute bottom-0 left-[13.5px] top-8 w-px bg-[var(--af-line)]" aria-hidden="true" />}
      <span className="relative z-[1] flex size-7 items-center justify-center rounded-full border border-[var(--af-line)] bg-[var(--af-surface)] text-[var(--af-muted)]" aria-hidden="true">
        <Icon className="size-3.5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 pt-1">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 text-[14px] leading-[1.45] text-[var(--af-muted)]">
            <span className="sr-only">{label}: </span>
            <span className="font-medium text-[var(--af-ink)]">{actor?.name ?? "Someone"}</span> {event.action} <span className="font-medium text-[var(--af-ink)]">{event.target}</span>
          </p>
          <time className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--af-faint)]">{event.time}</time>
        </div>
        <AnimatePresence initial={false}>
          {showDiffs && event.change && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: MOTION.exit, ease: EASE_IN } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className={compact ? "pt-1.5" : "pt-2.5"}>
                <Change change={event.change} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

function TypeFilter({
  value,
  counts,
  onChange,
  layoutId,
}: {
  value: ActivityFilter;
  counts: Record<ActivityFilter, number>;
  onChange: (f: ActivityFilter) => void;
  layoutId: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = FILTERS.indexOf(value);
  const onKey = (e: ReactKeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + FILTERS.length) % FILTERS.length;
    onChange(FILTERS[next]);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Filter by type"
      onKeyDown={onKey}
      className="flex flex-wrap gap-1 py-0.5"
    >
      {FILTERS.map((f, i) => {
        const on = f === value;
        return (
          <button
            key={f}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            data-demo={`type-${f}`}
            onClick={() => onChange(f)}
            className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-[color,transform] duration-150 active:scale-[0.97] ${FOCUS_RING} ${
              on ? "text-[var(--af-ink)]" : "text-[var(--af-faint)] hover:text-[var(--af-ink)]"
            }`}
          >
            {on && <motion.span layoutId={layoutId} transition={reduce ? { duration: 0 } : SPRING_UI} className="absolute inset-0 rounded-lg bg-[var(--af-raised)] shadow-[inset_0_0_0_1px_var(--af-line)]" />}
            <span className="relative">{f === "all" ? "All" : TYPE_META[f].plural}</span>
            <span className={`relative font-mono text-[11px] tabular-nums transition-colors duration-150 ${on ? "text-[var(--af-accent)]" : "text-[var(--af-faint)]"}`}>{counts[f]}</span>
          </button>
        );
      })}
    </div>
  );
}

function PeopleFilter({ people, value, onChange }: { people: ActivityPerson[]; value: string | null; onChange: (id: string | null) => void }) {
  return (
    <div role="group" aria-label="Filter by person" className="flex items-center gap-1.5">
      {people.map((p) => {
        const on = value === p.id;
        const dim = value !== null && !on;
        return (
          <button
            key={p.id}
            type="button"
            data-demo={`person-${p.id}`}
            aria-pressed={on}
            aria-label={`Only ${p.name}`}
            title={p.name}
            onClick={() => onChange(on ? null : p.id)}
            className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 relative flex size-8 items-center justify-center rounded-full bg-[var(--af-avatar)] text-[11px] font-semibold tracking-[0.02em] transition-[opacity,box-shadow,color,transform] duration-150 active:scale-[0.94] ${FOCUS_RING} ${
              on
                ? "text-[var(--af-ink)] shadow-[0_0_0_2px_var(--af-surface),0_0_0_3.5px_var(--af-accent)]"
                : dim
                  ? "text-[var(--af-faint)] opacity-45 hover:opacity-80"
                  : "text-[var(--af-muted)] hover:text-[var(--af-ink)]"
            }`}
          >
            {initials(p.name)}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ who, type, onClear }: { who: string | undefined; type: ActivityFilter; onClear: () => void }) {
  const reduce = useReducedMotion() ?? false;
  const what = type === "all" ? "activity" : TYPE_META[type].plural.toLowerCase();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, transition: { duration: MOTION.exit } }}
      transition={{ duration: reduce ? MOTION.fade : 0.4, ease: EASE_OUT }}
      className="flex flex-col items-center py-12 text-center"
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-[var(--af-line)] text-[var(--af-faint)]">
        <CircleDot className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-3 text-[14px] font-medium text-[var(--af-ink)]">{who ? `No ${what} from ${who.split(" ")[0]} this week` : `No ${what} this week`}</p>
      <button type="button" onClick={onClear} className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 mt-2 rounded text-[13px] text-[var(--af-muted)] underline decoration-[var(--af-line)] underline-offset-4 transition-colors duration-150 hover:text-[var(--af-ink)] ${FOCUS_RING}`}>
        Show everything
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function CollabActivityFeed({
  title = "Activity",
  subtitle = "Ledgerline · Website",
  events = DEMO_EVENTS,
  people = DEMO_PEOPLE,
  showDiffs = true,
  density = "comfortable",
  filter: filterProp,
  onFilterChange,
  person: personProp,
  onPersonChange,
  accent,
  theme = "dark",
  className = "",
}: CollabActivityFeedProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });
  const palette = PALETTE[theme];

  const [ownFilter, setOwnFilter] = useState<ActivityFilter>("all");
  const [ownPerson, setOwnPerson] = useState<string | null>(null);
  const [refiltered, setRefiltered] = useState(false);
  const filter = filterProp ?? ownFilter;
  const person = personProp === undefined ? ownPerson : personProp;
  const compact = density === "compact";

  // A filter pushed in from outside counts as a change too, so rows follow the quick stagger.
  const [seen, setSeen] = useState({ filterProp, personProp });
  if (seen.filterProp !== filterProp || seen.personProp !== personProp) {
    setSeen({ filterProp, personProp });
    setRefiltered(true);
  }

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const byPerson = useMemo(() => (person ? events.filter((e) => e.actorId === person) : events), [events, person]);
  const counts = useMemo(() => {
    const c = { all: byPerson.length, edit: 0, comment: 0, status: 0, member: 0 } as Record<ActivityFilter, number>;
    for (const e of byPerson) c[e.type] += 1;
    return c;
  }, [byPerson]);
  const shown = useMemo(() => (filter === "all" ? byPerson : byPerson.filter((e) => e.type === filter)), [byPerson, filter]);

  const groups = useMemo(() => {
    const out: { day: string; date?: string; items: ActivityEvent[] }[] = [];
    for (const e of shown) {
      const g = out[out.length - 1];
      if (g && g.day === e.day) g.items.push(e);
      else out.push({ day: e.day, date: e.date, items: [e] });
    }
    return out;
  }, [shown]);

  const chooseFilter = (f: ActivityFilter) => {
    setRefiltered(true);
    setOwnFilter(f);
    onFilterChange?.(f);
  };
  const choosePerson = (id: string | null) => {
    setRefiltered(true);
    setOwnPerson(id);
    onPersonChange?.(id);
  };
  const clear = () => {
    chooseFilter("all");
    choosePerson(null);
  };

  const filtered = filter !== "all" || person !== null;
  let row = 0;

  return (
    <section ref={root} aria-labelledby={`${uid}-title`} style={cssVars(palette, accent ?? palette.ink)} className={`@container w-full font-sans text-[var(--af-ink)] antialiased ${className}`}>
      <motion.div {...enter(play, 0, reduce)} className="overflow-hidden rounded-[14px] border border-[var(--af-line)] bg-[var(--af-surface)] shadow-[var(--af-shadow)]">
        <header className="flex flex-col gap-4 border-b border-[var(--af-rule)] px-5 pb-4 pt-5 @md:px-6">
          <motion.div {...enter(play, MOTION.step, reduce)} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={`${uid}-title`} className="font-display text-[18px] font-semibold tracking-[-0.025em]">
                {title}
              </h2>
              <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--af-faint)]">{subtitle}</p>
            </div>
            <PeopleFilter people={people} value={person} onChange={choosePerson} />
          </motion.div>
          <motion.div {...enter(play, MOTION.step * 2, reduce)} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <TypeFilter value={filter} counts={counts} onChange={chooseFilter} layoutId={`${uid}-type`} />
            </div>
            <AnimatePresence initial={false}>
              {filtered && (
                <motion.button
                  type="button"
                  data-demo="clear-filters"
                  onClick={clear}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6, filter: "blur(3px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 6, transition: { duration: MOTION.exit, ease: EASE_IN } }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] text-[var(--af-muted)] transition-[color,background-color] duration-150 hover:bg-[var(--af-raised)] hover:text-[var(--af-ink)] ${FOCUS_RING}`}
                >
                  <X className="size-3" strokeWidth={2.25} aria-hidden="true" />
                  Clear
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </header>

        <div className="px-5 pb-2 pt-5 @md:px-6" aria-live="polite">
          <LayoutGroup id={uid}>
            <AnimatePresence mode="popLayout" initial={false}>
              {groups.length === 0 ? (
                <EmptyState key="empty" who={person ? byId.get(person)?.name : undefined} type={filter} onClear={clear} />
              ) : (
                groups.map((g) => (
                  <motion.section
                    key={g.day}
                    layout={reduce ? false : "position"}
                    transition={{ layout: SPRING_UI }}
                    exit={{ opacity: 0, transition: { duration: MOTION.exit } }}
                    aria-label={g.date ? `${g.day}, ${g.date}` : g.day}
                    className="pb-1"
                  >
                    <motion.h3 {...enter(play, refiltered ? 0 : MOTION.rowsAt + row * MOTION.rowStep, reduce)} className="mb-3 flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.1em]">
                      <span className="text-[var(--af-muted)]">{g.day}</span>
                      {g.date && <span className="text-[var(--af-faint)]">{g.date}</span>}
                      <span className="h-px flex-1 self-center bg-[var(--af-rule)]" aria-hidden="true" />
                      <span className="tabular-nums text-[var(--af-faint)]">{g.items.length}</span>
                    </motion.h3>
                    <ul>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {g.items.map((e, i) => {
                          const at = row++;
                          return (
                            <EventRow
                              key={e.id}
                              event={e}
                              actor={byId.get(e.actorId)}
                              last={i === g.items.length - 1}
                              showDiffs={showDiffs}
                              compact={compact}
                              play={play}
                              delay={refiltered ? at * MOTION.refilterStep : MOTION.rowsAt + (at + 1) * MOTION.rowStep}
                            />
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  </motion.section>
                ))
              )}
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </motion.div>
    </section>
  );
}

/** The demo owns both filters so the Customize panel’s action and the demo cursor drive the same feed. */
export default function CollabActivityFeedDemo({
  filter: forcedFilter,
  person: forcedPerson,
  onFilterChange: _onFilterChange,
  onPersonChange: _onPersonChange,
  ...overrides
}: Partial<CollabActivityFeedProps> = {}) {
  void _onFilterChange;
  void _onPersonChange;
  const [filter, setFilter] = useState<ActivityFilter>(forcedFilter ?? "all");
  const [person, setPerson] = useState<string | null>(forcedPerson ?? null);
  useEffect(() => {
    if (forcedFilter) setFilter(forcedFilter);
  }, [forcedFilter]);
  useEffect(() => {
    if (forcedPerson !== undefined) setPerson(forcedPerson);
  }, [forcedPerson]);

  const light = overrides.theme === "light";
  // The dark theme's own accent is its ink; on the light theme that would vanish, so fall back to the light ink.
  const accent = light && overrides.accent?.toLowerCase() === "#f4f4f5" ? undefined : overrides.accent;
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-8" style={{ background: light ? STAGE_LIGHT : STAGE }}>
      <div className="w-full max-w-[720px]">
        <CollabActivityFeed {...overrides} accent={accent} filter={filter} onFilterChange={setFilter} person={person} onPersonChange={setPerson} />
      </div>
    </div>
  );
}
