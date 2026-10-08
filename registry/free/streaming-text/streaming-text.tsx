"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, Copy, RotateCcw, Square } from "lucide-react";

export type StreamingSource = { title: string; publisher: string; href: string };

export type StreamingTextProps = {
  /** The question being answered, set as the card's headline. */
  question?: string;
  /** Who asked and when, in the mono line above the question. */
  askedBy?: string;
  /**
   * The answer as paragraphs. Use **bold** for emphasis and [n] for a citation,
   * where n is the 1-based index into `sources`.
   */
  answer?: string[];
  sources?: StreamingSource[];
  /** Start streaming on mount. With reduced motion the full answer shows at once. */
  autoStart?: boolean;
  /** Multiplies every delay. 0.5 streams twice as fast. */
  pace?: number;
  className?: string;
};

const defaultAnswer = [
  "A loaf usually collapses because the dough ran out of strength before the oven could set it. The gas is still there; the structure holding it up isn’t.[1]",
  "The usual culprit is **overproofing**. Left too long, the yeast keeps making gas while acids slowly loosen the gluten, so the dough looks magnificent on the bench and sighs the moment you score it.[2][3] Try the poke test: if the dent springs back slowly and only partway, bake it. If it doesn’t come back at all, you’re late.",
  "Hydration plays a part too. Wetter doughs need an extra set of folds to build strength, and a slack shape can’t hold its oven spring.[4] Last, check the oven itself: a pot that isn’t fully preheated sets the crust too slowly, which gives the loaf time to spread.[5]",
  "Shorten the final proof by 30 to 45 minutes and add one more set of folds. That fixes most flat loaves.",
];

const defaultSources: StreamingSource[] = [
  { title: "What actually holds a loaf up", publisher: "The Crumb Quarterly", href: "#" },
  { title: "Reading the poke test, with photos", publisher: "Mill & Hearth", href: "#" },
  { title: "Acidity and gluten over a long ferment", publisher: "Journal of Home Baking", href: "#" },
  { title: "Folds, hydration and dough strength", publisher: "Bench Notes", href: "#" },
  { title: "Preheating cast iron: how long is long enough", publisher: "Oven Lab", href: "#" },
];

/* ------------------------------------------------------------------ */
/* Tokenising                                                           */
/* ------------------------------------------------------------------ */

type Tok = { kind: "text"; text: string; bold: boolean } | { kind: "cite"; n: number };

/** Splits paragraphs into word-sized tokens, keeping citations and bold runs intact. */
function tokenize(paragraphs: string[]): Tok[][] {
  return paragraphs.map((p) => {
    const toks: Tok[] = [];
    const parts = p.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean);
    for (const part of parts) {
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

/** How long to wait after a token. Punctuation breathes; mid-sentence words rush. */
function delayAfter(t: Tok | undefined, endOfParagraph: boolean) {
  if (endOfParagraph) return 260 + Math.random() * 220;
  if (!t || t.kind === "cite") return 40;
  const s = t.text.trimEnd();
  if (/[.!?]["”’)]?$/.test(s)) return 110 + Math.random() * 160;
  if (/[,;:—]$/.test(s)) return 50 + Math.random() * 70;
  if (Math.random() < 0.04) return 180 + Math.random() * 200; // the odd hesitation
  return 14 + Math.random() * 34;
}

const plainText = (paragraphs: string[]) => paragraphs.map((p) => p.replace(/\*\*/g, "")).join("\n\n");

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

type Phase = "reading" | "streaming" | "done" | "stopped";

export function StreamingText({
  question = "Why does my sourdough collapse when it goes in the oven?",
  askedBy = "Asked by Noor · 09:14",
  answer = defaultAnswer,
  sources = defaultSources,
  autoStart = true,
  pace = 1,
  className = "",
}: StreamingTextProps) {
  const reduce = !!useReducedMotion();
  const paragraphs = useMemo(() => tokenize(answer), [answer]);
  const flat = useMemo(() => paragraphs.flatMap((p, pi) => p.map((t, ti) => ({ t, end: ti === p.length - 1 && pi < paragraphs.length - 1 }))), [paragraphs]);
  const total = flat.length;
  const words = useMemo(() => plainText(answer).split(/\s+/).filter(Boolean).length, [answer]);

  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("reading");
  const [run, setRun] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reduced motion, or no autostart: show the finished answer straight away.
  useEffect(() => {
    if (reduce || (!autoStart && run === 0)) {
      setCount(total);
      setPhase("done");
      return;
    }
    setCount(0);
    setPhase("reading");
    started.current = performance.now();
    let i = 0;
    const tick = () => {
      // Emit one to three tokens at a time so it arrives in uneven little clumps.
      const n = Math.random() < 0.55 ? 1 : Math.random() < 0.7 ? 2 : 3;
      i = Math.min(total, i + n);
      setCount(i);
      if (i >= total) {
        setElapsed(performance.now() - started.current);
        setPhase("done");
        return;
      }
      timer.current = setTimeout(tick, delayAfter(flat[i - 1]?.t, !!flat[i - 1]?.end) * pace);
    };
    timer.current = setTimeout(() => {
      setPhase("streaming");
      tick();
    }, 900 * pace);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reduce, autoStart, run, total, flat, pace]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const stop = () => {
    setElapsed(performance.now() - started.current);
    setPhase("stopped");
    if (timer.current) clearTimeout(timer.current);
  };

  const regenerate = () => {
    setCopied(false);
    setRun((r) => r + 1);
  };

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(plainText(answer)).catch(() => undefined);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }, [answer]);

  const live = phase === "streaming" || phase === "reading";
  const finished = phase === "done";

  // Render tokens up to `count`, paragraph by paragraph.
  let left = count;
  const body: ReactNode[] = [];
  for (let pi = 0; pi < paragraphs.length && left > 0; pi++) {
    const toks = paragraphs[pi];
    const shown = toks.slice(0, left);
    left -= shown.length;
    const isLast = left <= 0 || pi === paragraphs.length - 1;
    body.push(
      <p key={pi} className="max-w-[64ch] text-pretty">
        {shown.map((t, ti) =>
          t.kind === "cite" ? (
            <Cite key={ti} n={t.n} source={sources[t.n - 1]} active={hover === t.n} onHover={setHover} reduce={reduce} />
          ) : t.bold ? (
            <strong key={ti} className="font-semibold text-white">
              {t.text}
            </strong>
          ) : (
            <Fragment key={ti}>{t.text}</Fragment>
          ),
        )}
        {phase === "streaming" && isLast ? <SoftCaret /> : null}
      </p>,
    );
  }

  const seconds = (elapsed / 1000).toFixed(1);
  const status =
    phase === "reading"
      ? `Reading ${sources.length} sources`
      : phase === "streaming"
        ? "Writing"
        : phase === "stopped"
          ? `Stopped after ${seconds}s`
          : reduce || (run === 0 && !autoStart)
            ? `${words} words · ${sources.length} sources`
            : `${words} words in ${seconds}s`;

  return (
    <section className={`min-h-dvh bg-black px-4 py-12 text-white sm:px-8 sm:py-20 ${className}`}>
      <article className="mx-auto max-w-[820px] relative rounded-[24px] bg-[#0b0b0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_80px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.08]">
        <header className="px-6 pb-6 pt-7 sm:px-12 sm:pb-8 sm:pt-11">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">
            <span aria-hidden="true" className="h-px w-5 bg-[#ff9a6b]" />
            {askedBy}
          </p>
          <h2 className="mt-4 max-w-[26ch] font-sans text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-balance">{question}</h2>
        </header>

        <div className="border-t border-white/[0.08] px-6 py-7 sm:px-12 sm:py-9">
          {/* Status line */}
          <div className="mb-5 flex h-6 items-center gap-2.5 font-mono text-[12px] text-white/60">
            <StatusMark phase={phase} />
            <span className="tabular-nums">{status}</span>
            {phase === "reading" ? <ReadingDots /> : null}
          </div>

          <div aria-live="polite" aria-busy={live} className="min-h-[12rem] space-y-[1.1em] text-[16.5px] leading-[1.72] text-white/[0.76] sm:text-[17.5px]">
            {phase === "reading" ? (
              <div aria-hidden="true" className="space-y-3 pt-1.5">
                {[92, 100, 76].map((w, i) => (
                  <motion.div
                    key={i}
                    className="h-3 rounded-full bg-white/[0.06]"
                    style={{ width: `${w}%` }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}
              </div>
            ) : (
              body
            )}
          </div>

          {/* Sources */}
          <AnimatePresence>
            {finished ? (
              <motion.div
                key={`sources-${run}`}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
                className="mt-9"
              >
                <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">Sources</h3>
                <ol className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
                  {sources.map((s, i) => (
                    <motion.li
                      key={s.title}
                      id={`streaming-text-src-${i + 1}`}
                      initial={reduce ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: reduce ? 0 : 0.08 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <a
                        href={s.href}
                        onMouseEnter={() => setHover(i + 1)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(i + 1)}
                        onBlur={() => setHover(null)}
                        className={`group grid min-h-12 grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-[8px] px-1 py-2.5 transition-[background-color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9a6b] ${hover === i + 1 ? "bg-[#ff9a6b]/[0.06]" : ""}`}
                      >
                        <span className={`flex size-6 items-center justify-center rounded-full font-mono text-[11px] tabular-nums transition-colors ${hover === i + 1 ? "bg-[#ff9a6b] text-black" : "bg-[#ff9a6b]/10 text-[#ff9a6b]"}`}>{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block text-[14.5px] font-medium leading-snug text-white sm:truncate">{s.title}</span>
                          <span className="block truncate text-[12.5px] text-white/55">{s.publisher}</span>
                        </span>
                        <ArrowUpRight className="size-4 text-white/35 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#ff9a6b]" aria-hidden="true" />
                      </a>
                    </motion.li>
                  ))}
                </ol>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3 sm:px-10">
          <p className="pl-2 font-mono text-[11px] text-white/50 sm:pl-2">Answers can be wrong. Check the sources.</p>
          <div className="flex items-center gap-1">
            {live ? (
              <ControlButton onClick={stop} label="Stop">
                <Square className="size-3 fill-current" aria-hidden="true" />
              </ControlButton>
            ) : (
              <ControlButton onClick={regenerate} label="Regenerate">
                {/* The arrow winds back a turn on hover, a hint of what it does. */}
                <RotateCcw className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/btn:-rotate-180" aria-hidden="true" />
              </ControlButton>
            )}
            <ControlButton onClick={copy} label={copied ? "Copied" : "Copy"} disabled={live} pressed={copied}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={copied ? "y" : "n"}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
                  transition={{ type: "spring", stiffness: 600, damping: 32 }}
                  className="inline-flex"
                >
                  {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                </motion.span>
              </AnimatePresence>
            </ControlButton>
          </div>
        </footer>
      </article>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function Cite({ n, source, active, onHover, reduce }: { n: number; source?: StreamingSource; active: boolean; onHover: (n: number | null) => void; reduce: boolean }) {
  return (
    <motion.sup
      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative -top-[0.45em] mx-[1px] inline-block align-baseline leading-none"
    >
      <a
        href={`#streaming-text-src-${n}`}
        aria-label={`Source ${n}${source ? `: ${source.title}` : ""}`}
        onMouseEnter={() => onHover(n)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(n)}
        onBlur={() => onHover(null)}
        className={`inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-[5px] font-mono text-[10px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9a6b] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b0b0c] ${active ? "bg-[#ff9a6b] text-black" : "bg-[#ff9a6b]/[0.12] text-[#ff9a6b] hover:bg-[#ff9a6b]/20"}`}
      >
        {n}
      </a>
    </motion.sup>
  );
}

function SoftCaret() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-[3px] inline-block h-[1.1em] w-[3px] translate-y-[0.2em] rounded-full bg-[#ff9a6b]"
      animate={{ opacity: [0.9, 0.2, 0.9] }}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function ReadingDots() {
  return (
    <span aria-hidden="true" className="flex gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1 rounded-full bg-white/50"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

function StatusMark({ phase }: { phase: Phase }) {
  if (phase === "done") return <span aria-hidden="true" className="size-2 rounded-full bg-[#ff9a6b]" />;
  if (phase === "stopped") return <span aria-hidden="true" className="size-2 rounded-[2px] bg-white/40" />;
  return (
    <span aria-hidden="true" className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff9a6b] opacity-50 motion-reduce:hidden" />
      <span className="relative inline-flex size-2 rounded-full bg-[#ff9a6b]" />
    </span>
  );
}

function ControlButton({ children, label, onClick, disabled, pressed }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-live={pressed !== undefined ? "polite" : undefined}
      className={`group/btn inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium transition-[color,background-color,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9a6b] disabled:cursor-not-allowed disabled:opacity-35 sm:h-10 ${pressed ? "text-[#ff9a6b]" : "text-white/75 hover:bg-white/[0.05] hover:text-white"}`}
    >
      {children}
      {label}
    </button>
  );
}

export default StreamingText;
