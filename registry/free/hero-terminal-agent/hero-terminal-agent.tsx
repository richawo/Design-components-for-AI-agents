"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

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
  /** How long the spinner runs before the test passes, in ms of animation time. */
  run: number;
};

export type AgentSession = {
  cwd: string;
  branch: string;
  /** Branch Relay works on, shown in the status bar. */
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
  brand?: string;
  /** Small release note above the headline. */
  announcement?: Link;
  /** The headline. The `emphasis` substring is set in a muted tone. */
  headline?: string;
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
};

const LIME = "#d4ff3a";
const ease = [0.2, 0.8, 0.2, 1] as const;
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const defaultSession: AgentSession = {
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
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

type Row =
  | { kind: "cwd"; at: number }
  | { kind: "cmd"; at: number; typedAt: number[] }
  | { kind: "status"; at: number; doneAt: number; label: string; done: string }
  | { kind: "heading"; at: number; label: string; gap: boolean }
  | { kind: "plan"; at: number; n: number; text: string }
  | { kind: "file"; at: number; file: SessionFile }
  | { kind: "test"; at: number; doneAt: number; test: SessionTest }
  | { kind: "summary"; at: number; text: string }
  | { kind: "pr"; at: number }
  | { kind: "prTitle"; at: number }
  | { kind: "note"; at: number }
  | { kind: "idle"; at: number };

function buildTimeline(s: AgentSession) {
  const rows: Row[] = [];
  let t = 0;
  rows.push({ kind: "cwd", at: t });
  t += 650;
  // Per-character typing delays, jittered deterministically so it reads human.
  const typedAt: number[] = [];
  for (let i = 0; i < s.command.length; i++) {
    const c = s.command.charCodeAt(i);
    t += 26 + ((c * 37 + i * 11) % 34) + (s.command[i] === " " ? 40 : 0);
    typedAt.push(t);
  }
  rows.push({ kind: "cmd", at: 650, typedAt });
  t += 520;
  rows.push({ kind: "status", at: t, doneAt: t + 1150, label: s.reading, done: s.readingDone });
  t += 1400;
  rows.push({ kind: "heading", at: t, label: "Plan", gap: true });
  s.plan.forEach((text, n) => {
    t += 230;
    rows.push({ kind: "plan", at: t, n: n + 1, text });
  });
  t += 600;
  rows.push({ kind: "heading", at: t, label: "Writing files", gap: true });
  s.files.forEach((file) => {
    t += 170;
    rows.push({ kind: "file", at: t, file });
  });
  t += 600;
  rows.push({ kind: "heading", at: t, label: "Running tests", gap: true });
  s.tests.forEach((test) => {
    t += 160;
    rows.push({ kind: "test", at: t, doneAt: t + test.run, test });
    t += test.run;
  });
  t += 300;
  rows.push({ kind: "summary", at: t, text: s.testSummary });
  t += 750;
  rows.push({ kind: "pr", at: t });
  t += 160;
  rows.push({ kind: "prTitle", at: t });
  t += 420;
  rows.push({ kind: "note", at: t });
  t += 500;
  rows.push({ kind: "idle", at: t });
  return { rows, total: t };
}

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function HeroTerminalAgent({
  brand = "Relay",
  announcement = { label: "Relay 2.4 reads monorepos now", href: "#changelog" },
  headline = "The agent that does the boring parts of shipping.",
  emphasis = "boring parts",
  body = "Relay reads your repo, writes the change, runs the tests and opens the pull request. You review a tidy diff and keep the interesting work for yourself.",
  primary = { label: "Start shipping free", href: "#signup" },
  installCommand = "npx relay@latest init",
  facts = ["Runs locally or in CI", "Never pushes to main", "Free for open source"],
  tabTitle = "checkout-api",
  version = "relay 2.4.1",
  session = defaultSession,
  loopPause = 5200,
}: HeroTerminalAgentProps) {
  const [pre, post] = splitOnce(headline, emphasis);

  return (
    <section className="relative isolate overflow-hidden bg-[#070708] text-[#f2eee6]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_70%_40%,#000_20%,transparent_75%)]"
      />
      <div aria-hidden="true" className="absolute right-[-10%] top-[18%] -z-10 h-[520px] w-[720px] max-w-[90vw] rounded-full bg-[radial-gradient(closest-side,rgba(212,255,58,0.10),transparent)] blur-2xl" />
      <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-14 px-5 pb-16 pt-8 sm:gap-y-20 sm:px-8 sm:pb-20 lg:grid-cols-12 lg:items-center lg:gap-y-24 lg:px-12 lg:pb-28 lg:pt-10">
        {/* Top row */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 lg:col-span-12">
          <p className="flex items-center gap-2.5 font-display text-[22px] font-bold tracking-[-0.04em]">
            <RelayMark />
            {brand}
          </p>
          <a
            href={announcement.href}
            className="group inline-flex items-center gap-2 rounded-sm font-mono text-[11px] uppercase tracking-[0.14em] text-[#f2eee6]/60 transition-colors hover:text-[#f2eee6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4ff3a]"
          >
            <span className="size-1.5 rounded-full bg-[#d4ff3a]" aria-hidden="true" />
            {announcement.label}
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
              →
            </span>
          </a>
        </div>

        {/* Copy */}
        <div className="lg:col-span-6">
          <h1 className="max-w-[12ch] text-balance font-display text-[clamp(2.75rem,1.5rem+4.8vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.05em]">
            {pre}
            {emphasis && post !== null ? (
              <>
                <span className="whitespace-nowrap text-[#f2eee6]/45">{emphasis}</span>
                {post}
              </>
            ) : null}
          </h1>

          <p className="mt-7 max-w-[46ch] text-[17px] leading-[1.6] text-[#f2eee6]/65">{body}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href={primary.href}
              className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-[10px] bg-[#f2eee6] px-5 text-[15px] font-semibold text-[#141311] transition-[transform,background-color] duration-300 ease-out hover:-translate-y-0.5 hover:bg-white active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#d4ff3a]"
            >
              {primary.label}
              <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" aria-hidden="true">
                <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <CopyCommand command={installCommand} />
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#f2eee6]/45">
            {facts.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-px w-3 bg-[#f2eee6]/30" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Terminal */}
        <div className="relative min-w-0 lg:col-span-6">
          <div aria-hidden="true" className="absolute -inset-px -z-10 rounded-[15px] bg-gradient-to-b from-white/[0.14] via-white/[0.04] to-transparent" />
          <Terminal session={session} tabTitle={tabTitle} version={version} loopPause={loopPause} />
        </div>
      </div>
    </section>
  );
}

function splitOnce(text: string, needle: string): [string, string | null] {
  if (!needle) return [text, null];
  const i = text.indexOf(needle);
  if (i < 0) return [text, null];
  return [text.slice(0, i), text.slice(i + needle.length)];
}

/* ------------------------------------------------------------------ */
/* Copyable install chip                                               */
/* ------------------------------------------------------------------ */

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard can be blocked (iframes, http). Still confirm: the command is visible to copy by hand.
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex h-12 min-w-0 items-center justify-between gap-4 rounded-[10px] border border-[#f2eee6]/15 bg-[#0c0b0a] pl-4 pr-2 font-mono text-[13.5px] text-[#f2eee6]/85 transition-colors duration-300 hover:border-[#f2eee6]/30 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#d4ff3a]"
      aria-label={`Copy install command: ${command}`}
    >
      <span className="truncate">
        <span className="select-none text-[#f2eee6]/35">$ </span>
        {command}
      </span>
      <span
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 font-sans text-[12px] font-medium transition-colors duration-300 ${
          copied ? "bg-[#d4ff3a] text-[#141311]" : "bg-[#f2eee6]/[0.07] text-[#f2eee6]/70 group-hover:bg-[#f2eee6]/[0.12] group-hover:text-[#f2eee6]"
        }`}
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
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Terminal                                                            */
/* ------------------------------------------------------------------ */

function Terminal({ session, tabTitle, version, loopPause }: { session: AgentSession; tabTitle: string; version: string; loopPause: number }) {
  const reduce = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { amount: 0.25 });
  const { rows, total } = useMemo(() => buildTimeline(session), [session]);
  const [now, setNow] = useState(0);

  // One clock drives the whole session. It pauses off-screen and never runs with reduced motion.
  useEffect(() => {
    if (reduce || !inView) return;
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      const dt = Math.min(t - last, 100);
      last = t;
      setNow((n) => (n + dt > total + loopPause ? 0 : n + dt));
    }, 40);
    return () => clearInterval(id);
  }, [reduce, inView, total, loopPause]);

  const time = reduce ? Number.POSITIVE_INFINITY : now;
  const visible = rows.filter((r) => r.at <= time);
  const finished = time >= total;
  const spin = SPIN[Math.floor(now / 80) % SPIN.length];

  const diff = visible.reduce(
    (acc, r) => (r.kind === "file" ? { files: acc.files + (r.file.added ? 1 : 0), add: acc.add + (r.file.added ?? 0), del: acc.del + (r.file.removed ?? 0) } : acc),
    { files: 0, add: 0, del: 0 },
  );

  // Keep the newest line in view, like a real terminal.
  const count = visible.length;
  const typed = visible.find((r): r is Extract<Row, { kind: "cmd" }> => r.kind === "cmd")?.typedAt.filter((x) => x <= time).length ?? 0;
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, typed]);

  return (
    <motion.div
      ref={frameRef}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease, delay: 0.1 }}
      className="relative overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#0c0b0a] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_50px_100px_-40px_rgba(0,0,0,0.9),0_20px_40px_-20px_rgba(0,0,0,0.6)]"
    >
      {/* Header: a tab, not traffic lights */}
      <div className="flex h-11 items-stretch justify-between border-b border-white/[0.07] pr-3 font-mono text-[12px] text-[#f2eee6]/50">
        <div className="flex min-w-0 items-stretch">
          <div className="flex items-center gap-[3px] border-r border-white/[0.07] px-4" aria-hidden="true">
            <span className="h-3 w-[3px] rounded-full bg-[#f2eee6]/25" />
            <span className="h-3 w-[3px] rounded-full bg-[#f2eee6]/25" />
          </div>
          <div className="relative flex min-w-0 items-center gap-2.5 border-r border-white/[0.07] bg-white/[0.03] px-4 text-[#f2eee6]/85">
            <span className="truncate">{tabTitle}</span>
            <span className="hidden text-[#f2eee6]/35 sm:inline">— relay ship</span>
            <span className="absolute inset-x-0 top-0 h-px bg-[#f2eee6]/40" aria-hidden="true" />
          </div>
          <div className="hidden items-center px-4 text-[#f2eee6]/30 sm:flex" aria-hidden="true">
            +
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 tabular-nums" aria-hidden="true">
          {finished ? (
            <>
              <span className="size-1.5 rounded-full" style={{ background: LIME }} />
              <span className="text-[#f2eee6]/70">done</span>
            </>
          ) : (
            <>
              <span className="size-1.5 animate-pulse rounded-full bg-[#ffb547]" />
              <span>{fmtClock(now)}</span>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        role="log"
        aria-label="Example Relay session"
        aria-live="off"
        className="h-[380px] overflow-y-auto px-4 py-4 font-mono text-[12px] leading-[1.75] text-[#f2eee6]/85 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] sm:h-[440px] sm:px-5 sm:text-[13px] lg:h-[480px]"
      >
        {visible.map((r, i) => (
          <TerminalRow key={i} row={r} time={time} spin={spin} session={session} />
        ))}
      </div>
      <style>{`@keyframes tm-hero-terminal-agent-blink{0%,55%{opacity:1}56%,100%{opacity:0}}`}</style>

      {/* Status bar */}
      <div className="flex h-8 items-center justify-between gap-4 border-t border-white/[0.07] bg-white/[0.02] px-4 font-mono text-[11px] text-[#f2eee6]/45 tabular-nums">
        <span className="flex min-w-0 items-center gap-3 truncate">
          <span className="text-[#f2eee6]/65">⎇ {session.workBranch}</span>
          <span className="hidden sm:inline">{diff.files} files</span>
          <span>
            <span className="text-[#d4ff3a]/80">+{diff.add}</span> <span>−{diff.del}</span>
          </span>
        </span>
        <span className="shrink-0">{version}</span>
      </div>
    </motion.div>
  );
}

function Spinner({ ch }: { ch: string }) {
  return <span className="inline-block w-[1.5ch] text-[#ffb547]">{ch}</span>;
}

function Tick() {
  return (
    <span className="inline-block w-[1.5ch]" style={{ color: LIME }}>
      ✓
    </span>
  );
}

function Cursor({ solid }: { solid?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-px inline-block h-[1.15em] w-[0.6em] translate-y-[0.2em] bg-[#f2eee6]/80 ${solid ? "" : "animate-[tm-hero-terminal-agent-blink_1.1s_steps(1)_infinite] motion-reduce:animate-none"}`}
    />
  );
}

function TerminalRow({ row, time, spin, session }: { row: Row; time: number; spin: string; session: AgentSession }) {
  switch (row.kind) {
    case "cwd":
      return (
        <p className="text-[#f2eee6]/45">
          <span className="text-[#f2eee6]/75">{session.cwd}</span> on <span className="text-[#f2eee6]/75">⎇ {session.branch}</span>
        </p>
      );
    case "cmd": {
      const n = row.typedAt.filter((x) => x <= time).length;
      const typing = n < session.command.length;
      return (
        <p className="whitespace-pre-wrap break-words">
          <span className="text-[#f2eee6]/45">❯ </span>
          <span className="text-[#f2eee6]">{session.command.slice(0, n)}</span>
          {typing ? <Cursor solid /> : null}
        </p>
      );
    }
    case "status": {
      const done = time >= row.doneAt;
      return (
        <p className="mt-3 flex gap-2">
          {done ? <span className="inline-block w-[1.5ch] text-[#f2eee6]/45">◇</span> : <Spinner ch={spin} />}
          <span className="min-w-0 flex-1">
            {done ? (
              <>
                Read <span className="text-[#f2eee6]/50">{row.done}</span>
              </>
            ) : (
              <span className="text-[#f2eee6]/70">{row.label}…</span>
            )}
          </span>
        </p>
      );
    }
    case "heading":
      return (
        <p className={`flex gap-2 ${row.gap ? "mt-3" : ""}`}>
          <span className="inline-block w-[1.5ch] text-[#f2eee6]/45">◇</span>
          <span className="text-[#f2eee6]">{row.label}</span>
        </p>
      );
    case "plan":
      return (
        <p className="flex gap-2 pl-[calc(1.5ch+0.5rem)] text-[#f2eee6]/70">
          <span className="w-[2ch] shrink-0 text-[#f2eee6]/35 tabular-nums">{row.n}</span>
          <span className="min-w-0">{row.text}</span>
        </p>
      );
    case "file": {
      const f = row.file;
      const isDir = f.name.endsWith("/");
      return (
        <p className="flex items-baseline gap-3 pl-[calc(1.5ch+0.5rem)]">
          <span className="min-w-0 flex-1 break-words">
            <span className="text-[#f2eee6]/25">{"│  ".repeat(Math.max(0, f.depth - 1))}</span>
            {f.depth > 0 ? <span className="text-[#f2eee6]/25">{f.last ? "└─ " : "├─ "}</span> : null}
            <span className={isDir ? "text-[#f2eee6]/55" : "text-[#f2eee6]/90"}>{f.name}</span>
          </span>
          {f.added || f.removed ? (
            <span className="shrink-0 tabular-nums text-[#f2eee6]/40">
              {f.added ? <span className="text-[#d4ff3a]/75">+{f.added}</span> : null}
              {f.removed ? <span className="ml-2">−{f.removed}</span> : null}
            </span>
          ) : null}
        </p>
      );
    }
    case "test": {
      const done = time >= row.doneAt;
      return (
        <p className="flex items-baseline gap-2 pl-[calc(1.5ch+0.5rem)]">
          {done ? <Tick /> : <Spinner ch={spin} />}
          <span className={`min-w-0 flex-1 ${done ? "text-[#f2eee6]/80" : "text-[#f2eee6]/55"}`}>{row.test.name}</span>
          <span className="shrink-0 tabular-nums text-[#f2eee6]/35">{done ? row.test.time : ""}</span>
        </p>
      );
    }
    case "summary":
      return (
        <p className="flex gap-2 pl-[calc(1.5ch+0.5rem)] pt-1">
          <span className="inline-block w-[1.5ch]" aria-hidden="true" />
          <span className="font-medium" style={{ color: LIME }}>
            {row.text}
          </span>
        </p>
      );
    case "pr":
      return (
        <p className="mt-3 flex gap-2">
          <span className="inline-block w-[1.5ch]" style={{ color: LIME }}>
            ◆
          </span>
          <span className="min-w-0 flex-1">
            Opened{" "}
            <a
              href={session.pr.href}
              className="rounded-sm text-[#f2eee6] underline decoration-[#d4ff3a]/60 underline-offset-[3px] transition-colors hover:decoration-[#d4ff3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4ff3a]"
            >
              pull request #{session.pr.number}
            </a>
          </span>
        </p>
      );
    case "prTitle":
      return <p className="pl-[calc(1.5ch+0.5rem)] text-[#f2eee6]/70">“{session.pr.title}”</p>;
    case "note":
      return <p className="pl-[calc(1.5ch+0.5rem)] text-[#f2eee6]/40">{session.pr.note}</p>;
    case "idle":
      return (
        <p className="mt-3">
          <span className="text-[#f2eee6]/45">❯ </span>
          <Cursor />
        </p>
      );
  }
}

function RelayMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="3" fill="#f2eee6" />
      <rect x="10" y="10" width="12" height="12" rx="3" fill="none" stroke="#d4ff3a" strokeWidth="2" />
    </svg>
  );
}

export default HeroTerminalAgent;
