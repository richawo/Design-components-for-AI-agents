"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cardEntrance, ComponentCard, FIRST_VIEW_CARDS } from "./component-card";
import type { CardData } from "@/lib/registry";

type Cat = { key: string; label: string; count: number };

/** The first cards' stagger continues on from the page header and toolbar. */
const FIRST_CARD_STEP = 4;

export function ComponentBrowser({ cards, categories }: { cards: CardData[]; categories: Cat[] }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<"all" | "free" | "pro">("all");
  const [cat, setCat] = useState<string>("all");
  const input = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  // Entrance classes belong to the first render only. Cards that mount later
  // (after a filter) are animated by AnimatePresence instead, never twice.
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);

  // "/" jumps to search from anywhere on the page, as on most libraries.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (tier !== "all" && c.tier !== tier) return false;
      if (cat !== "all" && c.category !== cat) return false;
      if (!needle) return true;
      return [c.name, c.description, c.category, ...c.tags].join(" ").toLowerCase().includes(needle);
    });
  }, [cards, q, tier, cat]);

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <aside className="site-in min-w-0 [--i:3] lg:sticky lg:top-24 lg:self-start">
        <p className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3 lg:block">Categories</p>
        <ul className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [mask-image:linear-gradient(90deg,#000_calc(100%-3rem),transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none] lg:mt-4 lg:flex-col lg:gap-0.5">
          <CatItem active={cat === "all"} onClick={() => setCat("all")} label="All components" count={cards.length} />
          {categories.map((c) => (
            <CatItem key={c.key} active={cat === c.key} onClick={() => setCat(c.key)} label={c.label} count={c.count} />
          ))}
        </ul>
      </aside>
      <div className="min-w-0">
        <div className="site-in flex flex-col gap-3 [--i:3] sm:flex-row">
          <label className="group/search relative flex-1">
            <span className="sr-only">Search components</span>
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-site-fg-3 transition-colors group-focus-within/search:text-site-fg-2" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              ref={input}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && q) {
                  e.preventDefault();
                  setQ("");
                }
              }}
              placeholder="Search charts, three.js, pricing, chat…"
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-11 pr-12 text-[14px] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 placeholder:text-site-fg-3 hover:border-white/[0.14] focus:border-white/25 focus:bg-white/[0.05] focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  input.current?.focus();
                }}
                aria-label="Clear search"
                className="site-pop absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-site-fg-2 transition-colors duration-150 hover:bg-white/[0.14] hover:text-site-fg active:scale-95"
              >
                <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden="true">
                  <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[11px] text-site-fg-3 transition-opacity group-focus-within/search:opacity-0 sm:flex">
                /
              </kbd>
            )}
          </label>
          <div role="radiogroup" aria-label="Tier" className="flex h-11 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {(["all", "free", "pro"] as const).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={tier === t}
                onClick={() => setTier(t)}
                className={`relative flex-1 rounded-lg px-4 text-[13px] font-medium capitalize transition-colors duration-150 ${tier === t ? "text-site-fg" : "text-site-fg-3 hover:text-site-fg-2"}`}
              >
                {tier === t && (
                  <motion.span
                    layoutId="browser-tier"
                    className="absolute inset-0 rounded-lg bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative inline-block transition-transform duration-150 active:scale-95">{t}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="site-in mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3 [--i:4]" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "component" : "components"}
        </p>
        {filtered.length ? (
          <motion.div layout={!reduce} className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false} mode="popLayout">
              {filtered.map((c, i) => (
                <motion.div
                  key={c.slug}
                  layout={!reduce}
                  initial={{ opacity: 0, scale: 0.97, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.97, filter: "blur(4px)", transition: { duration: 0.18 } }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="flex"
                >
                  <CardSlot entrance={firstRender.current ? cardEntrance(i, FIRST_CARD_STEP) : undefined}>
                    <ComponentCard c={c} priority={i < FIRST_VIEW_CARDS} />
                  </CardSlot>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="site-rise mt-4 rounded-[18px] border border-dashed border-white/10 p-12 text-center">
            <p className="text-lg font-medium tracking-[-0.02em]">{q ? <>Nothing matches “{q}”.</> : "Nothing in this combination yet."}</p>
            <p className="mt-2 text-[14px] text-site-fg-3">Try a broader word, or ask for it on GitHub.</p>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setTier("all");
                setCat("all");
              }}
              className="site-btn site-btn-secondary mt-5 h-9 px-4 text-[13px]"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The card's own wrapper, so entrance transforms never fight the layout animation around it. */
function CardSlot({ entrance, children }: { entrance?: ReturnType<typeof cardEntrance>; children: React.ReactNode }) {
  return (
    <div className={`flex w-full ${entrance?.className ?? ""}`} style={entrance?.style}>
      {children}
    </div>
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
        <span className="relative whitespace-nowrap transition-transform duration-150 group-active:scale-[0.97]">{label}</span>
        <span className={`relative font-mono text-[11px] tabular-nums transition-colors ${active ? "text-site-fg-2" : "text-site-fg-3"}`}>{count}</span>
      </button>
    </li>
  );
}
