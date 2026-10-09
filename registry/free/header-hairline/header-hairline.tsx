"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";

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

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const TALL = 64;
const SHORT = 56;
const DESKTOP = 896; // matches the @4xl container breakpoint

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
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(true);
  const [keyDown, setKeyDown] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > condenseAt));
  useEffect(() => {
    setScrolled(window.scrollY > condenseAt);
    setMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent));
  }, [condenseAt]);

  const choose = (i: number, e?: ReactMouseEvent) => {
    if (e && links[i].href.startsWith("#")) e.preventDefault();
    if (activeIndex === undefined) setInnerActive(i);
    onNavigate?.(i, links[i]);
  };

  // ⌘K / Ctrl K: the key chip physically presses in, then onSearch fires.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setKeyDown(true);
        onSearch?.();
      }
    };
    const up = () => setKeyDown(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", up);
    };
  }, [onSearch]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) burgerRef.current?.focus();
  }, []);

  // Mobile menu: lock scroll, trap focus, Esc closes, close if the bar grows to desktop.
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
      if (e.key !== "Tab" || !headerRef.current) return;
      const items = Array.from(headerRef.current.querySelectorAll<HTMLElement>("a[href]:not([tabindex='-1']), button:not([disabled])")).filter(
        (el) => el.offsetParent !== null && el.getClientRects().length > 0,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !headerRef.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !headerRef.current.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    const ro = new ResizeObserver(([entry]) => entry.contentRect.width >= DESKTOP && close(false));
    if (barRef.current) ro.observe(barRef.current);
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  }, [open, close]);

  const solid = scrolled || open;
  const height = scrolled ? SHORT : TALL;

  return (
    <header ref={headerRef} className={`sticky top-0 z-40 w-full text-white ${className}`}>
      {/* Surface: transparent at rest; hairline + blur fade in once the page moves. */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ opacity: solid ? 1 : 0 }}
        transition={{ duration: reduce ? 0.12 : solid ? 0.24 : 0.16, ease: solid ? EASE_OUT : EASE_IN }}
        className={`pointer-events-none absolute inset-0 border-b border-white/[0.09] backdrop-blur-xl backdrop-saturate-150 ${open ? "bg-black" : "bg-black/[0.72]"}`}
      />

      <motion.div
        ref={barRef}
        initial={false}
        animate={{ height }}
        transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE_OUT }}
        className="@container relative mx-auto flex w-full max-w-[1280px] items-center px-4 sm:px-6"
        style={{ height: TALL }}
      >
        <div className="grid w-full grid-cols-[1fr_auto] items-center gap-4 @min-[896px]:grid-cols-[auto_1fr_auto] @min-[1200px]:grid-cols-[1fr_auto_1fr]">
          {/* Wordmark */}
          <a
            href={brand.href}
            className="group -ml-1.5 flex h-10 w-max items-center gap-2 rounded-md px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Mark />
            <span className="font-display text-[17px] font-semibold leading-none tracking-[-0.04em]">{brand.name}</span>
          </a>

          {/* Centre links */}
          <HoverLinks links={links} active={active} onChoose={choose} reduce={reduce} groupId={uid} />

          {/* Right cluster */}
          <div className="flex items-center justify-end gap-1.5 @4xl:gap-2">
            <button
              type="button"
              onClick={() => onSearch?.()}
              aria-label={`${searchLabel} (${mac ? "Command" : "Control"} K)`}
              aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
              className={`group/s flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2.5 text-[13px] text-white/55 outline-none transition-[background-color,color,transform,box-shadow] duration-150 hover:text-white active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black @4xl:h-8 @4xl:min-w-0 @4xl:justify-start @4xl:pl-2.5 @4xl:pr-1 @4xl:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] @4xl:hover:bg-white/[0.04] @4xl:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] ${
                keyDown ? "@4xl:bg-white/[0.05] text-white" : ""
              }`}
            >
              <svg viewBox="0 0 16 16" className="size-[18px] @4xl:size-[14px]" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
                <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="hidden whitespace-nowrap pr-6 @min-[1200px]:inline">{searchLabel}</span>
              <kbd
                className={`hidden h-6 min-w-[2.25rem] items-center justify-center gap-0.5 rounded-[5px] bg-white/[0.06] px-1.5 font-mono text-[11px] font-medium text-white/60 transition-[transform,box-shadow,background-color] duration-100 group-hover/s:text-white/80 @4xl:inline-flex ${
                  keyDown
                    ? "translate-y-px bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                    : "shadow-[inset_0_-1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.1),0_1px_0_rgba(0,0,0,0.6)]"
                }`}
              >
                <span className={mac ? "text-[12px]" : "mr-[3px]"}>{mac ? "⌘" : "Ctrl"}</span>K
              </kbd>
            </button>

            <a
              href={signIn.href}
              className="hidden h-8 items-center whitespace-nowrap rounded-lg px-3 text-[13.5px] text-white/65 outline-none transition-[color,background-color,transform] duration-150 hover:bg-white/[0.04] hover:text-white active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black @4xl:inline-flex"
            >
              {signIn.label}
            </a>

            <a
              href={cta.href}
              tabIndex={open ? -1 : undefined}
              aria-hidden={open || undefined}
              className={`hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-3.5 text-[13.5px] font-medium tracking-[-0.01em] text-black shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] outline-none transition-[background-color,transform,opacity] duration-150 ${open ? "pointer-events-none opacity-0" : ""} hover:bg-[#e8e8ea] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black @2xl:inline-flex`}
            >
              {cta.label}
            </a>

            {/* Burger: two lines that cross. */}
            <button
              ref={burgerRef}
              type="button"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="-mr-2 flex size-11 items-center justify-center rounded-lg text-white/80 outline-none transition-[background-color,color,transform] duration-150 hover:bg-white/[0.05] hover:text-white active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-white/70 @4xl:hidden"
            >
              <span className="relative block h-4 w-[18px]" aria-hidden="true">
                <motion.span
                  initial={false}
                  animate={open ? { y: 0, rotate: 45 } : { y: -3.5, rotate: 0 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}
                  className="absolute inset-x-0 top-1/2 -mt-[0.75px] h-[1.5px] rounded-full bg-current"
                />
                <motion.span
                  initial={false}
                  animate={open ? { y: 0, rotate: -45 } : { y: 3.5, rotate: 0 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}
                  className="absolute inset-x-0 top-1/2 -mt-[0.75px] h-[1.5px] rounded-full bg-current"
                />
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.16, ease: EASE_IN } }}
            className="fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-y-auto overscroll-contain bg-black px-4 pb-[max(24px,env(safe-area-inset-bottom))] sm:px-6"
            style={{ top: height }}
          >
            <nav aria-label="Main">
              <ul className="flex flex-col pt-2">
                {links.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: reduce ? 0.12 : 0.36, ease: EASE_OUT, delay: reduce ? 0 : 0.04 + i * 0.04 }}
                    className="border-b border-white/[0.08]"
                  >
                    <a
                      href={l.href}
                      aria-current={i === active ? "page" : undefined}
                      onClick={(e) => {
                        choose(i, e);
                        close();
                      }}
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
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: reduce ? 0.12 : 0.36, ease: EASE_OUT, delay: reduce ? 0 : 0.06 + links.length * 0.04 }}
              className="mt-auto grid gap-2 pt-10"
            >
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
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Centre links: one highlight that travels between them. Its two      */
/* edges run on separate springs: the leading edge is stiffer, so the  */
/* highlight stretches toward where you're going and settles on arrival. */
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
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = useRef(false);
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const width = useTransform(() => Math.max(0, right.get() - left.get()));
  const opacity = useMotionValue(0);

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
      const lead = { type: "spring" as const, stiffness: 660, damping: 46 };
      const trail = { type: "spring" as const, stiffness: 320, damping: 31 };
      animate(left, L, goingRight ? trail : lead);
      animate(right, R, goingRight ? lead : trail);
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
        <ul ref={listRef} className="relative flex items-center" onPointerLeave={() => setHovered(null)}>
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-white/[0.075]"
            style={{ x: left, width, opacity }}
          />
          {links.map((l, i) => (
            <li key={l.href}>
              <a
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
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
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                    className="absolute bottom-[3px] left-1/2 -ml-[2px] size-1 rounded-full bg-white"
                  />
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </LayoutGroup>
    </nav>
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
/* Demo: a black stage with faint skeleton rows to scroll past, purely  */
/* so the bar can be seen condensing.                                   */
/* ------------------------------------------------------------------ */

function Demo() {
  return (
    <div className="min-h-[1500px] bg-black">
      <HeaderHairline />
      <div aria-hidden="true" className="mx-auto max-w-[1280px] px-4 pt-14 sm:px-6 sm:pt-20">
        <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
        <div className="mt-6 h-9 w-[min(560px,80%)] rounded-md bg-white/[0.06] sm:h-12" />
        <div className="mt-3 h-9 w-[min(380px,55%)] rounded-md bg-white/[0.04] sm:h-12" />
        <div className="mt-8 space-y-2.5">
          <div className="h-2.5 w-[min(520px,90%)] rounded-full bg-white/[0.04]" />
          <div className="h-2.5 w-[min(460px,75%)] rounded-full bg-white/[0.04]" />
        </div>
        <div className="mt-14 h-[340px] rounded-xl border border-white/[0.07] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.025),transparent_70%)] sm:h-[420px]">
          <div className="flex h-10 items-center gap-1.5 border-b border-white/[0.06] px-4">
            <span className="size-2 rounded-full bg-white/[0.08]" />
            <span className="size-2 rounded-full bg-white/[0.08]" />
            <span className="size-2 rounded-full bg-white/[0.08]" />
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-[200px_1fr] sm:p-6">
            <div className="hidden space-y-3 sm:block">
              {[70, 52, 64, 44, 58].map((w) => (
                <div key={w} className="h-2.5 rounded-full bg-white/[0.05]" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="space-y-3">
              {[92, 84, 88, 60, 76, 90, 48].map((w, i) => (
                <div key={i} className="h-2.5 rounded-full bg-white/[0.04]" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((k) => (
            <div key={k} className="h-40 rounded-xl border border-white/[0.06] p-5">
              <div className="h-2.5 w-1/3 rounded-full bg-white/[0.06]" />
              <div className="mt-4 h-2.5 w-4/5 rounded-full bg-white/[0.04]" />
              <div className="mt-2.5 h-2.5 w-3/5 rounded-full bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Demo;
