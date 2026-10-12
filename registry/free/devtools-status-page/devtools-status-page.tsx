"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { animate, AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type StatusState = "operational" | "degraded" | "outage";
type Tone = "up" | "degraded" | "down";

type Day = { tone: Tone; minutes: number; note: string };
type Part = { id: string; name: string; days: Day[] };
type Update = { at: string; title: string; body: string };
type Incident = { title: string; updates: Update[] };

export type StatusPageProps = {
  product?: string;
  /** Overall condition. The sample bars and the incident follow it. */
  state?: StatusState;
  /** Draw the 90-day bars. */
  showBars?: boolean;
  theme?: "dark" | "light";
  /** The one accent: degraded days, the status word, and the latest incident mark. */
  accent?: string;
  onSubscribe?: (email: string) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#7cc4ff";
const EASE = [0.22, 1, 0.36, 1] as const;
const UI_SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;
const DAYS = 90;

const PALETTE = {
  dark: {
    stage: "#000000",
    surface: "#0d0d0f",
    well: "#09090a",
    raised: "rgba(255,255,255,0.045)",
    ink: "#ededef",
    muted: "#98989a",
    faint: "#7d7d80",
    line: "rgba(255,255,255,0.08)",
    lineStrong: "rgba(255,255,255,0.16)",
    ok: "#5fc284",
    err: "#f07c80",
    inkHover: "#ffffff",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)",
  },
  light: {
    stage: "#f4f4f5",
    surface: "#ffffff",
    well: "#fafafa",
    raised: "rgba(17,17,19,0.045)",
    ink: "#17171a",
    muted: "#5d5d5f",
    faint: "#6f6f72",
    line: "rgba(17,17,19,0.09)",
    lineStrong: "rgba(17,17,19,0.16)",
    ok: "#23884a",
    err: "#c2353b",
    inkHover: "#2a2a2e",
    shadow: "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 40px 80px -40px rgba(17,17,19,0.25)",
  },
} as const;

type Theme = keyof typeof PALETTE;

function paletteVars(theme: Theme, accent: string): CSSProperties {
  const p = PALETTE[theme];
  return {
    "--sp-surface": p.surface,
    "--sp-well": p.well,
    "--sp-raised": p.raised,
    "--sp-ink": p.ink,
    "--sp-ink-hover": p.inkHover,
    "--sp-muted": p.muted,
    "--sp-faint": p.faint,
    "--sp-line": p.line,
    "--sp-line-strong": p.lineStrong,
    "--sp-ok": p.ok,
    "--sp-err": p.err,
    "--sp-accent": accent,
    "--sp-accent-ink": theme === "light" ? `color-mix(in oklab, ${accent} 62%, #000)` : accent,
  } as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* Sample                                                              */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(index: number) {
  const d = new Date(Date.UTC(2026, 9, 10));
  d.setUTCDate(d.getUTCDate() - (DAYS - 1 - index));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function upDay(): Day {
  return { tone: "up", minutes: 0, note: "Operational" };
}

function paint(bad: Record<number, Day>): Day[] {
  return Array.from({ length: DAYS }, (_, i) => bad[i] ?? upDay());
}

const WEBHOOK_NOTES = [
  "Deliveries started queueing.",
  "Slow receivers are still behind.",
  "The delay is about four minutes.",
  "Retries are catching up.",
];

function webhookDays(): Day[] {
  const bad: Record<number, Day> = {};
  [86, 87, 88, 89].forEach((i, n) => {
    bad[i] = { tone: "degraded", minutes: [18, 22, 11, 14][n], note: WEBHOOK_NOTES[n] };
  });
  return paint(bad);
}

function models(state: StatusState): { label: string; tone: Tone; headline: string; summary: string; parts: Part[]; incident: Incident | null; updated: string } {
  const names = [
    ["api", "API"],
    ["dashboard", "Dashboard"],
    ["webhooks", "Webhooks"],
    ["invoices", "Invoices"],
    ["email", "Email"],
  ] as const;

  if (state === "operational") {
    return {
      label: "Operational",
      tone: "up",
      headline: "All systems operational.",
      summary: "No incidents in the last 90 days.",
      updated: "14:41 UTC",
      incident: null,
      parts: names.map(([id, name]) => ({ id, name, days: paint({}) })),
    };
  }

  if (state === "outage") {
    const api = paint({
      88: { tone: "degraded", minutes: 40, note: "Error rate climbed, then recovered." },
      89: { tone: "down", minutes: 86, note: "Requests are failing." },
    });
    return {
      label: "Outage",
      tone: "down",
      headline: "The API is unavailable.",
      summary: "Webhooks are still delayed. Dashboard, invoices and email are up.",
      updated: "13:40 UTC",
      parts: names.map(([id, name]) => ({ id, name, days: id === "api" ? api : id === "webhooks" ? webhookDays() : paint({}) })),
      incident: {
        title: "API unavailable",
        updates: [
          { at: "13:05", title: "Identified", body: "Requests to api.ledgerline.dev are returning errors." },
          { at: "13:22", title: "Update", body: "Error rates are still high. Webhooks remain delayed." },
          { at: "13:40", title: "Investigating", body: "Failover did not take. Dashboard, invoices and email are up." },
        ],
      },
    };
  }

  return {
    label: "Degraded",
    tone: "degraded",
    headline: "Webhooks are delayed.",
    summary: "API, dashboard, invoices and email are up.",
    updated: "14:41 UTC",
    parts: names.map(([id, name]) => ({ id, name, days: id === "webhooks" ? webhookDays() : paint({}) })),
    incident: {
      title: "Webhooks delayed",
      updates: [
        { at: "7 Oct · 09:14", title: "Identified", body: "Deliveries to customer endpoints started queueing." },
        { at: "8 Oct · 16:40", title: "Update", body: "Receivers that answer slowly are still behind. Events are not dropped." },
        { at: "10 Oct · 14:41", title: "Monitoring", body: "The delay is about four minutes, and it is shrinking." },
      ],
    },
  };
}

function uptime(days: Day[]) {
  const lost = days.reduce((sum, day) => sum + day.minutes, 0);
  return (1 - lost / (DAYS * 1440)) * 100;
}

function currentTone(days: Day[]): Tone {
  return days[days.length - 1]?.tone ?? "up";
}

function daySentence(index: number, day: Day) {
  const when = dayLabel(index);
  if (day.tone === "up") return `${when} · Operational`;
  if (day.tone === "down") return `${when} · Down ${day.minutes} min · ${day.note}`;
  return `${when} · Degraded ${day.minutes} min · ${day.note}`;
}

function toneColor(tone: Tone) {
  if (tone === "down") return "var(--sp-err)";
  if (tone === "degraded") return "var(--sp-accent-ink)";
  return "var(--sp-ok)";
}

type DayLayout = { xs: number[]; ys: number[]; ws: number[]; rows: number; cellH: number; trackH: number };

/** A stitch is at least this wide, plus a 1px gap, before it reads as its own day. */
const MIN_STITCH = 5;
/** Wrapped rows keep the 8px stitch and drop the empty air above it, so a phone card matches the desktop frame. */
const WRAP_ROW_H = 8;
const WRAP_ROW_GAP = 3;

const FLAT: DayLayout = { xs: [], ys: [], ws: [], rows: 1, cellH: 0, trackH: 0 };

/**
 * One row of integer columns while every day stays at least 5px wide.
 * Narrower than that, the ninety days wrap into two or three equal rows instead of fusing into a line.
 * The wide path is the desktop strip: 1px gaps, extra pixels on the first columns.
 */
function layoutDays(width: number): DayLayout {
  if (width <= 0) return FLAT;
  const rows = rowsFor(width);
  if (rows === 1) {
    const xs: number[] = [];
    const ws: number[] = [];
    const gaps = DAYS - 1;
    const gap = width >= DAYS + gaps ? 1 : 0;
    const inner = width - gap * gaps;
    const base = Math.floor(inner / DAYS);
    const extra = inner - base * DAYS;
    let x = 0;
    for (let i = 0; i < DAYS; i++) {
      const w = base + (i < extra ? 1 : 0);
      xs.push(x);
      ws.push(w);
      x += w + (i < DAYS - 1 ? gap : 0);
    }
    return { xs, ys: xs.map(() => 0), ws, rows: 1, cellH: 0, trackH: 0 };
  }
  const cols = DAYS / rows;
  const gaps = cols - 1;
  const gap = width >= cols + gaps ? 1 : 0;
  const inner = width - gap * gaps;
  const base = Math.floor(inner / cols);
  const extra = inner - base * cols;
  const colX: number[] = [];
  const colW: number[] = [];
  let x = 0;
  for (let c = 0; c < cols; c++) {
    const w = base + (c < extra ? 1 : 0);
    colX.push(x);
    colW.push(w);
    x += w + (c < cols - 1 ? gap : 0);
  }
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  for (let i = 0; i < DAYS; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    xs.push(colX[col]);
    ys.push(row * (WRAP_ROW_H + WRAP_ROW_GAP));
    ws.push(colW[col]);
  }
  return { xs, ys, ws, rows, cellH: WRAP_ROW_H, trackH: rows * WRAP_ROW_H + (rows - 1) * WRAP_ROW_GAP };
}

function rowsFor(width: number) {
  const slot = MIN_STITCH + 1;
  if (width + 1 >= DAYS * slot) return 1;
  // Two rows, then three. Never a fourth: a phone stays a short comb, not a stack of hairlines.
  for (const rows of [2, 3]) {
    const cols = DAYS / rows;
    if (width + 1 >= cols * slot) return rows;
  }
  return 3;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function StatusPage({
  product = "ledgerline",
  state = "degraded",
  showBars = true,
  theme = "dark",
  accent = DEFAULT_ACCENT,
  onSubscribe,
  className = "",
}: StatusPageProps) {
  const reduce = !!useReducedMotion();
  const reveal = useMemo(() => entrance(reduce), [reduce]);
  const model = useMemo(() => models(state), [state]);
  const emailId = useId();
  const hintId = useId();
  const [trackWidth, setTrackWidth] = useState(0);
  const [pinned, setPinned] = useState<{ id: string; index: number } | null>(null);
  const [hover, setHover] = useState<{ id: string; index: number } | null>(null);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [hint, setHint] = useState("");

  const layout = useMemo(() => layoutDays(trackWidth), [trackWidth]);

  useEffect(() => {
    setPinned(null);
    setHover(null);
    setSubscribed(false);
    setEmail("");
    setHint("");
  }, [state]);

  const statusColor = toneColor(model.tone);
  const focus = hover ?? pinned;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setHint("Enter an email address.");
      return;
    }
    setHint("");
    setSubscribed(true);
    onSubscribe?.(next);
  };

  return (
    <motion.section
      aria-label={`Status for ${product}`}
      className={`@container w-full max-w-[920px] overflow-hidden rounded-[20px] font-sans text-(--sp-ink) ${className}`}
      style={{ ...paletteVars(theme, accent), background: PALETTE[theme].surface, boxShadow: PALETTE[theme].shadow }}
      initial="hidden"
      animate="shown"
      variants={reveal}
      custom={0}
    >
      <motion.header variants={reveal} custom={1} className="flex items-center justify-between gap-3 px-5 pt-5 @xl:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: statusColor }} aria-hidden="true" />
          <h2 className="truncate font-mono text-[12.5px] tracking-[0.01em]">{product}</h2>
        </div>
        <p className="shrink-0 font-mono text-[11px] text-(--sp-faint) tabular-nums">Updated {model.updated}</p>
      </motion.header>

      <motion.div variants={reveal} custom={2} className="px-5 pt-1 @lg:pt-4 @xl:px-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="min-w-0 text-[22px] leading-[1.15] tracking-[-0.03em] @lg:text-[26px]">{model.headline}</h3>
          <span className="shrink-0 pt-1.5 font-mono text-[12px]" style={{ color: statusColor }}>
            {model.label}
          </span>
        </div>
        <p className="mt-1.5 max-w-[62ch] text-[14px] leading-[1.5] text-(--sp-muted)">{model.summary}</p>
      </motion.div>

      <motion.div variants={reveal} custom={3} className="px-5 pt-1 @lg:pt-4 @xl:px-6">
        <div className="overflow-hidden rounded-[14px]" style={{ background: "var(--sp-well)", boxShadow: "inset 0 0 0 1px var(--sp-line)" }}>
          <ul aria-label="Components">
            {model.parts.map((part, index) => {
              const tone = currentTone(part.days);
              const shown = focus?.id === part.id ? focus.index : null;
              const day = shown === null ? null : part.days[shown];
              return (
                <li key={part.id} className="border-b border-(--sp-line) last:border-b-0" style={tone === "up" ? undefined : { background: "var(--sp-raised)" }}>
                  <Track
                    part={part}
                    tone={tone}
                    shown={shown}
                    day={day}
                    showBars={showBars}
                    layout={layout}
                    reduce={reduce}
                    onMeasure={showBars && index === 0 ? setTrackWidth : undefined}
                    onHover={(next) => setHover(next === null ? null : { id: part.id, index: next })}
                    onPick={(next) => setPinned({ id: part.id, index: next })}
                  />
                </li>
              );
            })}
          </ul>
          {showBars && (
            <div className="flex items-center justify-between border-t border-(--sp-line) px-3.5 py-1 font-mono text-[11px] text-(--sp-faint) tabular-nums @lg:px-4 @lg:py-2">
              <span>{dayLabel(0)}</span>
              <span>Today</span>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={reveal} custom={4} className="px-5 pt-3 @lg:pt-5 @xl:px-6">
        <p className="font-mono text-[11px] tracking-[0.14em] text-(--sp-faint) uppercase">Incident</p>
        <AnimatePresence mode="wait" initial={false}>
          {model.incident ? (
            <motion.div
              key={model.incident.title}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: reduce ? 0.12 : 0.32, ease: EASE }}
              className="mt-2"
            >
              <h4 className="text-[15px] tracking-[-0.02em]">{model.incident.title}</h4>
              <ol className="mt-2 @lg:mt-4" aria-label="Incident updates">
                {model.incident.updates.map((update, index) => {
                  const last = index === model.incident!.updates.length - 1;
                  return (
                    <li key={update.at} className="relative grid grid-cols-[14px_1fr] gap-3 pb-2 last:pb-0 @lg:pb-4">
                      <span className="relative flex justify-center" aria-hidden="true">
                        {!last && <span className="absolute top-2.5 bottom-[-8px] w-px @lg:bottom-[-16px]" style={{ background: "var(--sp-line)" }} />}
                        <span className={`relative mt-1.5 rounded-full ${last ? "size-2" : "size-1.5"}`} style={{ background: last ? statusColor : "var(--sp-line-strong)" }} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-(--sp-faint) tabular-nums">
                          {update.at} <span className="text-(--sp-ink)">{update.title}</span>
                        </p>
                        <p className="mt-0.5 max-w-[62ch] text-[13.5px] leading-snug text-(--sp-muted) @lg:mt-1 @lg:leading-[1.55]">{update.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </motion.div>
          ) : (
            <motion.p key="clear" className="mt-3 flex items-center gap-2 text-[14px] text-(--sp-muted)" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="size-1.5 rounded-full" style={{ background: "var(--sp-ok)" }} aria-hidden="true" />
              No open incidents.
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.form variants={reveal} custom={5} noValidate onSubmit={submit} className="px-5 pt-2 pb-2 @lg:pt-5 @lg:pb-5 @xl:px-6">
        <div className="border-t border-(--sp-line) pt-2 @lg:pt-4">
          <label htmlFor={emailId} className="text-[13px] text-(--sp-muted)">
            Email me when the status changes
          </label>
          <div className="mt-2 flex flex-row gap-2">
            <input
              id={emailId}
              data-demo="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              disabled={subscribed}
              placeholder="you@company.com"
              aria-invalid={hint ? true : undefined}
              aria-describedby={hintId}
              onChange={(event) => {
                setEmail(event.target.value);
                if (hint) setHint("");
              }}
              className="h-11 w-full min-w-0 rounded-[9px] bg-transparent px-3 text-[13.5px] text-(--sp-ink) shadow-[inset_0_0_0_1px_var(--sp-line-strong)] transition-shadow duration-150 outline-none placeholder:text-(--sp-faint) hover:shadow-[inset_0_0_0_1px_var(--sp-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sp-ink) disabled:opacity-60 @lg:h-9"
            />
            <button
              type="submit"
              data-demo="subscribe"
              disabled={subscribed}
              className="inline-flex h-11 w-[7.5rem] shrink-0 cursor-pointer items-center justify-center rounded-[9px] bg-(--sp-ink) text-[13px] font-medium text-(--sp-surface) transition-[transform,background-color] duration-150 hover:bg-(--sp-ink-hover) active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sp-ink) disabled:cursor-default disabled:bg-(--sp-ink) disabled:active:scale-100 @lg:h-9 @lg:w-32"
            >
              <AnimatePresence mode="wait" initial={false}>
                {subscribed ? (
                  <motion.span key="check" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduce ? 0.12 : 0.18 }} className="inline-flex" aria-label="Subscribed">
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.span>
                ) : (
                  <motion.span key="label" exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                    Subscribe
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
          <p id={hintId} className={`font-mono text-[11px] ${subscribed || hint ? "mt-2" : "sr-only"}`} style={{ color: subscribed ? "var(--sp-ok)" : "var(--sp-err)" }} aria-live="polite">
            {subscribed ? `Subscribed as ${email.trim()}.` : hint || "Enter an email to subscribe."}
          </p>
        </div>
      </motion.form>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Bars                                                                */
/* ------------------------------------------------------------------ */

function Track({
  part,
  tone,
  shown,
  day,
  showBars,
  layout,
  reduce,
  onMeasure,
  onHover,
  onPick,
}: {
  part: Part;
  tone: Tone;
  shown: number | null;
  day: Day | null;
  showBars: boolean;
  layout: DayLayout;
  reduce: boolean;
  onMeasure?: (width: number) => void;
  onHover: (index: number | null) => void;
  onPick: (index: number) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const gesture = useRef<{ x: number; y: number; id: number; scrub: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!onMeasure) return;
    const el = ref.current;
    if (!el) return;
    const apply = () => onMeasure(Math.floor(el.clientWidth));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onMeasure]);

  const indexFrom = (clientX: number, clientY: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || layout.xs.length === 0) return DAYS - 1;
    const x = clientX - box.left;
    if (layout.rows <= 1) {
      let index = 0;
      for (let i = 0; i < layout.xs.length; i++) if (layout.xs[i] <= x) index = i;
      return index;
    }
    const y = clientY - box.top;
    let index = 0;
    let best = Infinity;
    for (let i = 0; i < layout.xs.length; i++) {
      const dx = x - (layout.xs[i] + layout.ws[i] / 2);
      const dy = y - (layout.ys[i] + layout.cellH / 2);
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        index = i;
      }
    }
    return index;
  };

  return (
    <div
      role="slider"
        tabIndex={0}
        aria-valuemin={1}
        aria-valuemax={DAYS}
        aria-valuenow={shown === null ? DAYS : shown + 1}
        aria-valuetext={day && shown !== null ? daySentence(shown, day) : "Last 90 days"}
        aria-label={`${part.name}, last 90 days`}
        aria-orientation="horizontal"
        data-demo={part.id === "webhooks" ? "bars-webhooks" : undefined}
        onPointerDown={(event) => {
          gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId, scrub: false };
        }}
        onPointerMove={(event) => {
          const index = indexFrom(event.clientX, event.clientY);
          if (event.pointerType === "mouse") onHover(index);
          const current = gesture.current;
          if (!current || current.id !== event.pointerId) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (!current.scrub) {
            if (Math.hypot(dx, dy) < 6) return;
            // A vertical drag is a page scroll. Leave it alone.
            if (Math.abs(dy) > Math.abs(dx)) {
              gesture.current = null;
              return;
            }
            current.scrub = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          onPick(index);
        }}
        onPointerUp={(event) => {
          const current = gesture.current;
          gesture.current = null;
          if (!current || current.id !== event.pointerId || current.scrub) return;
          onPick(indexFrom(event.clientX, event.clientY));
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onPointerLeave={() => onHover(null)}
        onKeyDown={(event) => {
          const current = shown ?? DAYS - 1;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onPick(Math.min(DAYS - 1, current + 1));
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onPick(Math.max(0, current - 1));
          }
          if (event.key === "Home") {
            event.preventDefault();
            onPick(0);
          }
          if (event.key === "End") {
            event.preventDefault();
            onPick(DAYS - 1);
          }
        }}
        className="w-full cursor-pointer touch-pan-y px-3.5 py-0.5 text-left outline-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--sp-ink) @lg:px-4 @lg:py-2.5"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            {tone !== "up" && <span className="h-3.5 w-[2px] shrink-0 rounded-full" style={{ background: toneColor(tone) }} aria-hidden="true" />}
            <span className="truncate text-[14px] tracking-[-0.01em]">{part.name}</span>
          </span>
          <Percent value={uptime(part.days)} tone={tone} reduce={reduce} />
        </span>
        {showBars && (
          <span ref={ref} className={layout.rows > 1 ? "relative mt-0.5 block" : "relative mt-2 block h-5 @lg:h-4"} style={layout.rows > 1 ? { height: layout.trackH } : undefined}>
            {layout.xs.map((x, index) => {
              const item = part.days[index];
              const active = shown === index;
              const background = active ? "var(--sp-ink)" : item.tone === "down" ? "var(--sp-err)" : item.tone === "degraded" ? "var(--sp-accent-ink)" : "color-mix(in oklab, var(--sp-ink) 28%, transparent)";
              const wrapped = layout.rows > 1;
              return (
                <span
                  key={index}
                  className={wrapped ? "absolute" : "absolute inset-y-0"}
                  style={wrapped ? { left: x, top: layout.ys[index], width: layout.ws[index], height: layout.cellH } : { left: x, width: layout.ws[index] }}
                  aria-hidden="true"
                >
                  {active &&
                    (reduce ? (
                      <span className="absolute inset-0 rounded-[1px]" style={{ background: "color-mix(in oklab, var(--sp-ink) 18%, transparent)" }} />
                    ) : (
                      <motion.span layoutId={`sp-day-${part.id}`} className="absolute inset-0 rounded-[1px]" style={{ background: "color-mix(in oklab, var(--sp-ink) 18%, transparent)" }} transition={UI_SPRING} />
                    ))}
                  <motion.span
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE, delay: 0.04 + index * 0.0018 }}
                    className={`absolute bottom-0 left-0 w-full rounded-[1px] ${wrapped ? (active || item.tone !== "up" ? "h-full" : "h-1.5") : active ? "h-5 @lg:h-4" : item.tone === "up" ? "h-2 @lg:h-1.5" : "h-3.5 @lg:h-3"}`}
                    style={{ background, transformOrigin: "bottom" }}
                  />
                </span>
              );
            })}
          </span>
        )}
        <AnimatePresence initial={false}>
          {day && shown !== null && (
            <motion.span
              key="day"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, transition: { duration: 0.14 } }}
              transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE }}
              className="block overflow-hidden"
            >
              <span
                className="mt-1.5 block font-mono text-[12px] leading-[1.4] tabular-nums"
                style={{ color: day.tone === "down" ? "var(--sp-err)" : day.tone === "degraded" ? "var(--sp-accent-ink)" : "var(--sp-muted)" }}
              >
                {daySentence(shown, day)}
              </span>
            </motion.span>
          )}
        </AnimatePresence>
    </div>
  );
}

function Percent({ value, tone, reduce }: { value: number; tone: Tone; reduce: boolean }) {
  const [n, setN] = useState(reduce ? value : Math.max(0, value - 0.8));
  useEffect(() => {
    if (reduce) {
      setN(value);
      return;
    }
    const ctrl = animate(Math.max(0, value - 0.8), value, { duration: 0.7, ease: EASE, onUpdate: (next) => setN(next) });
    return () => ctrl.stop();
  }, [value, reduce]);
  const color = tone === "down" ? "var(--sp-err)" : tone === "degraded" ? "var(--sp-accent-ink)" : "var(--sp-muted)";
  return (
    <span className="shrink-0 font-mono text-[12px] tabular-nums" style={{ color }}>
      {n.toFixed(2)}%
    </span>
  );
}

function entrance(reduce: boolean): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" },
    shown: (index: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transitionEnd: { filter: "none" },
      transition: reduce ? { duration: 0.15 } : { duration: 0.56, ease: EASE, delay: 0.06 + index * 0.06 },
    }),
  };
}

/** Public status for ledgerline, on a quiet stage. */
export default function StatusPageDemo(overrides: Partial<StatusPageProps> = {}) {
  const theme: Theme = overrides.theme ?? "dark";
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-8 sm:px-8" style={{ background: PALETTE[theme].stage }}>
      <StatusPage {...overrides} theme={theme} />
    </div>
  );
}
