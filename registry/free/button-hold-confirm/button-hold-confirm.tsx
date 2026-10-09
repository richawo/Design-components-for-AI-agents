"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useAnimate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type Phase = "idle" | "holding" | "pending" | "done" | "error";

export type HoldConfirmButtonProps = {
  /** Resting label. */
  label?: string;
  /** Shown while an async onConfirm is in flight. */
  pendingLabel?: string;
  /** Shown once confirmed. */
  doneLabel?: string;
  /** Shown if onConfirm rejects. */
  errorLabel?: string;
  /** Tooltip after a quick tap, so people learn it's a hold. */
  hint?: string;
  /** Read to screen readers when the action completes. Defaults to doneLabel. */
  announcement?: string;
  /** How long to hold, in ms. */
  duration?: number;
  variant?: "danger" | "neutral";
  size?: "sm" | "md";
  /** Leading icon. Defaults to a trash can (danger) or an archive box (neutral). Pass null for none. */
  icon?: ReactNode | null;
  /** Runs at 100%. Return a promise to show the pending state, and reject it to show the error state. */
  onConfirm?: () => void | Promise<unknown>;
  /** Ms after success before the button resets. null keeps it confirmed. */
  resetAfter?: number | null;
  disabled?: boolean;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Look                                                                 */
/* ------------------------------------------------------------------ */

const ease = [0.22, 1, 0.36, 1] as const;

const tones = {
  danger: {
    surface: "bg-[#150a0b] shadow-[inset_0_0_0_1px_rgba(248,113,113,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]",
    hover: "hover:bg-[#1e0e10] hover:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]",
    text: "text-[#ff9b9b]",
    fill: "#e5484d",
    edge: "#ffb3b0",
    inverse: "text-white",
    ring: "focus-visible:outline-[#ff9b9b]",
  },
  neutral: {
    surface: "bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]",
    hover: "hover:bg-white/[0.08] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]",
    text: "text-white/80",
    fill: "#ececee",
    edge: "#ffffff",
    inverse: "text-[#0b0b0c]",
    ring: "focus-visible:outline-white",
  },
} as const;

const sizes = {
  sm: { box: "h-9 rounded-[9px] px-3 text-[13px]", gap: "gap-1.5", icon: 14 },
  md: { box: "h-11 rounded-[11px] px-[18px] text-[14px]", gap: "gap-2", icon: 16 },
} as const;

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function HoldConfirmButton({
  label = "Hold to delete",
  pendingLabel = "Deleting…",
  doneLabel = "Deleted",
  errorLabel = "Couldn’t delete",
  hint = "Press and hold",
  announcement,
  duration = 1200,
  variant = "danger",
  size = "md",
  icon,
  onConfirm,
  resetAfter = 2400,
  disabled = false,
  className = "",
}: HoldConfirmButtonProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const tone = tones[variant];
  const dim = sizes[size];

  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [hintOn, setHintOn] = useState(false);
  const [said, setSaid] = useState("");

  const progress = useMotionValue(0);
  const clip = useTransform(progress, (v) => `inset(0 ${(1 - Math.min(1, Math.max(0, v))) * 100}% 0 0)`);
  const edgeX = useTransform(progress, (v) => `${Math.min(1, Math.max(0, v)) * 100}%`);
  const edgeOpacity = useTransform(progress, (v) => (v > 0.004 && v < 0.996 ? 1 : 0));

  const run = useRef<AnimationPlaybackControls | null>(null);
  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const alive = useRef(true);
  const [scope, animateScope] = useAnimate();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      run.current?.stop();
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(() => alive.current && fn(), ms));
  };

  const shake = () => {
    if (reduce || !scope.current) return;
    animateScope(scope.current, { x: [0, -3, 3, -2, 2, -1, 0] }, { duration: 0.34, ease: "easeOut" });
  };

  const drain = (soft = false) => {
    run.current?.stop();
    run.current = animate(
      progress,
      0,
      reduce ? { duration: 0.15 } : soft ? { duration: 0.45, ease } : { type: "spring", stiffness: 420, damping: 40 },
    );
  };

  const finish = (ok: boolean) => {
    if (!alive.current) return;
    if (ok) {
      setPhase("done");
      setSaid(announcement ?? doneLabel);
      if (resetAfter !== null)
        later(() => {
          drain(true);
          setPhase("idle");
          setSaid("");
        }, resetAfter);
    } else {
      setPhase("error");
      setSaid(errorLabel);
      shake();
      drain();
      later(() => {
        if (phaseRef.current === "error") {
          setPhase("idle");
          setSaid("");
        }
      }, 2600);
    }
  };

  const complete = () => {
    if (phaseRef.current !== "holding") return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    shake();
    let result: void | Promise<unknown> = undefined;
    try {
      result = onConfirm?.();
    } catch {
      finish(false);
      return;
    }
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setPhase("pending");
      (result as Promise<unknown>).then(
        () => finish(true),
        () => finish(false),
      );
    } else finish(true);
  };

  const begin = () => {
    const p = phaseRef.current;
    if (disabled || p === "pending" || p === "done" || p === "holding") return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setHintOn(false);
    setPhase("holding");
    startedAt.current = performance.now();
    run.current?.stop();
    const remaining = (1 - progress.get()) * duration;
    run.current = animate(progress, 1, { duration: remaining / 1000, ease: "linear", onComplete: complete });
  };

  const release = () => {
    if (phaseRef.current !== "holding" || progress.get() >= 1) return;
    setPhase("idle");
    drain();
    // A quick tap gets a hint (and a little nudge of the fill) instead of nothing.
    if (performance.now() - startedAt.current < 260) {
      if (!reduce) {
        run.current?.stop();
        run.current = animate(progress, [progress.get(), 0.1, 0], { duration: 0.5, times: [0, 0.35, 1], ease: "easeOut" });
      }
      setHintOn(true);
      later(() => setHintOn(false), 1700);
    }
  };

  const busy = phase === "pending" || phase === "done";
  const describe = `Press and hold for ${(duration / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} seconds to confirm.`;
  const lead = icon === undefined ? variant === "danger" ? <TrashIcon size={dim.icon} /> : <ArchiveIcon size={dim.icon} /> : icon;

  const view = (p: Phase): { key: string; node: ReactNode; text: string } => {
    if (p === "pending") return { key: "pending", node: <Spinner size={dim.icon} />, text: pendingLabel };
    if (p === "done") return { key: "done", node: <CheckIcon size={dim.icon} reduce={reduce} />, text: doneLabel };
    if (p === "error") return { key: "error", node: <AlertIcon size={dim.icon} />, text: errorLabel };
    return { key: "idle", node: lead, text: label };
  };
  const current = view(phase);
  const all: Phase[] = ["idle", "pending", "done", "error"];

  /** One layer of label content. Rendered twice: in the button colour, and inverted inside the fill. */
  const layer = (
    <>
      {/* Every label sits invisibly in the same grid cell, so the button is as wide as its longest state and never resizes. */}
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 grid">
        {all.map((p) => {
          const v = view(p);
          return (
            <span key={p} className={`col-start-1 row-start-1 flex items-center justify-center whitespace-nowrap ${dim.gap}`}>
              {v.node}
              {v.text}
            </span>
          );
        })}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={current.key}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 7, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -7, filter: "blur(3px)", transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: reduce ? 0.12 : 0.26, ease }}
          className={`col-start-1 row-start-1 flex items-center justify-center whitespace-nowrap ${dim.gap}`}
        >
          {current.node}
          {current.text}
        </motion.span>
      </AnimatePresence>
    </>
  );

  return (
    <motion.span ref={scope} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={`${uid}-d`}
        aria-busy={phase === "pending" || undefined}
        data-phase={phase}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          begin();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerMove={(e) => {
          // Sliding well off the button counts as letting go.
          if (phaseRef.current !== "holding") return;
          const r = e.currentTarget.getBoundingClientRect();
          const m = 16;
          if (e.clientX < r.left - m || e.clientX > r.right + m || e.clientY < r.top - m || e.clientY > r.bottom + m) release();
        }}
        onKeyDown={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          if (!e.repeat) begin();
        }}
        onKeyUp={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          release();
        }}
        onBlur={release}
        onContextMenu={(e) => e.preventDefault()}
        className={`group relative isolate grid touch-manipulation select-none place-items-center font-sans font-medium tracking-[-0.01em] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] transition-[background-color,box-shadow,scale,opacity] ease-out focus-visible:outline-2 focus-visible:outline-offset-2 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:cursor-not-allowed disabled:opacity-40 ${dim.box} ${tone.surface} ${tone.text} ${tone.ring} ${
          busy || disabled ? "" : tone.hover
        } ${phase === "holding" ? "scale-[0.98] duration-100" : "scale-100 duration-150"} ${busy ? "cursor-default" : "cursor-pointer"}`}
      >
        {layer}

        {/* The fill and its inverted label share one clip, so the text changes colour exactly at the edge. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <motion.span className="absolute inset-0 grid place-items-center" style={{ clipPath: clip, background: tone.fill }}>
            <span className={`grid place-items-center ${size === "sm" ? "px-3" : "px-[18px]"} ${tone.inverse}`}>{layer}</span>
          </motion.span>
          {/* A hot leading edge: a hairline plus a short soft trail, so the fill reads as moving. */}
          <motion.span className="absolute inset-y-0 -ml-6 w-6" style={{ left: edgeX, opacity: edgeOpacity }}>
            <span className="absolute inset-0" style={{ background: `linear-gradient(90deg, transparent, ${tone.edge}55)` }} />
            <span className="absolute inset-y-0 right-0 w-px" style={{ background: tone.edge }} />
          </motion.span>
        </span>
      </button>

      <AnimatePresence>
        {hintOn && (
          <motion.span
            role="tooltip"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease }}
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[7px] bg-[#f4f4f5] px-2 py-1 font-sans text-[12px] font-medium text-[#0b0b0c] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)]"
          >
            {hint}
            <span aria-hidden="true" className="absolute left-1/2 top-full -mt-[3px] size-1.5 -translate-x-1/2 rotate-45 bg-[#f4f4f5]" />
          </motion.span>
        )}
      </AnimatePresence>

      <span id={`${uid}-d`} className="sr-only">
        {describe}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (drawn, 16-unit grid)                                          */
/* ------------------------------------------------------------------ */

function TrashIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2.75 4.25h10.5M6.25 4.25V3a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v1.25M4 4.25l.6 8.4a1.25 1.25 0 0 0 1.25 1.1h4.3a1.25 1.25 0 0 0 1.25-1.1l.6-8.4M6.75 7v4M9.25 7v4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArchiveIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2.5 3.25h11v2.5h-11zM3.5 5.75v6.5c0 .7.55 1.25 1.25 1.25h6.5c.7 0 1.25-.55 1.25-1.25v-6.5M6.5 8.25h3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ size, reduce }: { size: number; reduce: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <motion.path
        d="M3.25 8.4l3 3 6.5-6.75"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.34, ease, delay: 0.06 }}
      />
    </svg>
  );
}

function AlertIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.35" />
      <path d="M8 5.1v3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="10.75" r="0.85" fill="currentColor" />
    </svg>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path d="M13.75 8A5.75 5.75 0 0 0 8 2.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

type DemoProject = { id: string; name: string; meta: string; mono: string; tint: string; action: "delete" | "archive" };

const demoProjects: DemoProject[] = [
  { id: "halcyon", name: "halcyon-web", meta: "212 deploys · 2h ago", mono: "HW", tint: "#f5c451", action: "delete" },
  { id: "ledger", name: "ledger-sync", meta: "38 deploys · yesterday", mono: "LS", tint: "#7dd3a8", action: "delete" },
  { id: "atlas", name: "atlas-staging", meta: "Idle for 41 days", mono: "AS", tint: "#8ab8ff", action: "archive" },
];

function HoldConfirmButtonDemo() {
  const [projects, setProjects] = useState(demoProjects);
  const [leaving, setLeaving] = useState<string[]>([]);
  const reduce = useReducedMotion() ?? false;

  const cardRef = useRef<HTMLElement>(null);

  const remove = (id: string) => {
    window.setTimeout(() => setLeaving((l) => [...l, id]), 700);
    window.setTimeout(() => setProjects((ps) => ps.filter((p) => p.id !== id)), 760);
    // Once the row has gone, hand keyboard focus to the next thing to act on instead of dropping it on <body>.
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && cardRef.current?.contains(active)) return;
      cardRef.current?.querySelector<HTMLButtonElement>("ul button, [data-restore]")?.focus();
    }, 1150);
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-black px-4 py-16 text-white sm:px-8">
      <div className="@container w-full max-w-[600px]">
        <section
          ref={cardRef}
          aria-labelledby="hcb-projects"
          className="rounded-[18px] bg-[#0b0b0c] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.05),0_40px_80px_-40px_rgba(0,0,0,0.9)]"
        >
          <header className="flex items-center justify-between px-5 pb-3 pt-5 @md:px-6">
            <h2 id="hcb-projects" className="text-[14px] font-medium tracking-[-0.01em] text-white/90">
              Projects
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-white/35">{projects.length} of 3</span>
          </header>

          <ul className="px-2 pb-2">
            <AnimatePresence initial={false}>
              {projects.map((p) => (
                <motion.li
                  key={p.id}
                  exit={reduce ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, height: 0, transition: { duration: 0.32, ease: [0.65, 0, 0.35, 1] } }}
                  className={leaving.includes(p.id) ? "overflow-hidden" : ""}
                >
                  <div className="flex items-center gap-3 rounded-[12px] px-3 py-3 transition-colors duration-150 hover:bg-white/[0.025] @md:px-4">
                    <span
                      aria-hidden="true"
                      className="grid size-9 shrink-0 place-items-center rounded-[9px] font-mono text-[11px] font-medium"
                      style={{ background: `${p.tint}14`, color: p.tint, boxShadow: `inset 0 0 0 1px ${p.tint}2e` }}
                    >
                      {p.mono}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] text-white/90">{p.name}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-white/40">{p.meta}</span>
                    </span>
                    {p.action === "delete" ? (
                      <HoldConfirmButton
                        size="sm"
                        label="Delete"
                        doneLabel="Deleted"
                        errorLabel="Failed"
                        announcement={`${p.name} deleted`}
                        duration={1000}
                        resetAfter={null}
                        onConfirm={() => remove(p.id)}
                      />
                    ) : (
                      <HoldConfirmButton
                        size="sm"
                        variant="neutral"
                        label="Archive"
                        pendingLabel="Archiving…"
                        doneLabel="Archived"
                        errorLabel="Failed"
                        announcement={`${p.name} archived`}
                        duration={800}
                        resetAfter={null}
                        onConfirm={() => remove(p.id)}
                      />
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <AnimatePresence initial={false}>
            {projects.length === 0 && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease, delay: 0.15 }}
                className="flex flex-col items-center px-6 pb-9 pt-4 text-center"
              >
                <p className="text-[14px] text-white/80">Nothing left to delete.</p>
                <p className="mt-1 text-[13px] text-white/40">Thorough. The demo can put them back.</p>
                <button
                  type="button"
                  data-restore
                  onClick={() => {
                    setLeaving([]);
                    setProjects(demoProjects);
                  }}
                  className="mt-5 inline-flex h-9 items-center rounded-[9px] px-3.5 text-[13px] font-medium text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none transition-[background-color,color,scale] duration-150 hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] active:scale-[0.97]"
                >
                  Restore projects
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-4 border-t border-white/[0.07] px-5 py-5 @md:flex-row @md:items-center @md:justify-between @md:px-6">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-white/90">Delete workspace</p>
              <p className="mt-1 max-w-[38ch] text-[13px] leading-[1.5] text-white/45">
                Removes every project, preview and domain in Northwind. There’s no undo.
              </p>
            </div>
            <HoldConfirmButton
              label="Hold to delete workspace"
              pendingLabel="Deleting workspace…"
              errorLabel="Detach 2 domains first"
              duration={1500}
              className="self-start @md:self-auto"
              onConfirm={() => new Promise((_, reject) => window.setTimeout(() => reject(new Error("domains")), 1100))}
            />
          </div>
        </section>
        <p className="mt-4 text-center font-mono text-[11px] text-white/30">Hold Space or Enter to confirm from the keyboard.</p>
      </div>
    </div>
  );
}

export default HoldConfirmButtonDemo;
