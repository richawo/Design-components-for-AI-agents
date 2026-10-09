"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, Copy, RotateCcw, Square } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type StreamingSource = { title: string; publisher: string; href: string };

export type StreamingTextProps = {
  /** The question being answered, set as the card’s headline. */
  question?: string;
  /** Who asked and when, in the mono line above the question. */
  askedBy?: string;
  /**
   * The answer as paragraphs. Use **bold** for emphasis and [n] for a citation,
   * where n is the 1-based index into `sources`.
   */
  answer?: string[];
  sources?: StreamingSource[];
  /** Start streaming once the card is in view. With reduced motion the full answer shows at once. */
  autoStart?: boolean;
  /** Multiplies every delay. 0.5 streams twice as fast. */
  pace?: number;
  /** The one accent: the citation you’re pointing at and the source it links to. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#0e0e10",
    line: "#232327",
    rule: "#1b1b1e",
    ink: "#f4f4f5",
    body: "#c6c6cc",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    pill: "#202024",
    hover: "rgba(255,255,255,0.04)",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 32px 80px -32px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    line: "#e4e4e7",
    rule: "#efeff1",
    ink: "#18181b",
    body: "#3f3f46",
    muted: "#52525b",
    faint: "#71717a",
    pill: "#f0f0f2",
    hover: "rgba(24,24,27,0.04)",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

const DEFAULT_ACCENT = "#ff9a6b";

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = { dark: "#000000", light: "#f4f4f5" } as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 12, // px
  blur: 8, // px
  block: 0.5,
  step: 0.06, // card → asked-by → question → status
  bodyAt: 0.26, // the reading list, once the header has landed
  listStep: 0.05, // reading list and sources, row to row
  footerAt: 0.4,
  lead: 0.35, // after the card lands, before reading starts counting
  reading: 0.9, // “Reading 5 sources” before the first word (× pace)
  ink: 420, // ms: each chunk settles from a blur, like ink drying
  inkBlur: 4, // px
  exit: 0.16,
  copiedFor: 1600, // ms
  fade: 0.15, // reduced motion
} as const;

/* ------------------------------------------------------------------ */
/* Demo content                                                         */
/* ------------------------------------------------------------------ */

const DEMO_ANSWER = [
  "A loaf usually collapses because the dough ran out of strength before the oven could set it. The gas is still there; the structure holding it up isn’t.[1]",
  "The usual culprit is **overproofing**. Left too long, the yeast keeps making gas while acids slowly loosen the gluten, so the dough looks magnificent on the bench and sighs the moment you score it.[2][3] Try the poke test: if the dent springs back slowly and only partway, bake it. If it doesn’t come back at all, you’re late.",
  "Hydration plays a part too. Wetter doughs need an extra set of folds to build strength, and a slack shape can’t hold its oven spring.[4] Last, check the oven itself: a pot that isn’t fully preheated sets the crust too slowly, which gives the loaf time to spread.[5]",
  "Shorten the final proof by 30 to 45 minutes and add one more set of folds. That fixes most flat loaves.",
];

const DEMO_SOURCES: StreamingSource[] = [
  { title: "What actually holds a loaf up", publisher: "The Crumb Quarterly", href: "#" },
  { title: "Reading the poke test, with photos", publisher: "Mill & Hearth", href: "#" },
  { title: "Acidity and gluten over a long ferment", publisher: "Journal of Home Baking", href: "#" },
  { title: "Folds, hydration and dough strength", publisher: "Bench Notes", href: "#" },
  { title: "Preheating cast iron: how long is long enough", publisher: "Oven Lab", href: "#" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--st-accent": accent, "--st-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--st-${k}`] = v;
  return vars as CSSProperties;
}

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--st-ink)]";

/* ------------------------------------------------------------------ */
/* Tokenising                                                           */
/* ------------------------------------------------------------------ */

type Tok = { kind: "text"; text: string; bold: boolean } | { kind: "cite"; n: number };

/** Splits paragraphs into word-sized tokens, keeping citations and bold runs intact. */
function tokenize(paragraphs: string[]): Tok[][] {
  return paragraphs.map((p) => {
    const toks: Tok[] = [];
    for (const part of p.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean)) {
      const cite = part.match(/^\[(\d+)\]$/);
      if (cite) {
        toks.push({ kind: "cite", n: Number(cite[1]) });
        continue;
      }
      const bold = part.startsWith("**") && part.endsWith("**");
      const text = bold ? part.slice(2, -2) : part;
      for (const w of text.match(/\S+\s*|\s+/g) ?? []) toks.push({ kind: "text", text: w, bold });
    }
    return toks;
  });
}

/** Milliseconds to wait after a token. Punctuation breathes; mid-sentence words rush. */
function delayAfter(t: Tok | undefined, endOfParagraph: boolean) {
  if (endOfParagraph) return 260 + Math.random() * 220;
  if (!t || t.kind === "cite") return 40;
  const s = t.text.trimEnd();
  if (/[.!?]["”’)]?$/.test(s)) return 110 + Math.random() * 160;
  if (/[,;:—]$/.test(s)) return 50 + Math.random() * 70;
  if (Math.random() < 0.04) return 180 + Math.random() * 200; // the odd hesitation
  return 14 + Math.random() * 34;
}

/** One to three tokens per tick, so the answer arrives in uneven little clumps. */
const clump = () => (Math.random() < 0.55 ? 1 : Math.random() < 0.7 ? 2 : 3);

const plainText = (paragraphs: string[]) => paragraphs.map((p) => p.replace(/\*\*/g, "").replace(/\[\d+\]/g, "")).join("\n\n");

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

type Phase = "reading" | "streaming" | "done" | "stopped";

/**
 * Drives the answer: a pause while the sources are “read”, then tokens in uneven
 * clumps. One timer at a time, always cleared. `run` restarts it (Regenerate).
 */
function useTokenStream(flat: { t: Tok; end: boolean }[], { play, reduce, autoStart, pace }: { play: boolean; reduce: boolean; autoStart: boolean; pace: number }) {
  const total = flat.length;
  const instant = reduce || !autoStart;
  const [run, setRun] = useState(0);
  const [count, setCount] = useState(instant ? total : 0);
  const [phase, setPhase] = useState<Phase>(instant ? "done" : "reading");
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const started = useRef(0);

  useEffect(() => {
    // Reduced motion never streams; without autoStart the finished answer waits for Regenerate.
    if (reduce || (!autoStart && run === 0)) {
      setCount(total);
      setPhase("done");
      return;
    }
    if (!play) return;
    setCount(0);
    setPhase("reading");
    let i = 0;
    const tick = () => {
      i = Math.min(total, i + clump());
      setCount(i);
      if (i >= total) {
        setElapsed(performance.now() - started.current);
        setPhase("done");
        return;
      }
      timer.current = window.setTimeout(tick, delayAfter(flat[i - 1]?.t, !!flat[i - 1]?.end) * pace);
    };
    // The first run waits for the card to land; a regenerate starts reading at once.
    const lead = run === 0 ? MOTION.lead : 0;
    started.current = performance.now() + lead * 1000;
    timer.current = window.setTimeout(() => {
      setPhase("streaming");
      tick();
    }, (lead + MOTION.reading * pace) * 1000);
    return () => window.clearTimeout(timer.current);
  }, [play, reduce, autoStart, run, total, flat, pace]);

  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    setElapsed(Math.max(0, performance.now() - started.current));
    setPhase("stopped");
  }, []);

  const restart = useCallback(() => setRun((r) => r + 1), []);

  return { count, phase, elapsed, run, stop, restart };
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), MOTION.copiedFor);
  }, []);
  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setCopied(false);
  }, []);
  return { copied, copy, reset };
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

/**
 * The live dot is the card’s one ambient signal: it breathes while the model
 * works, holds still when the answer is done, and turns square when stopped.
 */
function StatusMark({ phase }: { phase: Phase }) {
  if (phase === "stopped") return <span aria-hidden="true" className="size-2 rounded-[2px] bg-[var(--st-faint)]" />;
  if (phase === "done") return <span aria-hidden="true" className="size-2 rounded-full bg-[var(--st-ink)]" />;
  return (
    <span aria-hidden="true" className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--st-ink)] opacity-40 motion-reduce:hidden" />
      <span className="relative inline-flex size-2 rounded-full bg-[var(--st-ink)]" />
    </span>
  );
}

/** While the model reads, the sources it’s reading arrive one by one. Real context, not skeleton bars. */
function ReadingList({ sources, play, firstRun, reduce }: { sources: StreamingSource[]; play: boolean; firstRun: boolean; reduce: boolean }) {
  const base = firstRun ? MOTION.bodyAt : 0;
  return (
    <motion.ol
      key="reading"
      aria-label="Sources being read"
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)", transition: { duration: MOTION.exit, ease: EASE_IN } }}
      className="space-y-2.5 pt-1"
    >
      {sources.map((s, i) => (
        <motion.li key={s.title} {...enter(play, base + i * MOTION.listStep, reduce)} className="flex items-baseline gap-3 font-mono text-[12px] text-[var(--st-faint)]">
          <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
          <span className="truncate">{s.publisher}</span>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function Cite({ n, source, active, onHover, inkClass, anchor }: { n: number; source?: StreamingSource; active: boolean; onHover: (n: number | null) => void; inkClass: string; anchor: string }) {
  return (
    <sup className={`relative -top-[0.45em] mx-[1px] inline-block align-baseline leading-none ${inkClass}`}>
      <a
        href={`#${anchor}`}
        aria-label={`Source ${n}${source ? `: ${source.title}` : ""}`}
        onMouseEnter={() => onHover(n)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(n)}
        onBlur={() => onHover(null)}
        className={`inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-[5px] font-mono text-[10px] font-medium tabular-nums transition-colors duration-150 ${focusRing} ${
          active ? "bg-[var(--st-accent)] text-[var(--st-on-accent)]" : "bg-[var(--st-pill)] text-[var(--st-muted)] hover:text-[var(--st-ink)]"
        }`}
      >
        {n}
      </a>
    </sup>
  );
}

/** A thin ink-coloured caret that breathes at the live end of the answer. */
function SoftCaret() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-[3px] inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-[var(--st-ink)]"
      animate={{ opacity: [0.85, 0.2, 0.85] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function Answer({
  paragraphs,
  count,
  live,
  settle,
  sources,
  hover,
  onHover,
  anchor,
}: {
  paragraphs: Tok[][];
  count: number;
  live: boolean;
  /** Fresh tokens settle in like ink; off for answers that were already there. */
  settle: boolean;
  sources: StreamingSource[];
  hover: number | null;
  onHover: (n: number | null) => void;
  anchor: (n: number) => string;
}) {
  const inkClass = settle ? "st-ink" : "";
  const nodes: ReactNode[] = [];
  let left = count;
  for (let pi = 0; pi < paragraphs.length && left > 0; pi++) {
    const shown = paragraphs[pi].slice(0, left);
    left -= shown.length;
    const isLast = left <= 0 || pi === paragraphs.length - 1;
    nodes.push(
      <p key={pi} className="max-w-[64ch] text-pretty">
        {shown.map((t, ti) =>
          t.kind === "cite" ? (
            <Cite key={ti} n={t.n} source={sources[t.n - 1]} active={hover === t.n} onHover={onHover} inkClass={inkClass} anchor={anchor(t.n)} />
          ) : t.bold ? (
            <strong key={ti} className={`font-semibold text-[var(--st-ink)] ${inkClass}`}>
              {t.text}
            </strong>
          ) : (
            <span key={ti} className={inkClass}>
              {t.text}
            </span>
          ),
        )}
        {live && isLast ? <SoftCaret /> : null}
      </p>,
    );
  }
  return <>{nodes}</>;
}

function Sources({ sources, hover, onHover, anchor, reduce }: { sources: StreamingSource[]; hover: number | null; onHover: (n: number | null) => void; anchor: (n: number) => string; reduce: boolean }) {
  return (
    <motion.div key="sources" exit={{ opacity: 0, transition: { duration: MOTION.exit } }} className="mt-9">
      <motion.h3 {...enter(true, 0.08, reduce)} className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--st-faint)]">
        Sources
      </motion.h3>
      <ol className="divide-y divide-[var(--st-rule)] border-y border-[var(--st-rule)]">
        {sources.map((s, i) => {
          const on = hover === i + 1;
          return (
            <motion.li key={s.title} id={anchor(i + 1)} {...enter(true, 0.14 + i * MOTION.listStep, reduce)}>
              <a
                href={s.href}
                onMouseEnter={() => onHover(i + 1)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(i + 1)}
                onBlur={() => onHover(null)}
                className={`group grid min-h-12 grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-[8px] px-1 py-2.5 transition-[background-color,transform] duration-150 active:scale-[0.99] ${focusRing} ${on ? "bg-[var(--st-hover)]" : ""}`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full font-mono text-[11px] tabular-nums transition-colors duration-150 ${
                    on ? "bg-[var(--st-accent)] text-[var(--st-on-accent)]" : "bg-[var(--st-pill)] text-[var(--st-muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-medium leading-snug text-[var(--st-ink)] @xl:truncate">{s.title}</span>
                  <span className="block truncate text-[12.5px] text-[var(--st-faint)]">{s.publisher}</span>
                </span>
                <ArrowUpRight
                  className="size-4 text-[var(--st-faint)] transition-[transform,color] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--st-ink)]"
                  aria-hidden="true"
                />
              </a>
            </motion.li>
          );
        })}
      </ol>
    </motion.div>
  );
}

function ControlButton({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group/btn inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium text-[var(--st-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--st-hover)] hover:text-[var(--st-ink)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--st-muted)] @xl:h-10 ${focusRing}`}
    >
      {children}
      {label}
    </button>
  );
}

/** Swaps the copy icon for a check with a stiff little pop. */
function CopyIcon({ copied, reduce }: { copied: boolean; reduce: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={copied ? "copied" : "copy"}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
        transition={reduce ? { duration: MOTION.fade } : SPRING_UI}
        className="inline-flex"
      >
        {copied ? <Check className="size-3.5 text-[var(--st-ink)]" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      </motion.span>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function StreamingText({
  question = "Why does my sourdough collapse when it goes in the oven?",
  askedBy = "Asked by Noor · 09:14",
  answer = DEMO_ANSWER,
  sources = DEMO_SOURCES,
  autoStart = true,
  pace = 1,
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: StreamingTextProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const anchor = useCallback((n: number) => `${uid}-src-${n}`, [uid]);
  const root = useRef<HTMLElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });

  const paragraphs = useMemo(() => tokenize(answer), [answer]);
  const flat = useMemo(() => paragraphs.flatMap((p, pi) => p.map((t, ti) => ({ t, end: ti === p.length - 1 && pi < paragraphs.length - 1 }))), [paragraphs]);
  // Running word count after each token, so the status can tick as words land.
  const wordsAt = useMemo(() => {
    let n = 0;
    return [0, ...flat.map(({ t }) => (n += t.kind === "text" && t.text.trim() ? 1 : 0))];
  }, [flat]);

  const instant = reduce || !autoStart;
  const stream = useTokenStream(flat, { play, reduce, autoStart, pace });
  const { copied, copy, reset } = useCopy();
  const [hover, setHover] = useState<number | null>(null);

  const { phase, count } = stream;
  const live = phase === "streaming" || phase === "reading";
  const words = wordsAt[count] ?? 0;
  const seconds = (stream.elapsed / 1000).toFixed(1);
  const status =
    phase === "reading"
      ? `Reading ${sources.length} sources`
      : phase === "streaming"
        ? `Writing · ${words} words`
        : phase === "stopped"
          ? `Stopped after ${seconds}s · ${words} words`
          : stream.run === 0 && instant
            ? `${words} words · ${sources.length} sources`
            : `${words} words in ${seconds}s`;

  const regenerate = () => {
    reset();
    setHover(null);
    stream.restart();
  };

  return (
    <article
      ref={root}
      aria-labelledby={`${uid}-q`}
      style={cssVars(PALETTE[theme], accent)}
      className={`@container relative w-full font-sans antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      {/* Hundreds of tiny one-shot fades: CSS is lighter than a motion node per word, and nothing ever reverses them. */}
      <style>{`
        @keyframes st-ink { from { opacity: 0; filter: blur(${MOTION.inkBlur}px); } to { opacity: 1; filter: blur(0); } }
        .st-ink { animation: st-ink ${MOTION.ink}ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .st-ink { animation: none; } }
      `}</style>

      <motion.div {...enter(play, 0, reduce)} className="overflow-hidden rounded-[24px] border border-[var(--st-line)] bg-[var(--st-surface)] text-[var(--st-ink)] shadow-[var(--st-shadow)]">
        <header className="px-6 pb-6 pt-7 @xl:px-12 @xl:pb-8 @xl:pt-11">
          <motion.p {...enter(play, MOTION.step, reduce)} className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--st-faint)]">
            <motion.span
              aria-hidden="true"
              initial={reduce ? false : { scaleX: 0 }}
              animate={play ? { scaleX: 1 } : undefined}
              transition={{ duration: MOTION.block, ease: EASE_OUT, delay: MOTION.step * 2 }}
              className="h-px w-5 origin-left bg-[var(--st-faint)]"
            />
            {askedBy}
          </motion.p>
          <motion.h2
            id={`${uid}-q`}
            {...enter(play, MOTION.step * 2, reduce)}
            className="mt-4 max-w-[26ch] text-balance text-[clamp(1.75rem,1.2rem+2.6cqi,2.75rem)] font-semibold leading-[1.05] tracking-[-0.04em]"
          >
            {question}
          </motion.h2>
        </header>

        <div className="border-t border-[var(--st-line)] px-6 py-7 @xl:px-12 @xl:py-9">
          <motion.div {...enter(play, MOTION.step * 3, reduce)} className="mb-5 flex h-6 items-center gap-2.5 font-mono text-[12px] text-[var(--st-muted)]">
            <StatusMark phase={phase} />
            <span className="tabular-nums">{status}</span>
          </motion.div>

          <div aria-live="polite" aria-busy={live} className="min-h-[12rem] space-y-[1.1em] text-[16.5px] leading-[1.72] text-[var(--st-body)] @xl:text-[17.5px]">
            <AnimatePresence mode="wait">
              {phase === "reading" ? (
                <ReadingList key={`reading-${stream.run}`} sources={sources} play={play} firstRun={stream.run === 0} reduce={reduce} />
              ) : (
                <motion.div key={`answer-${stream.run}`} className="space-y-[1.1em]">
                  <Answer
                    paragraphs={paragraphs}
                    count={count}
                    live={phase === "streaming"}
                    settle={!instant || stream.run > 0}
                    sources={sources}
                    hover={hover}
                    onHover={setHover}
                    anchor={anchor}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>{phase === "done" ? <Sources key={`sources-${stream.run}`} sources={sources} hover={hover} onHover={setHover} anchor={anchor} reduce={reduce} /> : null}</AnimatePresence>
        </div>

        <motion.footer {...enter(play, MOTION.footerAt, reduce)} className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--st-line)] px-4 py-3 @xl:px-10">
          <p className="pl-2 font-mono text-[11px] text-[var(--st-faint)]">Answers can be wrong. Check the sources.</p>
          <div className="flex items-center gap-1">
            {live ? (
              <ControlButton onClick={stream.stop} label="Stop">
                <Square className="size-3 fill-current" aria-hidden="true" />
              </ControlButton>
            ) : (
              <ControlButton onClick={regenerate} label="Regenerate">
                {/* The arrow winds back half a turn on hover: a hint of what it does. */}
                <RotateCcw className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/btn:-rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </ControlButton>
            )}
            <ControlButton onClick={() => copy(plainText(answer))} label={copied ? "Copied" : "Copy"} disabled={live}>
              <CopyIcon copied={copied} reduce={reduce} />
            </ControlButton>
            <span className="sr-only" aria-live="polite">
              {copied ? "Answer copied" : ""}
            </span>
          </div>
        </motion.footer>
      </motion.div>
    </article>
  );
}

export default function StreamingTextDemo() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-8 sm:py-20" style={{ background: STAGE.dark }}>
      <div className="w-full max-w-[820px]">
        <StreamingText />
      </div>
    </div>
  );
}
