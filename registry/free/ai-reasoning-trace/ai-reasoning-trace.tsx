"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** thinking: the model is working. answering: the reply is streaming in. done: finished. */
export type ReasoningState = "thinking" | "answering" | "done";

export type ReasoningStep = {
  /** The one-line headline shown while the model is on this step. */
  summary: string;
  /** The dimmed line kept in the trace. */
  detail: string;
  /** When the step landed, in ms since thinking began. Adds a quiet "+0.6s" stamp when present. */
  atMs?: number;
};

export type ReasoningTraceProps = {
  /** The model's state. Defaults to done, so a host that forgets it still gets a finished reply. */
  state?: ReasoningState;
  /** Every step so far, in order. Append as the model reasons; the component never invents steps. */
  trace?: ReasoningStep[];
  /** The reply so far, as paragraphs. Append words as they stream; they settle in one by one. */
  answer?: string[];
  /** When thinking began (Date.now()). Starts the live timer. Without it the header shows the bare label. */
  startedAt?: number;
  /** The final thinking time in ms. Once the answer starts, this wins over the measured time. */
  thoughtForMs?: number;
  /** Controlled open state for the trace. Pair with onOpenChange to own the reader's choice yourself. */
  open?: boolean;
  /** Open state before the reader or auto-collapse has spoken. Ignored when `open` is set. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Fold the trace away when the answer starts, unless the reader has chosen. */
  autoCollapse?: boolean;
  /** Keep the reader's open or closed choice across runs in this instance. Off, the choice lasts one run. */
  rememberChoice?: boolean;
  /** Persist the reader's choice in localStorage under this key, so it survives reloads. Implies rememberChoice. */
  storageKey?: string;
  /** Show the seconds in the header: live while thinking, frozen once done. Off keeps the bare label. */
  showTimer?: boolean;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#0d0d0f",
    line: "#26262c",
    ink: "#f4f4f5",
    body: "#d4d4d8",
    muted: "#a1a1aa",
    dim: "#8b8b95",
    hover: "rgba(255,255,255,0.06)",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 28px 60px -36px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    line: "#e4e4e7",
    ink: "#18181b",
    body: "#3f3f46",
    muted: "#52525b",
    dim: "#60606a",
    hover: "rgba(24,24,27,0.05)",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 28px 56px -40px rgba(24,24,27,0.28)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo's quiet backdrop. Not part of the component. */
const STAGE = { dark: "#000000", light: "#f4f4f5" } as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_OUT_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_IN_OUT_CSS = "cubic-bezier(0.65, 0, 0.35, 1)";
const STEP_IN = 0.32; // seconds: a step rises out of a blur
const STEP_STAGGER = 0.05; // seconds between steps that arrive in the same render, in reading order
const SUMMARY_IN = 0.26;
const SUMMARY_OUT = 0.14;
const HAND_OFF_FOLD = 0.3; // seconds: the summary row folds, and its text fades with it, at the hand-off
const FOLD_MS = 420; // the trace and the reply fold over this long
const CLOCK_MS = 100; // the timer's refresh rate, one tenth of a second
const SPEAK_EVERY_MS = 5000; // the screen reader hears at most one summary every five seconds
const FADE_TOP = 20; // px of fade at the top of the step list once it has scrolled
const FADE_BOTTOM = 24; // px of fade at the bottom while more steps lie below

const NO_STEPS: ReasoningStep[] = [];
const NO_ANSWER: string[] = [];

/* ------------------------------------------------------------------ */
/* Demo script                                                          */
/* ------------------------------------------------------------------ */

/** The scripted demo's content. The default export streams it; the component itself never does. */
const DEMO_TRACE: ReasoningStep[] = [
  { summary: "Reading the question", detail: "Two seats were added on day 19 of a monthly cycle, and the invoice went up by more than the price of two seats." },
  { summary: "Checking how seats are billed", detail: "Seats on this plan are prorated to the day they are added, so a mid-cycle change should not bill a whole month." },
  { summary: "Counting the days left", detail: "Day 19 of a 30-day cycle leaves 11 days, roughly 37% of the month." },
  { summary: "Pricing the two new seats", detail: "Two seats at $24 for 11 of 30 days comes to $17.60, which is not the jump on the invoice." },
  { summary: "Looking at the renewal", detail: "The renewal bills all five seats from day 1 of the next cycle, and it can land on the same invoice." },
  { summary: "Ruling out a duplicate charge", detail: "A duplicate would show the same amount twice. This invoice has one prorated line and one renewal line." },
  { summary: "Matching the totals", detail: "The prorated seats plus the renewal add up to the amount shown, so nothing is charged twice." },
  { summary: "Testing the renewal explanation", detail: "If the renewal is on the invoice, the two lines together explain a larger total than proration alone." },
  { summary: "Ruling out tax and currency", detail: "Tax and currency changes appear as their own lines. There are none here." },
  { summary: "Choosing the clearest order", detail: "Lead with the cause, then the number, so the reader can check it against their own invoice." },
  { summary: "Drafting the reply", detail: "Keep it to two short paragraphs and name proration in the first sentence." },
  { summary: "Checking the tone", detail: "No blame. The charge is correct, and the wording should show why." },
];

const DEMO_ANSWER = [
  "The jump is proration, not a double charge. Two seats added on day 19 bill for the 11 days left in the cycle, which comes to $17.60.",
  "The bigger line is the renewal. If it lands on the same invoice, the two charges sit together and read like one large jump. Look for a line called Renewal.",
];

const DEMO_STEPS = 7;
const MIN_STEPS = 3;
/**
 * The demo waits this long after page load before it streams on its own. The card rests finished until
 * then, so a screenshot or a recording's framing frame taken shortly after load lands on the tallest state.
 */
const DEMO_SETTLE_MS = 3600;

/* Run start, in real milliseconds (the pace does not divide these, so the folds always finish). */
const REST_HOLD = 300; // a run is asked for: the finished card holds this long
const CLEAR = FOLD_MS; // then the trace and the reply fold away together before the stream begins

/* Scripted timing, in model milliseconds. The demo's pace divides every one of them. */
const LEAD = 500; // after thinking begins, before the first step: time to a first thought
const STEP_GAP = 480; // between steps, multiplied by the rhythm below
/** A fixed rhythm, so steps don't tick like a metronome and every run lands on the same beats. */
const JITTER = [1, 0.82, 1.18, 0.94, 1.08, 0.9, 1.15, 0.86, 1.04, 0.97, 1.12, 0.92] as const;
const SETTLE = 480; // the last step is "checked" before the answer begins
const WORD_GAP = 55; // between word clumps; the first clump lands one gap after the hand-off, while the trace folds
const WORDS_PER_TICK = 2;
const DONE_HOLD = 150;

const DEMO_WORDS = DEMO_ANSWER.reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0);

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cssVars(p: Palette): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) vars[`--ai-rt-${k}`] = v;
  return vars as CSSProperties;
}

const splitWords = (paragraph: string) => paragraph.split(/\s+/).filter(Boolean);

const seconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`;

/** The step list's edge fade: each end fades only when the list can scroll that way. */
function fadeMask(top: boolean, bottom: boolean): CSSProperties | undefined {
  if (!top && !bottom) return undefined;
  const mask = `linear-gradient(to bottom, ${top ? "transparent" : "#000"} 0, #000 ${top ? FADE_TOP : 0}px, #000 calc(100% - ${bottom ? FADE_BOTTOM : 0}px), ${bottom ? "transparent" : "#000"} 100%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/** The first `count` words of the script, kept as paragraphs so the reply keeps its shape. */
function revealWords(paragraphs: string[], count: number): string[] {
  let left = count;
  const shown: string[] = [];
  for (const paragraph of paragraphs) {
    const words = splitWords(paragraph);
    const take = words.slice(0, Math.max(0, left));
    left -= words.length;
    if (take.length > 0) shown.push(take.join(" "));
  }
  return shown;
}

/** When every beat of the scripted demo lands, in model milliseconds. Pure, so every run has the same rhythm. */
function timeline(steps: number) {
  const stepAt: number[] = [];
  let t = LEAD;
  for (let i = 0; i < steps; i++) {
    stepAt.push(t);
    t += STEP_GAP * JITTER[i % JITTER.length];
  }
  const answerAt = (stepAt[steps - 1] ?? LEAD) + SETTLE;
  const wordAt = Array.from({ length: Math.ceil(DEMO_WORDS / WORDS_PER_TICK) }, (_, k) => answerAt + (k + 1) * WORD_GAP);
  const doneAt = (wordAt[wordAt.length - 1] ?? answerAt) + DONE_HOLD;
  return { stepAt, answerAt, wordAt, doneAt };
}

/** Entrance for a step: rises out of a blur, after `delay` seconds. Reduced motion: a short opacity fade only. */
function rise(reduce: boolean, delay: number) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } };
  return {
    initial: { opacity: 0, y: 6, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: STEP_IN, ease: EASE_OUT, delay },
  };
}

function readStoredChoice(key: string): boolean | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === "open" ? true : v === "closed" ? false : null;
  } catch {
    return null;
  }
}

function storeChoice(key: string, open: boolean) {
  try {
    window.localStorage.setItem(key, open ? "open" : "closed");
  } catch {
    /* Storage can be blocked; the choice still holds for this session. */
  }
}

/** A header label on its way out: its kind, and the time it showed (null: the frozen hand-off time). */
type OutgoingLabel = { thinking: boolean; timed: boolean; ms: number | null };

/** The header label's words, as plain text, for a label that is not live. */
function staticLabel(thinking: boolean, timed: boolean, ms: number | null) {
  if (thinking) return timed && ms !== null ? { verb: "Thinking", sep: true, digits: seconds(ms) } : { verb: "Thinking", sep: false, digits: null };
  return timed && ms !== null ? { verb: "Thought for", sep: false, digits: seconds(ms) } : { verb: "Thought", sep: false, digits: null };
}

/**
 * One header label, verb, separator and digits together. A live label renders the ticking clock in
 * place of static digits. An outgoing label is hidden from assistive tech and reports when it has faded.
 */
function LabelText({
  verb,
  sep,
  digits,
  live,
  hidden,
  className,
  onDone,
}: {
  verb: string;
  sep: boolean;
  digits: string | null;
  live?: ReactNode;
  hidden?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  return (
    <span
      aria-hidden={hidden || undefined}
      onAnimationEnd={onDone}
      className={`inline-flex items-baseline gap-1.5 whitespace-nowrap [grid-area:1/1] ${className ?? ""}`}
    >
      <span>{verb}</span>
      {live ? (
        <>
          <span aria-hidden="true">·</span>
          {live}
        </>
      ) : (
        <>
          {sep ? <span aria-hidden="true">·</span> : null}
          {digits === null ? null : <span className="text-[var(--ai-rt-ink)]">{digits}</span>}
        </>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

/**
 * The one ambient signal: a dot that breathes in full ink while the model is working.
 * Once it stops working the dot settles to dim ink and holds still, so a finished card never reads as live.
 */
function StatusDot({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2 shrink-0 rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none ${live ? "ai-rt-breathe bg-[var(--ai-rt-ink)]" : "bg-[var(--ai-rt-dim)]"}`}
    />
  );
}

/**
 * The live timer. It owns its own clock, so the rest of the card does not re-render ten times a second.
 * The digits change in place: no remount, no blur. The clock pauses while the card is offscreen or the
 * tab is hidden, and reads the real time again from `startedAt` when it resumes.
 */
function Elapsed({ startedAt }: { startedAt: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    let visible = true;
    let id = 0;
    const tick = () => setNow(Date.now());
    const sync = () => {
      const run = visible && !document.hidden;
      if (run && id === 0) {
        tick();
        id = window.setInterval(tick, CLOCK_MS);
      } else if (!run && id !== 0) {
        window.clearInterval(id);
        id = 0;
      }
    };
    const el = ref.current;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            sync();
          })
        : null;
    if (io && el) io.observe(el);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.clearInterval(id);
    };
  }, []);
  return (
    <span ref={ref} className="text-[var(--ai-rt-ink)]">
      {seconds(now - startedAt)}
    </span>
  );
}

/**
 * The reply, word by word. Words from index `settled` onwards settle in as they
 * mount; the ones already on screen when the reply first rendered don't animate
 * again, so a finished reply appears at once.
 */
function Answer({ paragraphs, settled }: { paragraphs: string[][]; settled: number }) {
  let offset = 0;
  return (
    <>
      {paragraphs.map((words, pi) => {
        const start = offset;
        offset += words.length;
        return (
          <p key={pi} className="max-w-[62ch] text-pretty">
            {words.map((w, wi) => (
              <span key={wi} className={start + wi < settled ? undefined : "ai-rt-word"}>
                {w}{" "}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function ReasoningTrace({
  state = "done",
  trace = NO_STEPS,
  answer = NO_ANSWER,
  startedAt,
  thoughtForMs,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  autoCollapse = true,
  rememberChoice = true,
  storageKey,
  showTimer = true,
  theme = "dark",
  className = "",
}: ReasoningTraceProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const regionId = `${uid}-trace`;
  const palette = useMemo(() => cssVars(PALETTE[theme]), [theme]);

  const thinking = state === "thinking";
  const count = trace.length;
  const tokens = useMemo(() => answer.map(splitWords), [answer]);
  const words = tokens.reduce((n, p) => n + p.length, 0);
  const hasAnswer = words > 0;
  const remember = rememberChoice || storageKey !== undefined;

  /** Words already on screen at mount stay put; later arrivals settle in. */
  const [settledWords, setSettledWords] = useState(words);
  /** Bumped each time a new reply begins, so its words settle in afresh. */
  const [answerKey, setAnswerKey] = useState(0);
  /** The last reply shown, kept on screen while the reply region folds away. */
  const [keptAnswer, setKeptAnswer] = useState(tokens);
  /** The reader's open or closed choice. Null means auto-collapse decides. */
  const [choice, setChoice] = useState<boolean | null>(null);
  /** Steps that arrived together in the latest render. Only a batch staggers; streamed steps arrive one by one. */
  const [batch, setBatch] = useState({ from: 0, size: count });
  /** The last render's inputs, to spot a new run or a new reply without an effect. */
  const [prev, setPrev] = useState({ thinking, count, hasAnswer });

  if (prev.thinking !== thinking || prev.count !== count || prev.hasAnswer !== hasAnswer) {
    // A new run starts clean: thinking begins, or the trace is cleared.
    const newRun = (thinking && !prev.thinking) || (prev.count > 0 && count === 0);
    if (newRun && !remember) setChoice(null);
    if (count !== prev.count) setBatch(count > prev.count ? { from: prev.count, size: count - prev.count } : { from: count, size: 0 });
    if (hasAnswer && !prev.hasAnswer) {
      setAnswerKey((k) => k + 1);
      setSettledWords(0);
    }
    setPrev({ thinking, count, hasAnswer });
  }
  if (hasAnswer && keptAnswer !== tokens) setKeptAnswer(tokens);

  // A stored choice from an earlier visit. Read after mount, so the server and first client render agree.
  useEffect(() => {
    if (storageKey === undefined) return;
    const stored = readStoredChoice(storageKey);
    if (stored !== null) setChoice(stored);
  }, [storageKey]);

  /*
   * The measured thinking time, frozen once at the hand-off so the header never drifts after it.
   * Measured in a layout effect rather than during render, and before paint, so the frozen figure
   * is on screen in the same frame the label changes.
   */
  const [frozenMs, setFrozenMs] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (thinking || startedAt === undefined) setFrozenMs(null);
    else setFrozenMs((ms) => ms ?? Date.now() - startedAt);
  }, [thinking, startedAt]);

  /* Header label: one unit (verb, separator and digits), so every part changes in the same frame. */
  const doneMs = thinking ? null : (thoughtForMs ?? frozenMs);
  const labelTimed = showTimer && (!thinking || startedAt !== undefined);
  const labelKey = `${thinking ? "thinking" : "thought"}-${labelTimed ? "timed" : "bare"}`;
  /*
   * The label swaps as one unit. The outgoing label stays in the same grid cell, frozen, and fades out
   * while the incoming one fades in, so there is never an empty slot or a verb beside the wrong digits.
   * A thinking label leaving at the hand-off shows the same frozen time the new label reads.
   */
  const [label, setLabel] = useState<{ key: string; thinking: boolean; timed: boolean; ms: number | null; swap: number; out: OutgoingLabel | null }>(
    { key: labelKey, thinking, timed: labelTimed, ms: doneMs, swap: 0, out: null },
  );
  if (label.key !== labelKey) {
    setLabel({ key: labelKey, thinking, timed: labelTimed, ms: doneMs, swap: label.swap + 1, out: { thinking: label.thinking, timed: label.timed, ms: label.thinking ? null : label.ms } });
  } else if (label.ms !== doneMs) {
    setLabel({ ...label, ms: doneMs });
  }
  const outgoingMs = label.out ? (label.out.ms ?? doneMs) : null;
  const thoughtText = doneMs === null || !showTimer ? "Thought" : `Thought for ${seconds(doneMs)}`;

  /* Reader's choice. Set by a click when uncontrolled; the host's `open` wins when given. */
  const foldedByDefault = autoCollapse && !thinking;
  const open = openProp ?? choice ?? (foldedByDefault ? false : defaultOpen);
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setChoice(next);
    if (storageKey !== undefined) storeChoice(storageKey, next);
    onOpenChange?.(next);
  };
  const countLabel = count === 0 ? "Reasoning" : count === 1 ? "1 step" : `${count} steps`;
  const toggleLabel = `${open ? "Hide" : "Show"} reasoning${count === 0 ? "" : `, ${countLabel}`}`;

  /* Trace list: a capped scroll region that follows the newest step while thinking. */
  const listRef = useRef<HTMLOListElement>(null);
  const wasOpen = useRef(open);
  const [scrollable, setScrollable] = useState(false);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const syncList = useCallback((el: HTMLElement) => {
    const canScroll = el.scrollHeight > el.clientHeight + 1;
    setScrollable(canScroll);
    const top = canScroll && el.scrollTop > 2;
    const bottom = canScroll && el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setEdges((e) => (e.top === top && e.bottom === bottom ? e : { top, bottom }));
  }, []);
  useEffect(() => {
    const el = listRef.current;
    const reopened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!el) return;
    // While thinking the list follows the newest step. Once the reply is in, a reopened trace
    // starts at step one, and the reader scrolls down from there.
    if (thinking) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    else if (reopened) el.scrollTop = 0;
    syncList(el);
  }, [count, open, thinking, reduce, syncList]);
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncList(el));
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncList]);

  /* Screen reader: the first step, then one summary at most every five seconds, then the finished time. */
  const latest = count > 0 ? trace[count - 1].summary : "";
  const [announcement, setAnnouncement] = useState("");
  const lastSpokenAt = useRef<number | null>(null);
  useEffect(() => {
    if (count === 0) {
      lastSpokenAt.current = null;
      return;
    }
    if (!thinking) return;
    const now = Date.now();
    if (lastSpokenAt.current === null || now - lastSpokenAt.current >= SPEAK_EVERY_MS) {
      lastSpokenAt.current = now;
      setAnnouncement(latest);
    }
  }, [thinking, count, latest]);
  const doneAnnounced = useRef(!thinking);
  useEffect(() => {
    if (thinking) {
      doneAnnounced.current = false;
      return;
    }
    if (doneAnnounced.current) return;
    doneAnnounced.current = true;
    setAnnouncement(thoughtText);
  }, [thinking, thoughtText]);

  // The summary stays mounted through the hand-off, so its row can fold with it rather than
  // sliding out while the row shrinks. It is hidden from assistive tech once thinking ends.
  const current = trace[count - 1];
  // While the reply region folds away, it keeps showing the last reply, already settled.
  const shownAnswer = hasAnswer ? tokens : keptAnswer;

  return (
    <section
      aria-label="Reasoning"
      style={palette}
      className={`@container relative w-full font-sans antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      {/* Ambient and word-level motion, namespaced to this component. Reduced motion keeps opacity only. */}
      <style>{`
        @keyframes ai-rt-word { from { opacity: 0; filter: blur(3px); } to { opacity: 1; filter: blur(0); } }
        @keyframes ai-rt-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ai-rt-breathe { from { opacity: 0.45; } to { opacity: 1; } }
        @keyframes ai-rt-label-in { from { opacity: 0; filter: blur(3px); } to { opacity: 1; filter: blur(0); } }
        @keyframes ai-rt-label-out { from { opacity: 1; filter: blur(0); } to { opacity: 0; filter: blur(3px); } }
        @keyframes ai-rt-fade-out { from { opacity: 1; } to { opacity: 0; } }
        .ai-rt-word { animation: ai-rt-word 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ai-rt-breathe { animation: ai-rt-breathe 1600ms ease-in-out infinite alternate; }
        .ai-rt-label-in { animation: ai-rt-label-in 200ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both; }
        .ai-rt-label-out { animation: ai-rt-label-out 120ms cubic-bezier(0.4, 0, 1, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .ai-rt-word { animation: ai-rt-fade 150ms ease-out both; }
          .ai-rt-breathe { animation: none; }
          .ai-rt-label-in { animation: ai-rt-fade 150ms ease-out both; }
          .ai-rt-label-out { animation: ai-rt-fade-out 100ms ease-in both; }
        }
      `}</style>

      <div className="rounded-[18px] border border-[var(--ai-rt-line)] bg-[var(--ai-rt-surface)] px-5 py-4 text-[var(--ai-rt-ink)] shadow-[var(--ai-rt-shadow)] @md:px-7 @md:py-6">
        <header className="flex min-h-11 items-center gap-3 @md:min-h-9">
          <StatusDot live={thinking} />
          <p className="inline-grid min-w-0 font-mono text-[12px] leading-none tabular-nums tracking-[0.01em] text-[var(--ai-rt-muted)]">
            {/* Outgoing and incoming labels share one grid cell and cross-fade, each as one unit. */}
            {label.out ? (
              <LabelText
                key={`out-${label.swap}`}
                {...staticLabel(label.out.thinking, label.out.timed, outgoingMs)}
                className="ai-rt-label-out"
                hidden
                onDone={() => setLabel((l) => (l.out ? { ...l, out: null } : l))}
              />
            ) : null}
            <LabelText
              key={`in-${label.swap}`}
              {...staticLabel(thinking, labelTimed, doneMs)}
              className={label.swap > 0 ? "ai-rt-label-in" : undefined}
              live={thinking && labelTimed && startedAt !== undefined ? <Elapsed startedAt={startedAt} /> : null}
            />
          </p>
          <button
            type="button"
            data-demo="trace-toggle"
            aria-expanded={open}
            aria-controls={regionId}
            aria-label={toggleLabel}
            onClick={toggle}
            className="group ml-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3 font-mono text-[12px] tabular-nums text-[var(--ai-rt-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--ai-rt-hover)] hover:text-[var(--ai-rt-ink)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ai-rt-ink)] @md:h-9"
          >
            {countLabel}
            <ChevronDown
              aria-hidden="true"
              className={`size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            />
          </button>
        </header>

        {/* The live summary rewrites as the model moves on. At the hand-off its row folds and fades together. */}
        <div
          aria-hidden={!thinking}
          inert={!thinking}
          className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ gridTemplateRows: thinking ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className="relative min-h-[1.5em] pt-3 transition-opacity ease-out"
              style={{ opacity: thinking ? 1 : 0, transitionDuration: `${HAND_OFF_FOLD * 1000}ms` }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {current ? (
                  <motion.p
                    key={count}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: SUMMARY_OUT, ease: "easeIn" } }}
                    transition={{ duration: reduce ? 0.15 : SUMMARY_IN, ease: EASE_OUT }}
                    className="truncate text-[15px] leading-[1.5] tracking-[-0.005em] text-[var(--ai-rt-ink)] @md:text-[16px]"
                  >
                    {current.summary}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* The trace folds with grid-rows, so its height is the content's own, without measuring. */}
        <div
          id={regionId}
          inert={!open}
          className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ gridTemplateRows: open ? "1fr" : "0fr", transitionDuration: `${FOLD_MS}ms` }}
        >
          <div className="min-h-0 overflow-hidden">
            <ol
              ref={listRef}
              tabIndex={scrollable ? 0 : undefined}
              onScroll={(e) => syncList(e.currentTarget)}
              aria-label="Reasoning steps"
              aria-busy={thinking}
              data-demo="trace-steps"
              className={`ml-1 max-h-[14rem] space-y-2.5 overflow-y-auto overscroll-contain pl-4 pr-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ai-rt-ink)] @md:ml-1.5 @md:pl-5 ${count > 0 ? "mt-3 border-l border-[var(--ai-rt-line)] pb-1" : ""}`}
              style={fadeMask(edges.top, edges.bottom)}
            >
              {trace.map((step, i) => {
                const live = thinking && i === count - 1;
                const delay = batch.size > 1 && i >= batch.from ? Math.min(i - batch.from, 8) * STEP_STAGGER : 0;
                return (
                  <motion.li
                    key={i}
                    {...rise(reduce, delay)}
                    className={`grid gap-x-2 grid-cols-[1.75rem_1fr] ${step.atMs === undefined ? "" : "@md:grid-cols-[1.75rem_1fr_auto]"}`}
                  >
                    <span className="pt-px font-mono text-[11px] leading-[1.55] tabular-nums text-[var(--ai-rt-dim)]">{String(i + 1).padStart(2, "0")}</span>
                    <span className={`text-[13.5px] leading-[1.55] transition-colors duration-300 ${live ? "text-[var(--ai-rt-body)]" : "text-[var(--ai-rt-dim)]"}`}>
                      {step.detail}
                    </span>
                    {step.atMs === undefined ? null : (
                      <span className="hidden pt-px font-mono text-[11px] leading-[1.55] tabular-nums text-[var(--ai-rt-dim)] @md:block">+{seconds(step.atMs)}</span>
                    )}
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </div>

        {/*
          The reply grows in while the trace folds, so the card changes height once at the hand-off.
          When a reply is cleared it folds and fades away instead of vanishing in a frame.
        */}
        <div
          aria-hidden={!hasAnswer}
          inert={!hasAnswer}
          className="grid transition-[grid-template-rows] motion-reduce:transition-none"
          style={{
            gridTemplateRows: hasAnswer ? "1fr" : "0fr",
            transitionDuration: `${FOLD_MS}ms`,
            transitionTimingFunction: hasAnswer ? EASE_OUT_CSS : EASE_IN_OUT_CSS,
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              aria-busy={state === "answering"}
              className="pt-5 transition-[opacity,filter] motion-reduce:transition-opacity"
              style={{
                opacity: hasAnswer ? 1 : 0,
                filter: hasAnswer || reduce ? "blur(0px)" : "blur(3px)",
                transitionDuration: hasAnswer ? "200ms" : "260ms",
                transitionTimingFunction: hasAnswer ? EASE_OUT_CSS : "cubic-bezier(0.4, 0, 1, 1)",
              }}
            >
              <div className="space-y-[1.1em] border-t border-[var(--ai-rt-line)] pt-5 text-[16px] leading-[1.65] text-[var(--ai-rt-body)] @md:text-[16.5px]">
                <Answer key={answerKey} paragraphs={shownAnswer} settled={hasAnswer ? settledWords : Number.POSITIVE_INFINITY} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Outside every busy region, so polite announcements are spoken as they happen. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Scripted demo (the default export only; hosts never use this)        */
/* ------------------------------------------------------------------ */

type DemoRun = { phase: ReasoningState | "clearing"; shown: number; words: number; startedAt: number };

/** True once the page has loaded and stayed quiet for `delayMs`. Runs once. */
function usePageSettled(delayMs: number) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let id = 0;
    const begin = () => {
      id = window.setTimeout(() => setSettled(true), delayMs);
    };
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
    return () => {
      window.removeEventListener("load", begin);
      window.clearTimeout(id);
    };
  }, [delayMs]);
  return settled;
}

/**
 * Streams the demo script on the clock, the way a host would stream a model's
 * steps. It runs while `ready`, restarts from zero whenever `steps`, `speed` or
 * `epoch` change, and never runs unless `mode` is thinking.
 *
 * Before the first run the card rests finished, with its trace open. That is the
 * tallest state the card reaches, so the first frame a recording or a screenshot
 * sees already has room for the whole card. A run then folds the trace and the
 * reply away together, and only once they have closed does the stream begin.
 */
function useScriptedReasoning({ steps, speed, mode, ready, epoch }: { steps: number; speed: number; mode: "thinking" | "done"; ready: boolean; epoch: number }) {
  const count = Math.min(Math.max(MIN_STEPS, Math.round(steps)), DEMO_TRACE.length);
  const pace = Math.max(0.25, speed);
  const plan = useMemo(() => timeline(count), [count]);
  const [run, setRun] = useState<DemoRun | null>(null);
  const streaming = mode === "thinking" && ready;

  // Layout effect: a run asked for again drops back to the resting card before paint, holds it, folds
  // it away, then streams.
  useLayoutEffect(() => {
    if (!streaming) return;
    setRun(null);
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const at = (ms: number, fn: () => void) => later(REST_HOLD + CLEAR + ms / pace, fn);
    const update = (patch: Partial<DemoRun>) => setRun((r) => (r ? { ...r, ...patch } : r));
    later(REST_HOLD, () => setRun({ phase: "clearing", shown: 0, words: 0, startedAt: 0 }));
    at(0, () => setRun({ phase: "thinking", shown: 0, words: 0, startedAt: Date.now() }));
    plan.stepAt.forEach((ms, i) => at(ms, () => update({ shown: i + 1 })));
    at(plan.answerAt, () => update({ phase: "answering" }));
    plan.wordAt.forEach((ms, k) => at(ms, () => update({ words: Math.min(DEMO_WORDS, (k + 1) * WORDS_PER_TICK) })));
    at(plan.doneAt, () => update({ phase: "done" }));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [streaming, plan, pace, epoch]);

  const timed = (n: number) => DEMO_TRACE.slice(0, n).map((s, i) => ({ ...s, atMs: plan.stepAt[i] / pace }));
  const finished = { state: "done" as const, trace: timed(count), answer: DEMO_ANSWER, thoughtForMs: plan.answerAt / pace };

  // Resting: finished at once, so nothing was measured and the thinking time is the scheduled one.
  if (mode === "done" || run === null) return { rest: mode === "thinking" ? ("resting" as const) : null, stage: finished };
  // Clearing: the finished card folds its trace and its reply away before the stream begins.
  if (run.phase === "clearing") return { rest: "clearing" as const, stage: { ...finished, answer: NO_ANSWER } };
  return {
    rest: null,
    stage: { state: run.phase, trace: timed(run.shown), answer: revealWords(DEMO_ANSWER, run.words), startedAt: run.startedAt },
  };
}

export type ReasoningTraceDemoProps = Partial<ReasoningTraceProps> & {
  /** Demo only (default export only, not part of the component API): how many steps the scripted stream runs, from 3 to 12. */
  steps?: number;
  /** Demo only (default export only, not part of the component API): stream pace. 2 streams twice as fast, so the timer reads the shorter time. */
  speed?: number;
};

/** The trace on a quiet stage, streaming its script. Overrides (the page's Customize panel) go straight to the component. */
export default function ReasoningTraceDemo({ steps = DEMO_STEPS, speed = 1, state, ...overrides }: ReasoningTraceDemoProps = {}) {
  const theme = overrides.theme ?? "dark";
  const reduce = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { once: true, amount: 0.2 });
  const settled = usePageSettled(DEMO_SETTLE_MS);
  // The first pointer movement restarts the script from zero and starts it at once, even before the page settles.
  const [pointed, setPointed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  // The reader's choice while the card is resting before the first run. Once streaming, the component owns it.
  const [restingOpen, setRestingOpen] = useState(true);
  const onFirstPointer = () => {
    if (pointed) return;
    setPointed(true);
    setEpoch((n) => n + 1);
  };
  // Reduced motion never autoplays: the finished reply is simply there, and the reader can open the trace.
  const mode = reduce || state === "done" ? "done" : "thinking";
  const { stage, rest } = useScriptedReasoning({ steps, speed, mode, ready: inView && (settled || pointed), epoch });
  const open = rest === "resting" ? restingOpen : rest === "clearing" ? false : overrides.open;
  return (
    // Anchored to the top of the stage, so the header never moves as the trace grows and folds.
    <div
      ref={stageRef}
      onPointerMove={onFirstPointer}
      className="flex min-h-dvh w-full items-start justify-center px-4 pb-14 pt-[15vh] font-sans sm:px-8"
      style={{ background: STAGE[theme] }}
    >
      <div className="w-full max-w-[640px]">
        <ReasoningTrace {...stage} {...overrides} open={open} onOpenChange={rest === "resting" ? setRestingOpen : overrides.onOpenChange} />
      </div>
    </div>
  );
}
