"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "motion/react";

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
  /** The one signal colour: quarter circle, hovers and focus rings. */
  accent?: string;
  /** Black poster (default) or white paper. */
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: { bg: "#0a0a0a", ink: "#f4f4f2", onInk: "#0a0a0a" },
  light: { bg: "#ffffff", ink: "#0a0a0a", onInk: "#ffffff" },
} as const;

const SWISS_RED = "#e10600";

/** Black or white, whichever reads better on the accent fill (WCAG luminance). */
function onAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // White text wins unless the fill is light enough that black has more contrast.
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? "#ffffff" : "#0a0a0a";
}

const EASE = [0.22, 1, 0.36, 1] as const;

// One timeline, in seconds, so the order reads top to bottom:
// guides (containers) → meta → headline → shape → intro row → index.
const T = {
  guides: 0,
  guideStep: 0.02,
  metaRule: 0.04,
  meta: 0.08,
  headline: 0.16,
  shape: 0.38,
  intro: 0.44,
  index: 0.56,
  step: 0.06,
  dur: 0.6,
  rule: 0.7,
} as const;

/** Rise 12px out of an 8px blur; `custom` is the start time in seconds. */
const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.dur, ease: EASE, delay } }),
};
/** Hairline rules draw from the left edge. */
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: T.rule, ease: EASE, delay } }),
};
/** Column guides drop from the top edge. */
const drawY: Variants = {
  hidden: { scaleY: 0, opacity: 0 },
  show: (delay: number) => ({ scaleY: 1, opacity: 1, transition: { duration: T.rule, ease: EASE, delay } }),
};
/** The quarter circle grows out of its own corner: no rotation, no overshoot. */
const grow: Variants = {
  hidden: { scale: 0 },
  show: (delay: number) => ({ scale: 1, transition: { duration: 0.7, ease: EASE, delay } }),
};
/** Reduced motion: one short fade for everything, no transforms, blur or stagger. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

// Content and guides share one grid, so everything visibly sits on it.
const COLS = "grid grid-cols-4 gap-x-4 @3xl:grid-cols-12 @3xl:gap-x-6";
const GUTTER = "px-5 @xl:px-8 @5xl:px-12";
const MONO = "font-mono text-[11px] uppercase tracking-[0.08em]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--sg-accent)";

/**
 * Hover as state rather than the :hover pseudo-class, so a scripted pointer
 * (the demo player, tests) lights things up exactly like a real mouse does.
 * Styles read `data-hot`, which the element and its `group` children share.
 */
function useHot() {
  const [hot, setHot] = useState(false);
  return {
    "data-hot": hot,
    onPointerEnter: () => setHot(true),
    onPointerLeave: () => setHot(false),
  } as const;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

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
  accent = SWISS_RED,
  theme = "dark",
}: HeroSwissGridProps) {
  const rootRef = useRef<HTMLElement>(null);
  const reduce = !!useReducedMotion();
  // Reveal once, when a fifth of the hero is on screen.
  const inView = useInView(rootRef, { once: true, amount: 0.2 });
  const p = PALETTE[theme];
  const vars = { "--sg-bg": p.bg, "--sg-ink": p.ink, "--sg-on-ink": p.onInk, "--sg-accent": accent, "--sg-on-accent": onAccent(accent) } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  return (
    <motion.section
      ref={rootRef}
      style={vars}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className="@container relative isolate overflow-hidden bg-(--sg-bg) text-(--sg-ink)"
    >
      <div className={`relative mx-auto max-w-[1440px] ${GUTTER}`}>
        {showGrid ? <Guides variants={v(drawY)} /> : null}

        <div className="relative">
          {/* Meta row */}
          <div className={`${COLS} relative gap-y-1 pb-4 pt-6 ${MONO} leading-[1.4] @3xl:pt-8`}>
            {meta.map((m, i) => (
              <motion.p key={m} variants={v(reveal)} custom={T.meta + i * T.step} className={`col-span-2 @3xl:col-span-3 ${i === 0 ? "font-semibold" : "text-(--sg-ink)/70"}`}>
                {m}
              </motion.p>
            ))}
            <Rule variants={v(drawX)} delay={T.metaRule} className="bottom-0 bg-(--sg-ink)" />
          </div>

          {/* Headline + quarter circle */}
          <div className={`${COLS} pt-6 @3xl:pt-8`}>
            <div className="relative col-span-2 col-start-3 row-start-1 aspect-square @3xl:col-span-4 @3xl:col-start-9" aria-hidden="true">
              <motion.svg viewBox="0 0 100 100" className="absolute inset-0 size-full origin-top-right" variants={v(grow)} custom={T.shape}>
                {/* Centre at the top-right corner, radius = the cell. */}
                <path d="M100 0V100A100 100 0 0 1 0 0Z" className="fill-(--sg-accent)" />
              </motion.svg>
            </div>
            <h1 className="col-span-4 row-start-2 -ml-[0.04em] -mt-[7cqi] font-sans text-[19cqi] font-bold lowercase leading-[0.86] tracking-[-0.065em] @3xl:col-span-8 @3xl:col-start-1 @3xl:row-start-1 @3xl:mt-0 @3xl:text-[clamp(3.6rem,0.9rem+12.2cqi,11.5rem)]">
              {lines.map((l, i) => (
                <motion.span key={i} variants={v(reveal)} custom={T.headline + i * T.step * 1.2} className="block">
                  {l}
                </motion.span>
              ))}
            </h1>
          </div>

          {/* Intro, actions, notes */}
          <div className={`${COLS} gap-y-8 pb-12 pt-12 @3xl:pb-16 @3xl:pt-16`}>
            <motion.p variants={v(reveal)} custom={T.intro} className="col-span-4 max-w-[38ch] text-[17px] leading-[1.55]">
              {intro}
            </motion.p>
            <motion.div variants={v(reveal)} custom={T.intro + T.step} className="col-span-4 flex flex-col items-start gap-4 @3xl:col-start-5">
              <PrimaryButton link={primary} />
              <SecondaryLink link={secondary} />
            </motion.div>
            <motion.ul
              variants={v(reveal)}
              custom={T.intro + T.step * 2}
              className={`col-span-4 space-y-1 ${MONO} leading-[1.5] text-(--sg-ink)/70 @3xl:col-span-3 @3xl:col-start-9`}
            >
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </motion.ul>
          </div>

          <Index label={indexLabel} items={items} columns={columns} reduce={reduce} />
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

/** Full-height column guides on the content grid; four on narrow containers, twelve from 48rem. */
function Guides({ variants }: { variants: Variants }) {
  return (
    <div className={`pointer-events-none absolute inset-y-0 left-5 right-5 @xl:left-8 @xl:right-8 @5xl:left-12 @5xl:right-12 ${COLS}`} aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <motion.span
          key={i}
          variants={variants}
          custom={T.guides + i * T.guideStep}
          className={`origin-top border-x border-(--sg-ink)/[0.07] bg-(--sg-ink)/[0.015] ${i >= 4 ? "hidden @3xl:block" : ""}`}
        />
      ))}
    </div>
  );
}

/** A 1px rule that draws left to right. */
function Rule({ variants, delay, className }: { variants: Variants; delay: number; className: string }) {
  return <motion.span aria-hidden="true" variants={variants} custom={delay} className={`absolute inset-x-0 h-px origin-left ${className}`} />;
}

function SecondaryLink({ link }: { link: Link }) {
  const hot = useHot();
  return (
    <a
      href={link.href}
      data-demo="secondary"
      {...hot}
      className={`text-[15px] font-medium underline decoration-1 underline-offset-[5px] transition-[color,transform] duration-150 data-[hot=true]:text-(--sg-accent) active:scale-[0.97] ${FOCUS}`}
    >
      {link.label}
    </a>
  );
}

function PrimaryButton({ link }: { link: Link }) {
  const hot = useHot();
  return (
    <a
      href={link.href}
      data-demo="primary"
      {...hot}
      className={`group inline-flex h-14 items-center gap-6 bg-(--sg-ink) pl-5 pr-4 text-[15px] font-semibold text-(--sg-on-ink) transition-[color,background-color,transform] duration-150 data-[hot=true]:bg-(--sg-accent) data-[hot=true]:text-(--sg-on-accent) active:scale-[0.97] ${FOCUS}`}
    >
      {link.label}
      <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-150 group-data-[hot=true]:translate-x-1" fill="none" aria-hidden="true">
        <path d="M2 8h12m0 0L9 3m5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
      </svg>
    </a>
  );
}

function Index({
  label,
  items,
  columns,
  reduce,
}: {
  label: string;
  items: SwissIndexItem[];
  columns: [string, string, string, string];
  reduce: boolean;
}) {
  const v = (variants: Variants) => (reduce ? fade : variants);
  const head = (i: number, children: ReactNode, className: string) => (
    <motion.p variants={v(reveal)} custom={T.index + i * T.step * 0.5} className={className}>
      {children}
    </motion.p>
  );

  return (
    <nav aria-label={label} className="pb-12 @3xl:pb-16">
      <div className={`${COLS} relative pb-3 ${MONO}`}>
        {head(0, label, "col-span-1 font-semibold")}
        {head(1, `${items.length} tracks`, "col-span-3 text-(--sg-ink)/60 @3xl:hidden")}
        {head(1, columns[1], "hidden text-(--sg-ink)/60 @3xl:col-span-5 @3xl:block")}
        {head(2, columns[2], "hidden text-(--sg-ink)/60 @3xl:col-span-3 @3xl:block")}
        {head(3, columns[3], "hidden text-(--sg-ink)/60 @3xl:col-span-3 @3xl:block")}
        <Rule variants={v(drawX)} delay={T.index} className="bottom-0 bg-(--sg-ink)" />
      </div>
      <ol>
        {items.map((it, i) => (
          <IndexRow key={it.title} item={it} n={i + 1} delay={T.index + T.step * (i + 1)} reduce={reduce} />
        ))}
      </ol>
    </nav>
  );
}

function IndexRow({ item, n, delay, reduce }: { item: SwissIndexItem; n: number; delay: number; reduce: boolean }) {
  const hot = useHot();
  return (
    <li className="relative">
      <motion.a
        href={item.href}
        data-demo={`track-${n}`}
        {...hot}
        variants={reduce ? fade : reveal}
        custom={delay}
        className={`group ${COLS} items-baseline py-4 transition-transform duration-150 active:scale-[0.99] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--sg-accent) @3xl:py-5`}
      >
        <span className="col-span-1 font-mono text-[13px] tabular-nums transition-colors duration-150 group-data-[hot=true]:text-(--sg-accent)">{String(n).padStart(2, "0")}</span>
        <span className="col-span-3 font-sans text-[clamp(1.35rem,1rem+1.4cqi,2.25rem)] font-semibold leading-[1.05] tracking-[-0.035em] @3xl:col-span-5">
          {/* The underline is a background so it can grow from the left on hover. */}
          <span className="bg-[linear-gradient(var(--sg-accent),var(--sg-accent))] bg-[length:0%_2px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[hot=true]:bg-[length:100%_2px]">
            {item.title}
          </span>
        </span>
        <span className="col-span-3 col-start-2 mt-1 text-[15px] text-(--sg-ink)/75 @3xl:col-span-3 @3xl:col-start-auto @3xl:mt-0">{item.speaker}</span>
        <span className="col-span-3 col-start-2 font-mono text-[11px] uppercase tracking-[0.08em] text-(--sg-ink)/60 @3xl:col-span-3 @3xl:col-start-auto @3xl:flex @3xl:items-baseline @3xl:justify-between">
          {item.when}
          <span
            aria-hidden="true"
            className="hidden -translate-x-1.5 text-[15px] text-(--sg-accent) opacity-0 transition-[opacity,transform] duration-200 group-data-[hot=true]:translate-x-0 group-data-[hot=true]:opacity-100 @3xl:inline"
          >
            →
          </span>
        </span>
      </motion.a>
      <Rule variants={reduce ? fade : drawX} delay={delay + 0.04} className="bottom-0 bg-(--sg-ink)/25" />
    </li>
  );
}

/** The featured instance. Controls pass overrides, which win over the defaults. */
export default function HeroSwissGridDemo(overrides: Partial<HeroSwissGridProps> = {}) {
  return <HeroSwissGrid {...overrides} />;
}
