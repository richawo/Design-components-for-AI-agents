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
  brand = { name: "Kiln", href: "#" },
  links = [
    { label: "Work", href: "#work", count: "24" },
    { label: "Studio", href: "#studio" },
    { label: "Services", href: "#services" },
    { label: "Journal", href: "#journal" },
  ],
  activeIndex = 0,
  cta = { label: "Start a project", href: "#contact" },
  contact = { email: "hello@kiln.studio", phone: "+44 20 7946 0321", address: ["Unit 4, Cremer Street", "London E2 8HD"] },
  socials = [
    { label: "Instagram", href: "#" },
    { label: "Are.na", href: "#" },
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
        className={`pointer-events-auto relative z-10 flex w-full items-center justify-between gap-4 rounded-full bg-[#111111] pl-3 pr-2 text-[#f5f3ef] transition-shadow duration-500 sm:pl-4 ${
          tucked ? "shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.06)]" : "shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        }`}
      >
        {/* Logo: the wordmark folds away when the bar tucks in, leaving the mark. */}
        <a
          href={brand.href}
          data-tm-nf-focus
          className="group flex h-11 shrink-0 items-center gap-2.5 rounded-full pr-2 outline-none focus-visible:ring-2 focus-visible:ring-[#ff9bd2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
        >
          <LogoMark />
          <motion.span
            initial={false}
            animate={{ width: tucked ? 0 : "auto", opacity: tucked ? 0 : 1 }}
            transition={spring}
            className="overflow-hidden whitespace-nowrap font-display text-[22px] font-bold leading-none tracking-[-0.05em]"
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
                  className="relative flex h-11 items-center rounded-full px-4 text-[15px] font-medium tracking-[-0.01em] outline-none focus-visible:ring-2 focus-visible:ring-[#ff9bd2] lg:px-5"
                >
                  <AnimatePresence>
                    {hovered === n ? (
                      <motion.span
                        layoutId="hover-pill"
                        className="absolute inset-0 rounded-full bg-white/[0.13]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                      />
                    ) : null}
                  </AnimatePresence>
                  <span className="relative">
                    {l.label}
                    {l.count ? <sup className="ml-0.5 font-mono text-[10px] font-normal text-white/55">{l.count}</sup> : null}
                  </span>
                  {n === activeIndex ? <span aria-hidden="true" className="absolute bottom-[5px] left-1/2 size-1 -translate-x-1/2 rounded-full bg-[#ff9bd2]" /> : null}
                </a>
              </li>
            ))}
          </ul>
        </LayoutGroup>

        <div className="flex items-center gap-2">
          <a
            href={cta.href}
            className="group hidden h-11 items-center gap-2 rounded-full bg-[#ff9bd2] pl-5 pr-1.5 text-[15px] font-semibold tracking-[-0.01em] text-[#111111] outline-none transition-colors hover:bg-[#ffb3dd] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] md:inline-flex"
          >
            {cta.label}
            <span className="flex size-8 items-center justify-center rounded-full bg-[#111111] text-[#ff9bd2] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:rotate-[-45deg]">
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
            className="flex h-11 items-center gap-3 rounded-full bg-white/[0.1] pl-4 pr-3 text-[15px] font-medium outline-none transition-colors hover:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-[#ff9bd2] md:hidden"
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
                className="absolute left-0.5 right-0.5 top-1/2 -mt-px h-0.5 rounded-full bg-current"
              />
              <motion.span
                initial={false}
                animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 3.5 }}
                transition={reduce ? { duration: 0 } : { duration: 0.35, ease }}
                className="absolute left-0.5 right-0.5 top-1/2 -mt-px h-0.5 rounded-full bg-current"
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
            className="pointer-events-auto fixed inset-0 z-0 flex flex-col overflow-y-auto bg-[#2b2bf5] px-5 pb-8 pt-28 text-white md:hidden"
          >
            <ul className="flex flex-col">
              {links.map((l, n) => (
                <li key={l.label} className="overflow-hidden border-b border-white/20">
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
                    className="group flex items-baseline justify-between gap-4 py-3 outline-none focus-visible:bg-white/10"
                  >
                    <span className="font-display text-[clamp(2.75rem,13vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.05em]">
                      {l.label}
                      {l.count ? <sup className="ml-1 align-super font-mono text-sm font-normal tracking-normal text-[#ff9bd2]">{l.count}</sup> : null}
                    </span>
                    <span className="font-mono text-xs text-white/60">{String(n + 1).padStart(2, "0")}</span>
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
                className="flex h-14 items-center justify-between rounded-full bg-[#ff9bd2] pl-6 pr-2 text-base font-semibold text-[#111111] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2b2bf5]"
              >
                {cta.label}
                <span className="flex size-10 items-center justify-center rounded-full bg-[#111111] text-[#ff9bd2]">
                  <Arrow />
                </span>
              </a>
              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 text-[15px] leading-snug">
                <div>
                  <dt className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">Say hello</dt>
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
                  <dt className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">Visit</dt>
                  {contact.address.map((line) => (
                    <dd key={line}>{line}</dd>
                  ))}
                </div>
              </dl>
              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/20 pt-5 text-[15px]">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} data-tm-nf-focus className="inline-flex min-h-11 items-center outline-none hover:text-[#ff9bd2] focus-visible:text-[#ff9bd2]">
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
    <span className="flex size-9 items-center justify-center rounded-full bg-[#f5f3ef] text-[#111111] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:rotate-[-8deg]">
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true">
        <path d="M4.5 20.5V11a7.5 7.5 0 0 1 15 0v9.5z" fill="currentColor" />
        <path d="M12 19.5c-2 0-3.2-1.3-3.2-3 0-1.9 1.7-2.8 2.2-4.8 1.6 1.1 4.2 2.8 4.2 4.9 0 1.7-1.2 2.9-3.2 2.9z" fill="#ff9bd2" />
      </svg>
    </span>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: a cobalt hero and a work strip so there is something to scroll */
/* past and the bar can be seen tucking itself in.                      */
/* ------------------------------------------------------------------ */

const tiles = [
  { client: "Halcyon Ferries", what: "Identity, wayfinding", bg: "#ff9bd2", fg: "#111111", shape: "sun" },
  { client: "Oddfellow Bakery", what: "Packaging", bg: "#111111", fg: "#f5f3ef", shape: "dots" },
  { client: "Moth Records", what: "Label & sleeves", bg: "#e9e6ff", fg: "#2b2bf5", shape: "disc" },
] as const;

function Demo() {
  return (
    <div className="bg-[#f5f3ef] text-[#111111]">
      <NavbarFloating />
      <section className="relative overflow-hidden bg-[#2b2bf5] px-5 pb-16 pt-36 text-white sm:px-8 sm:pt-44 lg:px-12 lg:pb-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/70 sm:text-xs">Brand & product studio — London E2</p>
          <h1 className="mt-6 max-w-[13ch] font-display text-[clamp(3.1rem,1.4rem+7vw,8.5rem)] font-extrabold leading-[0.9] tracking-[-0.055em]">
            Brands with a little <span className="text-[#ff9bd2]">heat</span> in them.
          </h1>
          <div className="mt-14 flex flex-col gap-6 border-t border-white/25 pt-6 sm:flex-row sm:items-end sm:justify-between lg:mt-20">
            <p className="max-w-[42ch] text-[17px] leading-relaxed text-white/80">
              Eleven people, two kilns’ worth of opinions. We name, shape and ship brands for founders who’d rather be remembered than liked.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/70">(Scroll)</p>
          </div>
        </div>
      </section>
      <section id="work" className="px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-baseline justify-between border-b border-[#111111]/15 pb-4">
            <h2 className="font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Recent work</h2>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#111111]/60">2025—2026</span>
          </div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-3">
            {tiles.map((t) => (
              <li key={t.client}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] sm:aspect-[4/5]" style={{ background: t.bg }} aria-hidden="true">
                  <TileArt shape={t.shape} fg={t.fg} />
                </div>
                <p className="mt-3 font-display text-lg font-semibold tracking-[-0.03em]">{t.client}</p>
                <p className="text-sm text-[#111111]/65">{t.what}</p>
              </li>
            ))}
          </ul>
          <p className="mt-16 max-w-[30ch] font-display text-[clamp(1.75rem,1.2rem+2vw,3rem)] font-bold leading-[1.02] tracking-[-0.045em]">
            Thirty-one launches since 2019. Most of them are still on fire.
          </p>
        </div>
      </section>
    </div>
  );
}

function TileArt({ shape, fg }: { shape: "sun" | "dots" | "disc"; fg: string }) {
  if (shape === "sun")
    return (
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-[18%] aspect-square w-[34%] sm:top-[22%] sm:w-[46%] -translate-x-1/2 rounded-full" style={{ background: fg }} />
        <div className="absolute inset-x-0 bottom-0 h-[42%]" style={{ background: `repeating-linear-gradient(180deg, ${fg} 0 10px, transparent 10px 22px)` }} />
      </div>
    );
  if (shape === "dots")
    return (
      <div className="absolute inset-0 m-auto grid aspect-square h-[72%] grid-cols-3 content-center gap-[8%]">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="aspect-square rounded-full" style={{ background: i === 4 ? "#ff9bd2" : fg }} />
        ))}
      </div>
    );
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="aspect-square w-[54%] rounded-full sm:w-[68%]"
        style={{ background: `radial-gradient(circle, ${fg} 0 9%, #e9e6ff 9% 11%, #111111 11% 100%)` }}
      >
        <div className="size-full rounded-full" style={{ background: "repeating-radial-gradient(circle, transparent 0 5px, rgba(255,255,255,0.08) 5px 6px)" }} />
      </div>
    </div>
  );
}

export default Demo;
