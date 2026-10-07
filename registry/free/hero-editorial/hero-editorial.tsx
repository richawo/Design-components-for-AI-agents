"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Link = { label: string; href: string };

export type HeroEditorialProps = {
  /** Small status line above the headline. */
  status?: string;
  location?: string;
  /** The fixed part of the headline. */
  lead?: string;
  /** Words that rotate at the end of the headline. Keep them similar in length. */
  words?: string[];
  body?: string;
  primary?: Link;
  secondary?: Link;
  clientsLabel?: string;
  clients?: string[];
  /** Text that runs around the spinning badge. */
  badge?: string;
  /** Milliseconds each word stays on screen. */
  interval?: number;
};

const ease = [0.2, 0.8, 0.2, 1] as const;

export function HeroEditorial({
  status = "Booking projects for January",
  location = "London — working worldwide",
  lead = "We design products people",
  words = ["remember.", "recommend.", "pay for.", "brag about."],
  body = "An independent studio for founders who'd rather be loved than liked. Brand, product and web, designed and built by the same five people.",
  primary = { label: "Start a project", href: "#contact" },
  secondary = { label: "See the work", href: "#work" },
  clientsLabel = "Trusted by",
  clients = ["Northwind", "Halcyon", "Fieldnote", "Pellucid", "Oddity & Co."],
  badge = "Independent studio · Est. 2014 · ",
  interval = 2200,
}: HeroEditorialProps) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce || words.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [reduce, words.length, interval]);

  return (
    <section className="relative isolate overflow-hidden bg-[#f4f0e8] text-[#16130f]">
      <div className="mx-auto flex min-h-[640px] max-w-7xl flex-col px-5 pb-10 pt-8 sm:px-8 lg:min-h-[760px] lg:px-12 lg:pt-10">
        {/* Status row */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#16130f]/60 sm:text-xs">
          <p className="flex items-center gap-2.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#1fb26b] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-[#1fb26b]" />
            </span>
            {status}
          </p>
          <p>{location}</p>
        </div>

        {/* Headline */}
        <div className="relative mt-14 flex-1 sm:mt-20 lg:mt-24">
          <h1 className="max-w-[15ch] font-display text-[clamp(2.9rem,1.2rem+7.4vw,8.25rem)] font-extrabold leading-[0.92] tracking-[-0.055em]">
            <span className="sr-only">
              {lead} {words.join(", ")}
            </span>
            <span aria-hidden="true">
              {lead}{" "}
              <span className="relative inline-grid align-baseline">
                {/* Every word sits in the same cell so the line never reflows. */}
                {words.map((w) => (
                  <span key={w} className="invisible col-start-1 row-start-1 whitespace-nowrap font-serif font-normal italic tracking-[-0.03em]">
                    {w}
                  </span>
                ))}
                <span className="col-start-1 row-start-1 overflow-hidden pb-[0.12em] pr-[0.06em]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={words[i]}
                      initial={{ y: "105%" }}
                      animate={{ y: "0%" }}
                      exit={{ y: "-105%" }}
                      transition={{ duration: 0.7, ease }}
                      className="block whitespace-nowrap font-serif font-normal italic tracking-[-0.03em] text-[#ff4f1f]"
                    >
                      {words[i]}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <Squiggle />
              </span>
            </span>
          </h1>

          <SpinningBadge text={badge} />
        </div>

        {/* Body + actions */}
        <div className="mt-12 grid gap-8 border-t border-[#16130f]/15 pt-8 md:grid-cols-12 md:items-end lg:mt-16">
          <p className="max-w-[44ch] text-[17px] leading-relaxed text-[#16130f]/75 md:col-span-6 lg:col-span-5 lg:text-lg">{body}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 md:col-span-6 md:justify-end lg:col-span-7">
            <a
              href={primary.href}
              className="group inline-flex h-14 items-center gap-3 rounded-full bg-[#16130f] pl-7 pr-2 text-[15px] font-semibold text-[#f4f0e8] transition-transform duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0"
            >
              {primary.label}
              <span className="flex size-10 items-center justify-center rounded-full bg-[#ff4f1f] text-[#16130f] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:rotate-[-45deg]">
                <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
                  <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </a>
            <a
              href={secondary.href}
              className="text-[15px] font-semibold underline decoration-[#16130f]/25 decoration-2 underline-offset-[6px] transition-colors hover:decoration-[#ff4f1f]"
            >
              {secondary.label}
            </a>
          </div>
        </div>

        {/* Clients */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-[#16130f]/50">{clientsLabel}</p>
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[#16130f]/70">
            {clients.map((c, n) => (
              <li key={c} className={wordmarkStyles[n % wordmarkStyles.length]}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Fictional client wordmarks, each set differently so the row reads as real logos. */
const wordmarkStyles = [
  "font-display text-xl font-bold tracking-[-0.04em]",
  "font-serif text-2xl italic",
  "font-mono text-sm font-medium uppercase tracking-[0.2em]",
  "font-display text-xl font-light tracking-[0.02em]",
  "font-sans text-lg font-semibold tracking-[-0.02em]",
];

function Squiggle() {
  return (
    <svg
      viewBox="0 0 300 20"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -bottom-[0.02em] left-0 h-[0.14em] w-[92%] text-[#16130f]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12c18-9 30-9 46 0s30 9 46 0 30-9 46 0 30 9 46 0 30-9 46 0 30 9 46 0"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SpinningBadge({ text }: { text: string }) {
  return (
    <div className="absolute bottom-0 right-0 hidden size-36 md:block lg:right-6 lg:size-44" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="size-full animate-[spin_18s_linear_infinite] motion-reduce:animate-none">
        <defs>
          <path id="hero-editorial-circle" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" />
        </defs>
        <circle cx="100" cy="100" r="99" fill="#ffd23f" />
        <text className="fill-[#16130f] font-mono text-[14px] uppercase">
          <textPath href="#hero-editorial-circle" textLength="474" lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 40 40" className="size-10 text-[#16130f] lg:size-12" fill="currentColor">
          <path d="M20 2l3.6 11.1H35l-9.2 6.8 3.5 11.1L20 24.2 10.7 31l3.5-11.1L5 13.1h11.4z" />
        </svg>
      </div>
    </div>
  );
}

export default HeroEditorial;
