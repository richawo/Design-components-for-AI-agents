"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, Check, CircleDot, FileText, FolderKanban, Inbox, Link2, Map as MapIcon, Plus, Search, Settings, Sun, Timer, UserPlus, UserRound } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

export type CommandItem = {
  id: string;
  label: string;
  /** Extra words that should match, e.g. "dark mode" for a theme switch. */
  keywords?: string[];
  /** Keys shown on the right, e.g. ["G", "I"] or ["⌘", "⇧", "L"]. */
  shortcut?: string[];
  /** Small trailing text, e.g. an issue key or "Project". */
  hint?: string;
  icon?: Icon;
};

export type CommandGroup = { id: string; label: string; items: CommandItem[] };

export type CommandPaletteProps = {
  groups?: CommandGroup[];
  /** Open on first view. The demo opens by default. */
  defaultOpen?: boolean;
  /** Focus the search field when the palette opens on first view. */
  autoFocus?: boolean;
  placeholder?: string;
  /** Text on the ⌘K trigger field. */
  triggerLabel?: string;
  /** Two queries offered when nothing matches. */
  suggestions?: [string, string];
  /** Called with the chosen item. */
  onSelect?: (item: CommandItem) => void;
  /** The one accent: the selection marker and the highlighter behind matched letters. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    panel: "#111113",
    field: "#141416",
    line: "#232327",
    rule: "#1c1c1f",
    ink: "#f4f4f5",
    body: "#c4c4ca",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    tile: "#1b1b1e",
    hover: "rgba(255,255,255,0.06)",
    press: "rgba(255,255,255,0.1)",
    scrim: "rgba(0,0,0,0.55)",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 80px -12px rgba(0,0,0,0.9)",
  },
  light: {
    panel: "#ffffff",
    field: "#fafafa",
    line: "#e4e4e7",
    rule: "#efeff1",
    ink: "#18181b",
    body: "#3f3f46",
    muted: "#52525b",
    faint: "#71717a",
    tile: "#f1f1f3",
    hover: "rgba(24,24,27,0.05)",
    press: "rgba(24,24,27,0.09)",
    scrim: "rgba(244,244,245,0.6)",
    shadow: "0 1px 2px rgba(24,24,27,0.05), 0 24px 64px -16px rgba(24,24,27,0.28)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

const DEFAULT_ACCENT = "#ff7a45";

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = "#0a0a0b";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 10, // px
  blur: 8, // px
  block: 0.42,
  openAt: 0.16, // the demo’s first open waits for the trigger to land
  panel: 0.32, // the panel itself
  step: 0.05, // the search row, just after the panel starts
  rowsAt: 0.1, // first group label, once the search row is down
  row: 0.025, // row to row while the palette opens
  rowCap: 10, // rows past the fold share the last delay, so a long list never drags
  rowBlock: 0.36,
  footer: 0.08, // after the last row starts
  settle: 0.18, // rows that appear while typing
  exit: 0.16,
  press: 130, // ms: the chosen row flashes before the palette closes
  toastFor: 2200, // ms
  fade: 0.15, // reduced motion
} as const;

/* ------------------------------------------------------------------ */
/* Demo content: Northdesk, an issue tracker                            */
/* ------------------------------------------------------------------ */

const DEMO_GROUPS: CommandGroup[] = [
  {
    id: "nav",
    label: "Navigation",
    items: [
      { id: "inbox", label: "Go to Inbox", shortcut: ["G", "I"], icon: Inbox, keywords: ["notifications", "mail"] },
      { id: "mine", label: "Go to My issues", shortcut: ["G", "M"], icon: UserRound, keywords: ["assigned", "tasks"] },
      { id: "projects", label: "Go to Projects", shortcut: ["G", "P"], icon: FolderKanban },
      { id: "roadmap", label: "Go to Roadmap", shortcut: ["G", "R"], icon: MapIcon, keywords: ["timeline", "quarter"] },
      { id: "settings", label: "Open Settings", shortcut: ["G", "S"], icon: Settings, keywords: ["preferences", "billing", "account"] },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    items: [
      { id: "new", label: "Create issue", shortcut: ["C"], icon: Plus, keywords: ["new", "bug", "ticket", "task"] },
      { id: "invite", label: "Invite a teammate", icon: UserPlus, keywords: ["member", "people", "add"] },
      { id: "theme", label: "Switch to light theme", shortcut: ["⌘", "⇧", "L"], icon: Sun, keywords: ["light mode", "appearance", "day"] },
      { id: "link", label: "Copy link to this page", shortcut: ["⌘", "⇧", "C"], icon: Link2, keywords: ["url", "share"] },
      { id: "log", label: "Log time", shortcut: ["T"], icon: Timer, keywords: ["hours", "timesheet"] },
    ],
  },
  {
    id: "recent",
    label: "Recent",
    items: [
      { id: "r1", label: "CSV export drops the last row", hint: "OPS-412", icon: CircleDot },
      { id: "r2", label: "Q4 pricing page rewrite", hint: "Project", icon: FolderKanban },
      { id: "r3", label: "Onboarding interviews, round 3", hint: "Doc", icon: FileText },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--cp-accent": accent };
  for (const [k, v] of Object.entries(p)) vars[`--cp-${k}`] = v;
  return vars as CSSProperties;
}

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean, rise: number = MOTION.rise, duration: number = MOTION.block) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration, ease: EASE_OUT, delay },
  };
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cp-ink)]";

/* ------------------------------------------------------------------ */
/* Fuzzy matching                                                       */
/* ------------------------------------------------------------------ */

type Match = { score: number; indices: number[] };
type Result = { item: CommandItem; match: Match };
type ResultGroup = CommandGroup & { results: Result[] };

/**
 * Subsequence match: every query character must appear in order. Consecutive
 * runs and word starts score higher, so "gi" ranks "Go to Inbox" above "Log time".
 */
function fuzzy(query: string, text: string): Match | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const t = text.toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const indices: number[] = [];
  let score = 0;
  let from = 0;
  let prev = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, from);
    if (found === -1) return null;
    const wordStart = found === 0 || /[\s\-_/,.]/.test(t[found - 1]);
    score += 1 + (found === prev + 1 ? 4 : 0) + (wordStart ? 3 : 0) - Math.min(found - from, 6) * 0.15;
    indices.push(found);
    prev = found;
    from = found + 1;
  }
  return { score: score - t.length * 0.01, indices };
}

function matchItem(query: string, item: CommandItem): Match | null {
  const own = fuzzy(query, item.label);
  if (own) return own;
  // Keyword hits still count, but rank lower and highlight nothing.
  for (const k of item.keywords ?? []) {
    const m = fuzzy(query, k);
    if (m) return { score: m.score - 3, indices: [] };
  }
  return null;
}

/** Groups with their matching items, best first; empty groups drop out. */
function useCommandSearch(groups: CommandGroup[], query: string) {
  return useMemo(() => {
    const q = query.trim();
    const results: ResultGroup[] = groups
      .map((g) => {
        const items = g.items.map((item) => ({ item, match: matchItem(q, item) })).filter((r): r is Result => r.match !== null);
        if (q) items.sort((a, b) => b.match.score - a.match.score);
        return { ...g, results: items };
      })
      .filter((g) => g.results.length > 0);
    return { results, flat: results.flatMap((g) => g.results) };
  }, [groups, query]);
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** ⌘K / Ctrl+K from anywhere, without re-binding on every render. */
function useHotkey(key: string, run: () => void) {
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  }, [run]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
}

/** A setTimeout that is always cleared: on re-schedule and on unmount. */
function useTimer() {
  const id = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(id.current), []);
  return useCallback((fn: () => void, ms: number) => {
    window.clearTimeout(id.current);
    id.current = window.setTimeout(fn, ms);
  }, []);
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[5px] border border-[var(--cp-line)] bg-[var(--cp-field)] px-1.5 font-mono text-[11px] leading-none text-[var(--cp-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {children}
    </kbd>
  );
}

/** Matched letters sit on a highlighter-pen stroke of the accent. */
function Highlight({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <>{text}</>;
  const hits = new Set(indices);
  const runs: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const hit = hits.has(i);
    const last = runs[runs.length - 1];
    if (last && last.hit === hit) last.text += text[i];
    else runs.push({ text: text[i], hit });
  }
  return (
    <>
      {runs.map((r, i) =>
        r.hit ? (
          <mark key={i} className="rounded-[3px] bg-[color-mix(in_srgb,var(--cp-accent)_30%,transparent)] px-[1px] text-[var(--cp-ink)] [box-decoration-break:clone]">
            {r.text}
          </mark>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}

function Trigger({ label, triggerRef, onOpen, play, reduce }: { label: string; triggerRef: RefObject<HTMLButtonElement | null>; onOpen: () => void; play: boolean; reduce: boolean }) {
  return (
    <motion.button
      ref={triggerRef}
      type="button"
      onClick={onOpen}
      aria-label="Open command palette"
      aria-keyshortcuts="Meta+K Control+K"
      {...enter(play, 0, reduce)}
      className={`mx-auto flex h-12 w-full max-w-[640px] items-center gap-3 rounded-[12px] border border-[var(--cp-line)] bg-[var(--cp-field)] pl-4 pr-2 text-[14.5px] text-[var(--cp-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[color,border-color,transform] duration-150 hover:border-[color-mix(in_srgb,var(--cp-ink)_22%,transparent)] hover:text-[var(--cp-muted)] active:scale-[0.99] ${focusRing}`}
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span className="flex items-center gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </motion.button>
  );
}

function ResultRow({
  result,
  selected,
  pressed,
  optionId,
  layoutPrefix,
  delay,
  staggered,
  reduce,
  onHover,
  onChoose,
}: {
  result: Result;
  selected: boolean;
  pressed: boolean;
  optionId: string;
  layoutPrefix: string;
  delay: number;
  /** True while the palette is opening: rows stagger in. Rows that appear later, as you type, just settle. */
  staggered: boolean;
  reduce: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const { item, match } = result;
  const ItemIcon = item.icon ?? ArrowRight;
  const entrance = staggered
    ? enter(true, delay, reduce, 6, MOTION.rowBlock)
    : { initial: reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)" }, animate: { opacity: 1, filter: "blur(0px)" }, transition: { duration: reduce ? MOTION.fade : MOTION.settle, ease: EASE_OUT } };
  return (
    <motion.div
      {...entrance}
      id={optionId}
      data-id={item.id}
      role="option"
      aria-selected={selected}
      onMouseMove={() => !selected && onHover()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onChoose}
      className={`relative isolate flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-1.5 text-[14.5px] transition-[color,scale] duration-100 active:scale-[0.99] ${selected ? "text-[var(--cp-ink)]" : "text-[var(--cp-body)]"} ${pressed ? "scale-[0.985]" : ""}`}
    >
      {/* One highlight and one marker glide between rows, rather than each row lighting up. */}
      {selected ? (
        <>
          <motion.span
            layoutId={`${layoutPrefix}-hl`}
            transition={reduce ? { duration: 0 } : SPRING_UI}
            className={`absolute inset-0 -z-10 rounded-[10px] transition-colors duration-100 ${pressed ? "bg-[var(--cp-press)]" : "bg-[var(--cp-hover)]"}`}
          />
          <motion.span layoutId={`${layoutPrefix}-marker`} transition={reduce ? { duration: 0 } : SPRING_UI} className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-[var(--cp-accent)]" />
        </>
      ) : null}
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-[7px] transition-colors duration-100 ${selected ? "bg-[var(--cp-ink)] text-[var(--cp-panel)]" : "bg-[var(--cp-tile)] text-[var(--cp-faint)]"}`}
      >
        <ItemIcon className="size-[15px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <Highlight text={item.label} indices={match.indices} />
      </span>
      {item.hint ? <span className="shrink-0 font-mono text-[11px] text-[var(--cp-faint)]">{item.hint}</span> : null}
      {item.shortcut ? (
        <span className="hidden shrink-0 items-center gap-1 @lg:flex">
          {item.shortcut.map((k, i) => (
            <Kbd key={i}>{k}</Kbd>
          ))}
        </span>
      ) : null}
    </motion.div>
  );
}

function EmptyState({ query, suggestions, onSuggest, reduce }: { query: string; suggestions: [string, string]; onSuggest: (q: string) => void; reduce: boolean }) {
  const suggestion = (q: string) => (
    <button
      type="button"
      onClick={() => onSuggest(q)}
      className={`rounded-[3px] font-medium text-[var(--cp-ink)] underline decoration-[var(--cp-faint)] decoration-2 underline-offset-[3px] transition-colors duration-150 hover:decoration-[var(--cp-ink)] ${focusRing}`}
    >
      {q}
    </button>
  );
  return (
    <div role="status" className="flex flex-col items-center px-6 py-12 text-center">
      <motion.span {...enter(true, 0, reduce, 6)} aria-hidden="true" className="mb-4 flex size-11 items-center justify-center rounded-full border border-dashed border-[var(--cp-line)] text-[var(--cp-faint)]">
        <Search className="size-[18px]" />
      </motion.span>
      <motion.p {...enter(true, MOTION.step, reduce, 6)} className="text-[15px] font-medium text-[var(--cp-ink)]">
        Nothing matches “{query.trim()}”
      </motion.p>
      <motion.p {...enter(true, MOTION.step * 2, reduce, 6)} className="mt-1 max-w-[36ch] text-[13.5px] leading-relaxed text-[var(--cp-muted)]">
        Try a shorter word, or something like {suggestion(suggestions[0])} or {suggestion(suggestions[1])}.
      </motion.p>
    </div>
  );
}

function Footer({ count, delay, reduce }: { count: number; delay: number; reduce: boolean }) {
  return (
    <motion.div
      {...enter(true, delay, reduce, 4)}
      className="flex h-11 items-center justify-between gap-4 border-t border-[var(--cp-line)] bg-[color-mix(in_srgb,var(--cp-ink)_2%,transparent)] px-4 font-mono text-[11px] text-[var(--cp-faint)] @lg:px-5"
    >
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span className="ml-0.5">navigate</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd>
          <span className="ml-0.5">open</span>
        </span>
        <span className="hidden items-center gap-1.5 @lg:flex">
          <Kbd>esc</Kbd>
          <span className="ml-0.5">close</span>
        </span>
      </div>
      <span className="tabular-nums" aria-live="polite">
        {count} {count === 1 ? "result" : "results"}
      </span>
    </motion.div>
  );
}

function Toast({ text, reduce }: { text: string; reduce: boolean }) {
  return (
    <motion.div
      role="status"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)", transition: { duration: MOTION.exit, ease: EASE_IN } }}
      transition={{ duration: reduce ? MOTION.fade : 0.3, ease: EASE_OUT }}
      className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-[var(--cp-ink)] py-2.5 pl-3 pr-4 text-[13.5px] text-[var(--cp-panel)] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]"
    >
      <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      Ran “{text}”
      <span className="font-mono text-[11px] opacity-55">⌘K to reopen</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function CommandPalette({
  groups = DEMO_GROUPS,
  defaultOpen = true,
  autoFocus = false,
  placeholder = "Search or type a command…",
  triggerLabel = "Search or jump to…",
  suggestions = ["invite", "theme"],
  onSelect,
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: CommandPaletteProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });

  const [open, setOpen] = useState(false);
  const [opens, setOpens] = useState(0); // each open replays the stagger
  const [staggering, setStaggering] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const firstView = useRef(true);
  const later = useTimer();
  const toastTimer = useTimer();
  const staggerTimer = useTimer();

  const { results, flat } = useCommandSearch(groups, query);
  const activeItem = flat[Math.min(active, flat.length - 1)]?.item;
  const optionId = (id: string) => `${uid}-opt-${id}`;

  const show = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
    setStaggering(true);
    setOpens((n) => n + 1);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  // The demo opens itself once the trigger has landed.
  useEffect(() => {
    if (!play || !defaultOpen) return;
    later(show, reduce ? 0 : MOTION.openAt * 1000);
  }, [play, defaultOpen, reduce, later, show]);

  // While the palette opens, rows stagger; afterwards new rows (from typing) just settle.
  useEffect(() => {
    if (!opens) return;
    staggerTimer(() => setStaggering(false), (MOTION.rowsAt + MOTION.rowCap * MOTION.row + MOTION.rowBlock) * 1000);
  }, [opens, staggerTimer]);

  // Opening focuses the field (not on page load unless asked); closing hands focus back to the trigger.
  useEffect(() => {
    if (open) {
      if (!firstView.current || autoFocus) input.current?.focus({ preventScroll: true });
      firstView.current = false;
    } else if (opens > 0 && root.current?.contains(document.activeElement ?? null) !== false) {
      trigger.current?.focus({ preventScroll: true });
    }
  }, [open, opens, autoFocus]);

  useHotkey("k", () => (open ? close() : show()));
  useEffect(() => setActive(0), [query]);

  // Keep the active option in view.
  useEffect(() => {
    if (!activeItem) return;
    list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(activeItem.id)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeItem]);

  const choose = (item: CommandItem) => {
    if (pressed) return;
    setPressed(item.id);
    // The row flashes first, so the choice registers before the palette leaves.
    later(
      () => {
        setPressed(null);
        onSelect?.(item);
        setToast(item.label.replace(/^Go to |^Open /, ""));
        toastTimer(() => setToast(null), MOTION.toastFor);
        close();
      },
      reduce ? 0 : MOTION.press,
    );
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const n = flat.length;
    const keys: Record<string, () => void> = {
      ArrowDown: () => n && setActive((a) => (a + 1) % n),
      ArrowUp: () => n && setActive((a) => (a - 1 + n) % n),
      Home: () => n && setActive(0),
      End: () => n && setActive(n - 1),
      Enter: () => activeItem && choose(activeItem),
      Escape: () => (query ? setQuery("") : close()),
    };
    const run = keys[e.key];
    if (!run) return;
    e.preventDefault();
    run();
  };

  // Row delays follow reading order: the search row, then each group’s label and rows.
  let order = 0;
  const rowDelay = () => MOTION.rowsAt + Math.min(order++, MOTION.rowCap) * MOTION.row;

  return (
    <div
      ref={root}
      style={cssVars(PALETTE[theme], accent)}
      className={`@container relative isolate w-full font-sans antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      <div className="px-3 pt-16 @lg:px-6 @2xl:pt-24">
        <Trigger label={triggerLabel} triggerRef={trigger} onOpen={show} play={play} reduce={reduce} />
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            aria-hidden="true"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: MOTION.exit } }}
            transition={{ duration: reduce ? MOTION.fade : 0.24 }}
            className="absolute inset-0 z-10 bg-[var(--cp-scrim)] backdrop-blur-[2px]"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            key={`palette-${opens}`}
            role="dialog"
            aria-label="Command palette"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98, filter: `blur(${MOTION.blur}px)` }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985, filter: "blur(4px)", transition: { duration: MOTION.exit, ease: EASE_IN } }}
            transition={{ duration: reduce ? MOTION.fade : MOTION.panel, ease: EASE_OUT }}
            style={{ transformOrigin: "50% 0%" }}
            className="absolute inset-x-3 top-14 z-20 mx-auto max-w-[640px] overflow-hidden rounded-[16px] border border-[var(--cp-line)] bg-[var(--cp-panel)] text-[var(--cp-ink)] shadow-[var(--cp-shadow)] @lg:inset-x-6 @2xl:top-[88px]"
          >
            {/* Search */}
            <motion.div {...enter(true, MOTION.step, reduce, 4)} className="flex h-[60px] items-center gap-3 border-b border-[var(--cp-line)] px-4 @lg:px-5">
              <Search className="size-[18px] shrink-0 text-[var(--cp-faint)]" aria-hidden="true" />
              <input
                ref={input}
                role="combobox"
                aria-expanded={flat.length > 0}
                aria-controls={`${uid}-list`}
                aria-autocomplete="list"
                aria-activedescendant={activeItem ? optionId(activeItem.id) : undefined}
                aria-label="Search commands"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                spellCheck={false}
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] tracking-[-0.01em] text-[var(--cp-ink)] outline-none placeholder:text-[var(--cp-faint)] @lg:text-[17px]"
              />
              <button
                type="button"
                onClick={close}
                className={`hidden h-7 items-center rounded-[6px] border border-[var(--cp-line)] px-2 font-mono text-[11px] text-[var(--cp-muted)] transition-[background-color,color] duration-150 hover:bg-[var(--cp-hover)] hover:text-[var(--cp-ink)] active:translate-y-px @lg:inline-flex ${focusRing}`}
              >
                esc
              </button>
            </motion.div>

            {/* Results */}
            <div ref={list} id={`${uid}-list`} role="listbox" aria-label="Commands" className="max-h-[min(400px,calc(100dvh-240px))] overflow-y-auto overscroll-contain p-2">
              {results.map((g) => (
                <div key={g.id} role="group" aria-labelledby={`${uid}-group-${g.id}`} className="pb-1 [&+&]:mt-1 [&+&]:border-t [&+&]:border-[var(--cp-rule)] [&+&]:pt-1">
                  <motion.p
                    id={`${uid}-group-${g.id}`}
                    {...(staggering ? enter(true, rowDelay(), reduce, 4, MOTION.rowBlock) : {})}
                    className="px-3 pb-1.5 pt-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--cp-faint)]"
                  >
                    {g.label}
                  </motion.p>
                  {g.results.map((r) => (
                    <ResultRow
                      key={r.item.id}
                      result={r}
                      selected={activeItem?.id === r.item.id}
                      pressed={pressed === r.item.id}
                      optionId={optionId(r.item.id)}
                      layoutPrefix={uid}
                      delay={rowDelay()}
                      staggered={staggering}
                      reduce={reduce}
                      onHover={() => setActive(flat.indexOf(r))}
                      onChoose={() => choose(r.item)}
                    />
                  ))}
                </div>
              ))}
              {flat.length === 0 ? <EmptyState query={query} suggestions={suggestions} onSuggest={setQuery} reduce={reduce} /> : null}
            </div>

            <Footer count={flat.length} delay={staggering ? rowDelay() + MOTION.footer : 0} reduce={reduce} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>{toast ? <Toast key={toast} text={toast} reduce={reduce} /> : null}</AnimatePresence>
    </div>
  );
}

export default function CommandPaletteDemo() {
  return (
    <div className="min-h-dvh" style={{ background: STAGE }}>
      <CommandPalette className="min-h-[max(720px,100dvh)]" />
    </div>
  );
}
