"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { CardData } from "@/lib/registry";
import { ComponentCard } from "./component-card";

const SHELF_IMAGE_SIZES = "(min-width: 1680px) calc((100vw - 384px) / 4.2), (min-width: 1280px) calc((100vw - 368px) / 3.2), (min-width: 1024px) calc((100vw - 352px) / 2.2), (min-width: 640px) calc((100vw - 96px) / 2.2), calc((100vw - 40px) * 0.86)";

/** A finite, manually browsed row. Native overflow also supports touch and Tab. */
export function ComponentShelf({ title, cards, onBrowse, priority = false }: {
  title: string;
  cards: CardData[];
  onBrowse: () => void;
  priority?: boolean;
}) {
  const id = useId();
  const track = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      const back = element.scrollLeft > 2;
      const forward = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
      setCanScroll(previous => previous.back === back && previous.forward === forward ? previous : { back, forward });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(element);
    return () => { element.removeEventListener("scroll", update); resize.disconnect(); };
  }, [cards.length]);

  const move = (direction: number) => {
    const element = track.current;
    const card = element?.firstElementChild;
    if (!element || !card) return;
    const step = card.getBoundingClientRect().width + 16;
    const perPage = Math.max(1, Math.floor(element.clientWidth / step));
    element.scrollBy({ left: direction * step * perPage, behavior: reduce ? "instant" : "smooth" });
  };

  return (
    <section aria-labelledby={`${id}-title`} className={priority ? "site-in [--i:4]" : "site-reveal"}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="text-[18px] font-medium tracking-[-0.025em]">{title}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onBrowse} aria-label={`View all ${title.toLowerCase()}`} className="site-btn site-btn-ghost h-11 gap-1.5 px-2 text-[13px] font-normal text-site-fg-2 sm:mr-2 sm:h-8">
            View all <span aria-hidden="true">→</span>
          </button>
          {([-1, 1] as const).map(direction => (
            <button
              key={direction}
              type="button"
              aria-label={`${direction === -1 ? "Previous" : "Next"} ${title.toLowerCase()}`}
              aria-controls={`${id}-track`}
              disabled={direction === -1 ? !canScroll.back : !canScroll.forward}
              onClick={() => move(direction)}
              className="flex size-11 items-center justify-center rounded-lg border border-white/10 text-site-fg-2 transition-[background-color,color,scale] duration-150 hover:bg-white/[0.06] hover:text-site-fg active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent motion-reduce:!scale-100 sm:size-8"
            >
              <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden="true"><path d={direction === -1 ? "m10 4-4 4 4 4" : "m6 4 4 4-4 4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ))}
        </div>
      </div>
      <ul ref={track} id={`${id}-track`} className="component-shelf-track -mx-1 grid auto-cols-[86%] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 pt-1 [scrollbar-width:none] sm:auto-cols-[calc((100%-32px)/2.2)] lg:auto-cols-[calc((100%-32px)/2.2)] xl:auto-cols-[calc((100%-48px)/3.2)] min-[105rem]:auto-cols-[calc((100%-64px)/4.2)] [&::-webkit-scrollbar]:hidden">
        {cards.map((card, index) => (
          <li key={card.slug} className="flex min-w-0">
            <ComponentCard c={card} priority={priority && index < 3} imageSizes={SHELF_IMAGE_SIZES} />
          </li>
        ))}
      </ul>
    </section>
  );
}
