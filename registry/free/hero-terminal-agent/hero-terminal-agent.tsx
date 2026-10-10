"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";

type Link = { label: string; href: string };

export type SessionFile = {
  /** File or folder name as it appears in the tree. Folders end with "/". */
  name: string;
  /** Nesting depth, 0 for top level. */
  depth: number;
  /** Draws the last-child elbow (└─) instead of a tee (├─). */
  last?: boolean;
  added?: number;
  removed?: number;
};

export type SessionTest = {
  name: string;
  /** Duration printed after the tick, e.g. "12ms". */
  time: string;
  /** How long the spinner runs before the test passes, in ms of session time. */
  run: number;
};

export type AgentSession = {
  cwd: string;
  branch: string;
  /** Branch the agent works on, shown in the status bar. */
  workBranch: string;
  command: string;
  /** Line shown while the agent reads the repo. */
  reading: string;
  readingDone: string;
  plan: string[];
  files: SessionFile[];
  tests: SessionTest[];
  testSummary: string;
  pr: { number: number; title: string; href: string; note: string };
};

export type HeroTerminalAgentProps = {
  /** Headline, one string per line. The `emphasis` phrase is set at 45% ink. */
  headline?: string[];
  emphasis?: string;
  body?: string;
  primary?: Link;
  /** Shell command in the copyable chip. */
  installCommand?: string;
  /** Short facts in the mono row under the actions. */
  facts?: string[];
  /** Tab title in the terminal header. */
  tabTitle?: string;
  version?: string;
  session?: AgentSession;
  /** Milliseconds the finished session stays on screen before it replays. */
  loopPause?: number;
  /** The one signal colour: the install chip's "Copied" confirmation. */
  accent?: string;
  /** Holds or resumes the session from outside. The pause button in the tab bar toggles it too. */
  playback?: "play" | "pause";
  /** Called when the pause button in the tab bar holds or resumes the session. */
  onPlaybackChange?: (playback: "play" | "pause") => void;
  /** Clock multiplier for the scripted session: 1 is real pace, 3 plays it three times faster. */
  speed?: number;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const COLORS = {
  page: "#09090b",
  surface: "#0f0f11",
  ink: "#f4f4f5",
  /** Text on the accent and on the ink button. */
  onLight: "#09090b",
} as const;

const DEFAULT_ACCENT = "#d4ff3a";
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Entrance timeline, in seconds. The copy lands first (headline lines, body,
 * actions, facts), then the terminal assembles (frame, header, status bar),
 * and only then does the session start typing.
 */
const T = {
  line: 0,
  lineStep: 0.065,
  body: 0.26,
  actions: 0.32,
  facts: 0.38,
  factStep: 0.04,
  frame: 0.3,
  header: 0.42,
  headerStep: 0.04,
  status: 0.52,
  dur: 0.55,
} as const;

/** Session time (ms) before the first line prints, so it starts once the frame has landed. */
const SESSION_DELAY = 800;
/** Braille spinner frames and how long each one shows, in ms. */
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPIN_FRAME = 80;
/** Longest frame step the clock accepts, so a backgrounded tab doesn't skip the session. */
const MAX_DT = 100;
const COPIED_MS = 1800;
/** Pointer tilt of the terminal, in degrees either way. */
const TILT = 1.5;

const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: T.dur, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const frameIn: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: 0.5, ease: EASE, delay } }),
};
/** Reduced motion: one short fade for everything, no transforms, blur or stagger. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--ta-ink)";

const DEFAULT_SESSION: AgentSession = {
  cwd: "~/northwind/checkout-api",
  branch: "main",
  workBranch: "relay/rate-limit",
  command: 'relay ship "rate-limit /v1/checkout and /v1/refunds"',
  reading: "Reading 214 files",
  readingDone: "214 files in 1.8s",
  plan: [
    "Add a token-bucket limiter as middleware",
    "Wire it into /v1/checkout and /v1/refunds",
    "Cover bursts, refills and separate buckets",
    "Open a PR with a changelog entry",
  ],
  files: [
    { name: "src/", depth: 0 },
    { name: "middleware/", depth: 1 },
    { name: "rate-limit.ts", depth: 2, last: true, added: 84 },
    { name: "routes/checkout.ts", depth: 1, added: 6, removed: 2 },
    { name: "routes/refunds.ts", depth: 1, last: true, added: 6, removed: 2 },
    { name: "tests/", depth: 0 },
    { name: "rate-limit.test.ts", depth: 1, last: true, added: 112 },
    { name: "CHANGELOG.md", depth: 0, last: true, added: 4 },
  ],
  tests: [
    { name: "allows 20 requests per window", time: "12ms", run: 380 },
    { name: "answers the 21st with a 429", time: "9ms", run: 320 },
    { name: "refills a token every 50ms", time: "1.04s", run: 1100 },
    { name: "keeps refunds on their own bucket", time: "14ms", run: 360 },
    { name: "checkout e2e still green", time: "2.31s", run: 1500 },
  ],
  testSummary: "5 passed  ·  3.39s",
  pr: {
    number: 482,
    title: "Rate-limit checkout and refunds",
    href: "#pr-482",
    note: "Waiting on one reviewer. Go and get a coffee.",
  },
};

/* ------------------------------------------------------------------ */
/* Session timeline                                                    */
/* ------------------------------------------------------------------ */

type Row =
  | { kind: "cwd"; at: number }
  | { kind: "cmd"; at: number; typedAt: number[] }
  | { kind: "status"; at: number; doneAt: number; label: string; done: string }
  | { kind: "heading"; at: number; label: string }
  | { kind: "plan"; at: number; n: number; text: string }
  | { kind: "file"; at: number; file: SessionFile }
  | { kind: "test"; at: number; doneAt: number; test: SessionTest }
  | { kind: "summary"; at: number; text: string }
  | { kind: "pr"; at: number }
  | { kind: "prTitle"; at: number }
  | { kind: "note"; at: number }
  | { kind: "idle"; at: number };

/** Pacing of the session, in ms. */
const PACE = { prompt: 650, typed: 520, read: 1150, afterRead: 1400, plan: 230, section: 600, file: 170, test: 160, summary: 300, pr: 750, prTitle: 160, note: 420, idle: 500 } as const;

/** Lays the session out on one clock. Also returns every moment something changes, so React only renders then. */
function buildTimeline(s: AgentSession) {
  const rows: Row[] = [];
  let t = 0;
  rows.push({ kind: "cwd", at: t });
  t += PACE.prompt;
  const cmdAt = t;
  // Per-character typing delays, jittered deterministically so it reads human.
  const typedAt: number[] = [];
  for (let i = 0; i < s.command.length; i++) {
    t += 26 + ((s.command.charCodeAt(i) * 37 + i * 11) % 34) + (s.command[i] === " " ? 40 : 0);
    typedAt.push(t);
  }
  rows.push({ kind: "cmd", at: cmdAt, typedAt });
  t += PACE.typed;
  rows.push({ kind: "status", at: t, doneAt: t + PACE.read, label: s.reading, done: s.readingDone });
  t += PACE.afterRead;
  rows.push({ kind: "heading", at: t, label: "Plan" });
  s.plan.forEach((text, n) => rows.push({ kind: "plan", at: (t += PACE.plan), n: n + 1, text }));
  t += PACE.section;
  rows.push({ kind: "heading", at: t, label: "Writing files" });
  s.files.forEach((file) => rows.push({ kind: "file", at: (t += PACE.file), file }));
  t += PACE.section;
  rows.push({ kind: "heading", at: t, label: "Running tests" });
  s.tests.forEach((test) => {
    t += PACE.test;
    rows.push({ kind: "test", at: t, doneAt: t + test.run, test });
    t += test.run;
  });
  rows.push({ kind: "summary", at: (t += PACE.summary), text: s.testSummary });
  rows.push({ kind: "pr", at: (t += PACE.pr) });
  rows.push({ kind: "prTitle", at: (t += PACE.prTitle) });
  rows.push({ kind: "note", at: (t += PACE.note) });
  rows.push({ kind: "idle", at: (t += PACE.idle) });

  const marks = new Set<number>();
  for (const r of rows) {
    marks.add(r.at);
    if ("doneAt" in r) marks.add(r.doneAt);
    if (r.kind === "cmd") r.typedAt.forEach((x) => marks.add(x));
  }
  return { rows, total: t, marks: [...marks].sort((a, b) => a - b) };
}

/**
 * One clock for the whole session. Time lives in a motion value (the spinner
 * and elapsed clock read it without re-rendering); React state only moves when
 * the clock crosses a mark, i.e. when a line, a character or a tick changes.
 * It pauses offscreen, in hidden tabs and while held, and replays after `loopPause`.
 */
function useSessionClock({ marks, total, loopPause, running, speed }: { marks: number[]; total: number; loopPause: number; running: boolean; speed: number }) {
  const time = useMotionValue(0);
  const [step, setStep] = useState(0);
  const elapsed = useRef(-SESSION_DELAY);
  const passed = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, MAX_DT);
      last = now;
      if (!document.hidden) {
        elapsed.current += dt * speed;
        if (elapsed.current > total + loopPause) {
          elapsed.current = 0;
          passed.current = 0;
        }
        let n = passed.current;
        while (n < marks.length && marks[n]! <= elapsed.current) n++;
        if (n !== passed.current) {
          passed.current = n;
          setStep(n);
        }
        time.set(Math.max(0, elapsed.current));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, marks, total, loopPause, speed, time]);

  // The last mark passed is "now" for rendering; before the first one, nothing has printed.
  const now = step > 0 ? marks[step - 1]! : -1;
  return { time, now };
}

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function HeroTerminalAgent({
  headline = ["The agent", "that does the", "boring parts", "of shipping."],
  emphasis = "boring parts",
  body = "Relay reads your repo, writes the change, runs the tests and opens the pull request. You review a tidy diff and keep the interesting work for yourself.",
  primary = { label: "Start shipping free", href: "#signup" },
  installCommand = "npx relay@latest init",
  facts = ["Runs locally or in CI", "Never pushes to main", "Free for open source"],
  tabTitle = "checkout-api",
  version = "relay 2.4.1",
  session = DEFAULT_SESSION,
  loopPause = 5200,
  accent = DEFAULT_ACCENT,
  playback,
  onPlaybackChange,
  speed = 1,
}: HeroTerminalAgentProps) {
  const rootRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const reduce = !!useReducedMotion();
  // Reveal once, when a fifth of the hero is on screen.
  const inView = useInView(rootRef, { once: true, amount: 0.2 });
  const vars = {
    "--ta-page": COLORS.page,
    "--ta-surface": COLORS.surface,
    "--ta-ink": COLORS.ink,
    "--ta-on-light": COLORS.onLight,
    "--ta-accent": accent,
  } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  return (
    <motion.section
      ref={rootRef}
      aria-labelledby={headingId}
      style={vars}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className="@container relative isolate overflow-hidden bg-(--ta-page) text-(--ta-ink)"
    >
      {/* A hairline grid, faded out toward the edges: texture, not decoration. */}
      <motion.div
        aria-hidden="true"
        variants={fade}
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_70%_45%,#000_20%,transparent_75%)]"
      />
      <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-14 px-5 py-16 @xl:px-8 @xl:py-20 @5xl:grid-cols-12 @5xl:items-center @5xl:px-12 @5xl:py-28">
        <div className="@5xl:col-span-6">
          <h1
            id={headingId}
            className="font-display text-[clamp(2.75rem,1.4rem+4.6cqi,5.25rem)] font-bold leading-[0.95] tracking-[-0.05em]"
          >
            {headline.map((line, i) => (
              <motion.span key={i} variants={v(reveal)} custom={T.line + i * T.lineStep} className="block">
                <Emphasised text={line} phrase={emphasis} />
              </motion.span>
            ))}
          </h1>
          <motion.p variants={v(reveal)} custom={T.body} className="mt-7 max-w-[46ch] text-[17px] leading-[1.6] text-(--ta-ink)/65">
            {body}
          </motion.p>
          <motion.div variants={v(reveal)} custom={T.actions} className="mt-9 flex flex-col gap-3 @md:flex-row @md:flex-wrap @md:items-center">
            <PrimaryLink link={primary} />
            <CopyCommand command={installCommand} />
          </motion.div>
          <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em] text-(--ta-ink)/45">
            {facts.map((f, i) => (
              <motion.li key={f} variants={v(reveal)} custom={T.facts + i * T.factStep} className="flex items-center gap-2">
                <span className="h-px w-3 bg-(--ta-ink)/30" aria-hidden="true" />
                {f}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="relative min-w-0 @5xl:col-span-6">
          <Terminal session={session} tabTitle={tabTitle} version={version} loopPause={loopPause} playback={playback} onPlaybackChange={onPlaybackChange} speed={speed} reduce={reduce} variants={v} />
        </div>
      </div>
    </motion.section>
  );
}

/** Sets a phrase of a line at 45% ink: two tones of one voice, no colour. */
function Emphasised({ text, phrase }: { text: string; phrase: string }) {
  const i = phrase ? text.indexOf(phrase) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="whitespace-nowrap text-(--ta-ink)/45">{phrase}</span>
      {text.slice(i + phrase.length)}
    </>
  );
}

function PrimaryLink({ link }: { link: Link }) {
  return (
    <a
      href={link.href}
      className={`group inline-flex h-12 items-center justify-center gap-2.5 rounded-[10px] bg-(--ta-ink) px-5 text-[15px] font-semibold text-(--ta-on-light) transition-[background-color,transform] duration-150 hover:bg-white active:scale-[0.98] ${FOCUS}`}
    >
      {link.label}
      <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-150 group-hover:translate-x-[3px]" fill="none" aria-hidden="true">
        <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Copyable install chip                                               */
/* ------------------------------------------------------------------ */

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard can be blocked (iframes, http). Still confirm: the command is visible to copy by hand.
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy install command: ${command}`}
      data-demo="copy-command"
      className={`group inline-flex h-12 min-w-0 items-center justify-between gap-4 rounded-[10px] border border-(--ta-ink)/15 bg-(--ta-surface) pl-4 pr-2 font-mono text-[13.5px] text-(--ta-ink)/85 transition-[border-color,transform] duration-150 hover:border-(--ta-ink)/30 active:scale-[0.98] ${FOCUS}`}
    >
      <span className="truncate">
        <span className="select-none text-(--ta-ink)/35">$ </span>
        {command}
      </span>
      {/* The accent appears here and only here: it confirms the copy. */}
      <span
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 font-sans text-[12px] font-medium transition-colors duration-200 ${
          copied ? "bg-(--ta-accent) text-(--ta-on-light)" : "bg-(--ta-ink)/[0.07] text-(--ta-ink)/70 group-hover:bg-(--ta-ink)/[0.12] group-hover:text-(--ta-ink)"
        }`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? "copied" : "copy"}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="inline-flex"
          >
            {copied ? (
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 3.5v-.4A1.1 1.1 0 0 0 9.4 2H3.6A1.1 1.1 0 0 0 2.5 3.1v5.8a1.1 1.1 0 0 0 1.1 1.1H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Terminal                                                            */
/* ------------------------------------------------------------------ */

type VariantPicker = (v: Variants) => Variants;

function Terminal({
  session,
  tabTitle,
  version,
  loopPause,
  playback,
  onPlaybackChange,
  speed,
  reduce,
  variants: v,
}: {
  session: AgentSession;
  tabTitle: string;
  version: string;
  loopPause: number;
  playback?: "play" | "pause";
  onPlaybackChange?: (playback: "play" | "pause") => void;
  speed: number;
  reduce: boolean;
  variants: VariantPicker;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // The terminal has its own reveal because it sits below the fold on phones;
  // the session clock also needs it on screen, and stops when it leaves.
  const revealed = useInView(frameRef, { once: true, amount: 0.3 });
  const onScreen = useInView(frameRef, { amount: 0.25 });
  const { rows, total, marks } = useMemo(() => buildTimeline(session), [session]);
  // The pause button holds the session so a line can be read.
  const [held, setHeld] = useState(playback === "pause");
  useEffect(() => {
    if (playback) setHeld(playback === "pause");
  }, [playback]);
  // A non-positive or non-finite speed would stall or reverse the clock; fall back to real pace.
  const clockSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const speedRef = useRef(clockSpeed);
  speedRef.current = clockSpeed;
  const toggleHold = () => {
    const next = !held;
    setHeld(next);
    onPlaybackChange?.(next ? "pause" : "play");
  };
  const { time, now: clockNow } = useSessionClock({ marks, total, loopPause, running: revealed && onScreen && !held && !reduce, speed: clockSpeed });
  const now = reduce ? Number.POSITIVE_INFINITY : clockNow;
  const visible = rows.filter((r) => r.at <= now);
  const finished = now >= total;
  const tilt = usePointerTilt(reduce);

  const diff = visible.reduce(
    (acc, r) => (r.kind === "file" ? { files: acc.files + (r.file.added ? 1 : 0), add: acc.add + (r.file.added ?? 0), del: acc.del + (r.file.removed ?? 0) } : acc),
    { files: 0, add: 0, del: 0 },
  );

  // Keep the newest line in view, like a real terminal.
  const typed = visible.find((r): r is Extract<Row, { kind: "cmd" }> => r.kind === "cmd")?.typedAt.filter((x) => x <= now).length ?? 0;
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length, typed]);

  const spin = useTransform(time, (t) => SPIN[Math.floor(t / (SPIN_FRAME * speedRef.current)) % SPIN.length] ?? SPIN[0]!);
  const clock = useTransform(time, fmtClock);

  return (
    <motion.div
      ref={frameRef}
      data-demo="terminal"
      initial="hidden"
      animate={revealed ? "show" : "hidden"}
      variants={v(frameIn)}
      custom={T.frame}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 1400 }}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="relative overflow-hidden rounded-[14px] border border-(--ta-ink)/[0.09] bg-(--ta-surface) shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_50px_100px_-40px_rgba(0,0,0,0.9),0_20px_40px_-20px_rgba(0,0,0,0.6)]"
    >
      {/* Header: a tab, not traffic lights. */}
      <div className="relative flex h-11 items-stretch justify-between pr-3 font-mono text-[12px] text-(--ta-ink)/50">
        <div className="flex min-w-0 items-stretch">
          <motion.div variants={v(reveal)} custom={T.header} className="flex">
            <HoldButton held={held} disabled={reduce} onToggle={toggleHold} />
          </motion.div>
          <motion.div
            variants={v(reveal)}
            custom={T.header + T.headerStep}
            className="relative flex min-w-0 items-center gap-2.5 border-x border-(--ta-ink)/[0.07] bg-(--ta-ink)/[0.03] px-4 text-(--ta-ink)/85"
          >
            <span className="truncate">{tabTitle}</span>
            <span className="hidden text-(--ta-ink)/35 @md:inline">— relay ship</span>
            <motion.span variants={v(drawX)} custom={T.header + T.headerStep * 2} className="absolute inset-x-0 top-0 h-px origin-left bg-(--ta-ink)/40" aria-hidden="true" />
          </motion.div>
          <motion.div variants={v(reveal)} custom={T.header + T.headerStep * 2} className="hidden items-center px-4 text-(--ta-ink)/30 @md:flex" aria-hidden="true">
            +
          </motion.div>
        </div>
        <motion.div variants={v(reveal)} custom={T.header + T.headerStep * 3} className="flex shrink-0 items-center gap-2 tabular-nums" aria-hidden="true">
          <SessionState finished={finished} held={held} clock={clock} />
        </motion.div>
        <motion.span variants={v(drawX)} custom={T.header} className="absolute inset-x-0 bottom-0 h-px origin-left bg-(--ta-ink)/[0.07]" aria-hidden="true" />
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        role="log"
        aria-label="Example Relay session"
        aria-live="off"
        className="h-[380px] overflow-y-auto px-4 py-4 font-mono text-[12px] leading-[1.75] text-(--ta-ink)/85 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] @md:h-[440px] @md:px-5 @md:text-[13px] @5xl:h-[480px]"
      >
        {visible.map((r, i) => (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 4, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <TerminalRow row={r} now={now} spin={spin} session={session} />
          </motion.div>
        ))}
      </div>
      <style>{`@keyframes tm-hero-terminal-agent-blink{0%,55%{opacity:1}56%,100%{opacity:0}}`}</style>

      {/* Status bar */}
      <motion.div
        variants={v(reveal)}
        custom={T.status}
        className="relative flex h-8 items-center justify-between gap-4 bg-(--ta-ink)/[0.02] px-4 font-mono text-[11px] tabular-nums text-(--ta-ink)/45"
      >
        <motion.span variants={v(drawX)} custom={T.status} className="absolute inset-x-0 top-0 h-px origin-left bg-(--ta-ink)/[0.07]" aria-hidden="true" />
        <span className="flex min-w-0 items-center gap-3 truncate">
          <span className="text-(--ta-ink)/65">⎇ {session.workBranch}</span>
          <span className="hidden @md:inline">
            <Count value={diff.files} reduce={reduce} /> files
          </span>
          <span>
            <span className="text-(--ta-ink)/80">
              +<Count value={diff.add} reduce={reduce} />
            </span>{" "}
            −<Count value={diff.del} reduce={reduce} />
          </span>
        </span>
        <span className="shrink-0">{version}</span>
      </motion.div>
    </motion.div>
  );
}

/** Springs the terminal a degree or two toward a mouse pointer; levels out on leave. */
function usePointerTilt(reduce: boolean) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 180, damping: 22 });
  const rotateY = useSpring(ry, { stiffness: 180, damping: 22 });
  return {
    rotateX,
    rotateY,
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (reduce || e.pointerType !== "mouse") return;
      const r = e.currentTarget.getBoundingClientRect();
      ry.set(((e.clientX - r.left) / r.width - 0.5) * TILT * 2);
      rx.set(-((e.clientY - r.top) / r.height - 0.5) * TILT * 2);
    },
    onPointerLeave: () => {
      rx.set(0);
      ry.set(0);
    },
  };
}

/** A figure that tweens from its previous value, so the diff counts rather than jumps. */
function Count({ value, reduce }: { value: number; reduce: boolean }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (n) => String(Math.round(n)));
  useEffect(() => {
    if (reduce) {
      mv.jump(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.4, ease: EASE });
    return () => controls.stop();
  }, [value, reduce, mv]);
  return <motion.span>{text}</motion.span>;
}

function HoldButton({ held, disabled, onToggle }: { held: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={held ? "Resume session" : "Pause session"}
      aria-pressed={held}
      data-demo="session-pause"
      className="group/p flex items-center justify-center px-4 transition-colors duration-150 hover:bg-(--ta-ink)/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ta-ink) disabled:pointer-events-none"
    >
      <span className="relative flex size-3 items-center justify-center transition-transform duration-100 group-active/p:scale-90">
        <span className={`absolute flex gap-[3px] transition-[opacity,scale] duration-200 ${held ? "scale-50 opacity-0" : "opacity-100"}`}>
          <span className="h-3 w-[3px] rounded-full bg-(--ta-ink)/40 transition-colors duration-150 group-hover/p:bg-(--ta-ink)/80" />
          <span className="h-3 w-[3px] rounded-full bg-(--ta-ink)/40 transition-colors duration-150 group-hover/p:bg-(--ta-ink)/80" />
        </span>
        <svg viewBox="0 0 12 12" className={`absolute size-3 text-(--ta-ink) transition-[opacity,scale] duration-200 ${held ? "opacity-100" : "scale-50 opacity-0"}`} aria-hidden="true">
          <path d="M3 1.8v8.4L10 6z" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}

function SessionState({ finished, held, clock }: { finished: boolean; held: boolean; clock: MotionValue<string> }) {
  if (finished) {
    return (
      <>
        <span className="size-1.5 rounded-full bg-(--ta-ink)/80" />
        <span className="text-(--ta-ink)/70">done</span>
      </>
    );
  }
  if (held) {
    return (
      <>
        <span className="flex gap-[2px]">
          <span className="h-2 w-[2px] rounded-full bg-(--ta-ink)/60" />
          <span className="h-2 w-[2px] rounded-full bg-(--ta-ink)/60" />
        </span>
        <span className="text-(--ta-ink)/70">paused</span>
      </>
    );
  }
  return (
    <>
      <span className="size-1.5 rounded-full bg-(--ta-ink)/45" />
      <motion.span>{clock}</motion.span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

const GUTTER = "inline-block w-[1.5ch]";
const INDENT = "pl-[calc(1.5ch+0.5rem)]";

function Spinner({ ch }: { ch: MotionValue<string> }) {
  return <motion.span className={`${GUTTER} text-(--ta-ink)/50`}>{ch}</motion.span>;
}

function Tick() {
  return <span className={`${GUTTER} text-(--ta-ink)`}>✓</span>;
}

function Cursor({ solid }: { solid?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-px inline-block h-[1.15em] w-[0.6em] translate-y-[0.2em] bg-(--ta-ink)/80 ${solid ? "" : "animate-[tm-hero-terminal-agent-blink_1.1s_steps(1)_infinite] motion-reduce:animate-none"}`}
    />
  );
}

function TerminalRow({ row, now, spin, session }: { row: Row; now: number; spin: MotionValue<string>; session: AgentSession }) {
  switch (row.kind) {
    case "cwd":
      return (
        <p className="text-(--ta-ink)/45">
          <span className="text-(--ta-ink)/75">{session.cwd}</span> on <span className="text-(--ta-ink)/75">⎇ {session.branch}</span>
        </p>
      );
    case "cmd": {
      const n = row.typedAt.filter((x) => x <= now).length;
      return (
        <p className="whitespace-pre-wrap break-words">
          <span className="text-(--ta-ink)/45">❯ </span>
          <span className="text-(--ta-ink)">{session.command.slice(0, n)}</span>
          {n < session.command.length ? <Cursor solid /> : null}
        </p>
      );
    }
    case "status": {
      const done = now >= row.doneAt;
      return (
        <p className="mt-3 flex gap-2">
          {done ? <span className={`${GUTTER} text-(--ta-ink)/45`}>◇</span> : <Spinner ch={spin} />}
          <span className="min-w-0 flex-1">
            {done ? (
              <>
                Read <span className="text-(--ta-ink)/50">{row.done}</span>
              </>
            ) : (
              <span className="text-(--ta-ink)/70">{row.label}…</span>
            )}
          </span>
        </p>
      );
    }
    case "heading":
      return (
        <p className="mt-3 flex gap-2">
          <span className={`${GUTTER} text-(--ta-ink)/45`}>◇</span>
          <span className="text-(--ta-ink)">{row.label}</span>
        </p>
      );
    case "plan":
      return (
        <p className={`flex gap-2 ${INDENT} text-(--ta-ink)/70`}>
          <span className="w-[2ch] shrink-0 tabular-nums text-(--ta-ink)/35">{row.n}</span>
          <span className="min-w-0">{row.text}</span>
        </p>
      );
    case "file": {
      const f = row.file;
      return (
        <p className={`flex items-baseline gap-3 ${INDENT}`}>
          <span className="min-w-0 flex-1 break-words">
            <span className="text-(--ta-ink)/25">{"│  ".repeat(Math.max(0, f.depth - 1))}</span>
            {f.depth > 0 ? <span className="text-(--ta-ink)/25">{f.last ? "└─ " : "├─ "}</span> : null}
            <span className={f.name.endsWith("/") ? "text-(--ta-ink)/55" : "text-(--ta-ink)/90"}>{f.name}</span>
          </span>
          {f.added || f.removed ? (
            <span className="shrink-0 tabular-nums text-(--ta-ink)/40">
              {f.added ? <span className="text-(--ta-ink)/80">+{f.added}</span> : null}
              {f.removed ? <span className="ml-2">−{f.removed}</span> : null}
            </span>
          ) : null}
        </p>
      );
    }
    case "test": {
      const done = now >= row.doneAt;
      return (
        <p className={`flex items-baseline gap-2 ${INDENT}`}>
          {done ? <Tick /> : <Spinner ch={spin} />}
          <span className={`min-w-0 flex-1 ${done ? "text-(--ta-ink)/80" : "text-(--ta-ink)/55"}`}>{row.test.name}</span>
          <span className="shrink-0 tabular-nums text-(--ta-ink)/35">{done ? row.test.time : ""}</span>
        </p>
      );
    }
    case "summary":
      return (
        <p className={`flex gap-2 ${INDENT} pt-1`}>
          <span className={GUTTER} aria-hidden="true" />
          <span className="font-medium text-(--ta-ink)">{row.text}</span>
        </p>
      );
    case "pr":
      return (
        <p className="mt-3 flex gap-2">
          <span className={`${GUTTER} text-(--ta-ink)`}>◆</span>
          <span className="min-w-0 flex-1">
            Opened{" "}
            <a
              href={session.pr.href}
              className="rounded-sm text-(--ta-ink) underline decoration-(--ta-ink)/40 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-(--ta-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ta-ink)"
            >
              pull request #{session.pr.number}
            </a>
          </span>
        </p>
      );
    case "prTitle":
      return <p className={`${INDENT} text-(--ta-ink)/70`}>“{session.pr.title}”</p>;
    case "note":
      return <p className={`${INDENT} text-(--ta-ink)/40`}>{session.pr.note}</p>;
    case "idle":
      return (
        <p className="mt-3">
          <span className="text-(--ta-ink)/45">❯ </span>
          <Cursor />
        </p>
      );
  }
}

/** The featured instance. Overrides from the page's controls win over the demo's own props. */
export default function HeroTerminalAgentDemo({ playback: forced, ...overrides }: Partial<HeroTerminalAgentProps> = {}) {
  // The page's Session buttons force a state; the in-terminal button keeps the same state in step.
  const [playback, setPlayback] = useState<"play" | "pause" | undefined>(forced);
  useEffect(() => {
    if (forced) setPlayback(forced);
  }, [forced]);
  // 3x: the plan, files, tests and PR land inside a short loop.
  return <HeroTerminalAgent speed={3} {...overrides} playback={playback} onPlaybackChange={setPlayback} />;
}
