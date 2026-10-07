"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";

type NavLink = { label: string; href: string; /** Optional small count set in superscript, e.g. a number of projects. */ count?: string };
type Social = { label: string; href: string };

export type NavbarFloatingProps = {
  brand?: { name: string; href: string };
  links?: NavLink[];
  /** Index of the link for the current page. Gets a dot and aria-current. */
  activeIndex?: number;
  cta?: { label: string; href: string };
  /** Shown in the mobile sheet under the big links. */
  contact?: { email: string; phone: string; address: string[] };
  socials?: Social[];
  /** Scroll distance in px after which the pill tucks itself in. */
  condenseAt?: number;
};

const ease = [0.2, 0.8, 0.2, 1] as const;


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
  const reduce = useReducedMotion();
  const groupId = useId();
  const sheetId = `${groupId}-sheet`;
  const [condensed, setCondensed] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setCondensed(v > condenseAt));
  useEffect(() => setCondensed(window.scrollY > condenseAt), [condenseAt]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Sheet: lock page scroll, close on Esc, keep Tab inside the header, close if the viewport grows to desktop.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab" || !headerRef.current) return;
      const items = Array.from(headerRef.current.querySelectorAll<HTMLElement>("[data-tm-nf-focus]")).filter((el) => el.offsetParent !== null);
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
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open, close]);

  const tucked = condensed && !open;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 36 };

  return (
    <header ref={headerRef} className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-5">
      <motion.nav
        aria-label="Main"
        initial={false}
        animate={{ maxWidth: tucked ? 720 : 1200, paddingTop: tucked ? 6 : 8, paddingBottom: tucked ? 6 : 8 }}
        transition={spring}
        className={`pointer-events-auto relative z-10 flex w-full items-center justify-between gap-4 rounded-full bg-[#0c0c0e]/70 pl-3 pr-2 text-white backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-500 sm:pl-4 ${
          tucked
            ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.1),0_24px_60px_-20px_rgba(0,0,0,0.9)]"
            : "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(255,255,255,0.08)]"
        }`}
      >
        {/* Logo: the wordmark folds away when the bar tucks in, leaving the mark. */}
        <a
          href={brand.href}
          data-tm-nf-focus
          className="group flex h-11 shrink-0 items-center gap-2.5 rounded-full pr-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <LogoMark />
          <motion.span
            initial={false}
            animate={{ width: tucked ? 0 : "auto", opacity: tucked ? 0 : 1 }}
            transition={spring}
            className="overflow-hidden whitespace-nowrap font-display text-[17px] font-semibold leading-none tracking-[-0.03em]"
          >
            {brand.name}
          </motion.span>
          {tucked ? <span className="sr-only">{brand.name}</span> : null}
        </a>

        {/* Desktop links with a hover pill that slides between them. */}
        <LayoutGroup id={groupId}>
          <ul className="hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
            {links.map((l, n) => (
              <li key={l.label} className="relative">
                <a
                  href={l.href}
                  aria-current={n === activeIndex ? "page" : undefined}
                  onMouseEnter={() => setHovered(n)}
                  onFocus={() => setHovered(n)}
                  onBlur={() => setHovered(null)}
                  className="relative flex h-10 items-center rounded-full px-4 text-[14px] text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 aria-[current=page]:text-white lg:px-4"
                >
                  <AnimatePresence>
                    {hovered === n ? (
                      <motion.span
                        layoutId="hover-pill"
                        className="absolute inset-0 rounded-full bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                      />
                    ) : null}
                  </AnimatePresence>
                  <span className="relative">
                    {l.label}
                    {l.count ? <sup className="ml-1 font-mono text-[9.5px] font-normal text-white/40">{l.count}</sup> : null}
                  </span>
                  {n === activeIndex ? <span aria-hidden="true" className="absolute bottom-[3px] left-1/2 h-px w-3 -translate-x-1/2 rounded-full bg-white/70" /> : null}
                </a>
              </li>
            ))}
          </ul>
        </LayoutGroup>

        <div className="flex items-center gap-2">
          <a
            href={cta.href}
            className="group hidden h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-medium text-black shadow-[0_8px_24px_-8px_rgba(255,255,255,0.45)] outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black md:inline-flex"
          >
            {cta.label}
            <span className="transition-transform duration-300 group-hover:translate-x-0.5">
              <Arrow />
            </span>
          </a>

          {/* Mobile menu button: two lines morph into a cross. */}
          <button
            ref={buttonRef}
            type="button"
            data-tm-nf-focus
            aria-expanded={open}
            aria-controls={sheetId}
            onClick={() => setOpen((o) => !o)}
            className="flex h-10 items-center gap-3 rounded-full bg-white/[0.07] pl-4 pr-3 text-[14px] font-medium outline-none ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/60 md:hidden"
          >
            <span className="relative inline-grid overflow-hidden">
              <span className={`col-start-1 row-start-1 transition-transform duration-300 ${open ? "-translate-y-full" : ""}`}>Menu</span>
              <span className={`col-start-1 row-start-1 transition-transform duration-300 ${open ? "" : "translate-y-full"}`} aria-hidden={!open}>
                Close
              </span>
            </span>
            <span className="relative block size-5" aria-hidden="true">
              <motion.span
                initial={false}
                animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -3.5 }}
                transition={reduce ? { duration: 0 } : { duration: 0.35, ease }}
                className="absolute left-0.5 right-0.5 top-1/2 h-px rounded-full bg-current"
              />
              <motion.span
                initial={false}
                animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 3.5 }}
                transition={reduce ? { duration: 0 } : { duration: 0.35, ease }}
                className="absolute left-0.5 right-0.5 top-1/2 h-px rounded-full bg-current"
              />
            </span>
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={sheetId}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
            animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }}
            exit={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)", transition: { duration: 0.45, ease, delay: 0.1 } }}
            transition={{ duration: 0.6, ease }}
            className="pointer-events-auto fixed inset-0 z-0 flex flex-col overflow-y-auto bg-[#050506] bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,255,255,0.08),transparent)] px-5 pb-8 pt-28 text-white md:hidden"
          >
            <ul className="flex flex-col">
              {links.map((l, n) => (
                <li key={l.label} className="overflow-hidden border-b border-white/[0.08]">
                  <motion.a
                    href={l.href}
                    data-tm-nf-focus
                    autoFocus={n === 0}
                    onClick={() => setOpen(false)}
                    aria-current={n === activeIndex ? "page" : undefined}
                    initial={reduce ? false : { y: "100%" }}
                    animate={{ y: "0%" }}
                    exit={reduce ? undefined : { y: "100%", transition: { duration: 0.3, ease } }}
                    transition={{ duration: 0.65, ease, delay: 0.18 + n * 0.06 }}
                    className="group flex items-baseline justify-between gap-4 py-4 outline-none focus-visible:bg-white/[0.05]"
                  >
                    <span className="font-display text-[clamp(2.25rem,11vw,3.5rem)] font-semibold leading-[1] tracking-[-0.05em]">
                      {l.label}
                      {l.count ? <sup className="ml-1.5 align-super font-mono text-xs font-normal tracking-normal text-white/40">{l.count}</sup> : null}
                    </span>
                    <span className="font-mono text-xs text-white/35">{String(n + 1).padStart(2, "0")}</span>
                  </motion.a>
                </li>
              ))}
            </ul>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.6, ease, delay: 0.45 }}
              className="mt-auto pt-12"
            >
              <a
                href={cta.href}
                data-tm-nf-focus
                onClick={() => setOpen(false)}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {cta.label}
                <Arrow />
              </a>
              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 text-[14px] leading-snug text-white/75">
                <div>
                  <dt className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Say hello</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`} data-tm-nf-focus className="underline decoration-white/30 underline-offset-4 outline-none focus-visible:bg-white/10">
                      {contact.email}
                    </a>
                  </dd>
                  <dd className="mt-1">
                    <a href={`tel:${contact.phone.replace(/\s/g, "")}`} data-tm-nf-focus className="outline-none focus-visible:bg-white/10">
                      {contact.phone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Visit</dt>
                  {contact.address.map((line) => (
                    <dd key={line}>{line}</dd>
                  ))}
                </div>
              </dl>
              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.08] pt-5 text-[14px] text-white/75">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} data-tm-nf-focus className="inline-flex min-h-11 items-center outline-none hover:text-white focus-visible:text-white">
                      {s.label} <span aria-hidden="true" className="ml-1">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function LogoMark() {
  return (
    <span className="relative flex size-8 items-center justify-center overflow-hidden rounded-[9px] bg-[linear-gradient(145deg,#ffffff,#a1a1aa)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_-4px_rgba(255,255,255,0.35)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:rotate-[-8deg]">
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
/* Demo: a dark product page to scroll past, so the bar can be seen     */
/* condensing.                                                          */
/* ------------------------------------------------------------------ */

const tiles = [
  { title: "Forecasts that explain themselves", tag: "Planning", a: "#ff7a45", b: "#ff4d6d" },
  { title: "Every number, one source of truth", tag: "Reporting", a: "#4cc3ff", b: "#3d5afe" },
  { title: "Close the month before lunch", tag: "Automation", a: "#a3e635", b: "#10b981" },
] as const;

function Demo() {
  return (
    <div className="min-h-[1700px] bg-[#050506] text-white">
      <NavbarFloating />
      <section className="relative isolate overflow-hidden px-5 pb-24 pt-40 text-center sm:px-8 sm:pt-48">
        <div aria-hidden="true" className="absolute left-1/2 top-0 -z-10 h-[520px] w-[1000px] max-w-[160%] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),transparent)]" />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000,transparent)]"
        />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">Finance for teams that move fast</p>
        <h1 className="mx-auto mt-6 max-w-[16ch] text-balance font-display text-[clamp(2.75rem,1.4rem+5vw,6rem)] font-semibold leading-[0.96] tracking-[-0.055em]">
          <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">Run the numbers.</span> <span className="text-white/40">Skip the spreadsheets.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[48ch] text-[16px] leading-relaxed text-white/55">Scroll down: the bar condenses into a tighter pill and the wordmark folds into its mark.</p>
      </section>
      <section id="product" className="mx-auto max-w-[1200px] px-5 pb-32 sm:px-8">
        <ul className="grid gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <li key={t.title} className="overflow-hidden rounded-[20px] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(255,255,255,0.08)]">
              <div aria-hidden="true" className="relative aspect-[4/3] overflow-hidden border-b border-white/[0.06]">
                <div className="absolute -bottom-1/3 left-1/2 aspect-square w-[90%] -translate-x-1/2 rounded-full opacity-70 blur-2xl" style={{ background: `radial-gradient(closest-side, ${t.a}, ${t.b} 60%, transparent)` }} />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[size:14px_14px] [mask-image:linear-gradient(transparent,#000)]" />
              </div>
              <div className="p-5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/40">{t.tag}</p>
                <p className="mt-2 text-[17px] font-medium tracking-[-0.02em]">{t.title}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default Demo;
