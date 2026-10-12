"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AgentToolCallStatus = "pending" | "running" | "done" | "failed";
export type AgentToolCallArgs = Record<string, string | number | boolean>;

export type AgentToolCallProps = {
  /** Position in the log, shown as a two-digit index. */
  seq?: number;
  /** Tool name, set in mono. Known names get realistic sample arguments, output and errors. */
  tool?: string;
  /** Flat arguments. Defaults to the sample for `tool`. */
  args?: AgentToolCallArgs;
  /** Controlled status. Omit it and Retry drives the status itself. */
  status?: AgentToolCallStatus;
  /** Starting status when uncontrolled. */
  defaultStatus?: AgentToolCallStatus;
  /** Recorded duration once the call has finished. While it runs, the line counts live. */
  durationMs?: number;
  /** Output of the call. Six lines show at first, the rest one click away. */
  result?: string;
  /** Standard error. A failed call shows its last four lines and a Retry. */
  stderr?: string;
  /** Whether the arguments and result panel starts open. Read on mount. */
  defaultExpanded?: boolean;
  showTiming?: boolean;
  density?: "compact" | "comfortable";
  theme?: "dark" | "light";
  /** The one accent: the arc while running, and the tint behind arguments. */
  accent?: string;
  /**
   * Runs on Retry. Return a promise: it resolves to done and rejects to failed. Without it, an
   * uncontrolled call reruns for 1.1 s; a controlled call (`status` set) hides Retry, because only
   * the host can move its status.
   */
  onRetry?: () => void | Promise<unknown>;
  /** Label on the retry button. */
  retryLabel?: string;
  /** Label on the retry button while the retry runs. */
  retryingLabel?: string;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#ff9d5c";
const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

/** Glyph geometry: a 6.25 px ring inside a 16 px box, drawn solid or dotted. */
const RING_R = 6.25;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
const RING_SOLID = `${RING_CIRCUMFERENCE.toFixed(2)} 0`;
const RING_QUEUED = "2 2.9";

/** A call still running after this long says so and stops its arc turning, so nothing spins forever. */
const STALL_MS = 20_000;
const COLLAPSED_LINES = 6;
const ERROR_TAIL_LINES = 4;
/** After a retry lands, the error waits this long so the drawn check registers before the line closes up. */
const SETTLE_HOLD_MS = 480;

const PALETTE = {
  dark: {
    stage: "#000000",
    surface: "#0d0d0f",
    ink: "#ededef",
    // Secondary text is solid, not an alpha of ink, so it holds AA on every tint it sits on:
    // muted (summary, duration, JSON keys) 6.7:1 on the surface, faint (labels, header) 5.5:1.
    muted: "#98989a",
    faint: "#88888a",
    line: "rgba(255,255,255,0.08)",
    ok: "#5fc284",
    err: "#f07c80",
    queued: "rgba(237,237,239,0.42)",
    ring: "rgba(237,237,239,0.16)",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)",
  },
  light: {
    stage: "#f4f4f5",
    surface: "#ffffff",
    ink: "#17171a",
    // Muted 6.6:1 and faint 5.6:1 on white, both still above 4.5:1 on the hover and tint fills.
    muted: "#5d5d5f",
    faint: "#68686a",
    line: "rgba(17,17,19,0.09)",
    ok: "#23884a",
    err: "#c2353b",
    queued: "rgba(23,23,26,0.42)",
    ring: "rgba(23,23,26,0.16)",
    shadow: "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 40px 80px -40px rgba(17,17,19,0.25)",
  },
} as const;

type Theme = keyof typeof PALETTE;

/** Every colour the component reads, as CSS variables, so Tailwind classes and inline styles agree. */
function paletteVars(theme: Theme, accent: string): CSSProperties {
  const p = PALETTE[theme];
  return {
    "--ac-stage": p.stage,
    "--ac-surface": p.surface,
    "--ac-ink": p.ink,
    "--ac-muted": p.muted,
    "--ac-faint": p.faint,
    "--ac-line": p.line,
    "--ac-ok": p.ok,
    "--ac-err": p.err,
    "--ac-queued": p.queued,
    "--ac-ring": p.ring,
    "--ac-accent": accent,
    // The accent is a mid tone on white, so the light theme darkens it for text and the arc.
    "--ac-accent-ink": theme === "light" ? `color-mix(in oklab, ${accent} 70%, #000)` : accent,
  } as CSSProperties;
}

const RING_TONE: Record<GlyphState, string> = {
  pending: "var(--ac-queued)",
  running: "var(--ac-ring)",
  stalled: "var(--ac-ring)",
  done: "var(--ac-ok)",
  failed: "var(--ac-err)",
};

const STATUS_LABEL: Record<AgentToolCallStatus, string> = {
  pending: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

/* ------------------------------------------------------------------ */
/* Sample calls                                                        */
/* ------------------------------------------------------------------ */

type Sample = { args: AgentToolCallArgs; result?: string; stderr: string };

const SAMPLE_FILE = [
  'import { roundCents } from "./money";',
  'import type { Invoice, LineItem, Seat } from "./types";',
  "",
  "export const TAX_RATE = 0.2;",
  "",
  "/** Prorates a seat change to the days left in the billing period. */",
  "export function prorate(seat: Seat, change: number, daysLeft: number, periodDays: number) {",
  "  const daily = seat.unitPrice / periodDays;",
  "  return roundCents(daily * daysLeft * change);",
  "}",
  "",
  "export function lineTotal(item: LineItem): number {",
  "  return roundCents(item.quantity * item.unitPrice);",
  "}",
  "",
  "export function taxFor(subtotal: number, region: string): number {",
  "  // EU reverse charge: the buyer accounts for VAT, so nothing is charged here.",
  '  if (region === "EU-REVERSE") return 0;',
  "  return roundCents(subtotal * TAX_RATE);",
  "}",
  "",
  "export function buildInvoice(lines: LineItem[], region: string, issuedAt: Date): Invoice {",
  "  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);",
  "  const tax = taxFor(subtotal, region);",
  "  return {",
  "    issuedAt,",
  "    lines,",
  "    subtotal: roundCents(subtotal),",
  "    tax,",
  "    total: roundCents(subtotal + tax),",
  '    currency: "USD",',
  "  };",
  "}",
  "",
  "export function creditFor(invoice: Invoice, unusedDays: number, periodDays: number): number {",
  "  const share = unusedDays / periodDays;",
  "  return roundCents(invoice.total * share);",
  "}",
  "",
  "export function assertBalanced(invoice: Invoice): void {",
  "  const sum = invoice.lines.reduce((acc, line) => acc + lineTotal(line), 0);",
  "  if (roundCents(sum) !== invoice.subtotal) {",
  '    throw new Error("subtotal does not match its lines");',
  "  }",
  "}",
];

const SAMPLES: Record<string, Sample | undefined> = {
  read_file: {
    args: { path: "src/billing/invoices.ts", encoding: "utf8" },
    result: SAMPLE_FILE.join("\n"),
    stderr: "ENOENT: no such file or directory, open 'src/billing/invoices.ts'\n    at Object.openSync (node:fs:601:3)\n    at readTool (tools/read_file.ts:19:22)",
  },
  "web.search": {
    args: { query: "stripe proration for mid-cycle seat changes", limit: 5 },
    result: [
      "1  billing.example.dev/docs/prorations",
      "   How proration items appear on the next invoice",
      "2  billing.example.dev/docs/upgrade-downgrade",
      "   Changing plans and seat counts mid-period",
      "3  billing.example.dev/blog/proration-explained",
      "   Why a downgrade can leave a credit balance",
      "4  support.example.dev/articles/seat-credits",
      "   Where unused seat credit goes after cancellation",
      "5  community.example.dev/t/rounding-per-line",
      "   Rounding tax per line or per invoice",
    ].join("\n"),
    stderr: "429 Too Many Requests: search quota reached for this minute\nRetry-After: 42",
  },
  bash: {
    args: { cmd: "pnpm test billing", cwd: "apps/web" },
    result: ["> web@0.4.2 test", "> vitest run billing", "", " RUN  v2.1.4 apps/web", "  ok  src/billing/proration.test.ts (6)", "  ok  src/billing/tax.test.ts (9)"].join("\n"),
    stderr: [
      "stdout | src/billing/invoices.test.ts",
      "rounds tax once per invoice",
      "FAIL  src/billing/invoices.test.ts > rounds tax once per invoice",
      "AssertionError: expected 1934 to be 1933 // Object.is equality",
      " ❯ src/billing/invoices.test.ts:88:24",
      "Tests  1 failed | 23 passed (24)",
    ].join("\n"),
  },
  "sql.query": {
    args: { query: "select plan, count(*) as seats from workspace_seats group by plan" },
    result: [
      "plan        seats",
      "----------  -----",
      "free        1204",
      "pro         3871",
      "team        412",
      "enterprise  19",
      "trial       96",
      "legacy      37",
      "(6 rows)",
    ].join("\n"),
    stderr: [
      'ERROR:  column "plan" does not exist',
      "LINE 1: select plan, count(*) as seats from workspace_seats group by plan",
      "               ^",
      'HINT:  Perhaps you meant to reference the column "workspace_seats.plan_id".',
    ].join("\n"),
  },
};

const FALLBACK_SAMPLE: Sample = { args: {}, stderr: "Process exited with status 1." };

function sampleFor(tool: string): Sample {
  return SAMPLES[tool] ?? FALLBACK_SAMPLE;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function summarise(args: AgentToolCallArgs): string {
  return Object.entries(args)
    .map(([key, value]) => `${key}=${typeof value === "string" ? `"${value}"` : String(value)}`)
    .join("  ");
}

function toLines(text: string | undefined): string[] {
  return text ? text.split("\n") : [];
}

/** Milliseconds since the call started running, updated every frame while it does. */
function useElapsed(running: boolean): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      setMs(performance.now() - start);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [running]);
  return ms;
}

/* JSON tokens: keys, strings, then numbers and literals. Keys carry their colon. */
const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g;

function highlightJson(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(JSON_TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push(line.slice(last, at));
    const [text, quoted, colon, number, literal] = match;
    if (quoted !== undefined) {
      nodes.push(
        colon ? (
          <Fragment key={at}>
            <span className="text-(--ac-muted)">{quoted}</span>
            {colon}
          </Fragment>
        ) : (
          <span key={at} className="text-(--ac-accent-ink)">
            {quoted}
          </span>
        ),
      );
    } else {
      nodes.push(
        <span key={at} className="text-(--ac-ink)/80">
          {number ?? literal ?? text}
        </span>,
      );
    }
    last = at + text.length;
  }
  if (last < line.length) nodes.push(line.slice(last));
  return nodes;
}

/* ------------------------------------------------------------------ */
/* Status glyph                                                        */
/* ------------------------------------------------------------------ */

type GlyphState = AgentToolCallStatus | "stalled";

/**
 * One 16 px glyph that morphs between states: a dotted ring while queued, a
 * spinning arc while running, a drawn check or cross once the call settles.
 * Every change is a shared shape moving, so nothing cuts.
 */
function glyphVariants(reduce: boolean): Record<"ring" | "arc" | "check" | "cross", Variants> {
  const dur = (seconds: number) => (reduce ? 0 : seconds);
  const dash = { duration: dur(0.3), ease: EASE };
  const solid = { strokeDasharray: RING_SOLID, transition: dash };
  const queued = { strokeDasharray: RING_QUEUED, transition: dash };
  const drawn = (delay: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: dur(0.36), ease: EASE, delay: reduce ? 0 : delay },
      opacity: { duration: dur(0.1) },
    },
  });
  const hidden = { pathLength: 0, opacity: 0, transition: { duration: dur(0.12) } };

  return {
    ring: { pending: queued, running: solid, stalled: solid, done: solid, failed: solid },
    arc: {
      pending: { opacity: 0, rotate: 0, transition: { duration: dur(0.15) } },
      running: {
        opacity: 1,
        rotate: 360,
        transition: {
          opacity: { duration: dur(0.15) },
          rotate: reduce ? { duration: 0 } : { duration: 1.1, ease: "linear", repeat: Infinity },
        },
      },
      stalled: { opacity: 0.55, rotate: 0, transition: { duration: dur(0.4), ease: EASE } },
      done: { opacity: 0, transition: { duration: dur(0.15) } },
      failed: { opacity: 0, transition: { duration: dur(0.15) } },
    },
    check: { pending: hidden, running: hidden, stalled: hidden, done: drawn(0.08), failed: hidden },
    cross: { pending: hidden, running: hidden, stalled: hidden, done: hidden, failed: drawn(0.08) },
  };
}

function StatusGlyph({ state, variants }: { state: GlyphState; variants: ReturnType<typeof glyphVariants> }) {
  return (
    // The ring takes its tone from a plain wrapper's colour, so the change is a CSS transition the
    // browser owns rather than a style value motion might hold on to across interrupted states.
    <span className="inline-flex shrink-0 transition-colors duration-200 ease-out" style={{ color: RING_TONE[state] }}>
      <motion.svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
        className="size-4 overflow-visible"
        initial={false}
        animate={state}
      >
        <motion.circle
          cx={8}
          cy={8}
          r={RING_R}
          fill="none"
          strokeWidth={1.5}
          stroke="currentColor"
          variants={variants.ring}
        />
        <motion.path
          d="M8 1.75A6.25 6.25 0 0 1 14.25 8"
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          variants={variants.arc}
          style={{ stroke: "var(--ac-accent-ink)", transformOrigin: "8px 8px" }}
        />
        <motion.path
          d="M5.1 8.3l2 2 3.8-4.1"
          fill="none"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={variants.check}
          style={{ stroke: "var(--ac-ok)" }}
        />
        <motion.path
          d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"
          fill="none"
          strokeWidth={1.7}
          strokeLinecap="round"
          variants={variants.cross}
          style={{ stroke: "var(--ac-err)" }}
        />
      </motion.svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const MICRO_TYPE = "font-mono text-[10.5px] uppercase tracking-[0.18em]";
const MICRO = `${MICRO_TYPE} text-(--ac-faint)`;
const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ac-ink)";
/** A horizontally scrolling block fades its right edge until the reader reaches the end, so cut text reads as more, not as a clip. */
const FADE_RIGHT: CSSProperties = {
  maskImage: "linear-gradient(to right, #000 calc(100% - 24px), transparent)",
  WebkitMaskImage: "linear-gradient(to right, #000 calc(100% - 24px), transparent)",
};

type ScrollAreaProps = {
  /** Accessible name once the block scrolls and so takes keyboard focus. */
  label: string;
  as?: "div" | "pre";
  className?: string;
  /** Anything that changes the content's size, so the overflow is measured again. */
  watch?: unknown;
  children: ReactNode;
};

/**
 * A block that scrolls its own overflow. It measures itself: only when something is hidden does it
 * become a focusable, labelled region (so a keyboard can reach the rest) and fade its right edge.
 */
function ScrollArea({ label, as: Tag = "div", className = "", watch, children }: ScrollAreaProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [edge, setEdge] = useState({ x: false, y: false, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const x = el.scrollWidth > el.clientWidth + 1;
      const y = el.scrollHeight > el.clientHeight + 1;
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      setEdge((prev) => (prev.x === x && prev.y === y && prev.end === end ? prev : { x, y, end }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [watch]);

  const scrolls = edge.x || edge.y;
  return (
    <Tag
      ref={ref as never}
      role={scrolls ? "region" : undefined}
      aria-label={scrolls ? label : undefined}
      tabIndex={scrolls ? 0 : undefined}
      className={`${className} ${scrolls ? FOCUS : ""}`}
      style={edge.x && !edge.end ? FADE_RIGHT : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * One tool invocation as a line in a flight recorder. The status glyph morphs
 * through queued, running, done and failed; the duration counts live while the
 * call runs; expanding shows the arguments and the result.
 */
export function AgentToolCall({
  seq = 1,
  tool = "read_file",
  args: argsProp,
  status: statusProp,
  defaultStatus = "done",
  durationMs,
  result: resultProp,
  stderr: stderrProp,
  defaultExpanded = false,
  showTiming = true,
  density = "comfortable",
  theme = "dark",
  accent = DEFAULT_ACCENT,
  onRetry,
  retryLabel = "Retry",
  retryingLabel = "Retrying",
  className = "",
}: AgentToolCallProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const panelId = `${uid}-details`;

  const sample = sampleFor(tool);
  const args = argsProp ?? sample.args;
  const argLines = useMemo(() => JSON.stringify(args, null, 2).split("\n"), [args]);
  const resultLines = toLines(resultProp ?? sample.result);
  const errorLines = toLines(stderrProp ?? sample.stderr);
  const errorTail = errorLines.slice(-ERROR_TAIL_LINES);

  const [internal, setInternal] = useState<AgentToolCallStatus>(defaultStatus);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  const [retried, setRetried] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [settling, setSettling] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const settleTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const status = statusProp ?? internal;
  const elapsed = useElapsed(status === "running");
  const stalled = status === "running" && elapsed >= STALL_MS;
  const glyphState: GlyphState = stalled ? "stalled" : status;
  const variants = useMemo(() => glyphVariants(reduce), [reduce]);

  // A retried call times itself, so its recorded duration from the failure no longer applies.
  const liveTiming = status === "running" || retried;
  const shownMs = liveTiming ? elapsed : durationMs ?? (elapsed > 0 ? elapsed : undefined);
  const timing =
    status === "pending" ? "queued" : stalled ? "still running" : shownMs === undefined ? "" : formatDuration(shownMs);

  // The error stays on screen, dimmed, while its retry runs and for a beat after it lands: the line keeps
  // its height and the reader sees the check draw in place before anything moves.
  const failureVisible = status === "failed" || (retrying && status === "running") || (settling && status === "done");
  const busy = retrying || settling;
  // A controlled call without onRetry cannot change its own status, so a Retry there would do nothing.
  const canRetry = onRetry !== undefined;

  // Transitions are announced once, politely, as they happen; the state a line mounts in is history, not news.
  const sentence =
    glyphState === "pending"
      ? `${tool} queued`
      : glyphState === "running"
        ? `${tool} running`
        : glyphState === "stalled"
          ? `${tool} still running`
          : glyphState === "failed"
            ? `${tool} failed`
            : `${tool} done${shownMs === undefined ? "" : ` in ${formatDuration(shownMs)}`}`;
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;
  const announcedState = useRef(glyphState);
  useEffect(() => {
    if (announcedState.current === glyphState) return;
    announcedState.current = glyphState;
    setAnnouncement(sentenceRef.current);
  }, [glyphState]);

  const hiddenLines = Math.max(0, resultLines.length - COLLAPSED_LINES);
  const visibleLines = showAll ? resultLines : resultLines.slice(0, COLLAPSED_LINES);

  const retry = useCallback(async () => {
    if (!onRetry) return;
    // A controlled status belongs to the host, which moves it through its own onRetry.
    const ownStatus = statusProp === undefined;
    setRetrying(true);
    if (ownStatus) {
      setRetried(true);
      setInternal("running");
    }
    try {
      await onRetry();
      if (ownStatus) setInternal("done");
      setSettling(true);
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setSettling(false), reduce ? 0 : SETTLE_HOLD_MS);
    } catch {
      if (ownStatus) setInternal("failed");
    } finally {
      setRetrying(false);
    }
  }, [onRetry, statusProp, reduce]);

  const disclose = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1, transition: { duration: 0.32, ease: EASE } },
        exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: EASE_IN } },
      };

  // Compact rows stay tight under a mouse and grow to a 44px target under a finger.
  const rowPad = density === "compact" ? "py-2 pointer-coarse:min-h-11" : "py-3.5";
  const toolText = density === "compact" ? "text-[12px]" : "text-[13px]";
  const jsonTint: CSSProperties = {
    background: "color-mix(in oklab, var(--ac-accent) 7%, transparent)",
    boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--ac-accent) 16%, transparent)",
  };
  const errorTint: CSSProperties = {
    background: "color-mix(in oklab, var(--ac-err) 7%, transparent)",
    boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--ac-err) 22%, transparent)",
  };

  return (
    <div
      className={`@container w-full border-b border-(--ac-line) text-(--ac-ink) ${className}`}
      style={paletteVars(theme, accent)}
      data-status={status}
    >
      <button
        type="button"
        data-demo="call-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
        className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 group flex w-full min-w-0 items-center gap-3 rounded-[10px] px-3 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-(--ac-ink)/[0.035] active:scale-[0.995] active:bg-(--ac-ink)/[0.05] ${rowPad} ${FOCUS}`}
      >
        <span aria-hidden="true" className="hidden w-5 shrink-0 font-mono text-[11px] tabular-nums text-(--ac-ink)/65 @sm:block">
          {String(seq).padStart(2, "0")}
        </span>
        <StatusGlyph state={glyphState} variants={variants} />
        <span className={`shrink-0 font-mono font-medium text-(--ac-ink) ${toolText}`}>{tool}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-(--ac-muted)">{summarise(args)}</span>
        {showTiming && (
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-(--ac-muted)">{timing}</span>
        )}
        <motion.svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-3.5 shrink-0 text-(--ac-faint)"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
        >
          <path d="M4 6.25 8 10l4-3.75" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
        <span className="sr-only">{stalled ? "Still running" : STATUS_LABEL[status]}</span>
      </button>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      <AnimatePresence initial={false}>
        {failureVisible && (
          <motion.div
            key="failure"
            initial={disclose.initial}
            animate={disclose.animate}
            exit={disclose.exit}
            className="overflow-hidden"
          >
            <div role="group" aria-label={`${tool} error output`} className="mb-3 ml-10 mr-3 @sm:ml-[4.5rem] rounded-[10px] px-3.5 py-3" style={errorTint}>
              <div className="flex items-center gap-3">
                <span className={`${MICRO_TYPE} text-(--ac-err)`}>stderr</span>
                {/* The count is context, not content: it gives way in a narrow column instead of truncating. */}
                <span className={`${MICRO} min-w-0 flex-1 truncate tabular-nums`}>
                  <span className="hidden @md:inline">
                    last {errorTail.length} of {errorLines.length} lines
                  </span>
                </span>
                {canRetry && (
                <button
                  type="button"
                  data-demo="call-retry"
                  onClick={retry}
                  disabled={busy}
                  aria-busy={retrying}
                  className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border border-(--ac-ink)/15 bg-(--ac-ink)/[0.04] px-2.5 font-mono text-[12px] text-(--ac-ink) transition-[background-color,transform,opacity] duration-150 ease-out before:absolute before:-inset-2 before:content-[''] enabled:hover:bg-(--ac-ink)/[0.09] enabled:active:scale-[0.97] disabled:cursor-progress disabled:opacity-60 ${FOCUS}`}
                >
                  <motion.svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className="size-3.5"
                    fill="none"
                    animate={{ rotate: retrying && !reduce ? 360 : 0 }}
                    transition={retrying && !reduce ? { duration: 0.9, ease: "linear", repeat: Infinity } : { duration: 0 }}
                  >
                    <path
                      d="M13.25 8a5.25 5.25 0 1 1-1.54-3.71M13.25 2.75v2.9h-2.9"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </motion.svg>
                  {/* Both labels share one grid cell, so the button keeps its width while the retry runs. */}
                  <span className="grid">
                    <span className={`col-start-1 row-start-1 text-center ${retrying ? "invisible" : ""}`}>{retryLabel}</span>
                    <span className={`col-start-1 row-start-1 text-center ${retrying ? "" : "invisible"}`}>{retryingLabel}</span>
                  </span>
                </button>
                )}
              </div>
              {/* An error tail is read, not scanned: it wraps in a narrow column and scrolls, faded, in a wide one. */}
              <div className={`mt-2.5 transition-opacity duration-200 ease-out ${busy ? "opacity-45" : ""}`}>
                <ScrollArea
                  as="pre"
                  label="stderr"
                  watch={errorTail.join("\n")}
                  className="rounded-[4px] font-mono text-[12px] leading-[1.6] whitespace-pre-wrap break-words text-(--ac-ink)/85 @md:overflow-x-auto @md:whitespace-pre"
                >
                  {errorTail.join("\n")}
                </ScrollArea>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="details" id={panelId} initial={disclose.initial} animate={disclose.animate} exit={disclose.exit} className="overflow-hidden">
            <div className="flex flex-col gap-5 pb-4 pl-10 pr-3 @sm:pl-[4.5rem]">
              <div className="flex flex-col gap-2">
                <span className={MICRO}>Arguments</span>
                <div className="rounded-[10px]" style={jsonTint}>
                  <ScrollArea
                    as="pre"
                    label="Arguments"
                    watch={argLines.join("\n")}
                    className="overflow-x-auto rounded-[10px] px-3.5 py-3 font-mono text-[12px] leading-[1.7] whitespace-pre"
                  >
                    {argLines.map((line, index) => (
                      <Fragment key={index}>
                        {highlightJson(line)}
                        {index < argLines.length - 1 ? "\n" : null}
                      </Fragment>
                    ))}
                  </ScrollArea>
                </div>
              </div>

              <div data-demo="call-result" className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className={MICRO}>Result</span>
                  <span className={`${MICRO} tabular-nums`}>{resultLines.length} lines</span>
                </div>
                {resultLines.length === 0 ? (
                  <p className="font-mono text-[12px] text-(--ac-muted)">No output was captured.</p>
                ) : (
                  <div className="rounded-[10px] bg-(--ac-ink)/[0.03]">
                    <ScrollArea
                      label="Result"
                      watch={`${showAll}-${resultLines.length}`}
                      className={`overflow-x-auto rounded-[10px] py-2 ${showAll ? "max-h-[184px] overflow-y-auto overscroll-contain" : "overflow-y-hidden"}`}
                    >
                      <ol className="w-max min-w-full font-mono text-[12px] leading-[1.65]">
                        {visibleLines.map((line, index) => (
                          <li key={index} className="flex gap-3 px-3">
                            <span aria-hidden="true" className="w-5 shrink-0 text-right tabular-nums text-(--ac-ink)/25 select-none">
                              {index + 1}
                            </span>
                            <span className="whitespace-pre text-(--ac-ink)/75">{line || " "}</span>
                          </li>
                        ))}
                      </ol>
                    </ScrollArea>
                  </div>
                )}
                {hiddenLines > 0 && (
                  <button
                    type="button"
                    data-demo="call-more"
                    onClick={() => setShowAll((open) => !open)}
                    className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 relative self-start rounded-[4px] font-mono text-[12px] text-(--ac-muted) transition-colors duration-150 ease-out before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:text-(--ac-ink) ${FOCUS}`}
                  >
                    {showAll ? "Show fewer lines" : `Show ${hiddenLines} more lines`}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

type CallState = { status: AgentToolCallStatus; ms?: number };

/** Timeline of the demo, in ms: the first call runs and lands done, the second is retried. */
const FEATURED_MS = 1520;
const RETRY_MS = 650;
const FAILED_MS = 620;

/** Calls the agent made before the two the demo is about. They fill the log and scroll off its top edge. */
const HISTORY: { tool: string; args: AgentToolCallArgs; ms: number; result: string }[] = [
  {
    tool: "bash",
    args: { cmd: "git log --oneline -3 -- src/billing", cwd: "apps/web" },
    ms: 72,
    result: "9f3c1e2 Round tax per invoice, not per line\n41ab7d0 Prorate seat changes by day\nc08e5f1 Add EU reverse charge",
  },
  {
    tool: "read_file",
    args: { path: "docs/billing.md", encoding: "utf8" },
    ms: 39,
    result: "# Billing\n\nTax is rounded once per invoice. Seat changes prorate by day.",
  },
  {
    tool: "web.search",
    args: { query: "stripe proration for mid-cycle seat changes", limit: 5 },
    ms: 842,
    result: "1  billing.example.dev/docs/prorations\n   How proration items appear on the next invoice",
  },
  {
    tool: "read_file",
    args: { path: "src/billing/proration.ts", encoding: "utf8" },
    ms: 64,
    result: 'import { roundCents } from "./money";\n\nexport const PRORATE_BY = "day";',
  },
  {
    tool: "sql.query",
    args: { query: "select plan_id, count(*) from workspace_seats group by plan_id" },
    ms: 312,
    result: "plan_id  count\n-------  -----\n2        3871\n3        412\n(4 rows)",
  },
  {
    tool: "read_file",
    args: { path: "src/billing/money.ts", encoding: "utf8" },
    ms: 47,
    result: "export function roundCents(value: number): number {\n  return Math.round(value * 100) / 100;\n}",
  },
  {
    tool: "bash",
    args: { cmd: "rg -n roundCents src/billing", cwd: "apps/web" },
    ms: 138,
    result: "src/billing/invoices.ts:1\nsrc/billing/invoices.ts:8\nsrc/billing/tax.ts:4",
  },
  {
    tool: "web.search",
    args: { query: "round tax per line or per invoice", limit: 3 },
    ms: 1206,
    result: "1  community.example.dev/t/rounding-per-line\n   Rounding tax per line or per invoice",
  },
  {
    tool: "read_file",
    args: { path: "src/billing/tax.ts", encoding: "utf8" },
    ms: 51,
    result: 'export const TAX_RATE = 0.2;\nexport const REVERSE_CHARGE = "EU-REVERSE";',
  },
];

/** The history numbered from 1, newest first, which is the DOM order of a bottom-anchored log. */
const HISTORY_NEWEST_FIRST = HISTORY.map((call, index) => ({ ...call, seq: index + 1 })).reverse();

/** The first call waits in the queue until someone is looking (a pointer, key or scroll), or this long. */
const DISPATCH_FALLBACK_MS = 4000;
const ATTENTION_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel"] as const;

/** Moves a call through a rerun: running at once, then done with the rerun's duration. */
function rerun(set: (state: CallState) => void): Promise<void> {
  return new Promise((resolve) => {
    set({ status: "running" });
    window.setTimeout(() => {
      set({ status: "done", ms: RETRY_MS });
      resolve();
    }, RETRY_MS);
  });
}

/** Resolves once the visitor shows attention, so the run is watched rather than missed during page load. */
function useDispatched(enabled: boolean): boolean {
  const [dispatched, setDispatched] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const go = () => setDispatched(true);
    const timer = window.setTimeout(go, DISPATCH_FALLBACK_MS);
    ATTENTION_EVENTS.forEach((type) => window.addEventListener(type, go, { once: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      ATTENTION_EVENTS.forEach((type) => window.removeEventListener(type, go));
    };
  }, [enabled]);
  return dispatched;
}

/** First-view entrance: blocks rise 10px and a 6px blur clears, 60ms apart, in reading order. */
function entrance(reduce: boolean): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" },
    shown: (index: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      // Drop the filter once the block has landed, so eleven idle lines are not eleven filtered layers.
      transitionEnd: { filter: "none" },
      transition: reduce ? { duration: 0.15 } : { duration: 0.56, ease: EASE, delay: 0.08 + index * 0.06 },
    }),
  };
}

/** A short log: one call runs to done, then a failed call is retried, on a quiet stage. */
export default function AgentToolCallDemo(overrides: Partial<AgentToolCallProps> = {}) {
  const { status: forced, ...rest } = overrides;
  const theme: Theme = rest.theme ?? "dark";
  const accent = rest.accent ?? DEFAULT_ACCENT;
  const reduce = !!useReducedMotion();
  const reveal = useMemo(() => entrance(reduce), [reduce]);
  const dispatched = useDispatched(!forced);
  const [featured, setFeatured] = useState<CallState>({ status: "pending" });
  const [retry, setRetry] = useState<CallState>({ status: "failed", ms: FAILED_MS });

  // The status control drives the first call. Without it, the call leaves the queue, runs and lands done.
  useEffect(() => {
    if (forced) {
      setFeatured({ status: forced, ms: forced === "pending" || forced === "running" ? undefined : FEATURED_MS });
      return;
    }
    if (!dispatched) {
      setFeatured({ status: "pending" });
      return;
    }
    setFeatured({ status: "running" });
    const timer = window.setTimeout(() => setFeatured({ status: "done", ms: FEATURED_MS }), FEATURED_MS);
    return () => window.clearTimeout(timer);
  }, [forced, dispatched]);

  const p = PALETTE[theme];
  // Shared by every line, so the layout controls restyle the whole log.
  const look = { density: rest.density, showTiming: rest.showTiming, theme, accent };
  const failedSeq = HISTORY.length + 1;

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-6 sm:px-8" style={{ background: p.stage }}>
      <motion.section
        aria-label="Agent call log"
        className="@container flex h-[min(680px,calc(100dvh-3rem))] w-full max-w-[640px] flex-col overflow-hidden rounded-[18px] pt-3"
        style={{ ...paletteVars(theme, accent), background: p.surface, boxShadow: p.shadow }}
        initial="hidden"
        animate="shown"
        variants={reveal}
        custom={0}
      >
        <motion.div
          variants={reveal}
          custom={1}
          className="flex shrink-0 items-center justify-between px-5 pb-2 font-mono text-[11px] tracking-[0.18em] text-(--ac-faint) uppercase"
        >
          <span>Call log</span>
          <span>billing-sync</span>
        </motion.div>
        {/*
          A log reads from the bottom: the newest call sits on the floor and earlier ones scroll off the
          top. column-reverse keeps the scroll pinned to the bottom while a call expands, so it grows
          upward like a terminal. The DOM runs newest first, which is also the keyboard order.
        */}
        <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain px-2 pb-2 [mask-image:linear-gradient(to_bottom,transparent,#000_32px)]">
          <motion.div variants={reveal} custom={2}>
            <AgentToolCall
              seq={failedSeq + 1}
              tool="read_file"
              status={featured.status}
              durationMs={featured.ms}
              // Retry on a forced failure reruns this call locally; the Status control takes over again when it changes.
              onRetry={() => rerun(setFeatured)}
              {...rest}
              theme={theme}
              accent={accent}
            />
          </motion.div>
          <motion.div variants={reveal} custom={3}>
            <AgentToolCall
              seq={failedSeq}
              tool="bash"
              status={retry.status}
              durationMs={retry.ms}
              onRetry={() => rerun(setRetry)}
              {...look}
            />
          </motion.div>
          {HISTORY_NEWEST_FIRST.map((call, index) => (
            <motion.div key={call.seq} variants={reveal} custom={4 + index}>
              <AgentToolCall seq={call.seq} tool={call.tool} args={call.args} result={call.result} status="done" durationMs={call.ms} {...look} />
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
