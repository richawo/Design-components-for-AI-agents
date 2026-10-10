import Link from "next/link";
import type { CSSProperties } from "react";
import { CATEGORIES } from "@/lib/registry-types";
import type { CardData } from "@/lib/registry";
import { CardMedia } from "./card-media";

/** Cards that can be on screen at first paint. They arrive with the page; the rest reveal on scroll. */
export const FIRST_VIEW_CARDS = 6;

/** Entrance for the card at `index` in a grid, its stagger continuing from `step` (the blocks above it). */
export function cardEntrance(index: number, step: number): { className: string; style?: CSSProperties } {
  if (index >= FIRST_VIEW_CARDS) return { className: "site-reveal" };
  return { className: "site-in", style: { "--i": index + step } as CSSProperties };
}

const CHIP = "inline-flex h-5 items-center rounded-full px-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ring-1 ring-inset";

/** Small mono label. The accent marks Pro, and only Pro. */
export function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`${CHIP} bg-white/[0.04] text-site-fg-2 ring-white/[0.08] ${className}`}>{children}</span>;
}

export function TierBadge({ tier, className = "" }: { tier: "free" | "pro"; className?: string }) {
  return tier === "pro" ? (
    <span className={`${CHIP} bg-site-accent/12 text-site-accent ring-site-accent/30 ${className}`}>Pro</span>
  ) : (
    <Chip className={className}>Free</Chip>
  );
}

export function ComponentCard({ c, priority = false }: { c: CardData; priority?: boolean }) {
  return (
    <Link
      href={`/components/${c.slug}`}
      className="group relative flex w-full flex-col overflow-hidden rounded-[18px] border border-white/[0.08] bg-site-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,background-color,scale] duration-150 ease-site hover:border-white/[0.16] hover:bg-site-raised-2 active:scale-[0.98] active:duration-75"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-white/[0.06] bg-site-sunken">
        <CardMedia name={c.name} thumb={c.thumb} video={c.video} platform={c.platform} priority={priority} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-[15px] font-medium tracking-[-0.015em] text-site-fg">{c.name}</h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {c.platform === "mobile" && <Chip>Native</Chip>}
            <TierBadge tier={c.tier} />
          </div>
        </div>
        <p className="flex items-center justify-between font-mono text-[11px] text-site-fg-3">
          {CATEGORIES[c.category].label}
          <span aria-hidden="true" className="-translate-x-1 text-site-fg-2 opacity-0 transition duration-200 ease-site group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
            View →
          </span>
        </p>
      </div>
    </Link>
  );
}
