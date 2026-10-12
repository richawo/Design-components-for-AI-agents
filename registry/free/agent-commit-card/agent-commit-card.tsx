"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CommitStatus = "ready" | "opened";
export type CheckState = "queued" | "running" | "passed";

export type CommitFile = { path: string; add: number; del: number };
export type CommitCheck = { id: string; label: string };

export type AgentCommitCardProps = {
  /** Who made the commit. */
  agent?: string;
  /** The subject line. */
  message?: string;
  /** One sentence under the subject. */
  detail?: string;
  /** Short hash, shown in mono. */
  hash?: string;
  /** Branch the commit is on. */
  branch?: string;
  files?: CommitFile[];
  checks?: CommitCheck[];
  /** Number used once Open PR has landed. */
  prNumber?: number;
  /** Ready rolls the checks. Opened shows them passed and the pull request number. */
  status?: CommitStatus;
  onStatusChange?: (status: CommitStatus) => void;
  /** Called with the pull request number when Open PR is used. */
  onOpen?: (prNumber: number) => void;
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#f4f4f5";
const EASE = [0.22, 1, 0.36, 1] as const;
/** One check runs, then the next. Three checks finish just after 1.5s. */
const CHECK_GAP = 320;

const PALETTE = {
  dark: {
    surface: "#0d0d0f",
    ink: "#ededef",
    body: "#c6c6cc",
    muted: "#98989a",
    faint: "#88888a",
    line: "rgba(255,255,255,0.08)",
    hover: "rgba(255,255,255,0.045)",
    ok: "#5fc284",
    shadow:
      "inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    ink: "#17171a",
    body: "#3f3f46",
    muted: "#5d5d5f",
    faint: "#68686a",
    line: "rgba(17,17,19,0.09)",
    hover: "rgba(17,17,19,0.045)",
    ok: "#1d7a40",
    shadow:
      "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 40px 80px -40px rgba(17,17,19,0.25)",
  },
} as const;

type ThemeName = keyof typeof PALETTE;

const T = { head: 0.04, files: 0.12, checks: 0.2, foot: 0.28 } as const;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cmt-ink)";
const PRESS = "active:scale-[0.98] active:duration-[90ms] motion-reduce:active:scale-100";

const rise: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const FILES: CommitFile[] = [
  { path: "app/pricing/faq.tsx", add: 12, del: 3 },
  { path: "lib/billing/seats.ts", add: 4, del: 0 },
  { path: "components/credit.tsx", add: 9, del: 2 },
];

const CHECKS: CommitCheck[] = [
  { id: "typecheck", label: "Typecheck" },
  { id: "registry", label: "Registry" },
  { id: "preview", label: "Preview" },
];

const WORD: Record<CheckState, string> = { queued: "Queued", running: "Running", passed: "Passed" };

function inkOn(hex: string): string {
  const match = /^#([\da-f]{6})$/i.exec(hex.trim());
  if (!match || isInk(hex)) return "";
  const n = parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return l > 0.62 ? "#1a1408" : "#f6f4ef";
}

function isInk(hex: string): boolean {
  const h = hex.trim().toLowerCase();
  return h === "#f4f4f5" || h === "#ededef" || h === "#17171a" || h === "#111113";
}

function paletteVars(theme: ThemeName, accent: string): CSSProperties {
  const p = PALETTE[theme];
  const accentValue = isInk(accent) ? p.ink : accent;
  const onAccent = isInk(accent) ? (theme === "dark" ? "#141416" : "#f4f4f5") : inkOn(accent);
  return {
    "--cmt-surface": p.surface,
    "--cmt-ink": p.ink,
    "--cmt-body": p.body,
    "--cmt-muted": p.muted,
    "--cmt-faint": p.faint,
    "--cmt-line": p.line,
    "--cmt-hover": p.hover,
    "--cmt-ok": p.ok,
    "--cmt-shadow": p.shadow,
    "--cmt-accent": accentValue,
    "--cmt-on-accent": onAccent,
  } as CSSProperties;
}

function stateAt(index: number, step: number): CheckState {
  const runningAt = index * 2 + 1;
  if (step < runningAt) return "queued";
  if (step === runningAt) return "running";
  return "passed";
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function Micro({ children }: { children: string }) {
  return <p className="font-mono text-[10.5px] font-normal uppercase tracking-[0.16em] text-(--cmt-faint)">{children}</p>;
}

function Mark({ state, reduce }: { state: CheckState; reduce: boolean }) {
  if (state === "passed") {
    return (
      <span aria-hidden="true" className="grid size-3.5 place-items-center rounded-full bg-(--cmt-ok) text-[#06210f]">
        <svg viewBox="0 0 16 16" className="size-2.5" fill="none">
          <path d="M3.5 8.2 6.4 11 12.5 4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "running") {
    return (
      <span
        aria-hidden="true"
        className={`size-3.5 rounded-full border-2 border-(--cmt-line) border-t-(--cmt-ok) ${reduce ? "" : "animate-spin motion-reduce:animate-none"}`}
      />
    );
  }
  return <span aria-hidden="true" className="size-3.5 rounded-full ring-1 ring-(--cmt-line) ring-inset" />;
}

/**
 * Rolls every check from queued to running to passed. `run` restarts it.
 * Reduced motion, and an already-opened card, show them passed.
 */
function useChecks(count: number, run: number, skip: boolean) {
  const done = count * 2;
  const [step, setStep] = useState(skip ? done : 0);
  useEffect(() => {
    if (skip) {
      setStep(done);
      return;
    }
    setStep(0);
    const timers: number[] = [];
    for (let i = 1; i <= done; i++) timers.push(window.setTimeout(() => setStep(i), i * CHECK_GAP));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [run, skip, done]);
  return step;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function AgentCommitCard({
  agent = "Ada",
  message = "Name when the seat credit lands",
  detail = "The pricing answer said the credit existed, not when.",
  hash = "c4e19a2",
  branch = "pricing-faq",
  files = FILES,
  checks = CHECKS,
  prNumber = 482,
  status,
  onStatusChange,
  onOpen,
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className,
}: AgentCommitCardProps) {
  const reduce = useReducedMotion() ?? false;
  const v = (variants: Variants) => (reduce ? fade : variants);

  const [owned, setOwned] = useState<CommitStatus>("ready");
  const [run, setRun] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const opened = (status ?? owned) === "opened";
  const step = useChecks(checks.length, run, reduce || opened);
  const allPassed = opened || reduce || step >= checks.length * 2;

  const commit = (next: CommitStatus) => {
    if (status === undefined) setOwned(next);
    onStatusChange?.(next);
  };

  const rerun = () => {
    commit("ready");
    setRun((n) => n + 1);
    setAnnouncement("Checks queued again.");
  };

  const open = () => {
    if (!allPassed || opened) return;
    commit("opened");
    setAnnouncement(`Opened pull request ${prNumber}.`);
    onOpen?.(prNumber);
  };

  return (
    <section aria-label={`Commit by ${agent}`} style={paletteVars(theme, accent)} className={`@container w-full font-sans text-(--cmt-ink) antialiased ${className ?? ""}`}>
      <div className="overflow-hidden rounded-[20px] bg-(--cmt-surface) shadow-(--cmt-shadow)">
        <motion.div initial="hidden" animate="show" variants={v(rise)} custom={T.head} className="px-4 pt-4 pb-4 @md:px-5 @md:pt-5">
          <div className="flex items-center justify-between gap-3">
            <Micro>{agent}</Micro>
            <p className="font-mono text-[12px] tabular-nums text-(--cmt-muted)">{hash}</p>
          </div>
          <h2 className="mt-2 text-[17px] leading-snug font-medium tracking-[-0.02em] text-balance">{message}</h2>
          <p className="mt-1.5 max-w-[46ch] text-[13.5px] leading-[1.45] text-(--cmt-body)">{detail}</p>
          <p className="mt-2 font-mono text-[11.5px] text-(--cmt-muted)">{branch}</p>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={v(rise)} custom={T.files} className="border-t border-(--cmt-line) px-4 py-3.5 @md:px-5">
          <Micro>Files</Micro>
          <ul className="mt-2.5 grid gap-1.5">
            {files.map((file) => (
              <li key={file.path} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-mono text-[12.5px]">{file.path}</span>
                <span className="shrink-0 font-mono text-[12px] tabular-nums">
                  <span className="text-(--cmt-ok)">+{file.add}</span>
                  <span className="text-(--cmt-muted)"> −{file.del}</span>
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={v(rise)} custom={T.checks} className="border-t border-(--cmt-line) px-4 py-3.5 @md:px-5">
          <div className="flex items-center justify-between gap-3">
            <Micro>Checks</Micro>
            <button
              type="button"
              data-demo="rerun"
              onClick={rerun}
              className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 font-mono text-[11px] tracking-[0.04em] text-(--cmt-muted) transition-colors duration-150 hover:text-(--cmt-ink) ${FOCUS}`}
            >
              Re-run
            </button>
          </div>
          <ul className="mt-2.5 grid gap-2" aria-label="Checks">
            {checks.map((check, index) => {
              const state = opened || reduce ? "passed" : stateAt(index, step);
              return (
                <li key={check.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Mark state={state} reduce={reduce} />
                    <span className="truncate text-[14px]">{check.label}</span>
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={state}
                      initial={reduce ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: reduce ? 0.12 : 0.2, ease: EASE }}
                      className={`font-mono text-[11px] tracking-[0.04em] ${state === "passed" ? "text-(--cmt-ok)" : state === "running" ? "text-(--cmt-ink)" : "text-(--cmt-muted)"}`}
                    >
                      {WORD[state]}
                    </motion.span>
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={v(rise)} custom={T.foot} className="border-t border-(--cmt-line) px-4 py-3.5 @md:px-5">
          <button
            type="button"
            data-demo="open"
            onClick={open}
            disabled={!opened && !allPassed}
            className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 inline-flex h-10 w-full touch-manipulation items-center justify-center rounded-[11px] bg-(--cmt-accent) text-[14px] font-medium tracking-[-0.01em] text-(--cmt-on-accent) shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-[filter] duration-150 hover:brightness-110 pointer-coarse:h-11 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${PRESS} ${FOCUS}`}
          >
            {opened ? `PR #${prNumber}` : "Open PR"}
          </button>
        </motion.div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** The commit on a quiet stage. Status is held here so Open PR and the Customize actions agree. */
export default function AgentCommitCardDemo({ status: forced, theme = "dark", ...overrides }: Partial<AgentCommitCardProps> = {}) {
  const [status, setStatus] = useState<CommitStatus>(forced ?? "ready");
  useEffect(() => {
    if (forced) setStatus(forced);
  }, [forced]);

  return (
    <div className={`flex min-h-dvh w-full items-start justify-center px-3 pt-8 pb-14 sm:px-8 sm:pt-16 sm:pb-20 ${theme === "light" ? "bg-[#f4f4f5]" : "bg-black"}`}>
      <div className="w-full max-w-[480px]">
        <AgentCommitCard {...overrides} theme={theme} status={status} onStatusChange={setStatus} />
      </div>
    </div>
  );
}
