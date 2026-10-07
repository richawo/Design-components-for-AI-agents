"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

type Link = { label: string; href: string };

export type CtaBannerBoldProps = {
  /** Small label above the headline. */
  eyebrow?: string;
  /** Headline. The `highlight` substring is set in butter yellow. */
  headline?: string;
  highlight?: string;
  primary?: Link;
  /** Secondary text link, usually an email address. */
  secondary?: Link;
  secondaryLead?: string;
  /** Three short reassurance notes along the bottom. The first gets a clock, the second a live dot, the third a pin. */
  notes?: [string, string, string];
};

const ease = [0.2, 0.8, 0.2, 1] as const;

export function CtaBannerBold({
  eyebrow = "Next step",
  headline = "Let’s make something worth talking about.",
  highlight = "worth talking about.",
  primary = { label: "Start a project", href: "#contact" },
  secondaryLead = "or write to",
  secondary = { label: "hello@northbound.studio", href: "mailto:hello@northbound.studio" },
  notes = ["We reply within one working day", "Two slots open for January", "Lisbon, working with teams in 14 countries"],
}: CtaBannerBoldProps) {
  const reduce = useReducedMotion();
  const i = headline.indexOf(highlight);
  const pre = i >= 0 ? headline.slice(0, i) : headline;
  const post = i >= 0 ? headline.slice(i + highlight.length) : "";

  return (
    <section className="bg-[#f4f2ec] p-3 sm:p-5 lg:p-6">
      <div className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-[24px] bg-[#2c43f2] text-white sm:rounded-[32px]">
        <Rings />

        <div className="relative px-6 pb-8 pt-10 sm:px-12 sm:pb-10 sm:pt-14 lg:px-20 lg:pb-12 lg:pt-20">
          <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#ffd23f]">
            <span className="h-px w-8 bg-[#ffd23f]" aria-hidden="true" />
            {eyebrow}
          </p>

          <motion.h2
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, ease }}
            className="mt-8 max-w-[13ch] text-balance font-display text-[clamp(2.9rem,1.4rem+6.2vw,8rem)] font-bold leading-[0.92] tracking-[-0.055em] sm:mt-10"
          >
            {pre}
            {i >= 0 ? <span className="text-[#ffd23f]">{highlight}</span> : null}
            {post}
          </motion.h2>

          <div className="mt-12 flex flex-col items-start gap-6 sm:mt-16 sm:flex-row sm:items-center sm:gap-10">
            <MagneticButton href={primary.href} label={primary.label} reduce={!!reduce} />
            <p className="text-[16px] text-white/75">
              {secondaryLead}{" "}
              <a
                href={secondary.href}
                className="rounded-sm font-semibold text-white underline decoration-white/40 decoration-2 underline-offset-[6px] transition-colors hover:decoration-[#ffd23f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd23f]"
              >
                {secondary.label}
              </a>
            </p>
          </div>

          <ul className="mt-14 grid gap-4 border-t border-white/20 pt-6 text-[14px] text-white/80 sm:mt-20 md:grid-cols-3 md:gap-8">
            <li className="flex items-center gap-3">
              <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-[#ffd23f]" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {notes[0]}
            </li>
            <li className="flex items-center gap-3">
              <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                <span className="absolute size-2.5 animate-ping rounded-full bg-[#ffd23f] opacity-60 motion-reduce:hidden" />
                <span className="relative size-2 rounded-full bg-[#ffd23f]" />
              </span>
              {notes[1]}
            </li>
            <li className="flex items-center gap-3">
              <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-[#ffd23f]" fill="none" aria-hidden="true">
                <path d="M8 14.5s4.75-4.2 4.75-8.1a4.75 4.75 0 1 0-9.5 0c0 3.9 4.75 8.1 4.75 8.1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="8" cy="6.4" r="1.6" fill="currentColor" />
              </svg>
              {notes[2]}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic button: leans toward the cursor on a spring                */
/* ------------------------------------------------------------------ */

function MagneticButton({ href, label, reduce }: { href: string; label: string; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 220, damping: 16, mass: 0.5 };
  const x = useSpring(mx, spring);
  const y = useSpring(my, spring);
  // The label and arrow travel a little further than the pill, which gives the lean its depth.
  const lx = useTransform(x, (v) => v * 0.45);
  const ly = useTransform(y, (v) => v * 0.45);
  const rotate = useTransform(x, [-24, 24], [-3, 3]);

  const onMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    mx.set(Math.max(-24, Math.min(24, dx * 0.32)));
    my.set(Math.max(-16, Math.min(16, dy * 0.4)));
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    // The outer span is a larger catch area, so the pull starts before the cursor touches the pill.
    <span ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className="-m-6 inline-flex p-6">
      <motion.a
        href={href}
        style={{ x, y, rotate }}
        className="group relative inline-flex h-16 items-center gap-4 rounded-full bg-[#ffd23f] pl-8 pr-2.5 text-[17px] font-semibold text-[#111640] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_14px_30px_-14px_rgba(10,16,80,0.55)] transition-colors duration-300 hover:bg-[#ffdc63] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.98] sm:h-[72px] sm:pl-9 sm:text-[18px]"
      >
        <motion.span style={{ x: lx, y: ly }} className="inline-block">
          {label}
        </motion.span>
        <motion.span style={{ x: lx, y: ly }} className="flex size-11 items-center justify-center rounded-full bg-[#111640] text-[#ffd23f] sm:size-[52px]">
          <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-rotate-45" fill="none" aria-hidden="true">
            <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </motion.a>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Decorative concentric outlines                                      */
/* ------------------------------------------------------------------ */

function Rings() {
  return (
    <svg
      viewBox="0 0 800 800"
      className="pointer-events-none absolute -right-[85%] top-[58%] -z-10 w-[170%] -translate-y-1/2 sm:-right-[12%] sm:top-1/2 sm:w-[min(1100px,110%)] sm:-translate-y-[38%] lg:-right-[8%] lg:w-[900px]"
      fill="none"
      aria-hidden="true"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} cx="400" cy="400" r={44 + i * 44} stroke="white" strokeOpacity={0.16 - i * 0.012} strokeWidth="1.25" />
      ))}
      <circle cx="400" cy="400" r="6" fill="#ffd23f" />
    </svg>
  );
}

export default CtaBannerBold;
