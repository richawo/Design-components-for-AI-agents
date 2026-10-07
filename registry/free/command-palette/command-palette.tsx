"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CircleDot,
  Clock,
  FileText,
  FolderKanban,
  Inbox,
  Link2,
  Map as MapIcon,
  Moon,
  Plus,
  Search,
  Settings,
  Timer,
  UserPlus,
  UserRound,
} from "lucide-react";

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
  /** Open on first render. The demo opens by default. */
  defaultOpen?: boolean;
  /** Focus the search field when the palette opens on first render. */
  autoFocus?: boolean;
  placeholder?: string;
  /** Workspace name drawn in the demo app behind the palette. */
  workspace?: string;
  /** Called with the chosen item. */
  onSelect?: (item: CommandItem) => void;
  className?: string;
};

const defaultGroups: CommandGroup[] = [
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
      { id: "theme", label: "Switch to dark theme", shortcut: ["⌘", "⇧", "L"], icon: Moon, keywords: ["dark mode", "appearance", "night"] },
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
/* Fuzzy matching                                                       */
/* ------------------------------------------------------------------ */

type Match = { score: number; indices: number[] };

/**
 * Subsequence match: every query character must appear in order. Consecutive
 * runs and word starts score higher, so "gi" ranks "Go to Inbox" above
 * "Log time".
 */
function fuzzy(query: string, text: string): Match | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const t = text.toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const indices: number[] = [];
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    const wordStart = found === 0 || /[\s\-_/,.]/.test(t[found - 1]);
    score += 1 + (found === prev + 1 ? 4 : 0) + (wordStart ? 3 : 0) - Math.min(found - ti, 6) * 0.15;
    indices.push(found);
    prev = found;
    ti = found + 1;
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

function Highlight({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <>{text}</>;
  const set = new Set(indices);
  const out: ReactNode[] = [];
  let run = "";
  let runHit = false;
  const flush = (k: number) => {
    if (!run) return;
    out.push(
      runHit ? (
        <mark key={k} className="rounded-[3px] bg-[#ffe680] px-[1px] text-[#18181b] [box-decoration-break:clone]">
          {run}
        </mark>
      ) : (
        <span key={k}>{run}</span>
      ),
    );
    run = "";
  };
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i);
    if (hit !== runHit) {
      flush(i);
      runHit = hit;
    }
    run += text[i];
  }
  flush(text.length);
  return <>{out}</>;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

const ease = [0.2, 0.8, 0.2, 1] as const;

export function CommandPalette({
  groups = defaultGroups,
  defaultOpen = true,
  autoFocus = false,
  placeholder = "Search or type a command…",
  workspace = "Northdesk",
  onSelect,
  className = "",
}: CommandPaletteProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstOpen = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (id: string) => `${uid}-opt-${id}`;

  const results = useMemo(() => {
    const q = query.trim();
    return groups
      .map((g) => {
        const items = g.items
          .map((item) => ({ item, match: matchItem(q, item) }))
          .filter((r): r is { item: CommandItem; match: Match } => r.match !== null);
        if (q) items.sort((a, b) => b.match.score - a.match.score);
        return { ...g, results: items };
      })
      .filter((g) => g.results.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => results.flatMap((g) => g.results), [results]);
  const activeItem = flat[Math.min(active, flat.length - 1)]?.item;

  useEffect(() => setActive(0), [query]);

  // Focus the field whenever the palette opens (but not on page load unless asked).
  useEffect(() => {
    if (!open) return;
    if (firstOpen.current && !autoFocus) {
      firstOpen.current = false;
      return;
    }
    firstOpen.current = false;
    input.current?.focus({ preventScroll: true });
  }, [open, autoFocus]);

  // ⌘K / Ctrl+K toggles from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the active option in view.
  useEffect(() => {
    if (!activeItem) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-id="${activeItem.id}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeItem]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }, []);

  const choose = (item: CommandItem) => {
    onSelect?.(item);
    setToast(item.label.replace(/^Go to |^Open /, ""));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = flat.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (n) setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setActive((a) => (a - 1 + n) % n);
    } else if (e.key === "Home" && n) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && n) {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeItem) choose(activeItem);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else close();
    }
  };

  let index = -1;

  return (
    <section className={`relative isolate min-h-[720px] overflow-hidden bg-[#f5f5f3] text-[#18181b] ${className}`}>
      <BackdropApp workspace={workspace} triggerRef={trigger} onOpen={() => setOpen(true)} />

      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            aria-hidden="true"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="absolute inset-0 z-10 bg-[#18181b]/[0.18]"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="palette"
            role="dialog"
            aria-label="Command palette"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: reduce ? 0 : 0.22, ease }}
            className="absolute inset-x-3 top-[76px] z-20 mx-auto max-w-[640px] overflow-hidden rounded-[16px] bg-white shadow-[0_0_0_1px_rgba(24,24,27,0.08),0_2px_4px_rgba(24,24,27,0.04),0_24px_64px_-12px_rgba(24,24,27,0.28)] sm:inset-x-6 sm:top-[112px]"
          >
            {/* Search */}
            <div className="flex h-[60px] items-center gap-3 border-b border-[#18181b]/[0.08] px-4 sm:px-5">
              <Search className="size-[18px] shrink-0 text-[#18181b]/45" aria-hidden="true" />
              <input
                ref={input}
                role="combobox"
                aria-expanded={flat.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeItem ? optionId(activeItem.id) : undefined}
                aria-label="Search commands"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                spellCheck={false}
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] tracking-[-0.01em] text-[#18181b] placeholder:text-[#18181b]/40 focus:outline-none sm:text-[17px]"
              />
              <button
                type="button"
                onClick={close}
                className="hidden h-7 items-center rounded-[6px] border border-[#18181b]/10 px-2 font-mono text-[11px] text-[#18181b]/55 transition-colors hover:bg-[#18181b]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181b] sm:inline-flex"
              >
                esc
              </button>
            </div>

            {/* Results */}
            <div ref={list} id={listId} role="listbox" aria-label="Commands" className="max-h-[min(400px,calc(100dvh-240px))] overflow-y-auto overscroll-contain p-2">
              {results.map((g) => {
                const headingId = `${uid}-group-${g.id}`;
                return (
                  <div key={g.id} role="group" aria-labelledby={headingId} className="pb-1 [&+&]:mt-1 [&+&]:border-t [&+&]:border-[#18181b]/[0.06] [&+&]:pt-1">
                    <p id={headingId} className="px-3 pb-1.5 pt-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#18181b]/45">
                      {g.label}
                    </p>
                    {g.results.map(({ item, match }) => {
                      index += 1;
                      const i = index;
                      const selected = activeItem?.id === item.id;
                      const ItemIcon = item.icon ?? ArrowRight;
                      return (
                        <div
                          key={item.id}
                          id={optionId(item.id)}
                          data-id={item.id}
                          role="option"
                          aria-selected={selected}
                          onMouseMove={() => active !== i && setActive(i)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choose(item)}
                          className={`relative flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-1.5 text-[14.5px] transition-colors duration-100 ${selected ? "bg-[#f1f0ec] text-[#18181b]" : "text-[#18181b]/80"}`}
                        >
                          {selected ? <motion.span layoutId={`${uid}-marker`} transition={{ duration: reduce ? 0 : 0.18, ease }} className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-[#18181b]" /> : null}
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-[7px] transition-colors ${selected ? "bg-[#18181b] text-white" : "bg-[#18181b]/[0.05] text-[#18181b]/60"}`}
                          >
                            <ItemIcon className="size-[15px]" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            <Highlight text={item.label} indices={match.indices} />
                          </span>
                          {item.hint ? <span className="shrink-0 font-mono text-[11px] text-[#18181b]/45">{item.hint}</span> : null}
                          {item.shortcut ? (
                            <span className="hidden shrink-0 items-center gap-1 sm:flex">
                              {item.shortcut.map((k, ki) => (
                                <Kbd key={ki}>{k}</Kbd>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {flat.length === 0 ? (
                <div role="status" className="flex flex-col items-center px-6 py-12 text-center">
                  <span aria-hidden="true" className="mb-4 flex size-11 items-center justify-center rounded-full border border-dashed border-[#18181b]/20 text-[#18181b]/40">
                    <Search className="size-[18px]" />
                  </span>
                  <p className="text-[15px] font-medium text-[#18181b]">Nothing matches “{query.trim()}”</p>
                  <p className="mt-1 max-w-[36ch] text-[13.5px] leading-relaxed text-[#18181b]/55">
                    Try a shorter word, or something like{" "}
                    <button type="button" onClick={() => setQuery("invite")} className="font-medium text-[#18181b] underline decoration-[#ffd84d] decoration-2 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181b]">
                      invite
                    </button>{" "}
                    or{" "}
                    <button type="button" onClick={() => setQuery("theme")} className="font-medium text-[#18181b] underline decoration-[#ffd84d] decoration-2 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181b]">
                      theme
                    </button>
                    .
                  </p>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex h-11 items-center justify-between gap-4 border-t border-[#18181b]/[0.08] bg-[#fafaf9] px-4 font-mono text-[11px] text-[#18181b]/50 sm:px-5">
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
                <span className="hidden items-center gap-1.5 sm:flex">
                  <Kbd>esc</Kbd>
                  <span className="ml-0.5">close</span>
                </span>
              </div>
              <span className="tabular-nums" aria-live="polite">
                {flat.length} {flat.length === 1 ? "result" : "results"}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Confirmation */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast}
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.25, ease }}
            className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-[#18181b] py-2.5 pl-3 pr-4 text-[13.5px] text-white shadow-[0_12px_32px_-12px_rgba(24,24,27,0.5)]"
          >
            <span className="size-1.5 rounded-full bg-[#ffd84d]" aria-hidden="true" />
            Ran “{toast}”
            <span className="font-mono text-[11px] text-white/50">⌘K to reopen</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[5px] border border-[#18181b]/[0.12] bg-white px-1.5 font-mono text-[11px] leading-none text-[#18181b]/60 shadow-[0_1px_0_rgba(24,24,27,0.08)]">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/* The quiet app behind the palette                                     */
/* ------------------------------------------------------------------ */

const backdropRows = [
  { key: "OPS-418", title: "Webhook retries hammer the billing API", who: "MO", state: "In progress" },
  { key: "OPS-412", title: "CSV export drops the last row", who: "JT", state: "In review" },
  { key: "WEB-207", title: "Pricing page: annual toggle remembers choice", who: "AK", state: "Todo" },
  { key: "WEB-199", title: "Footer links wrap badly at 1024px", who: "RS", state: "Todo" },
  { key: "OPS-405", title: "Rotate the staging database password", who: "MO", state: "Done" },
  { key: "WEB-188", title: "Empty state for saved views", who: "AK", state: "Done" },
];

function BackdropApp({ workspace, triggerRef, onOpen }: { workspace: string; triggerRef: RefObject<HTMLButtonElement | null>; onOpen: () => void }) {
  return (
    <div className="flex min-h-[720px]">
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-[#18181b]/[0.07] bg-[#efefec] p-4 md:flex" aria-hidden="true">
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <span className="flex size-6 items-center justify-center rounded-[6px] bg-[#18181b] font-display text-[12px] font-bold text-white">{workspace.charAt(0)}</span>
          <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">{workspace}</span>
        </div>
        {[
          ["Inbox", Inbox, "4"],
          ["My issues", UserRound, ""],
          ["Projects", FolderKanban, ""],
          ["Roadmap", MapIcon, ""],
          ["Recent", Clock, ""],
        ].map(([label, I, count], i) => {
          const IconC = I as Icon;
          return (
            <div key={label as string} className={`flex h-8 items-center gap-2.5 rounded-[7px] px-2 text-[13.5px] ${i === 0 ? "bg-white text-[#18181b] shadow-[0_0_0_1px_rgba(24,24,27,0.06)]" : "text-[#18181b]/60"}`}>
              <IconC className="size-4" aria-hidden="true" />
              <span className="flex-1">{label as string}</span>
              {count ? <span className="font-mono text-[11px] text-[#18181b]/45">{count as string}</span> : null}
            </div>
          );
        })}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-[#18181b]/[0.07] px-4 sm:px-8">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">Inbox</h2>
          <button
            ref={triggerRef}
            type="button"
            onClick={onOpen}
            aria-label="Open command palette"
            aria-keyshortcuts="Meta+K Control+K"
            className="flex h-10 min-w-0 items-center gap-2.5 rounded-[10px] border border-[#18181b]/10 bg-white pl-3 pr-1.5 text-[13.5px] text-[#18181b]/50 shadow-[0_1px_0_rgba(24,24,27,0.04)] transition-colors hover:border-[#18181b]/20 hover:text-[#18181b]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181b] sm:w-72"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden flex-1 truncate text-left sm:block">Search or jump to…</span>
            <span className="flex items-center gap-0.5">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        </header>
        <ul className="px-2 py-3 sm:px-6" aria-hidden="true">
          {backdropRows.map((r) => (
            <li key={r.key} className="flex h-12 items-center gap-4 rounded-[8px] px-2 text-[14px] sm:px-3">
              <span className="w-[4.5rem] shrink-0 font-mono text-[11.5px] text-[#18181b]/45">{r.key}</span>
              <span className="min-w-0 flex-1 truncate text-[#18181b]/85">{r.title}</span>
              <span className="hidden shrink-0 font-mono text-[11px] text-[#18181b]/45 sm:block">{r.state}</span>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#18181b]/[0.08] font-mono text-[9.5px] font-medium text-[#18181b]/70">{r.who}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default CommandPalette;
