"use client";

import Link from "next/link";
import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { CardMedia } from "./card-media";
import { TierBadge } from "./component-card";
import { SegmentedControl } from "@/registry/free/segmented-control/segmented-control";
import { cataloguePath } from "@/lib/catalogue-path";
import { CATEGORIES } from "@/lib/registry-types";
import type { CardData } from "@/lib/registry";

/**
 * Catalogue cover: short introduction, then the real work. One large specimen
 * anchors a mosaic of different interfaces. Every frame links to its design.
 * Phone rows stay still and reachable; recordings share the gallery's decoder
 * budget, stop offscreen, respect reduced motion and have an explicit pause.
 */
export function HomeCatalogue({ groups }: { groups: { id: string; label: string; cards: CardData[]; href: string }[] }) {
  const [selected, setSelected] = useState(groups[0].id);
  const [playing, setPlaying] = useState(true);
  const reduced = useReducedMotion();
  const group = groups.find((item) => item.id === selected) ?? groups[0];
  return <div>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <SegmentedControl label="Explore the library" options={groups.map(({ id, label }) => ({ value: id, label }))} value={selected} onValueChange={setSelected} icons={false} className="!w-full sm:!w-[460px] [&_button]:min-h-11" />
      <div className="flex items-center justify-between gap-5">
        {!reduced && <button type="button" onClick={() => setPlaying((current) => !current)} className="inline-flex min-h-11 items-center gap-2 rounded-md text-[13px] text-site-fg-3 hover:text-site-fg"><span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span>{playing ? "Pause previews" : "Play previews"}</button>}
        <Link href={group.href} className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-site-fg-2 transition-colors hover:text-site-fg">Explore {group.label === "Selected" ? "all" : group.label.toLowerCase()} <span aria-hidden="true">↗</span></Link>
      </div>
    </div>
    <div aria-live="polite" className="sr-only">Showing {group.label.toLowerCase()} examples.</div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {group.cards.map((card, index) => <GalleryPreview key={card.slug} card={card} featured={selected === groups[0].id && index === 0} priority={selected === groups[0].id && index < 3} playing={playing && !reduced} />)}
    </div>
  </div>;
}

function GalleryPreview({ card, featured, priority, playing }: { card: CardData; featured: boolean; priority: boolean; playing: boolean }) {
  return <Link href={cataloguePath(card)} className={`group flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-white/10 bg-site-raised transition-colors hover:border-white/25 ${featured ? "col-span-2 lg:row-span-2" : ""}`}>
    <div className={`relative min-h-0 overflow-hidden bg-site-sunken ${featured ? "aspect-[16/10] lg:aspect-auto lg:flex-1" : "aspect-[16/10]"}`}>
      <CardMedia name={card.name} thumb={card.thumb} srcSet={card.thumbSrcSet} sizes={featured ? "(min-width: 1280px) 620px, (min-width: 1024px) 50vw, 100vw" : "(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw"} video={playing ? card.video : null} platform={card.platform} priority={priority} />
    </div>
    <div className="border-t border-white/[0.06] px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="flex min-w-0 items-center justify-between gap-2"><h3 className="min-w-0 text-[13px] font-medium leading-snug tracking-[-0.02em] sm:text-[15px]">{card.name}</h3><span className="hidden shrink-0 sm:inline-flex"><TierBadge tier={card.tier} /></span></div>
      <p className="mt-1.5 font-mono text-[10px] text-site-fg-3 sm:text-[11px]">{card.platform === "mobile" ? "React Native" : CATEGORIES[card.category].label}<span className="sm:hidden"> · {card.tier === "pro" ? "Pro" : "Free"}</span></p>
    </div>
  </Link>;
}
