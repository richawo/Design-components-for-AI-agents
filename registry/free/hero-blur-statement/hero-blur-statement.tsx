"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring, type MotionValue, type Variants } from "motion/react";

type Link = { label: string; href: string };

export type RotatingNoun = {
  /** The name that rolls into the sentence. Keep it to one short word. */
  word: string;
  /** A few words about the work, shown beside the counter. */
  note: string;
};

export type HeroBlurStatementProps = {
  /** Mono line, top left. */
  eyebrow?: string;
  /** Mono line, top right (availability, location). */
  status?: string;
  /** Words before the rotating name. */
  lead?: string;
  /** Names that take turns in the sentence. The first is the static one with reduced motion. */
  nouns?: RotatingNoun[];
  /** Words after the rotating name, set at 38% ink. A "\n" (or " / " in a single-line field) breaks the line on wide containers. */
  tail?: string;
  primary?: Link;
  secondary?: Link;
  /** Time each name holds, in ms. */
  interval?: number;
  /** Film grain strength, 0–1. */
  grain?: number;
  /** Grainy true black (default) or warm-white paper. */
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: { page: "#000000", ink: "#f5f5f4", name: "#ffffff", onInk: "#000000", falloff: "rgba(255,255,255,0.035)" },
  light: { page: "#f4f3ef", ink: "#0c0c0b", name: "#000000", onInk: "#f4f3ef", falloff: "rgba(255,255,255,0.6)" },
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

/** The slot's width spring: a little give, so the line visibly breathes around the new name. */
const SLOT_SPRING = { stiffness: 260, damping: 26, mass: 0.9 } as const;

/**
 * One timeline, in seconds: the top row, then the sentence word by word, then
 * the bottom row (its hairline draws first, then the actions and the control).
 */
const T = {
  top: 0,
  topStep: 0.06,
  words: 0.12,
  wordStep: 0.04,
  wordDur: 0.75,
  rule: 0.5,
  ruleDur: 0.8,
  footer: 0.58,
  footerStep: 0.06,
  dur: 0.6,
} as const;

/** The first name holds this much longer while the sentence blurs in, in ms. */
const FIRST_HOLD = 900;
/** Longest frame the clock will count, so a stalled tab doesn't skip a name on return. */
const MAX_FRAME = 250;

// Fine monochrome film grain, drawn by the browser from an inline SVG filter (no network).
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>\")";

// The name's face: serif italic against the grotesk, the contrast is the point.
const NAME_FACE = "font-serif text-[1.08em] italic leading-[0.89] tracking-[-0.02em]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--bs-ink)";

/** Words blur in: 12px blur and a small drop clear together. */
const word: Variants = {
  hidden: { opacity: 0, filter: "blur(12px)", y: "0.08em" },
  show: (i: number) => ({ opacity: 1, filter: "blur(0px)", y: "0em", transition: { duration: T.wordDur, ease: EASE, delay: T.words + i * T.wordStep } }),
};
/** Blocks around the sentence rise 10px out of an 8px blur; `custom` is the start time. */
const reveal: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.dur, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
/** The bottom hairline draws from the left edge. */
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: T.ruleDur, ease: EASE, delay } }),
};
/** Reduced motion: one short fade, no transforms or blur. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const DEFAULT_NOUNS: RotatingNoun[] = [
  { word: "Tessel", note: "Issue tracking, 2022" },
  { word: "Kiln", note: "Build pipelines" },
  { word: "Meridian", note: "Startup treasury" },
  { word: "Parcel", note: "Returns, no queue" },
  { word: "Northwind", note: "Fleet telemetry" },
  { word: "Strata", note: "Design tokens, 2025" },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function HeroBlurStatement({
  eyebrow = "Ferro & Vale · Product studio, Lisbon",
  status = "Booking from February 2027",
  lead = "We design products for",
  nouns = DEFAULT_NOUNS,
  tail = "that people\nopen on purpose.",
  primary = { label: "Start a project", href: "#contact" },
  secondary = { label: "See selected work", href: "#work" },
  interval = 2600,
  grain = 0.07,
  theme = "dark",
}: HeroBlurStatementProps) {
  const reduce = !!useReducedMotion();
  const list = nouns.length ? nouns : DEFAULT_NOUNS;
  const [hovering, setHovering] = useState(false);
  const [held, setHeld] = useState(false);
  const paused = reduce || hovering || held || list.length < 2;

  const rootRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [index, step] = useRotation({ count: list.length, interval, paused, reduce, rootRef, barRef });
  const current = list[Math.min(index, list.length - 1)];

  const p = PALETTE[theme];
  const vars = { "--bs-page": p.page, "--bs-ink": p.ink, "--bs-name": p.name, "--bs-on-ink": p.onInk } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  return (
    <motion.section
      ref={rootRef}
      aria-label="Introduction"
      style={vars}
      initial="hidden"
      animate="show"
      className="@container relative isolate overflow-hidden bg-(--bs-page) text-(--bs-ink)"
    >
      {/* Film grain: static, faint, never on top of the copy's contrast budget. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px", opacity: grain }}
      />
      {/* A very soft falloff toward the corners keeps the page from feeling flat. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: `radial-gradient(120% 90% at 20% 0%, ${p.falloff}, transparent 60%)` }} />

      <div className="@container mx-auto flex min-h-[clamp(640px,100svh,980px)] max-w-[1440px] flex-col px-5 pb-8 pt-6 @md:px-8 @md:pb-10 @md:pt-8 @5xl:px-14 @5xl:pb-14 @5xl:pt-12">
        <TopRow eyebrow={eyebrow} status={status} v={v} />

        <div className="flex flex-1 flex-col justify-end pb-10 pt-20 @md:pb-14 @md:pt-28 @5xl:pb-16">
          <Statement
            lead={lead}
            tail={tail}
            names={list}
            index={index}
            reduce={reduce}
            onHover={setHovering}
          />
        </div>

        <Footer
          primary={primary}
          secondary={secondary}
          v={v}
          control={
            list.length > 1 ? (
              <RotationControl
                index={index}
                total={list.length}
                note={current.note}
                held={held}
                paused={paused}
                reduce={reduce}
                barRef={barRef}
                // With reduced motion nothing rotates on its own; the control steps through the names instead.
                onPress={() => (reduce ? step() : setHeld((h) => !h))}
              />
            ) : null
          }
        />
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * The rotation clock. One rAF loop advances the name and writes the progress
 * hairline's scale straight to the DOM (no React render per frame), so pausing
 * freezes both together. It also stops offscreen and in hidden tabs.
 * Returns the current index and a function that steps to the next name.
 */
function useRotation({
  count,
  interval,
  paused,
  reduce,
  rootRef,
  barRef,
}: {
  count: number;
  interval: number;
  paused: boolean;
  reduce: boolean;
  rootRef: RefObject<HTMLElement | null>;
  barRef: RefObject<HTMLSpanElement | null>;
}): [number, () => void] {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (reduce || count < 2) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (rootRef.current) io.observe(rootRef.current);
    let elapsed = -FIRST_HOLD;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME);
      last = now;
      if (!pausedRef.current && visible && !document.hidden) {
        elapsed += dt;
        if (elapsed >= interval) {
          elapsed = 0;
          setIndex((i) => (i + 1) % count);
        }
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, elapsed / interval)).toFixed(4)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [reduce, count, interval, rootRef, barRef]);

  const step = useCallback(() => setIndex((i) => (i + 1) % Math.max(1, count)), [count]);
  return [index, step];
}

/**
 * The slot's width, as a spring that follows the current name. Every name is
 * measured in the slot's own font from an invisible measurer, re-measured when
 * the headline resizes and when web fonts land. The first measure jumps.
 */
function useSlotWidth(measureRef: RefObject<HTMLSpanElement | null>, index: number, reduce: boolean): MotionValue<number> {
  const width = useSpring(0, SLOT_SPRING);
  const measured = useRef(false);

  const measure = useCallback(() => {
    const box = measureRef.current;
    if (!box) return;
    const w = (box.children[index] as HTMLElement | undefined)?.getBoundingClientRect().width ?? 0;
    if (!measured.current || reduce) {
      width.jump(w);
      measured.current = w > 0;
    } else width.set(w);
  }, [measureRef, index, reduce, width]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const box = measureRef.current;
    if (!box) return;
    // The slot follows the headline's container-relative size, so watch the h1.
    const ro = new ResizeObserver(measure);
    ro.observe(box.parentElement ?? box);
    let live = true;
    document.fonts?.ready.then(() => live && measure()).catch(() => {});
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [measureRef, measure]);

  return width;
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function TopRow({ eyebrow, status, v }: { eyebrow: string; status: string; v: (variants: Variants) => Variants }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-(--bs-ink)/55">
      <motion.p variants={v(reveal)} custom={T.top}>
        {eyebrow}
      </motion.p>
      <motion.p variants={v(reveal)} custom={T.top + T.topStep} className="flex items-center gap-2.5">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-(--bs-ink)/70 shadow-[0_0_0_3px_color-mix(in_oklab,var(--bs-ink)_8%,transparent)]" />
        {status}
      </motion.p>
    </div>
  );
}

/**
 * The sentence: lead words, the springing name slot, then the tail. Lines are
 * fixed with explicit breaks so the springing slot pushes its neighbours
 * sideways but never re-wraps them.
 */
function Statement({
  lead,
  tail,
  names,
  index,
  reduce,
  onHover,
}: {
  lead: string;
  tail: string;
  names: RotatingNoun[];
  index: number;
  reduce: boolean;
  onHover: (hovering: boolean) => void;
}) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const width = useSlotWidth(measureRef, index, reduce);
  const current = names[Math.min(index, names.length - 1)];
  const leadWords = lead.split(" ").filter(Boolean);
  // "\n" in the tail is a line break on wide containers.
  const tailLines = tail.split("\n").map((line) => line.split(" ").filter(Boolean));
  const fullSentence = `${lead} ${names.map((x) => x.word).join(", ")} ${tail.replace(/\n/g, " ")}`;
  const v = reduce ? fade : word;
  // Word order sets the stagger: lead, then the slot, then the tail, line by line.
  const slotOrder = leadWords.length;
  const tailStarts = tailLines.map((_, li) => slotOrder + 1 + tailLines.slice(0, li).reduce((n, l) => n + l.length, 0));

  return (
    <h1
      data-demo="statement"
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
      onPointerLeave={() => onHover(false)}
      className="relative font-display text-[clamp(2.9rem,0.6rem+7.6cqw,8.75rem)] font-medium leading-[0.96] tracking-[-0.058em] [text-wrap:pretty]"
    >
      <span className="sr-only">{fullSentence}</span>
      <span aria-hidden="true" className="block">
        <Words words={leadWords} first={0} variants={v} />
        <br />

        <motion.span custom={slotOrder} variants={v} className="relative inline-block whitespace-nowrap align-baseline">
          <NameSlot name={current.word} width={width} reduce={reduce} />
        </motion.span>
        {/* Narrow containers give the name a line of its own, so nothing re-wraps there either. */}
        <br className="@3xl:hidden" />
        <span className="hidden @3xl:inline"> </span>

        {tailLines.map((line, li) => (
          <span key={li}>
            {li > 0 ? (
              <>
                <br className="hidden @3xl:inline" />
                <span className="@3xl:hidden"> </span>
              </>
            ) : null}
            <Words words={line} first={tailStarts[li]} variants={v} className="text-(--bs-ink)/[0.38]" />
          </span>
        ))}
      </span>

      {/* Measurer: every name, same font, out of flow. */}
      <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap">
        {names.map((x) => (
          <span key={x.word} className={`absolute left-0 top-0 pr-[0.03em] ${NAME_FACE}`}>
            {x.word}
          </span>
        ))}
      </span>
    </h1>
  );
}

/** A run of words that blur in one after another; `first` is the run's place in the sentence. */
function Words({ words, first, variants, className = "" }: { words: string[]; first: number; variants: Variants; className?: string }) {
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <motion.span custom={first + i} variants={variants} className={`inline-block will-change-[filter,transform] ${className}`}>
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

/** An inline box whose width springs to the next name while the names roll through it. */
function NameSlot({ name, width, reduce }: { name: string; width: MotionValue<number>; reduce: boolean }) {
  return (
    <motion.span style={{ width }} className="relative inline-block">
      {/* Invisible copy of the current name gives the box its baseline. */}
      <span className={`invisible ${NAME_FACE}`}>{name}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={name}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.32em", filter: "blur(10px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: "0em", filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: "-0.32em", filter: "blur(10px)", transition: { duration: 0.34, ease: EASE_IN } }}
          transition={{ duration: 0.52, ease: EASE }}
          className={`absolute left-0 top-0 text-(--bs-name) ${NAME_FACE}`}
        >
          {name}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

/** Hairline, then the actions and the rotation control, one after another. */
function Footer({ primary, secondary, control, v }: { primary: Link; secondary: Link; control: ReactNode; v: (variants: Variants) => Variants }) {
  return (
    <div className="relative flex flex-col gap-5 pt-6 @md:pt-8 @4xl:flex-row @4xl:items-center @4xl:justify-between">
      <motion.span aria-hidden="true" variants={v(drawX)} custom={T.rule} className="absolute inset-x-0 top-0 h-px origin-left bg-(--bs-ink)/10" />
      <div className="flex gap-2 @md:gap-3 [&>*]:flex-1 @md:[&>*]:flex-none">
        <motion.a
          variants={v(reveal)}
          custom={T.footer}
          href={primary.href}
          className={`group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-(--bs-ink) px-5 text-[15px] font-medium tracking-[-0.01em] text-(--bs-on-ink) transition-[background-color,scale] duration-150 ease-out hover:bg-(--bs-name) active:scale-[0.97] active:duration-75 @md:px-6 ${FOCUS}`}
        >
          {primary.label}
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5">
            <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.a>
        <motion.a
          variants={v(reveal)}
          custom={T.footer + T.footerStep}
          href={secondary.href}
          className={`inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[15px] font-medium tracking-[-0.01em] text-(--bs-ink)/70 ring-1 ring-inset ring-(--bs-ink)/15 transition-[color,background-color,box-shadow,scale] duration-150 ease-out hover:bg-(--bs-ink)/[0.04] hover:text-(--bs-ink) hover:ring-(--bs-ink)/25 active:scale-[0.97] active:duration-75 @md:px-5 ${FOCUS}`}
        >
          {secondary.label}
        </motion.a>
      </div>
      {control ? (
        <motion.div variants={v(reveal)} custom={T.footer + T.footerStep * 2} className="self-start @4xl:self-auto">
          {control}
        </motion.div>
      ) : null}
    </div>
  );
}

/** Pause/play (or "next" with reduced motion), the counter, the progress hairline and the current name's note. */
function RotationControl({
  index,
  total,
  note,
  held,
  paused,
  reduce,
  barRef,
  onPress,
}: {
  index: number;
  total: number;
  note: string;
  held: boolean;
  paused: boolean;
  reduce: boolean;
  barRef: RefObject<HTMLSpanElement | null>;
  onPress: () => void;
}) {
  const pad = (k: number) => String(k).padStart(2, "0");
  return (
    <button
      type="button"
      onClick={onPress}
      data-demo="rotation"
      aria-label={reduce ? "Show the next client name" : held ? "Resume rotating client names" : "Pause rotating client names"}
      aria-pressed={reduce ? undefined : held}
      className="group -mx-2 flex min-h-11 items-center gap-3 rounded-full px-2 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-(--bs-ink)/55 transition-colors duration-150 hover:text-(--bs-ink)/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--bs-ink) active:scale-[0.98] @4xl:mx-0"
    >
      <span aria-hidden="true" className="grid size-6 place-items-center rounded-full ring-1 ring-inset ring-(--bs-ink)/15 transition-[box-shadow] duration-150 group-hover:ring-(--bs-ink)/30">
        <ControlGlyph kind={reduce ? "next" : paused ? "play" : "pause"} />
      </span>
      <span className="shrink-0 whitespace-nowrap tabular-nums text-(--bs-ink)/80">
        {pad(index + 1)}
        <span className="text-(--bs-ink)/35"> / {pad(total)}</span>
      </span>
      {reduce ? null : (
        <span aria-hidden="true" className="relative h-px w-8 shrink-0 overflow-hidden bg-(--bs-ink)/15 @md:w-10">
          <span ref={barRef} className="absolute inset-0 origin-left scale-x-0 bg-(--bs-ink)/70" />
        </span>
      )}
      <span className="relative grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={note}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.2 } }}
            transition={{ duration: 0.32, ease: EASE }}
            className="truncate"
          >
            {note}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

function ControlGlyph({ kind }: { kind: "next" | "play" | "pause" }) {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
      {kind === "next" ? (
        <path d="M2.5 6h6.5M6.5 3.2 9.3 6 6.5 8.8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : kind === "play" ? (
        <path d="M3.5 2.2v7.6L9.6 6z" fill="currentColor" />
      ) : (
        <path d="M3.2 2.4h1.8v7.2H3.2zM7 2.4h1.8v7.2H7z" fill="currentColor" />
      )}
    </svg>
  );
}

/**
 * The hero as it ships. Names hold 1.5 s here (the component's own default is 2.6 s)
 * so the demo shows several rolls in a few seconds; the Customize slider starts at 1500
 * and "Copy configured" keeps whatever it is set to. Overrides come from the Customize
 * panel, whose single-line Tail field writes " / " for the line break.
 */
export default function HeroBlurStatementDemo(overrides: Partial<HeroBlurStatementProps> = {}) {
  const tail = overrides.tail?.replace(/ \/ /g, "\n");
  return <HeroBlurStatement interval={1500} {...overrides} {...(tail === undefined ? {} : { tail })} />;
}
