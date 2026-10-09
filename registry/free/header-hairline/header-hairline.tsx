"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type HeaderLink = { label: string; href: string };

export type HeaderHairlineProps = {
  brand?: { name: string; href: string };
  links?: HeaderLink[];
  /** Controlled current route. Leave undefined to let the header track clicks itself. */
  activeIndex?: number;
  /** Starting route when uncontrolled. */
  defaultActiveIndex?: number;
  /** Called when a link is chosen, with its index. */
  onNavigate?: (index: number, link: HeaderLink) => void;
  /** Text inside the search chip (shown on wide screens). */
  searchLabel?: string;
  /** Fired by the chip and by ⌘K / Ctrl K anywhere on the page. */
  onSearch?: () => void;
  signIn?: { label: string; href: string };
  cta?: { label: string; href: string };
  /** Scroll distance in px after which the hairline, blur and condensed height kick in. */
  condenseAt?: number;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const COLOR = {
  page: "#000000",
  /** The scrolled surface: black at 72% under a backdrop blur. */
  surface: "rgba(0,0,0,0.72)",
  menu: "#000000",
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
/** The hover highlight's two edges: the leading one is stiffer, so it stretches toward where you're going. */
const EDGE = { lead: { type: "spring", stiffness: 660, damping: 46 }, trail: { type: "spring", stiffness: 320, damping: 31 } } as const;

const HEIGHT = { tall: 64, short: 56 } as const;
const DESKTOP = 896; // px: matches the @4xl container breakpoint

/** First-view choreography, in seconds: wordmark, then links, then the right cluster lands last. */
const INTRO = {
  item: 0.45,
  rise: 8, // px
  blur: 6, // px
  brandAt: 0.04,
  linksAt: 0.12,
  stagger: 0.045,
  actionsAt: 0.36,
  fade: 0.15, // reduced motion
} as const;

/** Opacity, an 8px rise and a 6px blur that clears. `custom` is the delay in seconds. */
const RISE: Variants = {
  hidden: { opacity: 0, y: INTRO.rise, filter: `blur(${INTRO.blur}px)` },
  shown: (delay: number = 0) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: INTRO.item, ease: EASE_OUT, delay } }),
};
const FADE: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: INTRO.fade } } };
const riseVariants = (reduce: boolean) => (reduce ? FADE : RISE);

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** True once the page has scrolled past `at`. Re-renders only when the answer flips. */
function useCondensed(at: number) {
  const [condensed, setCondensed] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setCondensed(v > at));
  useEffect(() => setCondensed(window.scrollY > at), [at]);
  return condensed;
}

/** ⌘K / Ctrl K anywhere calls `onSearch`; returns whether the key is held, so the kbd chip can press in. */
function useCommandK(onSearch?: () => void) {
  const [held, setHeld] = useState(false);
  const [mac, setMac] = useState(true); // default ⌘ so the server render matches Apple platforms
  useEffect(() => setMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)), []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setHeld(true);
        onSearch?.();
      }
    };
    const up = () => setHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", up);
    };
  }, [onSearch]);
  return { held, mac };
}

/** Mobile menu: lock scroll, trap Tab inside the header, Esc closes, close if the bar grows to desktop. */
function useMenuBehaviour(open: boolean, scope: RefObject<HTMLElement | null>, bar: RefObject<HTMLElement | null>, close: (refocus?: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        return close();
      }
      const el = scope.current;
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>("a[href]:not([tabindex='-1']), button:not([disabled])")).filter(
        (n) => n.offsetParent !== null && n.getClientRects().length > 0,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const outside = !el.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    const ro = new ResizeObserver(([entry]) => entry.contentRect.width >= DESKTOP && close(false));
    if (bar.current) ro.observe(bar.current);
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  }, [open, scope, bar, close]);
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function HeaderHairline({
  brand = { name: "Kestrel", href: "#" },
  links = [
    { label: "Product", href: "#product" },
    { label: "Docs", href: "#docs" },
    { label: "Customers", href: "#customers" },
    { label: "Pricing", href: "#pricing" },
    { label: "Changelog", href: "#changelog" },
  ],
  activeIndex,
  defaultActiveIndex = 1,
  onNavigate,
  searchLabel = "Search docs",
  onSearch,
  signIn = { label: "Sign in", href: "#login" },
  cta = { label: "Start deploying", href: "#signup" },
  condenseAt = 8,
  className = "",
}: HeaderHairlineProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const menuId = `${uid}-menu`;
  const [innerActive, setInnerActive] = useState(defaultActiveIndex);
  const active = activeIndex ?? innerActive;
  const [open, setOpen] = useState(false);
  const scrolled = useCondensed(condenseAt);
  const { held, mac } = useCommandK(onSearch);
  const headerRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const rise = riseVariants(reduce);

  const choose = (i: number, e?: ReactMouseEvent) => {
    if (e && links[i].href.startsWith("#")) e.preventDefault();
    if (activeIndex === undefined) setInnerActive(i);
    onNavigate?.(i, links[i]);
  };

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) burgerRef.current?.focus();
  }, []);
  useMenuBehaviour(open, headerRef, barRef, close);

  const solid = scrolled || open;
  const height = scrolled ? HEIGHT.short : HEIGHT.tall;
  const at = (k: number) => INTRO.actionsAt + k * INTRO.stagger;

  return (
    <header ref={headerRef} className={`sticky top-0 z-40 w-full text-white ${className}`}>
      {/* Surface: transparent at rest; hairline + blur fade in once the page moves. Never transition backdrop-filter itself. */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ opacity: solid ? 1 : 0 }}
        transition={{ duration: reduce ? INTRO.fade : solid ? 0.24 : 0.16, ease: solid ? EASE_OUT : EASE_IN }}
        style={{ backgroundColor: open ? COLOR.menu : COLOR.surface }}
        className="pointer-events-none absolute inset-0 border-b border-white/[0.09] backdrop-blur-xl backdrop-saturate-150"
      />

      <motion.div
        ref={barRef}
        initial={false}
        animate={{ height }}
        transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE_OUT }}
        style={{ height: HEIGHT.tall }}
        className="@container relative mx-auto flex w-full max-w-[1280px] items-center px-4 sm:px-6"
      >
        <div className="grid w-full grid-cols-[1fr_auto] items-center gap-4 @min-[896px]:grid-cols-[auto_1fr_auto] @min-[1200px]:grid-cols-[1fr_auto_1fr]">
          <motion.a
            href={brand.href}
            variants={rise}
            initial="hidden"
            animate="shown"
            custom={INTRO.brandAt}
            className="group -ml-1.5 flex h-10 w-max items-center gap-2 rounded-md px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Mark />
            <span className="font-display text-[17px] font-semibold leading-none tracking-[-0.04em]">{brand.name}</span>
          </motion.a>

          <HoverLinks links={links} active={active} onChoose={choose} reduce={reduce} groupId={uid} />

          <div className="flex items-center justify-end gap-1.5 @4xl:gap-2">
            <Landing variants={rise} delay={at(0)}>
              <SearchChip label={searchLabel} mac={mac} held={held} onSearch={onSearch} />
            </Landing>
            <Landing variants={rise} delay={at(1)} className="hidden @4xl:block">
              <a
                href={signIn.href}
                className="flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-[13.5px] text-white/65 outline-none transition-[color,background-color,transform] duration-150 hover:bg-white/[0.04] hover:text-white active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {signIn.label}
              </a>
            </Landing>
            <Landing variants={rise} delay={at(2)} className="hidden @2xl:block">
              <a
                href={cta.href}
                tabIndex={open ? -1 : undefined}
                aria-hidden={open || undefined}
                className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-3.5 text-[13.5px] font-medium tracking-[-0.01em] text-black shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] outline-none transition-[background-color,transform,opacity] duration-150 hover:bg-[#e8e8ea] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  open ? "pointer-events-none opacity-0" : ""
                }`}
              >
                {cta.label}
              </a>
            </Landing>
            <Landing variants={rise} delay={at(1)} className="@4xl:hidden">
              <Burger ref={burgerRef} open={open} controls={menuId} reduce={reduce} onToggle={() => setOpen((o) => !o)} />
            </Landing>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {open ? (
          <MobileMenu
            id={menuId}
            top={height}
            links={links}
            active={active}
            signIn={signIn}
            cta={cta}
            reduce={reduce}
            onChoose={(i, e) => {
              choose(i, e);
              close();
            }}
          />
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function Landing({ variants, delay, className, children }: { variants: Variants; delay: number; className?: string; children: ReactNode }) {
  return (
    <motion.div variants={variants} initial="hidden" animate="shown" custom={delay} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Centre links: one highlight that travels between them. Its two      */
/* edges run on separate springs, so the highlight stretches toward    */
/* where you're going and settles on arrival.                          */
/* ------------------------------------------------------------------ */

function HoverLinks({
  links,
  active,
  onChoose,
  reduce,
  groupId,
}: {
  links: HeaderLink[];
  active: number;
  onChoose: (i: number, e: ReactMouseEvent) => void;
  reduce: boolean;
  groupId: string;
}) {
  // Measure the <li>s, not the links: each li carries the entrance filter, which makes it the
  // links' offsetParent, so a link's offsetLeft would always read 0.
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  // The current-route dot pops in once, after its link lands; later route changes glide via layoutId instead.
  const [dotLanded, setDotLanded] = useState(false);
  const shown = useRef(false);
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const width = useTransform(() => Math.max(0, right.get() - left.get()));
  const opacity = useMotionValue(0);
  const rise = riseVariants(reduce);

  const moveTo = useCallback(
    (i: number | null) => {
      const el = i === null ? null : itemRefs.current[i];
      if (!el) {
        shown.current = false;
        animate(opacity, 0, { duration: reduce ? 0.1 : 0.16, ease: EASE_IN });
        return;
      }
      const L = el.offsetLeft;
      const R = L + el.offsetWidth;
      if (!shown.current || reduce) {
        // Appear in place; only glide once it is already visible.
        left.jump(L);
        right.jump(R);
        shown.current = true;
        animate(opacity, 1, { duration: reduce ? 0.1 : 0.14, ease: EASE_OUT });
        return;
      }
      const goingRight = L > left.get();
      animate(left, L, goingRight ? EDGE.trail : EDGE.lead);
      animate(right, R, goingRight ? EDGE.lead : EDGE.trail);
      animate(opacity, 1, { duration: 0.12 });
    },
    [left, right, opacity, reduce],
  );

  useLayoutEffect(() => {
    moveTo(hovered);
  }, [hovered, moveTo]);

  return (
    <nav aria-label="Main" className="hidden justify-center @4xl:flex">
      <LayoutGroup id={groupId}>
        <ul className="relative flex items-center" onPointerLeave={() => setHovered(null)}>
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-white/[0.075]"
            style={{ x: left, width, opacity }}
          />
          {links.map((l, i) => {
            const delay = INTRO.linksAt + i * INTRO.stagger;
            return (
              <motion.li
                key={l.href}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                variants={rise}
                initial="hidden"
                animate="shown"
                custom={delay}
              >
                <a
                  href={l.href}
                  aria-current={i === active ? "page" : undefined}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(i)}
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHovered(i)}
                  onBlur={() => setHovered(null)}
                  onClick={(e) => onChoose(i, e)}
                  className={`relative flex h-10 items-center whitespace-nowrap rounded-lg px-3 text-[13.5px] tracking-[-0.005em] outline-none transition-[color,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                    hovered === i || i === active ? "text-white" : "text-white/55"
                  }`}
                >
                  {l.label}
                  {i === active ? (
                    <motion.span
                      layoutId="hh-active"
                      aria-hidden="true"
                      initial={dotLanded || reduce ? false : { scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onAnimationComplete={() => setDotLanded(true)}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { ...SPRING_UI, scale: { duration: 0.3, ease: EASE_OUT, delay: delay + INTRO.item * 0.6 }, opacity: { duration: 0.2, delay: delay + INTRO.item * 0.6 } }
                      }
                      className="absolute bottom-[3px] left-1/2 -ml-[2px] size-1 rounded-full bg-white"
                    />
                  ) : null}
                </a>
              </motion.li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Search chip: a 44px icon button on narrow bars, a labelled chip with */
/* a ⌘K key that physically presses in on wide ones.                    */
/* ------------------------------------------------------------------ */

function SearchChip({ label, mac, held, onSearch }: { label: string; mac: boolean; held: boolean; onSearch?: () => void }) {
  return (
    <button
      type="button"
      onClick={() => onSearch?.()}
      aria-label={`${label} (${mac ? "Command" : "Control"} K)`}
      aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      className={`group/s flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2.5 text-[13px] text-white/55 outline-none transition-[background-color,color,transform,box-shadow] duration-150 hover:text-white active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black @4xl:h-8 @4xl:min-w-0 @4xl:justify-start @4xl:pl-2.5 @4xl:pr-1 @4xl:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] @4xl:hover:bg-white/[0.04] @4xl:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] ${
        held ? "text-white @4xl:bg-white/[0.05]" : ""
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-[18px] @4xl:size-[14px]" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="hidden whitespace-nowrap pr-6 @min-[1200px]:inline">{label}</span>
      <kbd
        className={`hidden h-6 min-w-[2.25rem] items-center justify-center gap-0.5 rounded-[5px] bg-white/[0.06] px-1.5 font-mono text-[11px] font-medium text-white/60 transition-[transform,box-shadow,background-color] duration-100 group-hover/s:text-white/80 @4xl:inline-flex ${
          held
            ? "translate-y-px bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.12)]"
            : "shadow-[inset_0_-1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.1),0_1px_0_rgba(0,0,0,0.6)]"
        }`}
      >
        <span className={mac ? "text-[12px]" : "mr-[3px]"}>{mac ? "⌘" : "Ctrl"}</span>K
      </kbd>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Burger: two lines that cross.                                        */
/* ------------------------------------------------------------------ */

function Burger({ ref, open, controls, reduce, onToggle }: { ref: RefObject<HTMLButtonElement | null>; open: boolean; controls: string; reduce: boolean; onToggle: () => void }) {
  const line = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 500, damping: 34 } as const);
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={onToggle}
      className="-mr-2 flex size-11 items-center justify-center rounded-lg text-white/80 outline-none transition-[background-color,color,transform] duration-150 hover:bg-white/[0.05] hover:text-white active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <span className="relative block h-4 w-[18px]" aria-hidden="true">
        <motion.span
          initial={false}
          animate={open ? { y: 0, rotate: 45 } : { y: -3.5, rotate: 0 }}
          transition={line}
          className="absolute inset-x-0 top-1/2 -mt-[0.75px] h-[1.5px] rounded-full bg-current"
        />
        <motion.span
          initial={false}
          animate={open ? { y: 0, rotate: -45 } : { y: 3.5, rotate: 0 }}
          transition={line}
          className="absolute inset-x-0 top-1/2 -mt-[0.75px] h-[1.5px] rounded-full bg-current"
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile menu: rows stagger in from a blur, then the two buttons.      */
/* ------------------------------------------------------------------ */

const MENU = { at: 0.04, stagger: 0.045 } as const;

function MobileMenu({
  id,
  top,
  links,
  active,
  signIn,
  cta,
  reduce,
  onChoose,
}: {
  id: string;
  top: number;
  links: HeaderLink[];
  active: number;
  signIn: { label: string; href: string };
  cta: { label: string; href: string };
  reduce: boolean;
  onChoose: (i: number, e: ReactMouseEvent) => void;
}) {
  const rise = riseVariants(reduce);
  const exit = { opacity: 0, transition: { duration: 0.1 } };
  return (
    <motion.div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: 0.16, ease: EASE_IN } }}
      style={{ top, backgroundColor: COLOR.menu }}
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-y-auto overscroll-contain px-4 pb-[max(24px,env(safe-area-inset-bottom))] sm:px-6"
    >
      <nav aria-label="Main">
        <ul className="flex flex-col pt-2">
          {links.map((l, i) => (
            <motion.li key={l.href} variants={rise} initial="hidden" animate="shown" exit={exit} custom={MENU.at + i * MENU.stagger} className="border-b border-white/[0.08]">
              <a
                href={l.href}
                aria-current={i === active ? "page" : undefined}
                onClick={(e) => onChoose(i, e)}
                className="group flex h-14 items-center justify-between rounded-md text-[20px] font-medium tracking-[-0.025em] text-white/75 outline-none transition-colors duration-150 hover:text-white active:text-white/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 aria-[current=page]:text-white"
              >
                <span className="flex items-center gap-3">
                  {l.label}
                  {i === active ? <span aria-hidden="true" className="size-[5px] rounded-full bg-white" /> : null}
                </span>
                <svg viewBox="0 0 16 16" className="size-4 text-white/30 transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-white/70" fill="none" aria-hidden="true">
                  <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </motion.li>
          ))}
        </ul>
      </nav>
      <motion.div variants={rise} initial="hidden" animate="shown" exit={exit} custom={MENU.at + (links.length + 1) * MENU.stagger} className="mt-auto grid gap-2 pt-10">
        <a
          href={signIn.href}
          className="flex h-12 items-center justify-center rounded-xl text-[15px] font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] outline-none transition-[background-color,transform] duration-150 hover:bg-white/[0.04] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {signIn.label}
        </a>
        <a
          href={cta.href}
          className="flex h-12 items-center justify-center rounded-xl bg-white text-[15px] font-medium text-black outline-none transition-[background-color,transform] duration-150 hover:bg-[#e8e8ea] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {cta.label}
        </a>
      </motion.div>
    </motion.div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[22px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-px" aria-hidden="true">
      <path d="M3.5 19.5 12.2 4.5h4.3l-8.7 15Z" fill="currentColor" />
      <path d="M11.2 19.5 16.3 10.7h4.2l-5.1 8.8Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: one docs article to scroll past, so the hairline, blur and     */
/* condensed height can be seen arriving. Its blocks land after the     */
/* header, then reveal once on scroll. Stage only, not part of the API. */
/* ------------------------------------------------------------------ */

const PAGE = { at: 0.34, stagger: 0.06 } as const;
/** When the page's own first-view sequence ends; blocks already on screen at load wait for it. */
const PAGE_END = PAGE.at + PAGE.stagger * 4;

/** Reveal once at 25% visibility; returns the start delay, or null while hidden. */
function useRevealOnce(ref: RefObject<HTMLElement | null>, startedAt: number) {
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const [delay, setDelay] = useState<number | null>(null);
  useEffect(() => {
    if (inView) setDelay(Math.max(0, PAGE_END - (performance.now() - startedAt) / 1000));
  }, [inView, startedAt]);
  return delay;
}

function Reveal({ startedAt, reduce, className, children }: { startedAt: number; reduce: boolean; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const delay = useRevealOnce(ref, startedAt);
  return (
    <motion.div ref={ref} variants={riseVariants(reduce)} initial="hidden" animate={delay === null ? "hidden" : "shown"} custom={delay ?? 0} className={className}>
      {children}
    </motion.div>
  );
}

const CLI = [
  { prompt: true, text: "kestrel rollback --to dpl_8f2c41" },
  { prompt: false, text: "  Found dpl_8f2c41  main · 2 days ago" },
  { prompt: false, text: "  Promoted to production in 1.4s" },
];

function Demo() {
  const reduce = useReducedMotion() ?? false;
  const rise = riseVariants(reduce);
  const [startedAt] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
  const intro = (k: number) => PAGE.at + k * PAGE.stagger;
  return (
    <div className="min-h-[1500px] text-white" style={{ backgroundColor: COLOR.page }}>
      <HeaderHairline />
      <article className="mx-auto max-w-[1280px] px-4 pb-40 pt-14 sm:px-6 sm:pt-20">
        <div className="max-w-[680px]">
          <motion.p variants={rise} initial="hidden" animate="shown" custom={intro(0)} className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
            Docs <span className="text-white/20">/</span> Deployments <span className="text-white/20">/</span> <span className="text-white/70">Rollbacks</span>
          </motion.p>
          <motion.h1
            variants={rise}
            initial="hidden"
            animate="shown"
            custom={intro(1)}
            className="mt-6 text-balance font-display text-[clamp(2.25rem,1.5rem+3vw,3.75rem)] font-semibold leading-[1] tracking-[-0.045em]"
          >
            Roll back a deploy in one command
          </motion.h1>
          <motion.p variants={rise} initial="hidden" animate="shown" custom={intro(2)} className="mt-6 text-[17px] leading-[1.65] text-white/60">
            Every deploy on Kestrel is immutable, so a rollback is a pointer move rather than a rebuild. Production switches back in under two seconds and keeps its domains, secrets and
            cache.
          </motion.p>
          <motion.p variants={rise} initial="hidden" animate="shown" custom={intro(3)} className="mt-6 font-mono text-[12px] tabular-nums text-white/40">
            6 min read · Updated 3 Oct 2026
          </motion.p>

          <Reveal startedAt={startedAt} reduce={reduce} className="mt-14 border-t border-white/[0.09] pt-10">
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em]">From the command line</h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-white/60">
              Pass the deploy you want back. Kestrel checks that its build still exists, promotes it, and leaves the broken one in place so you can read its logs afterwards.
            </p>
          </Reveal>
          <Reveal startedAt={startedAt} reduce={reduce} className="mt-6">
            <pre className="overflow-x-auto rounded-xl bg-white/[0.035] p-5 font-mono text-[13px] leading-[1.8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <code>
                {CLI.map((l) => (
                  <span key={l.text} className={`block whitespace-pre ${l.prompt ? "text-white" : "text-white/45"}`}>
                    {l.prompt ? <span className="select-none text-white/30">$ </span> : null}
                    {l.text}
                  </span>
                ))}
              </code>
            </pre>
          </Reveal>
          <Reveal startedAt={startedAt} reduce={reduce} className="mt-14">
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em]">What stays the same</h2>
            <ul className="mt-5 grid gap-3 text-[16px] leading-[1.6] text-white/60">
              {[
                ["Domains", "every alias points at the restored deploy within one request."],
                ["Secrets", "environment variables are read from the project, not the build."],
                ["Cache", "edge caches are keyed by deploy, so nothing stale is served."],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-4">
                  <span className="w-20 shrink-0 font-mono text-[12px] uppercase leading-[1.6rem] tracking-[0.1em] text-white/40">{k}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal startedAt={startedAt} reduce={reduce} className="mt-14">
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em]">When a rollback isn’t enough</h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-white/60">
              Database migrations don’t roll back with the code. If the bad deploy changed a schema, restore from the snapshot Kestrel took before it ran, then roll back the deploy.
            </p>
          </Reveal>
        </div>
      </article>
    </div>
  );
}

export default Demo;
