"use client";

import { motion, useReducedMotion } from "motion/react";

type Link = { label: string; href: string };

export type SwissIndexItem = {
  title: string;
  speaker: string;
  when: string;
  href: string;
};

export type HeroSwissGridProps = {
  /** Four metadata cells across the top, one per three columns. */
  meta?: [string, string, string, string];
  /** Headline lines, lowercase. Keep each line short. */
  lines?: string[];
  intro?: string;
  primary?: Link;
  secondary?: Link;
  /** Mono notes beside the actions. */
  notes?: string[];
  indexLabel?: string;
  /** Numbered tracks or speakers, 01–04. */
  items?: SwissIndexItem[];
  /** Column headers for the index on wide screens. */
  columns?: [string, string, string, string];
  /** Show the 12-column guides. */
  showGrid?: boolean;
};

const RED = "#e10600";

export function HeroSwissGrid({
  meta = ["Raster 2027", "34. Konferenz für Gestaltung", "Kongresshaus, Zürich", "14–16 May 2027"],
  lines = ["the grid", "sets you", "free."],
  intro = "Three days on grids, type and systems in the city that wrote the rulebook. 600 seats, 24 speakers and one house rule: nothing gets centred without a reason.",
  primary = { label: "Tickets, CHF 680", href: "#tickets" },
  secondary = { label: "Programme (PDF, 2.4 MB)", href: "#programme" },
  notes = ["Early rate until 31 January", "Students CHF 240"],
  indexLabel = "Index",
  items = [
    { title: "Grids & systems", speaker: "Lea Brunner", when: "Fri 14 · 09:30", href: "#track-01" },
    { title: "Type in motion", speaker: "Matteo Fässler", when: "Fri 14 · 14:00", href: "#track-02" },
    { title: "Information design", speaker: "Ines Okafor-Weiss", when: "Sat 15 · 10:00", href: "#track-03" },
    { title: "The poster is not dead", speaker: "Tomasz Wierzbicki", when: "Sun 16 · 11:00", href: "#track-04" },
  ],
  columns = ["No.", "Track", "Speaker", "When"],
  showGrid = true,
}: HeroSwissGridProps) {
  const reduce = useReducedMotion();
  const cols = "grid grid-cols-4 gap-x-4 md:grid-cols-12 md:gap-x-6";

  return (
    <section className="relative isolate overflow-hidden bg-white text-[#0a0a0a]">
      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        {/* Column guides: the same grid as the content, so everything visibly sits on it */}
        {showGrid ? (
          <div className={`pointer-events-none absolute inset-y-0 left-5 right-5 sm:left-8 sm:right-8 lg:left-12 lg:right-12 ${cols}`} aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={`border-x border-[#0a0a0a]/[0.06] bg-[#0a0a0a]/[0.012] ${i >= 4 ? "hidden md:block" : ""}`} />
            ))}
          </div>
        ) : null}

        <div className="relative">
          {/* Meta row */}
          <div className={`${cols} gap-y-1 border-b border-[#0a0a0a] pb-4 pt-6 font-mono text-[11px] uppercase leading-[1.4] tracking-[0.08em] md:pt-8`}>
            {meta.map((m, i) => (
              <p key={m} className={`col-span-2 md:col-span-3 ${i === 0 ? "font-semibold" : "text-[#0a0a0a]/70"}`}>
                {m}
              </p>
            ))}
          </div>

          {/* Headline + red quarter circle */}
          <div className={`${cols} pt-6 md:pt-8`}>
            <div className="relative col-span-2 col-start-3 row-start-1 aspect-square md:col-span-4 md:col-start-9" aria-hidden="true">
              <motion.svg
                viewBox="0 0 100 100"
                className="absolute inset-0 size-full"
                initial={reduce ? false : { scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 1.2, ease: [0.7, 0, 0.2, 1], delay: 0.25 }}
                style={{ transformOrigin: "100% 0%" }}
              >
                <path d="M100 0V100A100 100 0 0 1 0 0Z" fill={RED} />
              </motion.svg>
            </div>
            <h1 className="col-span-4 row-start-2 -ml-[0.04em] -mt-[7vw] font-sans text-[19vw] font-bold lowercase leading-[0.86] tracking-[-0.065em] md:col-span-8 md:col-start-1 md:row-start-1 md:mt-0 md:text-[clamp(3.6rem,0.9rem+12.2vw,11.5rem)]">
              {lines.map((l, i) => (
                <span key={i} className="block">
                  {l}
                </span>
              ))}
            </h1>
          </div>

          {/* Intro, actions, notes */}
          <div className={`${cols} gap-y-8 pb-12 pt-12 md:pb-16 md:pt-16`}>
            <p className="col-span-4 max-w-[38ch] text-[17px] leading-[1.55] md:col-span-4">{intro}</p>
            <div className="col-span-4 flex flex-col items-start gap-4 md:col-span-4 md:col-start-5">
              <a
                href={primary.href}
                className="group inline-flex h-14 items-center gap-6 bg-[#0a0a0a] pl-5 pr-4 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-[#e10600] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#e10600]"
              >
                {primary.label}
                <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" aria-hidden="true">
                  <path d="M2 8h12m0 0L9 3m5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
                </svg>
              </a>
              <a
                href={secondary.href}
                className="text-[15px] font-medium underline decoration-1 underline-offset-[5px] transition-colors hover:text-[#e10600] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#e10600]"
              >
                {secondary.label}
              </a>
            </div>
            <ul className="col-span-4 space-y-1 font-mono text-[11px] uppercase leading-[1.5] tracking-[0.08em] text-[#0a0a0a]/70 md:col-span-3 md:col-start-9">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          {/* Index */}
          <nav aria-label={indexLabel} className="pb-12 md:pb-16">
            <div className={`${cols} border-b border-[#0a0a0a] pb-3 font-mono text-[11px] uppercase tracking-[0.08em]`}>
              <p className="col-span-1 font-semibold">{indexLabel}</p>
              <p className="col-span-3 text-[#0a0a0a]/60 md:hidden">{items.length} tracks</p>
              <p className="hidden text-[#0a0a0a]/60 md:col-span-5 md:block">{columns[1]}</p>
              <p className="hidden text-[#0a0a0a]/60 md:col-span-3 md:block">{columns[2]}</p>
              <p className="hidden text-[#0a0a0a]/60 md:col-span-3 md:block">{columns[3]}</p>
            </div>
            <ol>
              {items.map((it, i) => (
                <li key={it.title}>
                  <a
                    href={it.href}
                    className={`group ${cols} items-baseline border-b border-[#0a0a0a]/25 py-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#e10600] md:py-5`}
                  >
                    <span className="col-span-1 font-mono text-[13px] tabular-nums transition-colors group-hover:text-[#e10600]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="col-span-3 font-sans text-[clamp(1.35rem,1rem+1.4vw,2.25rem)] font-semibold leading-[1.05] tracking-[-0.035em] md:col-span-5">
                      <span className="bg-[linear-gradient(#e10600,#e10600)] bg-[length:0%_2px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:bg-[length:100%_2px]">
                        {it.title}
                      </span>
                    </span>
                    <span className="col-span-3 col-start-2 mt-1 text-[15px] text-[#0a0a0a]/75 md:col-span-3 md:col-start-auto md:mt-0">{it.speaker}</span>
                    <span className="col-span-3 col-start-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#0a0a0a]/60 md:col-span-3 md:col-start-auto md:flex md:items-baseline md:justify-between">
                      {it.when}
                      <span aria-hidden="true" className="hidden translate-x-[-6px] text-[15px] text-[#e10600] opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-0 group-hover:opacity-100 md:inline">
                        →
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </section>
  );
}

export default HeroSwissGrid;
