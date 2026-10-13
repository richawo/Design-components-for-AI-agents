"use client";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { groupCategories } from "@/lib/category-groups";
import {
  ALL_ROW_ID,
  COLLAPSED_KEY,
  SCROLL_KEY,
  groupRowId,
  itemRowId,
  moveSidebarRow,
  openGroup,
  parseCollapsed,
  parseScroll,
  scrollDelta,
  sidebarMaxHeight,
  toggleCollapsed,
  typeaheadRow,
  type SidebarRow,
} from "@/lib/gallery-sidebar";

type Cat = { key: string; label: string; count: number };

const EASE = [0.22, 1, 0.36, 1] as const;
/** Inset, so the ring stays visible inside the scrolling list instead of being clipped. */
const FOCUS = "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-site-accent)]";

export function CategorySidebar({
  categories,
  total,
  active,
  onSelect,
}: {
  categories: Cat[];
  total: number;
  active: string;
  onSelect: (key: string) => void;
}) {
  const groups = useMemo(() => groupCategories(categories), [categories]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(true);
  const [prefsReady, setPrefsReady] = useState(false);
  const [cursor, setCursor] = useState(() => (active === "all" ? ALL_ROW_ID : itemRowId(active)));
  const panelId = useId();
  const asideRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const disclosureRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const didRestore = useRef(false);
  const buffer = useRef("");
  const bufferTimer = useRef(0);

  // Saved groups apply before paint. The active group opens with them so a
  // shared category link is not hidden inside a collapsed section.
  useLayoutEffect(() => {
    let saved: string[] = [];
    try {
      saved = parseCollapsed(localStorage.getItem(COLLAPSED_KEY));
    } catch {}
    const group = groups.find((g) => g.items.some((c) => c.key === active))?.label;
    const next = openGroup(saved, group);
    if (next.join("\n") !== saved.join("\n")) writeCollapsed(next);
    setCollapsed(next);
    setPrefsReady(true);
    const frame = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(frame);
    // Mount only. Later toggles are the user's, and choosing a category opens its group on its own.
  }, []);

  useLayoutEffect(() => {
    const aside = asideRef.current;
    const panel = panelRef.current;
    if (!aside) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    let frame = 0;
    const apply = () => {
      frame = 0;
      if (desktop.matches) {
        if (panel) panel.style.maxHeight = "";
        aside.style.maxHeight = `${sidebarMaxHeight(aside.getBoundingClientRect().top, window.innerHeight)}px`;
        return;
      }
      aside.style.maxHeight = "";
      if (!panel || !open) {
        if (panel) panel.style.maxHeight = "";
        return;
      }
      const room = window.innerHeight - panel.getBoundingClientRect().top - 16;
      panel.style.maxHeight = `${Math.max(0, Math.round(room))}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    desktop.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      desktop.removeEventListener("change", schedule);
    };
  }, [open]);

  useEffect(() => {
    setCursor(active === "all" ? ALL_ROW_ID : itemRowId(active));
  }, [active]);

  useLayoutEffect(() => {
    if (!prefsReady || didRestore.current) return;
    const el = scrollRef.current;
    if (!el) return;
    didRestore.current = true;
    let saved: ReturnType<typeof parseScroll> = null;
    try {
      saved = parseScroll(sessionStorage.getItem(SCROLL_KEY));
    } catch {}
    // A saved offset wins. Pulling the selection back on top of it would
    // forget the place the reader left the list.
    if (saved?.cat === active) {
      el.scrollTop = saved.top;
      return;
    }
    const current = el.querySelector<HTMLElement>("[data-current='true']");
    if (!current) return;
    const box = el.getBoundingClientRect();
    const row = current.getBoundingClientRect();
    el.scrollTop += scrollDelta(box.top, box.bottom, row.top, row.bottom);
  }, [prefsReady, active]);

  // The phone list is a different height from the desktop one, so a saved
  // desktop offset would hide the selection. Opening the panel shows it.
  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    const current = el?.querySelector<HTMLElement>("[data-current='true']");
    if (!el || !current) return;
    const box = el.getBoundingClientRect();
    const row = current.getBoundingClientRect();
    el.scrollTop += scrollDelta(box.top, box.bottom, row.top, row.bottom);
  }, [open, active]);

  useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`);
    if (!el) return;
    pendingFocus.current = null;
    setCursor(id);
    el.focus({ preventScroll: true });
    reveal(el);
  });

  const saveScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ cat: active, top: el.scrollTop }));
    } catch {}
  }, [active]);

  const needle = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return groups;
    return groups
      .map((g) => (g.label.toLowerCase().includes(needle) ? g : { ...g, items: g.items.filter((c) => c.label.toLowerCase().includes(needle)) }))
      .filter((g) => g.items.length);
  }, [groups, needle]);

  const groupOpen = useCallback((label: string) => Boolean(needle) || !collapsed.includes(label), [needle, collapsed]);

  const rows = useMemo<SidebarRow[]>(() => {
    const list: SidebarRow[] = [{ id: ALL_ROW_ID, label: "All components", kind: "all" }];
    for (const g of visible) {
      const isOpen = groupOpen(g.label);
      list.push({ id: groupRowId(g.label), label: g.label, kind: "group", open: isOpen });
      if (!isOpen) continue;
      for (const c of g.items) list.push({ id: itemRowId(c.key), label: c.label, kind: "item", key: c.key, group: g.label });
    }
    return list;
  }, [visible, groupOpen]);

  const activeGroupLabel = groups.find((g) => g.items.some((c) => c.key === active))?.label;
  const fallbackId =
    rows.find((row) => row.kind === "item" && row.key === active)?.id ??
    (activeGroupLabel ? rows.find((row) => row.id === groupRowId(activeGroupLabel))?.id : undefined) ??
    rows[0]?.id;
  const cursorId = rows.some((row) => row.id === cursor) ? cursor : fallbackId;

  const reveal = (el: HTMLElement) => {
    const port = scrollRef.current;
    if (!port) return;
    const box = port.getBoundingClientRect();
    const row = el.getBoundingClientRect();
    port.scrollTop += scrollDelta(box.top, box.bottom, row.top, row.bottom);
  };

  const focusRow = (id: string) => {
    setCursor(id);
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`);
    if (!el) {
      pendingFocus.current = id;
      return;
    }
    el.focus({ preventScroll: true });
    reveal(el);
  };

  const toggle = (label: string) => {
    setInstant(false);
    setCollapsed((prev) => {
      const next = toggleCollapsed(prev, label);
      writeCollapsed(next);
      return next;
    });
  };

  const select = (key: string) => {
    onSelect(key);
    const group = groups.find((g) => g.items.some((c) => c.key === key))?.label;
    if (group) {
      setCollapsed((prev) => {
        const next = openGroup(prev, group);
        if (next.length !== prev.length) writeCollapsed(next);
        return next;
      });
    }
    if (open) {
      setOpen(false);
      disclosureRef.current?.focus({ preventScroll: true });
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === "Escape") {
      if (needle) {
        e.preventDefault();
        setFilter("");
        return;
      }
      if (open) {
        e.preventDefault();
        setOpen(false);
        disclosureRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    if (e.key.length === 1 && e.key !== " ") {
      e.preventDefault();
      const next = `${buffer.current}${e.key.toLowerCase()}`;
      buffer.current = next;
      window.clearTimeout(bufferTimer.current);
      bufferTimer.current = window.setTimeout(() => {
        buffer.current = "";
      }, 500);
      const id = typeaheadRow(rows, cursorId ?? "", next);
      if (id) focusRow(id);
      return;
    }
    const move = moveSidebarRow(rows, cursorId ?? "", e.key);
    if (!move) return;
    e.preventDefault();
    if (move.type === "focus") {
      focusRow(move.id);
      return;
    }
    toggle(move.label);
    if (move.open) {
      const first = groups.find((g) => g.label === move.label)?.items[0];
      pendingFocus.current = first ? itemRowId(first.key) : move.id;
    } else {
      focusRow(move.id);
    }
  };

  const current = active === "all" ? { label: "All components", count: total } : categories.find((c) => c.key === active);
  const matchCount = visible.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <aside
      ref={asideRef}
      aria-label="Categories"
      className="site-in relative min-w-0 [--i:3] lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-8rem)] lg:flex-col lg:self-start"
    >
      <p className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3 lg:block">Categories</p>
      <button
        ref={disclosureRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-left text-[14px] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:border-white/[0.14] lg:hidden ${FOCUS}`}
      >
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">Category</span>
          <span className="truncate">{current?.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-site-fg-2">{current?.count}</span>
          <Chevron open={open} />
        </span>
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={`${open ? "mt-3 flex" : "hidden"} max-h-[min(70dvh,34rem)] min-h-0 flex-col rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 lg:mt-4 lg:flex lg:max-h-none lg:flex-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0`}
      >
        <FilterInput
          value={filter}
          onChange={setFilter}
          onSubmit={() => visible[0]?.items[0] && select(visible[0].items[0].key)}
          onArrowDown={() => cursorId && focusRow(cursorId)}
        />
        <p className="sr-only" aria-live="polite">
          {needle ? `${matchCount} ${matchCount === 1 ? "category" : "categories"}` : ""}
        </p>
        <ScrollArea scrollRef={scrollRef} onScroll={saveScroll}>
          <div onKeyDown={onListKeyDown}>
            <ul className="flex flex-col gap-0.5">
              <CatItem
                rowId={ALL_ROW_ID}
                tabIndex={cursorId === ALL_ROW_ID ? 0 : -1}
                active={active === "all"}
                onSelect={() => {
                  setCursor(ALL_ROW_ID);
                  select("all");
                }}
                label="All components"
                count={total}
              />
            </ul>
            {visible.map((g) => (
              <Group
                key={g.label}
                label={g.label}
                count={g.items.reduce((sum, c) => sum + c.count, 0)}
                open={groupOpen(g.label)}
                hasActive={g.items.some((c) => c.key === active)}
                instant={instant}
                tabIndex={cursorId === groupRowId(g.label) ? 0 : -1}
                onToggle={() => {
                  setCursor(groupRowId(g.label));
                  toggle(g.label);
                }}
              >
                {g.items.map((c) => (
                  <CatItem
                    key={c.key}
                    rowId={itemRowId(c.key)}
                    tabIndex={cursorId === itemRowId(c.key) ? 0 : -1}
                    active={active === c.key}
                    onSelect={() => {
                      setCursor(itemRowId(c.key));
                      select(c.key);
                    }}
                    label={c.label}
                    count={c.count}
                  />
                ))}
              </Group>
            ))}
            {needle && !visible.length && <p className="px-3 py-4 text-[13px] text-site-fg-3">No category matches “{filter.trim()}”.</p>}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}

function writeCollapsed(next: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
  } catch {}
}

function FilterInput({
  value,
  onChange,
  onSubmit,
  onArrowDown,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onArrowDown: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label className="group/filter relative mb-3 block shrink-0">
      <span className="sr-only">Filter categories</span>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-site-fg-3 transition-colors group-focus-within/filter:text-site-fg-2" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          } else if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            onSubmit();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onArrowDown();
          }
        }}
        placeholder="Filter categories"
        className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-9 text-[13px] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 placeholder:text-site-fg-3 hover:border-white/[0.14] focus:border-white/25 focus:bg-white/[0.05] focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          aria-label="Clear category filter"
          className={`site-pop absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-site-fg-2 transition-colors duration-150 hover:bg-white/[0.14] hover:text-site-fg active:scale-95 ${FOCUS}`}
        >
          <svg viewBox="0 0 12 12" className="size-2" fill="none" aria-hidden="true">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </label>
  );
}

/** Scrolls on its own, fading whichever edge has more list behind it. */
function ScrollArea({ children, scrollRef, onScroll }: { children: React.ReactNode; scrollRef: React.RefObject<HTMLDivElement | null>; onScroll: () => void }) {
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure, scrollRef]);

  const fade = "1.5rem";
  const mask = `linear-gradient(180deg, ${edges.top ? "transparent" : "#000"} 0, #000 ${fade}, #000 calc(100% - ${fade}), ${edges.bottom ? "transparent" : "#000"} 100%)`;
  return (
    <motion.div
      ref={scrollRef}
      layoutScroll
      onScroll={() => {
        measure();
        onScroll();
      }}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className="min-h-0 flex-1 scroll-py-6 overflow-y-auto overscroll-contain [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]"
    >
      <div className="pb-1">{children}</div>
    </motion.div>
  );
}

function Group({
  label,
  count,
  open,
  hasActive,
  instant,
  tabIndex,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  hasActive: boolean;
  instant: boolean;
  tabIndex: number;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className="mt-3">
      <button
        type="button"
        data-row={groupRowId(label)}
        tabIndex={tabIndex}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className={`group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 hover:text-site-fg-2 ${FOCUS} ${hasActive && !open ? "text-site-fg-2" : "text-site-fg-3"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="whitespace-nowrap tracking-[0.06em]">{label}</span>
          {hasActive && !open && <span aria-hidden="true" className="site-pop size-1 shrink-0 rounded-full bg-site-fg-2" />}
          {hasActive && !open && <span className="sr-only">contains the selected category</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {!open && <span className="tabular-nums">{count}</span>}
          <Chevron open={open} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="items"
            id={id}
            initial={instant ? false : { height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={reduce || instant ? { duration: 0 } : { duration: 0.24, ease: EASE }}
            className="mt-0.5 flex flex-col gap-0.5"
          >
            {children}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`size-3 shrink-0 text-site-fg-3 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CatItem({
  rowId,
  tabIndex,
  active,
  onSelect,
  label,
  count,
}: {
  rowId: string;
  tabIndex: number;
  active: boolean;
  onSelect: () => void;
  label: string;
  count: number;
}) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        data-row={rowId}
        data-current={active ? "true" : undefined}
        tabIndex={tabIndex}
        onClick={onSelect}
        aria-pressed={active}
        className={`group relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-[14px] transition-colors duration-150 ${FOCUS} ${active ? "text-site-fg" : "text-site-fg-2 hover:bg-white/[0.04] hover:text-site-fg"}`}
      >
        {active && (
          <motion.span
            layoutId="browser-cat"
            className="absolute inset-0 rounded-lg bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        )}
        <span className="relative min-w-0 truncate transition-transform duration-150 group-active:scale-[0.97]">{label}</span>
        <span className={`relative font-mono text-[11px] tabular-nums transition-colors ${active ? "text-site-fg-2" : "text-site-fg-3"}`}>{count}</span>
      </button>
    </li>
  );
}
