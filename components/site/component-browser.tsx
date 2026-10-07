"use client";

import { useMemo, useState } from "react";
import { ComponentCard } from "./component-card";
import type { CardData } from "@/lib/registry";

type Cat = { key: string; label: string; count: number };

export function ComponentBrowser({ cards, categories }: { cards: CardData[]; categories: Cat[] }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<"all" | "free" | "pro">("all");
  const [cat, setCat] = useState<string>("all");

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
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3 lg:block">Categories</p>
        <ul className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 lg:mt-4 lg:flex-col lg:gap-0.5">
          <CatItem active={cat === "all"} onClick={() => setCat("all")} label="All components" count={cards.length} />
          {categories.map((c) => (
            <CatItem key={c.key} active={cat === c.key} onClick={() => setCat(c.key)} label={c.label} count={c.count} />
          ))}
        </ul>
      </aside>
      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search components</span>
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-site-fg-3" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search charts, three.js, pricing, chat…"
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-11 pr-4 text-[14px] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-site-fg-3 focus:border-white/20 focus:bg-white/[0.05]"
            />
          </label>
          <div role="radiogroup" aria-label="Tier" className="flex h-11 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {(["all", "free", "pro"] as const).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={tier === t}
                onClick={() => setTier(t)}
                className={`flex-1 rounded-lg px-4 text-[13px] font-medium capitalize transition-colors ${tier === t ? "bg-white/[0.1] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-site-fg-3 hover:text-site-fg-2"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "component" : "components"}
        </p>
        {filtered.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c, i) => (
              <ComponentCard key={c.slug} c={c} priority={i < 6} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[18px] border border-dashed border-white/10 p-12 text-center">
            <p className="text-lg font-medium tracking-[-0.02em]">Nothing matches “{q}”.</p>
            <p className="mt-2 text-[14px] text-site-fg-3">Try a broader word, or request it on GitHub.</p>
          </div>
        )}
      </div>
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
        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${active ? "bg-white/[0.07] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-site-fg-2 hover:bg-white/[0.03] hover:text-site-fg"}`}
      >
        <span className="whitespace-nowrap">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-site-fg-3">{count}</span>
      </button>
    </li>
  );
}
