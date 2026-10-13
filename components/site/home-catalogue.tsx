"use client";

import { SiteLink as Link } from "@/components/site/site-link";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { CardMedia } from "./card-media";
import { videoAllowed } from "./card-playback";
import { TierBadge } from "./component-card";
import { cataloguePath } from "@/lib/catalogue-path";
import { advanceConveyor } from "@/lib/conveyor-motion";
import type { CardData } from "@/lib/registry";

/** Visible clips autoplay within the shared decoder budget. Touch readers get
 * native swipe rows; reduced motion and Save-Data retain still artwork. */
export function HomeCatalogue({ groups }: { groups: { id: string; label: string; cards: CardData[]; href: string }[] }) {
  const [paused, setPaused] = useState(false);
  const [stationary, setStationary] = useState(true);
  const [canPlay, setCanPlay] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(max-width: 47.999rem), (prefers-reduced-motion: reduce), (hover: none)");
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const update = () => { setStationary(preference.matches || !!connection?.saveData); setCanPlay(videoAllowed()); };
    update();
    preference.addEventListener("change", update);
    motionPreference.addEventListener("change", update);
    connection?.addEventListener("change", update);
    return () => { preference.removeEventListener("change", update); motionPreference.removeEventListener("change", update); connection?.removeEventListener("change", update); };
  }, []);
  return <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden">
    <div className="mx-auto mb-4 flex max-w-[80rem] flex-wrap items-center justify-between gap-3 px-5 sm:px-8">
      <p className="text-[13px] text-site-fg-3">{stationary ? "Swipe or scroll to explore. Open any design to try it." : "A little of what you can build. Hover to pause the conveyor."}</p>
      {(!stationary || canPlay) && <button type="button" onClick={() => setPaused((current) => !current)} className="inline-flex min-h-11 items-center gap-2 rounded-md text-[13px] text-site-fg-2 hover:text-site-fg">{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}{stationary ? (paused ? "Play previews" : "Pause previews") : (paused ? "Resume conveyor" : "Pause conveyor")}</button>}
    </div>
    <div className="space-y-4 sm:space-y-5">{groups.slice(0, 2).map((group, index) => <ConveyorRow key={group.id} cards={group.cards} label={group.label} index={index} paused={paused || !canPlay} stationary={stationary} />)}</div>
    <div className="mx-auto mt-5 flex max-w-[80rem] flex-wrap justify-between gap-3 px-5 sm:px-8"><Link href="/components" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-site-fg-2 hover:text-site-fg">Explore all components <span aria-hidden="true">↗</span></Link><Link href="/categories/mobile" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-site-fg-3 hover:text-site-fg">React Native collection <span aria-hidden="true">→</span></Link></div>
  </div>;
}

function ConveyorRow({ cards, label, index, paused, stationary }: { cards: CardData[]; label: string; index: number; paused: boolean; stationary: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const realSet = useRef<HTMLDivElement>(null);
  const state = useRef({ position: 0, velocity: 0, period: 0, hover: false, focus: false, visible: true });
  const wake = useRef<() => void>(() => {});
  const [copies, setCopies] = useState(3);

  useEffect(() => {
    const root = viewport.current, belt = track.current, set = realSet.current;
    if (!root || !belt || !set) return;
    if (stationary) {
      belt.style.transform = "none"; root.scrollLeft = 0;
      if (root.contains(document.activeElement)) (document.activeElement as HTMLElement)?.scrollIntoView({ block: "nearest", inline: "center" });
      return;
    }
    root.scrollLeft = 0;
    let frame = 0, previous = performance.now();
    const paint = () => { belt.style.transform = `translate3d(${-state.current.period - state.current.position}px,0,0)`; };
    const tick = (now: number) => {
      frame = 0;
      const motion = state.current;
      if (!motion.visible || document.hidden) return;
      const held = paused || motion.hover || motion.focus;
      if (!motion.focus) {
        const next = advanceConveyor(motion.position, motion.velocity, held ? 0 : (index ? -46 : 40), (now - previous) / 1000, motion.period);
        motion.position = next.position; motion.velocity = next.velocity;
      } else motion.velocity = 0;
      previous = now; paint();
      if (!held || Math.abs(motion.velocity) > .01) frame = requestAnimationFrame(tick);
    };
    const start = () => { if (!frame && state.current.visible && !document.hidden) { previous = performance.now(); frame = requestAnimationFrame(tick); } };
    wake.current = start;
    const measure = () => {
      state.current.period = set.offsetWidth;
      setCopies(state.current.period > 0 ? Math.max(3, Math.ceil(root.clientWidth / state.current.period) + 2) : 3);
      const link = document.activeElement as HTMLElement | null;
      if (state.current.focus && link && root.contains(link)) state.current.position = link.offsetLeft - state.current.period - (root.clientWidth - link.offsetWidth) / 2;
      paint(); start();
    };
    measure();
    const resize = new ResizeObserver(measure); resize.observe(set); resize.observe(root);
    const visibility = new IntersectionObserver(([entry]) => {
      state.current.visible = entry.isIntersecting;
      if (entry.isIntersecting) start(); else { cancelAnimationFrame(frame); frame = 0; }
    });
    visibility.observe(root);
    const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else start(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); visibility.disconnect(); document.removeEventListener("visibilitychange", onVisibility); wake.current = () => {}; };
  }, [index, paused, stationary]);

  const set = (copy: number) => <div key={copy} ref={copy === 1 ? realSet : undefined} aria-hidden={copy !== 1 || undefined} className="flex shrink-0 gap-4 pr-4 sm:gap-5 sm:pr-5">{cards.map((card, cardIndex) => <ConveyorCard key={card.slug} card={card} duplicate={copy !== 1} allowVideo={!paused} priority={cardIndex < 4 && index === 0} />)}</div>;
  return <div ref={viewport} role="region" aria-label={label} data-conveyor-row={index} className={`relative [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${stationary ? "overflow-x-auto overflow-y-hidden px-5 sm:px-8" : "overflow-clip [mask-image:linear-gradient(to_right,transparent,#000_5%,#000_95%,transparent)]"}`}
    onPointerEnter={(event) => { if (event.pointerType !== "touch") { state.current.hover = true; wake.current(); } }}
    onPointerLeave={() => { state.current.hover = false; wake.current(); }}
    onFocusCapture={(event) => {
      if (stationary) return;
      const link = (event.target as HTMLElement).closest("a");
      if (!link || !viewport.current || !link.matches(":focus-visible")) return;
      state.current.focus = true; state.current.velocity = 0;
      // Canonical links stay reachable even when the conveyor has carried them away.
      state.current.position = link.offsetLeft - state.current.period - (viewport.current.clientWidth - link.offsetWidth) / 2;
      track.current!.style.transform = `translate3d(${-state.current.period - state.current.position}px,0,0)`;
      viewport.current.scrollLeft = 0; wake.current();
    }}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { state.current.focus = false; wake.current(); } }}>
    <div ref={track} data-conveyor-track className="relative flex w-max motion-safe:will-change-transform">{stationary ? set(1) : Array.from({ length: copies }, (_, copy) => set(copy))}</div>
  </div>;
}

function ConveyorCard({ card, duplicate, allowVideo, priority }: { card: CardData; duplicate: boolean; allowVideo: boolean; priority: boolean }) {
  const native = card.platform === "mobile";
  return <Link href={cataloguePath(card)} tabIndex={duplicate ? -1 : undefined} aria-label={`Explore ${card.name}, ${card.tier === "pro" ? "Pro" : "Free"}`} className={`group flex shrink-0 flex-col overflow-hidden rounded-[18px] border border-white/10 bg-site-raised transition-colors hover:border-white/30 focus-visible:border-site-accent ${native ? "w-[180px] sm:w-[220px] xl:w-[240px]" : "w-[280px] sm:w-[360px] xl:w-[420px]"}`}>
    <div className={`relative h-[175px] overflow-hidden bg-site-sunken sm:h-[225px] xl:h-[262px] ${native ? "[&_img]:object-cover [&_img]:object-center [&_img]:py-0 [&_video]:object-cover [&_video]:object-center [&_video]:py-0" : ""}`}><CardMedia name={card.name} thumb={card.thumb} srcSet={card.thumbSrcSet} sizes="(min-width:1280px) 420px, (min-width:640px) 360px, 280px" video={allowVideo ? card.conveyorVideo ?? card.video : null} compact={!!card.conveyorVideo} platform={card.platform} priority={priority} /></div>
    <div className="flex min-h-[64px] items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3"><h3 className="min-w-0 text-[14px] font-medium leading-snug tracking-[-0.02em] sm:text-[15px]">{card.name}</h3><TierBadge tier={card.tier} /></div>
  </Link>;
}
