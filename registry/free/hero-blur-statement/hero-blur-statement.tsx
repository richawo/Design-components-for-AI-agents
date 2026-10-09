"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring, type Variants } from "motion/react";

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
  /** Words after the rotating name, set at 38% white. A "\n" breaks the line on wide containers. */
  tail?: string;
  primary?: Link;
  secondary?: Link;
  /** Time each name holds, in ms. */
  interval?: number;
  /** Film grain strength, 0–1. */
  grain?: number;
};

const ease = [0.22, 1, 0.36, 1] as const;

// Fine monochrome film grain, drawn by the browser from an inline SVG filter (no network).
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>\")";

const DEFAULT_NOUNS: RotatingNoun[] = [
  { word: "Tessel", note: "Issue tracking, 2022" },
  { word: "Kiln", note: "Build pipelines" },
  { word: "Meridian", note: "Startup treasury" },
  { word: "Parcel", note: "Returns, no queue" },
  { word: "Northwind", note: "Fleet telemetry" },
  { word: "Strata", note: "Design tokens, 2025" },
];

const word: Variants = {
  hidden: { opacity: 0, filter: "blur(12px)", y: "0.08em" },
  show: (i: number) => ({
    opacity: 1,
    filter: "blur(0px)",
    y: "0em",
    transition: { duration: 0.75, ease, delay: 0.12 + i * 0.04 },
  }),
};

const wordReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

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
}: HeroBlurStatementProps) {
  const reduce = !!useReducedMotion();
  const list = nouns.length ? nouns : DEFAULT_NOUNS;
  const n = list.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [held, setHeld] = useState(false);
  const paused = reduce || hovering || held || n < 2;

  const rootRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const widths = useRef<number[]>([]);
  const width = useSpring(0, { stiffness: 260, damping: 26, mass: 0.9 });
  const measured = useRef(false);

  // Measure every name in the slot's own font so the slot can spring to fit.
  const measure = useCallback(() => {
    const box = measureRef.current;
    if (!box) return;
    widths.current = Array.from(box.children).map((el) => (el as HTMLElement).getBoundingClientRect().width);
    const w = widths.current[index] ?? 0;
    if (!measured.current || reduce) {
      width.jump(w);
      measured.current = w > 0;
    } else width.set(w);
  }, [index, reduce, width]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const box = measureRef.current;
    if (!box) return;
    // The slot follows the headline's container-relative size, so watch the h1.
    const ro = new ResizeObserver(() => measure());
    ro.observe(box.parentElement ?? box);
    // Web fonts can land after first paint and change every width.
    document.fonts?.ready.then(() => measure()).catch(() => {});
    return () => ro.disconnect();
  }, [measure]);

  // One clock drives both the name and the hairline under the counter, so pausing
  // freezes them together. It also stops offscreen and in hidden tabs.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    if (reduce || n < 2) return;
    const root = rootRef.current;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (root) io.observe(root);
    // The first name holds a little longer while the sentence blurs in.
    let elapsed = -900;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      if (!pausedRef.current && visible && !document.hidden) {
        elapsed += dt;
        if (elapsed >= interval) {
          elapsed = 0;
          setIndex((i) => (i + 1) % n);
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
  }, [reduce, n, interval]);

  const current = list[Math.min(index, n - 1)];
  const leadWords = lead.split(" ").filter(Boolean);
  // "\n" in the tail is a line break on wide containers. Fixed lines mean the
  // springing slot pushes its neighbours sideways but never re-wraps them.
  const tailLines = tail.split("\n").map((line) => line.split(" ").filter(Boolean));
  const tailWords = tailLines.flat();
  const v = reduce ? wordReduced : word;
  const fullSentence = `${lead} ${list.map((x) => x.word).join(", ")} ${tail.replace(/\n/g, " ")}`;
  const pad = (k: number) => String(k).padStart(2, "0");

  return (
    <section
      ref={rootRef}
      aria-label="Introduction"
      className="@container relative isolate overflow-hidden bg-black text-[#f5f5f4]"
    >
      {/* Film grain: static, faint, never on top of the copy's contrast budget. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px", opacity: grain }}
      />
      {/* A very soft falloff toward the corners keeps the black from feeling flat. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_20%_0%,rgba(255,255,255,0.035),transparent_60%)]"
      />

      <div className="mx-auto flex min-h-[clamp(640px,100svh,980px)] max-w-[1440px] flex-col px-5 pb-8 pt-6 @md:px-8 @md:pb-10 @md:pt-8 @5xl:px-14 @5xl:pb-14 @5xl:pt-12">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50"
        >
          <p>{eyebrow}</p>
          <p className="flex items-center gap-2.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-white/70 shadow-[0_0_0_3px_rgba(255,255,255,0.08)]" />
            {status}
          </p>
        </motion.div>

        <div className="flex flex-1 flex-col justify-end pb-10 pt-20 @md:pb-14 @md:pt-28 @5xl:pb-16">
          <h1
            onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
            onPointerLeave={() => setHovering(false)}
            className="relative font-display text-[clamp(2.9rem,0.6rem+7cqw,8rem)] font-medium leading-[0.96] tracking-[-0.058em] [text-wrap:pretty]"
          >
            <span className="sr-only">{fullSentence}</span>
            <motion.span aria-hidden="true" initial="hidden" animate="show" className="block">
              {leadWords.map((w, i) => (
                <span key={`l${i}`}>
                  <motion.span custom={i} variants={v} className="inline-block will-change-[filter,transform]">
                    {w}
                  </motion.span>
                  {i < leadWords.length - 1 ? " " : null}
                </span>
              ))}
              <br />

              {/* The slot: an inline box whose width springs to the next name. */}
              <motion.span
                custom={leadWords.length}
                variants={v}
                className="relative inline-block whitespace-nowrap align-baseline"
              >
                <motion.span style={{ width }} className="relative inline-block">
                  {/* Invisible copy of the current name gives the box its baseline. */}
                  <span className="invisible font-serif text-[1.08em] italic leading-[0.89] tracking-[-0.02em]">{current.word}</span>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={current.word}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.32em", filter: "blur(10px)" }}
                      animate={reduce ? { opacity: 1 } : { opacity: 1, y: "0em", filter: "blur(0px)" }}
                      exit={
                        reduce
                          ? { opacity: 0, transition: { duration: 0.1 } }
                          : { opacity: 0, y: "-0.32em", filter: "blur(10px)", transition: { duration: 0.34, ease: [0.4, 0, 1, 1] } }
                      }
                      transition={{ duration: 0.52, ease }}
                      className="absolute left-0 top-0 font-serif text-[1.08em] italic leading-[0.89] tracking-[-0.02em] text-white"
                    >
                      {current.word}
                    </motion.span>
                  </AnimatePresence>
                </motion.span>
              </motion.span>
              {/* Narrow containers give the name a line of its own, so nothing re-wraps there either. */}
              <br className="@3xl:hidden" />
              <span className="hidden @3xl:inline"> </span>

              {tailLines.map((line, li) => {
                const offset = tailLines.slice(0, li).reduce((a, l) => a + l.length, 0);
                return (
                  <span key={`tl${li}`}>
                    {li > 0 ? (
                      <>
                        <br className="hidden @3xl:inline" />
                        <span className="@3xl:hidden"> </span>
                      </>
                    ) : null}
                    {line.map((w, i) => (
                      <span key={`t${i}`}>
                        <motion.span
                          custom={leadWords.length + 1 + offset + i}
                          variants={v}
                          className="inline-block text-white/[0.38] will-change-[filter,transform]"
                        >
                          {w}
                        </motion.span>
                        {i < line.length - 1 ? " " : null}
                      </span>
                    ))}
                  </span>
                );
              })}
            </motion.span>

            {/* Measurer: every name, same font, out of flow. */}
            <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap">
              {list.map((x) => (
                <span key={x.word} className="absolute left-0 top-0 pr-[0.03em] font-serif text-[1.08em] italic leading-[0.89] tracking-[-0.02em]">
                  {x.word}
                </span>
              ))}
            </span>
          </h1>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: reduce ? 0 : 0.55 }}
          className="flex flex-col gap-5 border-t border-white/10 pt-6 @md:pt-8 @4xl:flex-row @4xl:items-center @4xl:justify-between"
        >
          <div className="flex gap-2 @md:gap-3 [&>a]:flex-1 @md:[&>a]:flex-none">
            <a
              href={primary.href}
              className="group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#f5f5f4] px-5 @md:px-6 text-[15px] font-medium tracking-[-0.01em] text-black transition-[background-color,scale] duration-150 ease-out hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.97] active:duration-75"
            >
              {primary.label}
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5">
                <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href={secondary.href}
              className="group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 @md:px-5 text-[15px] font-medium tracking-[-0.01em] text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition-[color,background-color,box-shadow,scale] duration-150 ease-out hover:bg-white/[0.04] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.97] active:duration-75"
            >
              {secondary.label}
            </a>
          </div>

          {n > 1 ? (
            <button
              type="button"
              // With reduced motion nothing rotates on its own; the control steps through the names instead.
              onClick={() => (reduce ? setIndex((i) => (i + 1) % n) : setHeld((h) => !h))}
              aria-label={reduce ? "Show the next client name" : held ? "Resume rotating client names" : "Pause rotating client names"}
              aria-pressed={reduce ? undefined : held}
              className="group -mx-2 flex min-h-11 items-center self-start gap-3 rounded-full px-2 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-white/50 transition-colors duration-150 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] @4xl:mx-0"
            >
              <span aria-hidden="true" className="grid size-6 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] transition-[box-shadow] duration-150 group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]">
                {reduce ? (
                  <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
                    <path d="M2.5 6h6.5M6.5 3.2 9.3 6 6.5 8.8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : paused ? (
                  <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
                    <path d="M3.5 2.2v7.6L9.6 6z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
                    <path d="M3.2 2.4h1.8v7.2H3.2zM7 2.4h1.8v7.2H7z" fill="currentColor" />
                  </svg>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums text-white/80">
                {pad(index + 1)}
                <span className="text-white/30"> / {pad(n)}</span>
              </span>
              <span aria-hidden="true" className="relative h-px w-8 shrink-0 overflow-hidden bg-white/15 @md:w-10">
                <span ref={barRef} className="absolute inset-0 origin-left scale-x-0 bg-white/70" />
              </span>
              <span className="relative grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={current.word}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.2 } }}
                    transition={{ duration: 0.32, ease }}
                    className="truncate"
                  >
                    {current.note}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}

export default function HeroBlurStatementDemo() {
  return <HeroBlurStatement />;
}
