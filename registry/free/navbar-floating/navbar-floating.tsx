"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type NavLink = { label: string; href: string; /** Optional small count set in superscript, e.g. a number of projects. */ count?: string };
type Social = { label: string; href: string };
type Contact = { email: string; phone: string; address: string[] };

export type NavbarFloatingProps = {
  brand?: { name: string; href: string };
  links?: NavLink[];
  /** Index of the link for the current page. Gets an underline and aria-current. */
  activeIndex?: number;
  cta?: { label: string; href: string };
  /** Shown in the mobile sheet under the big links. */
  contact?: Contact;
  socials?: Social[];
  /** Scroll distance in px after which the pill tucks itself in. */
  condenseAt?: number;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const COLOR = {
  /** The pill: near-black at 72% so the page reads through the blur. */
  bar: "rgba(12,12,14,0.72)",
  sheet: "#050506",
  page: "#050506",
} as const;

const SHADOW = {
  rest: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.08)",
  tucked: "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.1), 0 24px 60px -20px rgba(0,0,0,0.9)",
} as const;

const WIDTH = { full: 1200, tucked: 720, intro: 640 } as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** First-view choreography, in seconds: the pill settles, links follow, the action lands last. */
const INTRO = {
  bar: 0.5,
  item: 0.45,
  rise: 8, // px
  blur: 6, // px
  brandAt: 0.1,
  linksAt: 0.16,
  stagger: 0.05,
  actionAt: 0.42,
  fade: 0.15, // reduced motion
} as const;

/** Mobile sheet choreography: the wipe, then big links from their masks, then the rest. */
const SHEET = { wipe: 0.6, wipeOut: 0.4, linksAt: 0.18, linkStagger: 0.06, link: 0.6, restAt: 0.42, restStagger: 0.06 } as const;

const MD = "(min-width: 768px)";

/** Opacity, an 8px rise and a 6px blur that clears. `custom` is the delay in seconds. */
const RISE: Variants = {
  hidden: { opacity: 0, y: INTRO.rise, filter: `blur(${INTRO.blur}px)` },
  shown: (delay: number = 0) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: INTRO.item, ease: EASE_OUT, delay } }),
};
/** Reduced motion keeps the meaning (things appear) without the travel. */
const FADE: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: INTRO.fade } } };
const riseVariants = (reduce: boolean) => (reduce ? FADE : RISE);

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** True once the page has scrolled past `at`. Only re-renders when the answer flips. */
function useCondensed(at: number) {
  const [condensed, setCondensed] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setCondensed(v > at));
  useEffect(() => setCondensed(window.scrollY > at), [at]);
  return condensed;
}

/** While the sheet is open: lock page scroll, close on Esc, keep Tab inside the header, close if the viewport grows to desktop. */
function useSheetBehaviour(open: boolean, scope: RefObject<HTMLElement | null>, close: () => void, dismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab" || !scope.current) return;
      const items = Array.from(scope.current.querySelectorAll<HTMLElement>("[data-nf-focus]")).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const mq = window.matchMedia(MD);
    const onMq = () => mq.matches && dismiss();
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open, scope, close, dismiss]);
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function NavbarFloating({
  brand = { name: "Meridian", href: "#" },
  links = [
    { label: "Product", href: "#product" },
    { label: "Customers", href: "#customers", count: "1.2k" },
    { label: "Pricing", href: "#pricing" },
    { label: "Changelog", href: "#changelog" },
  ],
  activeIndex = 0,
  cta = { label: "Start free", href: "#signup" },
  contact = { email: "hello@meridian.app", phone: "+44 20 7946 0321", address: ["14 Hoxton Square", "London N1 6NT"] },
  socials = [
    { label: "X", href: "#" },
    { label: "GitHub", href: "#" },
    { label: "LinkedIn", href: "#" },
  ],
  condenseAt = 80,
}: NavbarFloatingProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const sheetId = `${uid}-sheet`;
  const condensed = useCondensed(condenseAt);
  const [open, setOpen] = useState(false);
  // The first width change is the entrance unfold (a tween the eye can follow); after that, condensing runs on spring.ui.
  const [landed, setLanded] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => setOpen(false), []);
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  useSheetBehaviour(open, headerRef, close, dismiss);

  const tucked = condensed && !open;
  const spring = reduce ? { duration: 0 } : SPRING_UI;
  const rise = riseVariants(reduce);

  return (
    <header ref={headerRef} className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-5">
      {/* The pill arrives a little narrower and springs out to full width while its contents land. */}
      <motion.nav
        aria-label="Main"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, maxWidth: WIDTH.intro }}
        animate={{ opacity: 1, y: 0, maxWidth: tucked ? WIDTH.tucked : WIDTH.full, paddingTop: tucked ? 6 : 8, paddingBottom: tucked ? 6 : 8 }}
        transition={{
          ...spring,
          maxWidth: landed || reduce ? spring : { duration: INTRO.bar + 0.15, ease: EASE_OUT },
          opacity: { duration: reduce ? INTRO.fade : INTRO.bar * 0.6, ease: EASE_OUT },
          y: { duration: INTRO.bar, ease: EASE_OUT },
        }}
        onAnimationComplete={() => setLanded(true)}
        style={{ backgroundColor: COLOR.bar, boxShadow: tucked ? SHADOW.tucked : SHADOW.rest }}
        className="pointer-events-auto relative z-10 flex w-full items-center justify-between gap-4 rounded-full pl-3 pr-2 text-white backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-500 sm:pl-4"
      >
        <motion.a
          href={brand.href}
          data-nf-focus
          variants={rise}
          initial="hidden"
          animate="shown"
          custom={INTRO.brandAt}
          className="group flex h-11 shrink-0 items-center gap-2.5 rounded-full pr-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <LogoMark />
          {/* The wordmark folds away when the bar tucks in, leaving the mark. */}
          <motion.span
            initial={false}
            animate={{ width: tucked ? 0 : "auto", opacity: tucked ? 0 : 1 }}
            transition={spring}
            className="overflow-hidden whitespace-nowrap font-display text-[17px] font-semibold leading-none tracking-[-0.03em]"
          >
            {brand.name}
          </motion.span>
          {tucked ? <span className="sr-only">{brand.name}</span> : null}
        </motion.a>

        <DesktopLinks links={links} activeIndex={activeIndex} reduce={reduce} groupId={uid} />

        <motion.div variants={rise} initial="hidden" animate="shown" custom={INTRO.actionAt} className="flex items-center gap-2">
          <a
            href={cta.href}
            className="group hidden h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-medium text-black shadow-[inset_0_-1px_0_rgba(0,0,0,0.14)] outline-none transition-[background-color,transform] duration-150 hover:bg-[#ececee] active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black md:inline-flex"
          >
            {cta.label}
            <span className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[3px]">
              <Arrow />
            </span>
          </a>
          <MenuButton ref={buttonRef} open={open} controls={sheetId} reduce={reduce} onToggle={() => setOpen((o) => !o)} />
        </motion.div>
      </motion.nav>

      <AnimatePresence>
        {open ? (
          <MobileSheet
            id={sheetId}
            links={links}
            activeIndex={activeIndex}
            cta={cta}
            contact={contact}
            socials={socials}
            reduce={reduce}
            onNavigate={dismiss}
          />
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop links: a hover pill slides between them on spring.ui.        */
/* ------------------------------------------------------------------ */

function DesktopLinks({ links, activeIndex, reduce, groupId }: { links: NavLink[]; activeIndex: number; reduce: boolean; groupId: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const rise = riseVariants(reduce);
  return (
    <LayoutGroup id={groupId}>
      <ul className="hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
        {links.map((l, n) => {
          const delay = INTRO.linksAt + n * INTRO.stagger;
          return (
            <motion.li key={l.label} variants={rise} initial="hidden" animate="shown" custom={delay} className="relative">
              <a
                href={l.href}
                aria-current={n === activeIndex ? "page" : undefined}
                onMouseEnter={() => setHovered(n)}
                onFocus={() => setHovered(n)}
                onBlur={() => setHovered(null)}
                className="relative flex h-10 items-center rounded-full px-4 text-[14px] text-white/70 outline-none transition-[color,transform] duration-150 hover:text-white active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-white/60 aria-[current=page]:text-white"
              >
                <AnimatePresence>
                  {hovered === n ? (
                    <motion.span
                      layoutId="nf-hover-pill"
                      className="absolute inset-0 rounded-full bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_IN } }}
                      transition={reduce ? { duration: 0 } : SPRING_UI}
                    />
                  ) : null}
                </AnimatePresence>
                <span className="relative">
                  {l.label}
                  {l.count ? <sup className="ml-1 font-mono text-[9.5px] font-normal tabular-nums text-white/40">{l.count}</sup> : null}
                </span>
                {n === activeIndex ? (
                  // The current-page rule draws from its centre once its link has landed.
                  <motion.span
                    aria-hidden="true"
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, ease: EASE_OUT, delay: delay + INTRO.item * 0.6 }}
                    className="absolute bottom-[3px] left-1/2 -ml-1.5 h-px w-3 rounded-full bg-white/70"
                  />
                ) : null}
              </a>
            </motion.li>
          );
        })}
      </ul>
    </LayoutGroup>
  );
}

/* ------------------------------------------------------------------ */
/* Menu button: the label rolls Menu → Close, two lines cross.          */
/* ------------------------------------------------------------------ */

function MenuButton({
  ref,
  open,
  controls,
  reduce,
  onToggle,
}: {
  ref: RefObject<HTMLButtonElement | null>;
  open: boolean;
  controls: string;
  reduce: boolean;
  onToggle: () => void;
}) {
  const line = reduce ? { duration: 0 } : { duration: 0.35, ease: EASE_OUT };
  const roll = "col-start-1 row-start-1 transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
  return (
    <button
      ref={ref}
      type="button"
      data-nf-focus
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="flex h-10 items-center gap-3 rounded-full bg-white/[0.07] pl-4 pr-3 text-[14px] font-medium outline-none ring-1 ring-inset ring-white/10 transition-[background-color,transform] duration-150 hover:bg-white/[0.12] active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-white/60 md:hidden"
    >
      <span className="relative inline-grid overflow-hidden">
        <span className={`${roll} ${open ? "-translate-y-full" : ""}`}>Menu</span>
        <span className={`${roll} ${open ? "" : "translate-y-full"}`} aria-hidden={!open}>
          Close
        </span>
      </span>
      <span className="relative block size-5" aria-hidden="true">
        <motion.span
          initial={false}
          animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -3.5 }}
          transition={line}
          className="absolute left-0.5 right-0.5 top-1/2 h-px rounded-full bg-current"
        />
        <motion.span
          initial={false}
          animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 3.5 }}
          transition={line}
          className="absolute left-0.5 right-0.5 top-1/2 h-px rounded-full bg-current"
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile sheet                                                         */
/* ------------------------------------------------------------------ */

function MobileSheet({
  id,
  links,
  activeIndex,
  cta,
  contact,
  socials,
  reduce,
  onNavigate,
}: {
  id: string;
  links: NavLink[];
  activeIndex: number;
  cta: { label: string; href: string };
  contact: Contact;
  socials: Social[];
  reduce: boolean;
  onNavigate: () => void;
}) {
  const rise = riseVariants(reduce);
  const restAt = (k: number) => SHEET.restAt + k * SHEET.restStagger;
  return (
    <motion.div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
      animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }}
      exit={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)", transition: { duration: SHEET.wipeOut, ease: EASE_IN, delay: 0.08 } }}
      transition={{ duration: reduce ? INTRO.fade : SHEET.wipe, ease: EASE_OUT }}
      style={{ backgroundColor: COLOR.sheet }}
      className="pointer-events-auto fixed inset-0 z-0 flex flex-col overflow-y-auto bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,255,255,0.06),transparent)] px-5 pb-8 pt-28 text-white md:hidden"
    >
      <ul className="flex flex-col">
        {links.map((l, n) => (
          <li key={l.label} className="overflow-hidden border-b border-white/[0.08]">
            {/* Each link rises out of its own mask, 60ms after the one above. */}
            <motion.a
              href={l.href}
              data-nf-focus
              autoFocus={n === 0}
              onClick={onNavigate}
              aria-current={n === activeIndex ? "page" : undefined}
              initial={reduce ? { opacity: 0 } : { y: "100%" }}
              animate={reduce ? { opacity: 1 } : { y: "0%" }}
              exit={reduce ? { opacity: 0 } : { y: "100%", transition: { duration: 0.3, ease: EASE_IN } }}
              transition={{ duration: reduce ? INTRO.fade : SHEET.link, ease: EASE_OUT, delay: reduce ? 0 : SHEET.linksAt + n * SHEET.linkStagger }}
              className="group flex items-baseline justify-between gap-4 py-4 outline-none focus-visible:bg-white/[0.05]"
            >
              <span className="flex items-baseline gap-3 font-display text-[clamp(2.25rem,11vw,3.5rem)] font-semibold leading-[1] tracking-[-0.05em]">
                <span>
                  {l.label}
                  {l.count ? <sup className="ml-1.5 align-super font-mono text-xs font-normal tracking-normal text-white/40">{l.count}</sup> : null}
                </span>
              </span>
              <span className="flex items-center gap-2 font-mono text-xs tabular-nums text-white/35">
                {n === activeIndex ? <span aria-hidden="true" className="size-1.5 rounded-full bg-white" /> : null}
                {String(n + 1).padStart(2, "0")}
              </span>
            </motion.a>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-12">
        <SheetBlock variants={rise} delay={restAt(0)}>
          <a
            href={cta.href}
            data-nf-focus
            onClick={onNavigate}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-black outline-none transition-transform duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {cta.label}
            <Arrow />
          </a>
        </SheetBlock>
        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 text-[14px] leading-snug text-white/75">
          <SheetBlock variants={rise} delay={restAt(1)}>
            <dt className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Say hello</dt>
            <dd>
              <a href={`mailto:${contact.email}`} data-nf-focus className="underline decoration-white/30 underline-offset-4 outline-none focus-visible:bg-white/10">
                {contact.email}
              </a>
            </dd>
            <dd className="mt-1">
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`} data-nf-focus className="tabular-nums outline-none focus-visible:bg-white/10">
                {contact.phone}
              </a>
            </dd>
          </SheetBlock>
          <SheetBlock variants={rise} delay={restAt(2)}>
            <dt className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Visit</dt>
            {contact.address.map((line) => (
              <dd key={line}>{line}</dd>
            ))}
          </SheetBlock>
        </dl>
        <SheetBlock variants={rise} delay={restAt(3)}>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.08] pt-5 text-[14px] text-white/75">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} data-nf-focus className="inline-flex min-h-11 items-center outline-none transition-colors duration-150 hover:text-white focus-visible:text-white">
                  {s.label} <span aria-hidden="true" className="ml-1">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </SheetBlock>
      </div>
    </motion.div>
  );
}

function SheetBlock({ variants, delay, children }: { variants: Variants; delay: number; children: ReactNode }) {
  return (
    <motion.div variants={variants} initial="hidden" animate="shown" exit={{ opacity: 0, transition: { duration: 0.12 } }} custom={delay}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Glyphs                                                               */
/* ------------------------------------------------------------------ */

function LogoMark() {
  return (
    <span className="relative flex size-8 items-center justify-center overflow-hidden rounded-[9px] bg-[linear-gradient(145deg,#ffffff,#a1a1aa)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(0,0,0,0.18)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[-8deg] motion-reduce:transition-none">
      <svg viewBox="0 0 24 24" className="size-[18px] text-black" aria-hidden="true">
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </svg>
    </span>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: a short changelog page to scroll past, so the pill can be seen */
/* tucking in. Its blocks land after the bar, then reveal once on       */
/* scroll. The page is stage, not part of the component.                */
/* ------------------------------------------------------------------ */

type Release = { version: string; date: string; title: string; body: string; changes: string[] };

const RELEASES: Release[] = [
  {
    version: "4.12",
    date: "8 Oct 2026",
    title: "Forecasts explain themselves",
    body: "Hover any forecast cell and Meridian lists the three drivers behind it, ranked by how far each one moved the number. Click a driver to open the ledger rows it came from.",
    changes: ["Driver breakdown on every forecast cell", "Variance notes carry over between versions"],
  },
  {
    version: "4.11",
    date: "1 Oct 2026",
    title: "One ledger for every entity",
    body: "Group companies now share a single chart of accounts. Intercompany transfers reconcile themselves at month end, and eliminations post without a spreadsheet in sight.",
    changes: ["Shared chart of accounts across entities", "Automatic intercompany eliminations"],
  },
  {
    version: "4.10",
    date: "24 Sep 2026",
    title: "A close checklist with owners",
    body: "Month-end close gets a checklist with owners, due dates and a single view of what is blocking whom. Teams on the beta closed 2.4 days sooner.",
    changes: ["Owners and due dates on close tasks", "Blocked tasks surface in the daily digest"],
  },
  {
    version: "4.9",
    date: "17 Sep 2026",
    title: "Imports that remember",
    body: "Map a bank export’s columns once and Meridian remembers the mapping for that bank. Re-imports skip rows it has already seen, so nothing posts twice.",
    changes: ["Saved column mappings per bank", "Duplicate rows skipped on re-import"],
  },
];

const PAGE = { at: 0.3, stagger: 0.07 } as const;
/** When the page's own intro (eyebrow → headline → lead) has started its last block. Entries visible on load wait for it. */
const PAGE_END = PAGE.at + PAGE.stagger * 3;

/**
 * Reveal once at 25% visibility. Returns the delay to start with, or null while
 * still hidden: an entry already on screen at load waits for the page intro, so
 * the eye reads top to bottom; one scrolled to later starts at once.
 */
function useRevealOnce(ref: RefObject<HTMLElement | null>, startedAt: number) {
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const [delay, setDelay] = useState<number | null>(null);
  useEffect(() => {
    if (inView) setDelay(Math.max(0, PAGE_END - (performance.now() - startedAt) / 1000));
  }, [inView, startedAt]);
  return delay;
}

function Demo() {
  const reduce = useReducedMotion() ?? false;
  const rise = riseVariants(reduce);
  const [startedAt] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
  return (
    <div className="min-h-[1700px] text-white" style={{ backgroundColor: COLOR.page }}>
      <NavbarFloating activeIndex={3} />
      <main className="mx-auto max-w-[1240px] px-6 pb-32 pt-36 sm:px-9 sm:pt-44">
        <motion.p variants={rise} initial="hidden" animate="shown" custom={PAGE.at} className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
          Changelog · Updated 8 Oct 2026
        </motion.p>
        <motion.h1
          variants={rise}
          initial="hidden"
          animate="shown"
          custom={PAGE.at + PAGE.stagger}
          className="mt-6 max-w-[14ch] text-balance font-display text-[clamp(2.75rem,1.6rem+4.6vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.05em]"
        >
          Small releases, <span className="text-white/40">every week.</span>
        </motion.h1>
        <motion.p variants={rise} initial="hidden" animate="shown" custom={PAGE.at + PAGE.stagger * 2} className="mt-6 max-w-[52ch] text-[16px] leading-[1.65] text-white/60 sm:text-[17px]">
          Everything we shipped to Meridian this autumn, newest first. Each entry links to the docs that changed with it.
        </motion.p>
        <ol className="mt-16 border-t border-white/[0.08] sm:mt-24">
          {RELEASES.map((r) => (
            <ReleaseEntry key={r.version} release={r} reduce={reduce} startedAt={startedAt} />
          ))}
        </ol>
      </main>
    </div>
  );
}

/** Meta, then title, then body, then the list. */
function ReleaseEntry({ release, reduce, startedAt }: { release: Release; reduce: boolean; startedAt: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const delay = useRevealOnce(ref, startedAt);
  const rise = riseVariants(reduce);
  const step = (k: number) => (delay ?? 0) + k * PAGE.stagger;
  return (
    <motion.li
      ref={ref}
      initial="hidden"
      animate={delay === null ? "hidden" : "shown"}
      className="grid gap-4 border-b border-white/[0.08] py-10 sm:grid-cols-[200px_1fr] sm:gap-10 sm:py-14"
    >
      <motion.p variants={rise} custom={step(0)} className="flex items-baseline gap-3 font-mono text-[12px] tabular-nums text-white/45 sm:flex-col sm:gap-1.5">
        <span className="text-white/85">v{release.version}</span>
        <span>{release.date}</span>
      </motion.p>
      <div className="max-w-[60ch]">
        <motion.h2 variants={rise} custom={step(1)} className="font-display text-[clamp(1.5rem,1.2rem+1.2vw,2.125rem)] font-semibold leading-[1.1] tracking-[-0.035em]">
          {release.title}
        </motion.h2>
        <motion.p variants={rise} custom={step(2)} className="mt-4 text-[16px] leading-[1.65] text-white/60">
          {release.body}
        </motion.p>
        <motion.ul variants={rise} custom={step(3)} className="mt-6 grid gap-2 text-[14px] text-white/75">
          {release.changes.map((c) => (
            <li key={c} className="flex items-baseline gap-3">
              <span aria-hidden="true" className="h-px w-3 shrink-0 translate-y-[-4px] bg-white/35" />
              {c}
            </li>
          ))}
        </motion.ul>
      </div>
    </motion.li>
  );
}

export default Demo;
