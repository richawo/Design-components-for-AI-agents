"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useAnimate,
  useInView,
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
  /** The fill colour. Defaults to red for danger and the theme’s ink for neutral. */
  accent?: string;
  /** The surface the button sits on, so its label and tints keep their contrast. */
  theme?: "dark" | "light";
  disabled?: boolean;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

/** Ink per theme, the default danger fill, and the neutral fill (the theme’s own ink, near enough). */
const PALETTE = {
  dark: { ink: "#f4f4f5", danger: "#e5484d", neutral: "#ececee", tip: "#f4f4f5", onTip: "#0b0b0c" },
  light: { ink: "#18181b", danger: "#dc2626", neutral: "#18181b", tip: "#18181b", onTip: "#ffffff" },
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** One place for the feel. Seconds unless noted. */
const MOTION = {
  tapMs: 260, // a release sooner than this was a tap, not a hold
  nudge: 0.1, // a tap pushes the fill this far, then lets it go
  nudgeFor: 0.5,
  drainFor: 0.45, // the soft drain after success
  hintMs: 1700,
  errorMs: 2600,
  slip: 16, // px off the button before a held pointer counts as letting go
  shake: [0, -3, 3, -2, 2, -1, 0],
  shakeFor: 0.34,
  swap: 0.26, // label cross-fade
  swapExit: 0.16,
  check: 0.34,
  fade: 0.15, // reduced motion
} as const;
const SPRING_BACK = { type: "spring", stiffness: 420, damping: 40 } as const;

/**
 * Every colour derives from two variables: the tint (the fill for danger, the ink for neutral)
 * and the ink. Mixing with `transparent` keeps the surface honest on whatever it sits on.
 */
const SURFACE =
  "bg-[color-mix(in_srgb,var(--hc-tint)_8%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--hc-tint)_24%,transparent),inset_0_1px_0_rgba(255,255,255,0.04)] text-[color-mix(in_srgb,var(--hc-tint)_62%,var(--hc-ink))] focus-visible:outline-[color-mix(in_srgb,var(--hc-tint)_62%,var(--hc-ink))]";
const SURFACE_HOVER =
  "hover:bg-[color-mix(in_srgb,var(--hc-tint)_12%,transparent)] hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--hc-tint)_36%,transparent),inset_0_1px_0_rgba(255,255,255,0.05)]";

const SIZES = {
  sm: { box: "h-9 rounded-[9px] px-3 text-[13px]", pad: "px-3", gap: "gap-1.5", icon: 14 },
  md: { box: "h-11 rounded-[11px] px-[18px] text-[14px]", pad: "px-[18px]", gap: "gap-2", icon: 16 },
} as const;

function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** setTimeout that is cleared on unmount, so a late callback never lands on a dead component. */
function useTimers() {
  const ids = useRef<number[]>([]);
  useEffect(() => () => ids.current.forEach(clearTimeout), []);
  const later = useCallback((fn: () => void, ms: number) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);
  const clear = useCallback(() => {
    ids.current.forEach(clearTimeout);
    ids.current = [];
  }, []);
  return { later, clear };
}

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
  accent,
  theme = "dark",
  disabled = false,
  className = "",
}: HoldConfirmButtonProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const dim = SIZES[size];
  const palette = PALETTE[theme];
  const fill = accent ?? (variant === "danger" ? palette.danger : palette.neutral);
  const vars = {
    "--hc-ink": palette.ink,
    "--hc-tint": variant === "danger" ? fill : palette.ink,
    "--hc-fill": fill,
    "--hc-on-fill": inkOn(fill),
    "--hc-tip": palette.tip,
    "--hc-on-tip": palette.onTip,
  } as CSSProperties;

  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [hintOn, setHintOn] = useState(false);
  const [said, setSaid] = useState("");

  // One motion value drives the clip, the inverted label and the hot edge: no render per frame.
  const progress = useMotionValue(0);
  const clip = useTransform(progress, (v) => `inset(0 ${(1 - Math.min(1, Math.max(0, v))) * 100}% 0 0)`);
  const edgeX = useTransform(progress, (v) => `${Math.min(1, Math.max(0, v)) * 100}%`);
  const edgeOpacity = useTransform(progress, (v) => (v > 0.004 && v < 0.996 ? 1 : 0));

  const run = useRef<AnimationPlaybackControls | null>(null);
  const startedAt = useRef(0);
  const { later, clear } = useTimers();
  const [scope, animateScope] = useAnimate();

  useEffect(() => () => run.current?.stop(), []);

  const shake = () => {
    if (reduce || !scope.current) return;
    animateScope(scope.current, { x: [...MOTION.shake] }, { duration: MOTION.shakeFor, ease: "easeOut" });
  };

  const drain = (soft = false) => {
    run.current?.stop();
    run.current = animate(progress, 0, reduce ? { duration: MOTION.fade } : soft ? { duration: MOTION.drainFor, ease: EASE_OUT } : SPRING_BACK);
  };

  const finish = (ok: boolean) => {
    if (ok) {
      setPhase("done");
      setSaid(announcement ?? doneLabel);
      if (resetAfter !== null)
        later(() => {
          drain(true);
          setPhase("idle");
          setSaid("");
        }, resetAfter);
      return;
    }
    setPhase("error");
    setSaid(errorLabel);
    shake();
    drain();
    later(() => {
      if (phaseRef.current !== "error") return;
      setPhase("idle");
      setSaid("");
    }, MOTION.errorMs);
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
      // The scope ref empties on unmount: a promise that settles after that is ignored.
      (result as Promise<unknown>).then(
        () => scope.current && finish(true),
        () => scope.current && finish(false),
      );
    } else finish(true);
  };

  const begin = () => {
    const p = phaseRef.current;
    if (disabled || p === "pending" || p === "done" || p === "holding") return;
    clear();
    setHintOn(false);
    setPhase("holding");
    startedAt.current = performance.now();
    run.current?.stop();
    // A re-grab continues from wherever the fill has drained to.
    const remaining = (1 - progress.get()) * duration;
    run.current = animate(progress, 1, { duration: remaining / 1000, ease: "linear", onComplete: complete });
  };

  const release = () => {
    if (phaseRef.current !== "holding" || progress.get() >= 1) return;
    setPhase("idle");
    drain();
    // A quick tap gets a hint (and a little nudge of the fill) instead of nothing.
    if (performance.now() - startedAt.current < MOTION.tapMs) {
      if (!reduce) {
        run.current?.stop();
        run.current = animate(progress, [progress.get(), MOTION.nudge, 0], { duration: MOTION.nudgeFor, times: [0, 0.35, 1], ease: "easeOut" });
      }
      setHintOn(true);
      later(() => setHintOn(false), MOTION.hintMs);
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
  const sizers: Phase[] = ["idle", "pending", "done", "error"];

  /** One layer of label content. Rendered twice: in the button colour, and inverted inside the fill. */
  const layer = (
    <>
      {/* Every label sits invisibly in the same grid cell, so the button is as wide as its longest state and never resizes. */}
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 grid">
        {sizers.map((p) => {
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
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -7, filter: "blur(3px)", transition: { duration: MOTION.swapExit, ease: EASE_IN } }}
          transition={{ duration: reduce ? MOTION.fade : MOTION.swap, ease: EASE_OUT }}
          className={`col-start-1 row-start-1 flex items-center justify-center whitespace-nowrap ${dim.gap}`}
        >
          {current.node}
          {current.text}
        </motion.span>
      </AnimatePresence>
    </>
  );

  return (
    <motion.span ref={scope} className={`relative inline-flex ${className}`} style={vars}>
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
          const m = MOTION.slip;
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
        className={`group relative isolate grid touch-manipulation select-none place-items-center font-sans font-medium tracking-[-0.01em] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] transition-[background-color,box-shadow,scale,opacity] ease-out focus-visible:outline-2 focus-visible:outline-offset-2 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:cursor-not-allowed disabled:opacity-40 ${dim.box} ${SURFACE} ${
          busy || disabled ? "" : SURFACE_HOVER
        } ${phase === "holding" ? "scale-[0.98] duration-100" : "scale-100 duration-150"} ${busy ? "cursor-default" : "cursor-pointer"}`}
      >
        {layer}

        {/* The fill and its inverted label share one clip, so the text changes colour exactly at the edge. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <motion.span className="absolute inset-0 grid place-items-center bg-[var(--hc-fill)]" style={{ clipPath: clip }}>
            <span className={`grid place-items-center text-[var(--hc-on-fill)] ${dim.pad}`}>{layer}</span>
          </motion.span>
          {/* A hot leading edge: a hairline plus a short soft trail, so the fill reads as moving. */}
          <motion.span className="absolute inset-y-0 -ml-6 w-6" style={{ left: edgeX, opacity: edgeOpacity }}>
            <span className="absolute inset-0 bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--hc-fill)_45%,white))] opacity-35" />
            <span className="absolute inset-y-0 right-0 w-px bg-[color-mix(in_srgb,var(--hc-fill)_45%,white)]" />
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
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[7px] bg-[var(--hc-tip)] px-2 py-1 font-sans text-[12px] font-medium text-[var(--hc-on-tip)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)]"
          >
            {hint}
            <span aria-hidden="true" className="absolute left-1/2 top-full -mt-[3px] size-1.5 -translate-x-1/2 rotate-45 bg-[var(--hc-tip)]" />
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
        transition={{ duration: MOTION.check, ease: EASE_OUT, delay: 0.06 }}
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
/* Demo: a project list where deleting takes a deliberate hold          */
/* ------------------------------------------------------------------ */

/** The demo’s card; not part of the component. Greyscale: the red belongs to the buttons alone. */
const STAGE = { backdrop: "#000000", card: "#0b0b0c", line: "rgba(255,255,255,0.08)", rule: "rgba(255,255,255,0.07)", ink: "#f4f4f5", muted: "#8a8a93", monoBg: "#18181b", monoInk: "#a1a1aa" } as const;

const DEMO_MOTION = {
  rise: 12,
  blur: 8,
  block: 0.5,
  step: 0.06,
  rowsAt: 0.16,
  footerAt: 0.4,
  hintAt: 0.52,
  count: 0.6,
  removeAfterMs: 700, // let “Deleted” and its check land before the row folds away
  collapse: 0.32,
  refocusMs: 1150, // once the row has gone, hand focus to the next thing to act on
} as const;

type DemoProject = { id: string; name: string; meta: string; mono: string; action: "delete" | "archive" };

const DEMO_PROJECTS: DemoProject[] = [
  { id: "halcyon", name: "halcyon-web", meta: "212 deploys · 2h ago", mono: "HW", action: "delete" },
  { id: "ledger", name: "ledger-sync", meta: "38 deploys · yesterday", mono: "LS", action: "delete" },
  { id: "atlas", name: "atlas-staging", meta: "Idle for 41 days", mono: "AS", action: "archive" },
];

function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: DEMO_MOTION.rise, filter: `blur(${DEMO_MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: DEMO_MOTION.block, ease: EASE_OUT, delay },
  };
}

/** “3 of 3” counts up on first view and ticks down as rows go, with a blur that clears as it lands. */
function Count({ value, total, play, reduce }: { value: number; total: number; play: boolean; reduce: boolean }) {
  const n = useMotionValue(0);
  const blur = useMotionValue(0);
  const text = useTransform(n, (v) => `${Math.round(v)} of ${total}`);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);
  const first = useRef(true);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      n.set(value);
      return;
    }
    const delay = first.current ? DEMO_MOTION.step * 2 : 0;
    first.current = false;
    blur.set(3);
    const runs = [animate(n, value, { duration: DEMO_MOTION.count, ease: EASE_OUT, delay }), animate(blur, 0, { duration: DEMO_MOTION.count, ease: EASE_OUT, delay })];
    return () => runs.forEach((r) => r.stop());
  }, [value, play, reduce, n, blur]);
  return (
    <>
      <motion.span aria-hidden="true" style={{ filter }} className="inline-block tabular-nums">
        {text}
      </motion.span>
      <span className="sr-only">
        {value} of {total}
      </span>
    </>
  );
}

export default function HoldConfirmButtonDemo() {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const cardRef = useRef<HTMLElement>(null);
  const play = useInView(cardRef, { once: true, amount: 0.3 });
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [leaving, setLeaving] = useState<string[]>([]);
  const { later } = useTimers();

  const remove = (id: string) => {
    // Clip the row only as it leaves, so the hint tooltip isn’t cut off while it’s still there.
    later(() => setLeaving((l) => [...l, id]), DEMO_MOTION.removeAfterMs);
    later(() => setProjects((ps) => ps.filter((p) => p.id !== id)), DEMO_MOTION.removeAfterMs + 60);
    later(() => {
      const active = document.activeElement;
      if (active && active !== document.body && cardRef.current?.contains(active)) return;
      cardRef.current?.querySelector<HTMLButtonElement>("ul button, [data-restore]")?.focus();
    }, DEMO_MOTION.refocusMs);
  };

  const restore = () => {
    setLeaving([]);
    setProjects(DEMO_PROJECTS);
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-16 font-sans antialiased sm:px-8" style={{ background: STAGE.backdrop, color: STAGE.ink }}>
      <div className="@container w-full max-w-[600px]">
        <motion.section
          ref={cardRef}
          aria-labelledby={`${uid}-title`}
          {...enter(play, 0, reduce)}
          className="rounded-[18px]"
          style={{ background: STAGE.card, boxShadow: `inset 0 0 0 1px ${STAGE.line}, inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)` }}
        >
          <motion.header {...enter(play, DEMO_MOTION.step, reduce)} className="flex items-center justify-between px-5 pb-3 pt-5 @md:px-6">
            <h2 id={`${uid}-title`} className="text-[14px] font-medium tracking-[-0.01em]">
              Projects
            </h2>
            <span className="font-mono text-[11px]" style={{ color: STAGE.muted }}>
              <Count value={projects.length} total={DEMO_PROJECTS.length} play={play} reduce={reduce} />
            </span>
          </motion.header>

          <ul className="px-2 pb-2">
            <AnimatePresence>
              {projects.map((p, i) => (
                <motion.li
                  key={p.id}
                  {...enter(play, DEMO_MOTION.rowsAt + i * DEMO_MOTION.step, reduce)}
                  exit={reduce ? { opacity: 0, transition: { duration: MOTION.fade } } : { opacity: 0, height: 0, transition: { duration: DEMO_MOTION.collapse, ease: EASE_IN_OUT } }}
                  className={leaving.includes(p.id) ? "overflow-hidden" : ""}
                >
                  <ProjectRow project={p} onRemove={() => remove(p.id)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <AnimatePresence initial={false}>
            {projects.length === 0 && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, transition: { duration: MOTION.fade } }}
                transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.15 }}
                className="flex flex-col items-center px-6 pb-9 pt-4 text-center"
              >
                <p className="text-[14px]">Nothing left to delete.</p>
                <p className="mt-1 text-[13px]" style={{ color: STAGE.muted }}>
                  Thorough. The demo can put them back.
                </p>
                <button
                  type="button"
                  data-restore
                  onClick={restore}
                  className="mt-5 inline-flex h-9 items-center rounded-[9px] px-3.5 text-[13px] font-medium text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-[background-color,color,scale] duration-150 hover:bg-white/[0.05] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.97]"
                >
                  Restore projects
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            {...enter(play, DEMO_MOTION.footerAt, reduce)}
            className="flex flex-col gap-4 border-t px-5 py-5 @md:flex-row @md:items-center @md:justify-between @md:px-6"
            style={{ borderColor: STAGE.rule }}
          >
            <div className="min-w-0">
              <p className="text-[14px] font-medium">Delete workspace</p>
              <p className="mt-1 max-w-[38ch] text-[13px] leading-[1.5]" style={{ color: STAGE.muted }}>
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
          </motion.div>
        </motion.section>
        <motion.p {...enter(play, DEMO_MOTION.hintAt, reduce)} className="mt-4 text-center font-mono text-[11px]" style={{ color: STAGE.muted }}>
          Hold Space or Enter to confirm from the keyboard.
        </motion.p>
      </div>
    </div>
  );
}

function ProjectRow({ project: p, onRemove }: { project: DemoProject; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] px-3 py-3 transition-colors duration-150 hover:bg-white/[0.025] @md:px-4">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-[9px] font-mono text-[11px] font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        style={{ background: STAGE.monoBg, color: STAGE.monoInk }}
      >
        {p.mono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[13px]">{p.name}</span>
        <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: STAGE.muted }}>
          {p.meta}
        </span>
      </span>
      {p.action === "delete" ? (
        <HoldConfirmButton size="sm" label="Delete" doneLabel="Deleted" errorLabel="Failed" announcement={`${p.name} deleted`} duration={1000} resetAfter={null} onConfirm={onRemove} />
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
          onConfirm={onRemove}
        />
      )}
    </div>
  );
}
