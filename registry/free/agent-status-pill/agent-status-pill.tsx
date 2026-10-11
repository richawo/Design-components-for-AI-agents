"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, type Transition } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AgentStatus = "idle" | "running" | "waiting" | "error" | "done";

export type AgentActivity = {
  id: string;
  /** What happened, in a few words. */
  text: string;
  /** Short relative time: "now", "1m", "3m". */
  time?: string;
  /** The step happening right now; drawn in full ink. */
  live?: boolean;
};

export type AgentStatusAction = {
  label: string;
  onSelect: () => void;
  /** The one filled button. Use it for the action the state is asking for. */
  primary?: boolean;
};

export type AgentStatusPillProps = Omit<HTMLAttributes<HTMLSpanElement>, "title" | "children"> & {
  state?: AgentStatus;
  /** Replaces the built-in label for every state (e.g. "Awaiting review"). Empty keeps Idle, Running, Needs you, Failed, Done. */
  label?: string;
  /** Show the clock: run time while running, time spent waiting, and the frozen run time on error and done. */
  elapsed?: boolean;
  /** Epoch ms the clock counts from. */
  since?: number;
  /** Epoch ms the clock stopped at. Leave undefined to keep it ticking. */
  until?: number;
  size?: "sm" | "md";
  /** The surface the pill sits on. */
  theme?: "dark" | "light";
  /** Whose status this is. Read to screen readers and used to name the activity panel. */
  agent?: string;
  /** Activity panel title. Defaults to a sentence for the state. */
  heading?: string;
  /** One or two lines under the heading. */
  summary?: string;
  /** A command or path the state is about, set in mono. */
  command?: string;
  /** The last few steps, oldest first. Three or four reads best. */
  activity?: AgentActivity[];
  /** Buttons at the foot of the panel. Selecting one closes it. */
  actions?: AgentStatusAction[];
  /** Which edge of the pill the panel lines up with. */
  align?: "start" | "end";
  /** Open the panel below or above the pill. */
  side?: "bottom" | "top";
  /** Override a state's colour. Monochrome by default; only waiting, error and done carry hue. */
  tones?: Partial<Record<AgentStatus, string>>;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    surface: "rgba(255,255,255,0.045)",
    surfaceHover: "rgba(255,255,255,0.08)",
    ring: "rgba(255,255,255,0.10)",
    highlight: "rgba(255,255,255,0.06)",
    panel: "#111113",
    panelRing: "rgba(255,255,255,0.09)",
    panelShadow: "0 24px 48px -16px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.5)",
    well: "#09090b",
    onInk: "#0b0b0c",
    /** How much of a state hue goes into its label; the rest is ink. */
    tintMix: 74,
  },
  light: {
    ink: "#18181b",
    muted: "#52525b",
    faint: "#71717a",
    surface: "rgba(24,24,27,0.04)",
    surfaceHover: "rgba(24,24,27,0.07)",
    ring: "rgba(24,24,27,0.12)",
    highlight: "rgba(255,255,255,0.7)",
    panel: "#ffffff",
    panelRing: "rgba(24,24,27,0.10)",
    panelShadow: "0 24px 48px -18px rgba(24,24,27,0.28), 0 2px 6px rgba(24,24,27,0.08)",
    well: "#f4f4f5",
    onInk: "#ffffff",
    tintMix: 52,
  },
} as const;

/** null means "the theme's ink": running stays monochrome, only its dot breathes. */
const STATE_TONE: Record<AgentStatus, string | null> = {
  idle: "#71717a",
  running: null,
  waiting: "#f5a524",
  error: "#f2555a",
  done: "#3fcf8e",
};

const STATE_META: Record<AgentStatus, { label: string; heading: string; live: boolean; tinted: boolean }> = {
  idle: { label: "Idle", heading: "Not running", live: false, tinted: false },
  running: { label: "Running", heading: "Working", live: true, tinted: false },
  waiting: { label: "Needs you", heading: "Waiting for your input", live: true, tinted: true },
  error: { label: "Failed", heading: "Stopped with an error", live: false, tinted: true },
  done: { label: "Done", heading: "Finished", live: false, tinted: false },
};

const SIZES = {
  sm: { height: 24, padX: 9, gap: 6, text: 12, time: 11, dot: 6, sep: 9 },
  md: { height: 30, padX: 12, gap: 7, text: 13, time: 12, dot: 7, sep: 11 },
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI: Transition = { type: "spring", stiffness: 500, damping: 40 };
const INSTANT: Transition = { duration: 0 };

const TIMING = {
  hoverOpenMs: 380,
  hoverCloseMs: 140,
  /** The live dot: running ticks over faster than waiting, which breathes. */
  pingRunningS: 1.6,
  pingWaitingS: 2.4,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

/** 0:42, 6:12, 1:04:09. */
function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** The same span as an ISO 8601 duration, for <time dateTime>. */
function isoDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `PT${Math.floor(s / 3600)}H${Math.floor((s % 3600) / 60)}M${s % 60}S`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Wall-clock time, ticking once a second while `active`. null until mounted so server and client render the same markup. */
function useNow(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    let id: number | undefined;
    const sync = () => {
      window.clearInterval(id);
      if (document.hidden) return;
      setNow(Date.now());
      id = window.setInterval(() => setNow(Date.now()), 1000);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [active]);
  return now;
}

/** The content's natural width, so the pill can animate to it instead of jumping. */
function useNaturalWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function StatusDot({ state, tone, size, animate: ambient, reduce }: { state: AgentStatus; tone: string; size: number; animate: boolean; reduce: boolean }) {
  const hollow = state === "idle";
  const live = STATE_META[state].live && !reduce;
  const period = state === "waiting" ? TIMING.pingWaitingS : TIMING.pingRunningS;
  return (
    <span aria-hidden="true" className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {live && (
        <span
          key={state}
          className="absolute inset-0 rounded-full"
          style={{
            background: tone,
            animation: `asp-ping ${period}s cubic-bezier(0.22, 1, 0.36, 1) infinite`,
            animationPlayState: ambient ? "running" : "paused",
          }}
        />
      )}
      <motion.span
        className="relative rounded-full"
        style={{ width: size, height: size }}
        initial={false}
        animate={{
          backgroundColor: hollow ? "rgba(0,0,0,0)" : tone,
          boxShadow: hollow ? `inset 0 0 0 1.5px ${tone}` : `inset 0 0 0 0px ${tone}`,
        }}
        transition={reduce ? INSTANT : { duration: 0.24, ease: EASE_OUT }}
      />
    </span>
  );
}

const swap = (reduce: boolean) =>
  reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } } }
    : {
        initial: { opacity: 0, y: 5, filter: "blur(3px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.24, ease: EASE_OUT } },
        exit: { opacity: 0, y: -5, filter: "blur(3px)", transition: { duration: 0.16, ease: EASE_IN } },
      };

type PanelProps = {
  id: string;
  state: AgentStatus;
  tone: string;
  heading: string;
  agent?: string;
  summary?: string;
  command?: string;
  activity?: AgentActivity[];
  actions?: AgentStatusAction[];
  clock: string | null;
  align: "start" | "end";
  side: "bottom" | "top";
  reduce: boolean;
  onAction: (a: AgentStatusAction) => void;
};

function ActivityPanel({ id, state, tone, heading, agent, summary, command, activity, actions, clock, align, side, reduce, onAction }: PanelProps) {
  const fromY = side === "bottom" ? -6 : 6;
  return (
    <motion.div
      id={id}
      role="dialog"
      aria-label={agent ? `${agent}: ${heading}` : heading}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: fromY, scale: 0.98, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: reduce ? 0.15 : 0.22, ease: EASE_OUT } }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: fromY / 2, scale: 0.98, transition: { duration: 0.14, ease: EASE_IN } }}
      className={[
        "absolute z-30 w-[min(19rem,calc(100vw-2rem))] rounded-[12px] p-3.5 text-left",
        // An invisible bridge over the gap, so moving from pill to panel doesn't close it.
        "before:absolute before:inset-x-0 before:h-2.5 before:content-['']",
        side === "bottom" ? "top-[calc(100%+8px)] before:-top-2.5" : "bottom-[calc(100%+8px)] before:-bottom-2.5",
        align === "end" ? "right-0" : "left-0",
      ].join(" ")}
      style={{
        background: "var(--asp-panel)",
        boxShadow: "inset 0 0 0 1px var(--asp-panel-ring), inset 0 1px 0 var(--asp-highlight), var(--asp-panel-shadow)",
        transformOrigin: `${side === "bottom" ? "top" : "bottom"} ${align === "end" ? "right" : "left"}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={state === "idle" ? { boxShadow: `inset 0 0 0 1.5px ${tone}` } : { background: tone }} />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em]" style={{ color: "var(--asp-ink)" }}>
          {heading}
        </p>
        {clock && (
          <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: "var(--asp-faint)" }}>
            {clock}
          </span>
        )}
      </div>

      {summary && (
        <p className="mt-1.5 text-[12.5px] leading-[1.5]" style={{ color: "var(--asp-muted)" }}>
          {summary}
        </p>
      )}

      {command && (
        <code
          className="mt-2.5 block overflow-x-auto whitespace-nowrap rounded-[8px] px-2.5 py-2 font-mono text-[11.5px] [scrollbar-width:none]"
          style={{ background: "var(--asp-well)", color: "var(--asp-ink)", boxShadow: "inset 0 0 0 1px var(--asp-panel-ring)" }}
        >
          <span aria-hidden="true" style={{ color: "var(--asp-faint)" }}>
            ${" "}
          </span>
          {command}
        </code>
      )}

      {activity && activity.length > 0 && (
        <ol className="mt-3 space-y-1.5" aria-label="Recent activity">
          {activity.map((a, i) => (
            <motion.li
              key={a.id}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.05 + i * 0.045, duration: 0.24, ease: EASE_OUT } }}
              className="grid grid-cols-[2.25rem_1fr] items-baseline gap-2"
            >
              <span className="font-mono text-[10.5px] tabular-nums" style={{ color: "var(--asp-faint)" }}>
                {a.time}
              </span>
              <span className="text-[12.5px] leading-[1.45]" style={{ color: a.live ? "var(--asp-ink)" : "var(--asp-muted)" }}>
                {a.text}
              </span>
            </motion.li>
          ))}
        </ol>
      )}

      {actions && actions.length > 0 && (
        <div className="mt-3.5 flex justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--asp-panel-ring)" }}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              data-demo={`action-${slug(a.label)}`}
              onClick={() => onAction(a)}
              className={[
                "relative h-8 rounded-[8px] px-3 text-[12.5px] font-medium tracking-[-0.01em] outline-none transition-[background-color,transform] duration-150",
                "active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asp-ink)]",
                "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']",
                a.primary ? "hover:opacity-90" : "hover:bg-[var(--asp-surface-hover)]",
              ].join(" ")}
              style={
                a.primary
                  ? { background: "var(--asp-ink)", color: "var(--asp-on-ink)" }
                  : { color: "var(--asp-ink)", boxShadow: "inset 0 0 0 1px var(--asp-ring)" }
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* AgentStatusPill                                                     */
/* ------------------------------------------------------------------ */

export function AgentStatusPill({
  state = "idle",
  label,
  elapsed = true,
  since,
  until,
  size = "md",
  theme = "dark",
  agent,
  heading,
  summary,
  command,
  activity,
  actions,
  align = "end",
  side = "bottom",
  tones,
  className,
  style,
  ...rest
}: AgentStatusPillProps) {
  const reduce = useReducedMotion() ?? false;
  const panelId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inView = useInView(wrapRef);
  const [contentRef, width] = useNaturalWidth<HTMLSpanElement>();

  const p = PALETTE[theme];
  const s = SIZES[size];
  const meta = STATE_META[state];
  const tone = tones?.[state] ?? STATE_TONE[state] ?? p.ink;
  const text = label?.trim() || meta.label;

  // The clock only ticks while a state is open-ended and the pill is on screen.
  const ticking = elapsed && state !== "idle" && since !== undefined && until === undefined;
  const now = useNow(ticking && inView);
  const elapsedMs = since === undefined ? null : until !== undefined ? until - since : now === null ? null : now - since;
  const showClock = elapsed && state !== "idle" && elapsedMs !== null;
  const clock = showClock ? formatElapsed(elapsedMs) : null;

  /* Panel: hover peeks after a short delay, a click pins it open. */
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const suppressHover = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const clearTimer = () => window.clearTimeout(timer.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const close = useCallback((refocus: boolean) => {
    window.clearTimeout(timer.current);
    pinned.current = false;
    setOpen(false);
    const active = document.activeElement;
    if (refocus && active && active !== buttonRef.current && wrapRef.current?.contains(active)) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, []);

  // A pinned panel closes on any press outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  const onEnter = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse" || suppressHover.current) return;
    clearTimer();
    if (!open) timer.current = window.setTimeout(() => setOpen(true), TIMING.hoverOpenMs);
  };
  // Intent, not transit: a pointer passing over the pill on its way somewhere else restarts the wait.
  const onMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse" || suppressHover.current || open || pinned.current) return;
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(true), TIMING.hoverOpenMs);
  };
  const onLeave = (e: ReactPointerEvent) => {
    suppressHover.current = false;
    if (e.pointerType !== "mouse") return;
    clearTimer();
    if (!pinned.current) timer.current = window.setTimeout(() => setOpen(false), TIMING.hoverCloseMs);
  };
  const onClick = () => {
    clearTimer();
    if (open && pinned.current) close(false);
    else {
      pinned.current = true;
      setOpen(true);
    }
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      close(false);
      buttonRef.current?.focus({ preventScroll: true });
    }
  };
  const onAction = (a: AgentStatusAction) => {
    suppressHover.current = true;
    close(true);
    a.onSelect();
  };

  // Only the states that ask something of the user tint the pill itself.
  const tinted = meta.tinted;
  const labelColor = tinted ? `color-mix(in oklab, ${tone} ${p.tintMix}%, ${p.ink})` : p.ink;
  const surface = tinted ? `color-mix(in oklab, ${tone} 9%, ${p.surface})` : "var(--asp-surface)";
  const ring = tinted ? `color-mix(in oklab, ${tone} 34%, transparent)` : "var(--asp-ring)";

  const vars = {
    "--asp-ink": p.ink,
    "--asp-muted": p.muted,
    "--asp-faint": p.faint,
    "--asp-surface": p.surface,
    "--asp-surface-hover": p.surfaceHover,
    "--asp-ring": p.ring,
    "--asp-highlight": p.highlight,
    "--asp-panel": p.panel,
    "--asp-panel-ring": p.panelRing,
    "--asp-panel-shadow": p.panelShadow,
    "--asp-well": p.well,
    "--asp-on-ink": p.onInk,
  } as CSSProperties;

  return (
    <span
      ref={wrapRef}
      {...rest}
      className={`relative inline-flex align-middle font-sans ${className ?? ""}`}
      style={{ ...vars, ...style }}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onKeyDown={onKeyDown}
    >
      <style>{`@keyframes asp-ping{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(2.9);opacity:0}}`}</style>

      <motion.button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onClick}
        initial={false}
        animate={{ width: width ?? "auto" }}
        transition={reduce ? INSTANT : SPRING_UI}
        className={[
          "group/asp relative inline-flex shrink-0 cursor-pointer select-none rounded-full outline-none [-webkit-tap-highlight-color:transparent]",
          "transition-[translate] duration-100 active:translate-y-px",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asp-ink)]",
          // Keeps a 44px touch target without making the pill itself tall.
          "before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']",
        ].join(" ")}
        style={{ height: s.height }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full transition-[background-color,box-shadow] duration-200"
          style={{ background: surface, boxShadow: `inset 0 0 0 1px ${ring}, inset 0 1px 0 var(--asp-highlight)` }}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-hover/asp:opacity-100" style={{ background: "var(--asp-surface-hover)" }} />

        {/* Clip box: the pill's width animates while the content inside keeps its natural width. */}
        <span className="relative block h-full w-full overflow-hidden rounded-full">
          <span ref={contentRef} className="relative inline-flex h-full w-max items-center whitespace-nowrap" style={{ paddingInline: s.padX, gap: s.gap }}>
            <StatusDot state={state} tone={tone} size={s.dot} animate={inView} reduce={reduce} />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={text}
                {...swap(reduce)}
                className="font-medium tracking-[-0.005em]"
                style={{ fontSize: s.text, color: labelColor, lineHeight: 1 }}
              >
                {text}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              {clock && elapsedMs !== null && (
                <motion.span key="clock" {...swap(reduce)} className="inline-flex items-center" style={{ gap: s.gap }}>
                  <span aria-hidden="true" className="w-px" style={{ height: s.sep, background: "var(--asp-ring)" }} />
                  <time dateTime={isoDuration(elapsedMs)} className="font-mono tabular-nums" style={{ fontSize: s.time, color: "var(--asp-muted)", lineHeight: 1 }}>
                    {clock}
                  </time>
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </span>
      </motion.button>

      {/* Announce state changes, never the ticking clock. */}
      <span role="status" className="sr-only">
        {agent ? `${agent}: ${text}` : text}
      </span>

      <AnimatePresence>
        {open && (
          <ActivityPanel
            id={panelId}
            state={state}
            tone={tone}
            heading={heading ?? meta.heading}
            agent={agent}
            summary={summary}
            command={command}
            activity={activity}
            actions={actions}
            clock={clock}
            align={align}
            side={side}
            reduce={reduce}
            onAction={onAction}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

type ActionSpec = { label: string; to?: AgentStatus; primary?: boolean };
type StateCopy = { heading?: string; summary?: string; command?: string; activity?: AgentActivity[]; actions?: ActionSpec[] };
type DemoAgent = {
  id: string;
  name: string;
  task: string;
  initial: AgentStatus;
  /** Seconds already on the clock when the demo opens. */
  runSeconds: number;
  waitSeconds?: number;
  copy: Partial<Record<AgentStatus, StateCopy>>;
};

const STAGE = {
  backdrop: "#000000",
  card: "#0b0b0c",
  line: "rgba(255,255,255,0.08)",
  ink: "#f4f4f5",
  muted: "#8a8a93",
  tile: "#18181b",
} as const;

const FEATURED: DemoAgent = {
  id: "fixer",
  name: "Fixer",
  task: "Migrate billing webhooks to v2",
  initial: "waiting",
  runSeconds: 372,
  waitSeconds: 74,
  copy: {
    waiting: {
      heading: "Approve a migration?",
      summary: "Fixer wants to apply one pending migration to staging before it reruns the webhook tests.",
      command: "pnpm prisma migrate deploy",
      activity: [
        { id: "w1", time: "4m", text: "Rewrote 4 handlers in src/webhooks" },
        { id: "w2", time: "1m", text: "Generated 0042_webhook_events" },
      ],
      actions: [
        { label: "Deny", to: "idle" },
        { label: "Approve", to: "running", primary: true },
      ],
    },
    running: {
      heading: "Applying migration",
      summary: "Staging only. Production stays untouched until you merge.",
      activity: [
        { id: "r1", time: "4m", text: "Rewrote 4 handlers in src/webhooks" },
        { id: "r2", time: "1m", text: "You approved the migration" },
        { id: "r3", time: "now", text: "Applying 0042_webhook_events on staging", live: true },
      ],
      actions: [{ label: "Stop", to: "idle" }],
    },
    error: {
      heading: "Migration failed",
      summary: "Column event_id already exists on webhook_events. Nothing was written.",
      command: "prisma migrate resolve --rolled-back 0042",
      actions: [{ label: "Retry", to: "running", primary: true }],
    },
    done: {
      heading: "Ready for review",
      summary: "Opened PR #483: 6 files changed, all 41 webhook tests passing.",
      actions: [{ label: "Open PR", primary: true }],
    },
    idle: {
      heading: "Paused",
      summary: "Stopped before the migration. Staging hasn’t changed.",
      actions: [{ label: "Resume", to: "running", primary: true }],
    },
  },
};

const LIST: DemoAgent[] = [
  {
    id: "lint",
    name: "lint-sweeper",
    task: "Fix 23 ESLint warnings in packages/ui",
    initial: "running",
    runSeconds: 48,
    copy: {
      running: {
        summary: "Working through packages/ui, one file at a time.",
        activity: [
          { id: "l1", time: "2m", text: "Fixed 17 of 23 warnings" },
          { id: "l2", time: "now", text: "Editing Button.tsx", live: true },
        ],
        actions: [{ label: "Stop", to: "idle" }],
      },
    },
  },
  {
    id: "docs",
    name: "docs-writer",
    task: "Draft the 4.12 changelog",
    initial: "done",
    runSeconds: 187,
    copy: {
      done: {
        summary: "Read 31 merged PRs and opened #482 with the draft.",
        actions: [{ label: "View draft", primary: true }],
      },
    },
  },
  {
    id: "tests",
    name: "test-doctor",
    task: "Quarantine the flaky checkout e2e suite",
    initial: "error",
    runSeconds: 112,
    copy: {
      error: {
        summary: "Playwright couldn’t reach localhost:3000 after 30 seconds.",
        command: "pnpm test:e2e --grep checkout",
        actions: [{ label: "Retry", to: "running", primary: true }],
      },
    },
  },
  {
    id: "deps",
    name: "dep-bot",
    task: "Weekly dependency bump",
    initial: "idle",
    runSeconds: 0,
    copy: {
      idle: {
        summary: "Next run Monday at 09:00. Last week it bumped 6 packages.",
        actions: [{ label: "Run now", to: "running", primary: true }],
      },
    },
  },
];

type Run = { state: AgentStatus; since?: number; until?: number; runStart: number };

/** One agent's state and clocks: a resumed run keeps its time, a fresh one starts at zero. */
function useRun(agent: DemoAgent) {
  const [run, setRun] = useState<Run>(() => {
    const now = Date.now();
    const runStart = now - agent.runSeconds * 1000;
    switch (agent.initial) {
      case "waiting":
        return { state: "waiting", since: now - (agent.waitSeconds ?? 0) * 1000, runStart };
      case "running":
        return { state: "running", since: runStart, runStart };
      case "error":
      case "done":
        return { state: agent.initial, since: runStart, until: now, runStart };
      default:
        return { state: "idle", runStart };
    }
  });

  const go = useCallback((next: AgentStatus) => {
    setRun((r) => {
      if (r.state === next) return r;
      const now = Date.now();
      switch (next) {
        case "running": {
          const runStart = r.state === "waiting" ? r.runStart : now;
          return { state: "running", since: runStart, runStart };
        }
        case "waiting":
          return { state: "waiting", since: now, runStart: r.runStart };
        case "error":
        case "done":
          return { state: next, since: r.runStart, until: now, runStart: r.runStart };
        default:
          return { state: "idle", runStart: r.runStart };
      }
    });
  }, []);

  return [run, go] as const;
}

function copyFor(agent: DemoAgent, state: AgentStatus, go: (s: AgentStatus) => void) {
  const c = agent.copy[state] ?? (state === "running" ? { activity: [{ id: "x", time: "now", text: agent.task, live: true }], actions: [{ label: "Stop", to: "idle" as const }] } : {});
  return {
    heading: c.heading,
    summary: c.summary,
    command: c.command,
    activity: c.activity,
    actions: c.actions?.map((a) => ({ label: a.label, primary: a.primary, onSelect: () => a.to && go(a.to) })),
  };
}

function enter(play: boolean, delay: number, reduce: boolean) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(8px)" },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined,
    transition: reduce ? { duration: 0.15 } : { duration: 0.5, delay, ease: EASE_OUT },
  };
}

function Monogram({ text }: { text: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[10px] font-mono text-[11px] font-medium"
      style={{ background: STAGE.tile, color: "#a1a1aa", boxShadow: `inset 0 0 0 1px ${STAGE.line}` }}
    >
      {text}
    </span>
  );
}

function RunRow({ agent, index, play, reduce }: { agent: DemoAgent; index: number; play: boolean; reduce: boolean }) {
  const [run, go] = useRun(agent);
  return (
    <motion.li
      {...enter(play, 0.22 + index * 0.06, reduce)}
      className="relative flex items-center gap-4 border-t px-5 py-3.5 has-[[aria-expanded=true]]:z-20 @md:px-6"
      style={{ borderColor: STAGE.line }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[12.5px]" style={{ color: STAGE.ink }}>
          {agent.name}
        </p>
        <p className="mt-0.5 truncate text-[13px]" style={{ color: STAGE.muted }}>
          {agent.task}
        </p>
      </div>
      <AgentStatusPill
        size="sm"
        agent={agent.name}
        state={run.state}
        since={run.since}
        until={run.until}
        side={index >= LIST.length - 2 ? "top" : "bottom"}
        {...copyFor(agent, run.state, go)}
      />
    </motion.li>
  );
}

export default function AgentStatusPillDemo({ state: forced, ...overrides }: Partial<AgentStatusPillProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const cardRef = useRef<HTMLElement>(null);
  const play = useInView(cardRef, { once: true, amount: 0.3 });
  const [run, go] = useRun(FEATURED);

  // The State control drives the featured run; Approve, Retry and the rest keep working on top of it.
  const target = forced ?? FEATURED.initial;
  useEffect(() => {
    go(target);
  }, [target, go]);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-16 font-sans antialiased sm:px-8" style={{ background: STAGE.backdrop, color: STAGE.ink }}>
      <div className="@container w-full max-w-[640px]">
        <motion.section
          ref={cardRef}
          aria-labelledby={`${uid}-title`}
          {...enter(play, 0, reduce)}
          className="rounded-[18px]"
          style={{ background: STAGE.card, boxShadow: `inset 0 0 0 1px ${STAGE.line}, inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)` }}
        >
          <motion.header {...enter(play, 0.08, reduce)} className="relative flex items-center gap-3 px-5 pb-5 pt-5 has-[[aria-expanded=true]]:z-20 @md:gap-3.5 @md:px-6">
            <Monogram text="Fx" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[11px]" style={{ color: STAGE.muted }}>
                <span className="hidden @md:inline">northwind / agents / </span>fixer
              </p>
              <h2 id={`${uid}-title`} className="mt-0.5 text-balance text-[15px] font-medium leading-[1.3] tracking-[-0.015em] @md:truncate">
                {FEATURED.task}
              </h2>
            </div>
            <AgentStatusPill
              data-demo="status-pill"
              agent={FEATURED.name}
              state={run.state}
              since={run.since}
              until={run.until}
              {...copyFor(FEATURED, run.state, go)}
              {...overrides}
            />
          </motion.header>

          <motion.p {...enter(play, 0.16, reduce)} className="border-t px-5 pb-2 pt-4 font-mono text-[10.5px] uppercase tracking-[0.08em] @md:px-6" style={{ borderColor: STAGE.line, color: STAGE.muted }}>
            Other runs
          </motion.p>
          <ul className="[&>li:first-child]:border-t-0">
            {LIST.map((a, i) => (
              <RunRow key={a.id} agent={a} index={i} play={play} reduce={reduce} />
            ))}
          </ul>
        </motion.section>

        <motion.p {...enter(play, 0.5, reduce)} className="mt-4 text-center font-mono text-[11px]" style={{ color: STAGE.muted }}>
          Hover or click a status for its activity · Esc closes
        </motion.p>
      </div>
    </div>
  );
}
