"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { groupCategories } from "@/lib/category-groups";

type Cat = { key: string; label: string; count: number };

const COLLAPSED_KEY = "dfa:browser-collapsed-groups";
const EASE = [0.22, 1, 0.36, 1] as const;

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
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Read after mount so server and client render the same tree first.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(saved)) setCollapsed(new Set(saved.filter((s): s is string => typeof s === "string")));
    } catch {}
  }, []);

  const saveCollapsed = useCallback((next: Set<string>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {}
  }, []);

  const activeGroup = groups.find((g) => g.items.some((c) => c.key === active))?.label;
  useEffect(() => {
    if (!activeGroup) return;
    setCollapsed((prev) => {
      if (!prev.has(activeGroup)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup);
      return next;
    });
  }, [activeGroup]);

  const needle = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return groups;
    return groups
      .map((g) => (g.label.toLowerCase().includes(needle) ? g : { ...g, items: g.items.filter((c) => c.label.toLowerCase().includes(needle)) }))
      .filter((g) => g.items.length);
  }, [groups, needle]);

  const select = (key: string) => {
    onSelect(key);
    setOpen(false);
  };

  const toggle = (label: string) => {
    const next = new Set(collapsed);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    saveCollapsed(next);
  };

  const current = active === "all" ? { label: "All components", count: total } : categories.find((c) => c.key === active);

  return (
    <aside className="site-in relative min-w-0 [--i:3] lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-8rem)] lg:flex-col lg:self-start">
      <p className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3 lg:block">Categories</p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-left text-[14px] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:border-white/[0.14] lg:hidden"
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
        id={panelId}
        className={`${open ? "mt-3 flex" : "hidden"} max-h-[min(70dvh,34rem)] min-h-0 flex-col rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 lg:mt-4 lg:flex lg:max-h-none lg:flex-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0`}
      >
        <FilterInput value={filter} onChange={setFilter} onSubmit={() => visible[0]?.items[0] && select(visible[0].items[0].key)} />
        <ScrollArea>
          <ul className="flex flex-col gap-0.5">
            <CatItem active={active === "all"} onClick={() => select("all")} label="All components" count={total} />
          </ul>
          {visible.map((g) => (
            <Group
              key={g.label}
              label={g.label}
              open={Boolean(needle) || !collapsed.has(g.label)}
              hasActive={g.label === activeGroup}
              onToggle={() => toggle(g.label)}
            >
              {g.items.map((c) => (
                <CatItem key={c.key} active={active === c.key} onClick={() => select(c.key)} label={c.label} count={c.count} />
              ))}
            </Group>
          ))}
          {needle && !visible.length && <p className="px-3 py-4 text-[13px] text-site-fg-3">No category matches “{filter.trim()}”.</p>}
        </ScrollArea>
      </div>
    </aside>
  );
}

function FilterInput({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
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
          className="site-pop absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-site-fg-2 transition-colors duration-150 hover:bg-white/[0.14] hover:text-site-fg active:scale-95"
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
function ScrollArea({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  const fade = "1.5rem";
  const mask = `linear-gradient(180deg, ${edges.top ? "transparent" : "#000"} 0, #000 ${fade}, #000 calc(100% - ${fade}), ${edges.bottom ? "transparent" : "#000"} 100%)`;
  return (
    <motion.div
      ref={ref}
      layoutScroll
      onScroll={measure}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]"
    >
      <div className="pb-1">{children}</div>
    </motion.div>
  );
}

function Group({
  label,
  open,
  hasActive,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  hasActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className={`group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 hover:text-site-fg-2 ${hasActive && !open ? "text-site-fg-2" : "text-site-fg-3"}`}
      >
        <span className="flex items-center gap-2">
          {label}
          {hasActive && !open && <span aria-hidden="true" className="site-pop size-1 rounded-full bg-site-fg-2" />}
        </span>
        <Chevron open={open} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="items"
            id={id}
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={reduce ? { duration: 0 } : { duration: 0.24, ease: EASE }}
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

function CatItem({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`group relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors duration-150 ${active ? "text-site-fg" : "text-site-fg-2 hover:bg-white/[0.04] hover:text-site-fg"}`}
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
