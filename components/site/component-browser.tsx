"use client";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import "./gallery-focus.css";

import { AnimatePresence, motion } from "motion/react";
import { memo, Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  FILTER_KEY,
  clampResultsScroll,
  galleryHref,
  galleryFilters,
  filterHref,
  readCategoryParam,
  resultsScrollTop,
  sidebarScrollRoom,
} from "@/lib/gallery-sidebar";
import { SegmentedControl } from "@/registry/free/segmented-control/segmented-control";
import { CategorySidebar } from "./category-sidebar";
import { cardEntrance, ComponentCard, FIRST_VIEW_CARDS } from "./component-card";
import { ComponentShelf } from "./component-shelf";
import { CountUp } from "./count-up";
import type { CardData } from "@/lib/registry";
import { catalogueOrderHref, newestFirst, readCatalogueOrder, type CatalogueOrder } from "@/lib/catalogue-order";

type Cat = { key: string; label: string; count: number };

/** The first cards' stagger continues on from the page header and toolbar. */
const FIRST_CARD_STEP = 4;
// Keep the first render independent of catalogue size. Media remains lazy
// inside these cards; another batch mounts shortly before the reader reaches it.
const CARD_BATCH = 12;
const GRID_IMAGE_SIZES = "(min-width: 1680px) calc((100vw - 368px) / 4), (min-width: 1280px) calc((100vw - 352px) / 3), (min-width: 1024px) calc((100vw - 336px) / 2), (min-width: 640px) calc((100vw - 80px) / 2), calc(100vw - 40px)";
const BrowserCard = memo(ComponentCard);
const DISCOVERY_CATEGORIES = ["hero", "features", "ai", "three-d"] as const;

export function ComponentBrowser({ cards, categories, introduction }: { cards: CardData[]; categories: Cat[]; introduction: ReactNode }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<"all" | "free" | "pro">("all");
  const [filtersReady, setFiltersReady] = useState(false);
  // Match the static server HTML during hydration. A layout effect restores
  // URL/session filters before a client navigation can paint stale results.
  const [cat, setCatState] = useState("all");
  const [order, setOrderState] = useState<CatalogueOrder>("featured");
  const validCategories = useMemo(() => new Set(categories.map(c => c.key)), [categories]);
  const handledQuery = useRef<string | null>(null);
  const restoredFilters = useRef(false);
  const initialPresence = useRef("initial");
  const pending = useRef(cat);
  const input = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLParagraphElement>(null);
  const catalogueRef = useRef<HTMLElement>(null);
  const catalogueHeading = useRef<HTMLHeadingElement>(null);
  const focusResults = useRef(false);
  const catalogueId = useId();
  const filterKey = JSON.stringify([cat, tier, q.trim().toLowerCase(), order]);
  const seenSelection = useRef(filterKey);
  const reduce = useReducedMotion();
  // Entrance classes belong to the first render only. Cards that mount later
  // (after a filter) are animated by AnimatePresence instead, never twice.
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);

  // Search and tier live for the tab. Coming back from a component remounts
  // this view, and the category is already in the URL.
  const restoreFilters = useCallback((query: string) => {
    const search = new URLSearchParams(query);
    if (search.toString() === handledQuery.current) return;
    let stored: string | null = null;
    if (!restoredFilters.current) {
      try { stored = sessionStorage.getItem(FILTER_KEY); } catch {}
    }
    const next = readCategoryParam(search.get("category"), validCategories);
    const nextOrder = readCatalogueOrder(search);
    pending.current = next;
    setCatState(next);
    setOrderState(nextOrder);
    const saved = galleryFilters(search, stored);
    // Do not animate the static default results out underneath a restored
    // selection. Reset presence once; later deliberate filters still animate.
    if (!restoredFilters.current && (next !== "all" || saved.q || saved.tier !== "all" || nextOrder !== "featured")) initialPresence.current = "restored";
    setQ(saved.q);
    setTier(saved.tier);
    // Invalid categories become the unfiltered catalogue without a server
    // redirect. Keep explicit search/tier filters and the current history entry.
    const categoryHref = galleryHref(window.location.search, next);
    const href = catalogueOrderHref(categoryHref.split("?")[1] ?? "", nextOrder);
    if (`${window.location.pathname}${window.location.search}` !== href)
      window.history.replaceState(null, "", `${href}${window.location.hash}`);
    handledQuery.current = new URLSearchParams(window.location.search).toString();
    restoredFilters.current = true;
    setFiltersReady(true);
  }, [validCategories]);
  useLayoutEffect(() => restoreFilters(window.location.search), [restoreFilters]);

  useLayoutEffect(() => {
    if (!filtersReady) return;
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({ q, tier }));
    } catch {}
    const href = filterHref(window.location.search, q, tier);
    if (`${window.location.pathname}${window.location.search}` !== href) window.history.replaceState(null, "", `${href}${window.location.hash}`);
    handledQuery.current = new URLSearchParams(window.location.search).toString();
  }, [q, tier, filtersReady]);

  // Back and forward restore the category from the URL. replace() does not
  // push those entries, so this only fires when leaving and returning.
  useEffect(() => {
    const onPop = () => {
      const next = readCategoryParam(new URLSearchParams(window.location.search).get("category"), validCategories);
      pending.current = next;
      setCatState(next);
      setOrderState(readCatalogueOrder(new URLSearchParams(window.location.search)));
      const filters = galleryFilters(new URLSearchParams(window.location.search), null);
      setQ(filters.q);
      setTier(filters.tier);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [validCategories]);

  // A short selection, chosen while the long list is scrolled down, would
  // otherwise leave the reader in the footer. Stop before that scroll pushes
  // the sidebar under the header: a one-card list is only as tall as the sidebar.
  useEffect(() => {
    if (cat !== pending.current || seenSelection.current === filterKey) return;
    seenSelection.current = filterKey;
    const el = resultsRef.current;
    if (!el) return;
    const resultOffset = 80 + (toolbarRef.current?.offsetHeight ?? 64);
    const next = resultsScrollTop(el.getBoundingClientRect().top, window.scrollY, window.innerHeight, resultOffset);
    if (next === null) return;
    const aside = document.querySelector("aside");
    const parent = aside?.parentElement;
    let top = next;
    if (aside && parent && window.matchMedia("(min-width: 1024px)").matches) {
      const box = aside.getBoundingClientRect();
      const room = sidebarScrollRoom(box.top, box.bottom, parent.getBoundingClientRect().bottom);
      top = clampResultsScroll(window.scrollY, next, room);
    }
    if (Math.abs(top - window.scrollY) < 2) return;
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }, [filterKey, cat, reduce]);

  useLayoutEffect(() => {
    if (!focusResults.current) return;
    focusResults.current = false;
    catalogueHeading.current?.focus({ preventScroll: true });
  }, [cat, order]);

  const setCat = (key: string) => {
    pending.current = key;
    setCatState(key);
    setOrderState("featured");
    const search = new URLSearchParams(window.location.search);
    search.delete("sort");
    const href = galleryHref(search.toString(), key);
    if (`${window.location.pathname}${window.location.search}` === href) return;
    // The full catalogue is already here; changing a filter needs no server render.
    // Next copies its own history metadata when given null and tracks the URL.
    window.history.replaceState(null, "", `${href}${window.location.hash}`);
  };

  const browseNew = () => {
    focusResults.current = true;
    setOrderState("new");
    window.history.replaceState(null, "", `${catalogueOrderHref(window.location.search, "new")}${window.location.hash}`);
  };

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
    const matches = cards.filter((c) => {
      if (tier !== "all" && c.tier !== tier) return false;
      if (cat !== "all" && c.category !== cat) return false;
      if (!needle) return true;
      return [c.name, c.description, c.category, ...c.tags].join(" ").toLowerCase().includes(needle);
    });
    return order === "new" ? newestFirst(matches) : matches;
  }, [cards, q, tier, cat, order]);

  const showDiscovery = cat === "all" && tier === "all" && !q.trim() && order === "featured";
  const featured = useMemo(() => cards.slice(0, 8), [cards]);
  const newCards = useMemo(() => newestFirst(cards).slice(0, 8), [cards]);
  const collections = useMemo(() => DISCOVERY_CATEGORIES.flatMap(key => {
    const category = categories.find(item => item.key === key);
    const selection = cards.filter(card => card.category === key).slice(0, 8);
    return category && selection.length ? [{ key, title: key === "ai" ? "AI chat" : category.label, cards: selection }] : [];
  }), [cards, categories]);
  const resultTitle = showDiscovery ? "Explore everything" : q.trim() ? "Search results" : cat !== "all" ? categories.find(category => category.key === cat)?.label : tier === "free" ? "Free components" : tier === "pro" ? "Pro components" : order === "new" ? "New components" : "All components";

  const [pageWindow, setPageWindow] = useState({ key: filterKey, count: CARD_BATCH });
  const shownCount = pageWindow.key === filterKey ? pageWindow.count : CARD_BATCH;
  const shown = filtered.slice(0, shownCount);
  const hasMore = shown.length < filtered.length;
  const moreRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    setPageWindow({ key: filterKey, count: CARD_BATCH });
  }, [filterKey]);
  useEffect(() => {
    if (!focusNext.current) return;
    const next = gridRef.current?.querySelector<HTMLAnchorElement>(`a[href="/components/${focusNext.current}"]`);
    if (next) { focusNext.current = null; next.focus(); }
  }, [shown.length]);
  const loadMore = useCallback(() => {
    setPageWindow(current => ({
      key: filterKey,
      count: Math.min(filtered.length, (current.key === filterKey ? current.count : CARD_BATCH) + CARD_BATCH),
    }));
  }, [filterKey, filtered.length]);
  useEffect(() => {
    const target = moreRef.current;
    if (!hasMore || !target || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      loadMore();
    }, { rootMargin: "600px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, shown.length]);

  return (
    <div data-gallery-ready={filtersReady} className="relative grid gap-5 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-x-8 lg:gap-y-6">
      <p data-gallery-loading role="status" className="absolute inset-x-0 top-0 hidden py-4 text-sm text-site-fg-2">Loading your selection…</p>
      {/* Only the URL observer needs the request's search params. Keeping it
          in its own boundary preserves the server-rendered gallery. */}
      <Suspense fallback={null}><GalleryLocationSync onSearchChange={restoreFilters} /></Suspense>
      <div className="lg:col-start-2">{introduction}</div>
      <CategorySidebar categories={categories} total={cards.length} active={cat} onSelect={setCat} />
      <div className="min-w-0 lg:col-start-2">
        <div ref={toolbarRef} className="site-in sticky top-16 z-20 flex flex-col gap-3 border-b border-white/[0.07] bg-site-bg/95 py-3 backdrop-blur-xl [--i:3] sm:flex-row">
          <div className="group/search relative flex-1">
            <label htmlFor="component-search" className="sr-only">Search components</label>
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-site-fg-3 transition-colors group-focus-within/search:text-site-fg-2" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              ref={input}
              id="component-search"
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
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-11 pr-12 text-base sm:text-[14px] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 placeholder:text-site-fg-3 hover:border-white/[0.14] focus:border-white/25 focus:bg-white/[0.05] focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  input.current?.focus();
                }}
                aria-label="Clear search"
                className="site-pop absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-site-fg-2 transition-colors duration-150 hover:bg-white/[0.14] hover:text-site-fg active:scale-95 motion-reduce:!scale-100"
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
          </div>
          <SegmentedControl
            label="Tier"
            value={tier}
            onValueChange={(value) => setTier(value as "all" | "free" | "pro")}
            options={[{ value: "all", label: "All" }, { value: "free", label: "Free" }, { value: "pro", label: "Pro" }]}
            icons={false}
            className="sm:!w-[200px] sm:shrink-0 [&_button]:min-h-11"
          />
        </div>
        {showDiscovery && (
          <div className="mt-6 space-y-7 sm:mt-7 sm:space-y-8">
            <ComponentShelf title="Featured" cards={featured} priority onBrowse={() => {
              const element = catalogueRef.current;
              catalogueHeading.current?.focus({ preventScroll: true });
              if (element) window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 80 - (toolbarRef.current?.offsetHeight ?? 64), behavior: reduce ? "instant" : "smooth" });
            }} />
            <ComponentShelf title="New" cards={newCards} onBrowse={browseNew} />
            {collections.map(collection => <ComponentShelf key={collection.key} title={collection.title} cards={collection.cards} onBrowse={() => { focusResults.current = true; setCat(collection.key); }} />)}
          </div>
        )}
        <section ref={catalogueRef} aria-labelledby={catalogueId} className="mt-7 sm:mt-9">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 ref={catalogueHeading} id={catalogueId} tabIndex={-1} className="text-[20px] font-medium tracking-[-0.025em]">{resultTitle}</h2>
          <p ref={resultsRef} className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3" aria-live="polite">
            <span className="sr-only">{filtered.length} {filtered.length === 1 ? "component" : "components"}</span>
            <span aria-hidden="true"><CountUp value={filtered.length} initialAnimation={false} /> {filtered.length === 1 ? "component" : "components"}</span>
          </p>
        </div>
        {filtered.length ? (
          <motion.div ref={gridRef} layout={!reduce} className="component-grid mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[105rem]:grid-cols-4">
            <AnimatePresence key={initialPresence.current} initial={false} mode="popLayout">
              {shown.map((c, i) => (
                <motion.div
                  key={c.slug}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: "blur(4px)", transition: { duration: 0.18 } }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="flex"
                >
                  <CardSlot entrance={firstRender.current ? showDiscovery ? { className: "site-reveal" } : cardEntrance(i, FIRST_CARD_STEP) : undefined}>
                    <BrowserCard c={c} priority={!showDiscovery && i < FIRST_VIEW_CARDS} imageSizes={GRID_IMAGE_SIZES} />
                  </CardSlot>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="site-rise mt-4 rounded-[18px] border border-dashed border-white/10 p-6 text-center sm:p-12">
            <p className="break-words text-lg font-medium tracking-[-0.02em]">{q ? <>Nothing matches “{q}”.</> : "Nothing in this combination yet."}</p>
            <p className="mt-2 text-[14px] text-site-fg-3">Try a broader word, or ask for it on GitHub.</p>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setTier("all");
                setCat("all");
                input.current?.focus({ preventScroll: true });
              }}
              className="site-btn site-btn-secondary mt-5 h-11 px-4 text-[13px]"
            >
              Clear filters
            </button>
          </div>
        )}
        {hasMore && (
          <div ref={moreRef} className="relative mt-4 h-px">
            {/* Automatic for scrolling, with an explicit path for keyboard and
                screen-reader navigation. Focus continues at the new cards. */}
            <button type="button" onClick={() => { focusNext.current = filtered[shown.length]?.slug ?? null; loadMore(); }} className="site-btn site-btn-secondary sr-only focus:not-sr-only focus:absolute focus:inset-x-0 focus:top-0 focus:mx-auto focus:h-11 focus:w-fit focus:px-5 focus:text-sm">
              Load more components
            </button>
          </div>
        )}
        </section>
      </div>
    </div>
  );
}

function GalleryLocationSync({ onSearchChange }: { onSearchChange: (query: string) => void }) {
  const query = useSearchParams().toString();
  useLayoutEffect(() => {
    // A queued router snapshot must never overwrite more recent local typing
    // or a category choice already committed through the native History API.
    if (query === new URLSearchParams(window.location.search).toString()) onSearchChange(query);
  }, [query, onSearchChange]);
  return null;
}

/** The card's own wrapper, so entrance transforms never fight the layout animation around it. */
function CardSlot({ entrance, children }: { entrance?: ReturnType<typeof cardEntrance>; children: React.ReactNode }) {
  return (
    <div className={`flex w-full ${entrance?.className ?? ""}`} style={entrance?.style}>
      {children}
    </div>
  );
}
