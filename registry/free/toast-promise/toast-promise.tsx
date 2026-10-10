"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** loading settles to success or error; success becomes undone when Undo is pressed. */
export type PromiseToastStatus = "loading" | "success" | "error" | "undone";
export type PromiseToastPosition = "bottom-right" | "bottom-center" | "top-right";

export type PromiseToastProps = {
  /** The async work. Resolve for success, reject for error. Runs on mount and whenever runKey changes. */
  job?: () => Promise<unknown>;
  /** Change this to run the job again. The toast morphs back to loading. */
  runKey?: string | number;
  loadingTitle?: string;
  loadingDescription?: string;
  successTitle?: string;
  /** The line under the title on success. With undo on, the window is appended to it. */
  successDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  undoLabel?: string;
  /** Title once Undo has been pressed. */
  undoTitle?: string;
  undoneDescription?: string;
  /** Offer Undo on success. A ring around the button counts the window down. */
  undo?: boolean;
  /** The undo window in seconds (2 to 10). The toast leaves when the ring empties. */
  duration?: number;
  position?: PromiseToastPosition;
  /** "absolute" sits in the nearest positioned parent; "fixed" pins to the viewport. */
  strategy?: "absolute" | "fixed";
  theme?: "dark" | "light";
  onUndo?: () => void;
  onDismiss?: () => void;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

type Palette = {
  card: string;
  line: string;
  ink: string;
  muted: string;
  track: string;
  shadow: string;
  ok: string;
  bad: string;
  /** Tailwind classes, literal so the compiler sees them: a resting fill and its hover. */
  controlClass: string;
  hoverClass: string;
};

const PALETTE: Record<"dark" | "light", Palette> = {
  dark: {
    card: "#17171a",
    line: "rgba(255,255,255,0.09)",
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    track: "rgba(255,255,255,0.08)",
    shadow: "0 28px 56px -18px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.4)",
    ok: "#6fd08c",
    bad: "#ff7a6b",
    controlClass: "bg-white/[0.06]",
    hoverClass: "hover:bg-white/[0.12]",
  },
  light: {
    card: "#ffffff",
    line: "rgba(24,24,27,0.09)",
    ink: "#18181b",
    muted: "#52525b",
    track: "rgba(24,24,27,0.08)",
    shadow: "0 24px 48px -18px rgba(24,24,27,0.28), 0 2px 6px rgba(24,24,27,0.08)",
    ok: "#3f8a50",
    bad: "#c9553d",
    controlClass: "bg-zinc-900/[0.05]",
    hoverClass: "hover:bg-zinc-900/[0.09]",
  },
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  enter: 0.42,
  enterRise: 14, // px the card rises from
  enterBlur: 6, // px
  swap: 0.26, // a status change cross-fades its copy
  swapExit: 0.16,
  swapRise: 6, // px
  swapBlur: 3, // px
  exit: 0.22,
  exitRise: 8, // px
  sweep: 1.3, // one pass of the indeterminate hairline
  resolve: 0.5, // the hairline lands in success or error
  resolveFade: 0.6, // the success hairline leaves once it has landed
  check: 0.34,
  undone: 1.6, // a restored toast stays this long, then leaves
  swipe: { distance: 90, velocity: 500, fly: 420 },
  fade: 0.15, // reduced motion
} as const;

/** The undo ring is a rounded rect 84.5 × 40.5 with radius 20.25: its length, for dash maths. */
const RING_LENGTH = 2 * Math.PI * 20.25 + 2 * (84.5 - 2 * 20.25);

const PLACE: Record<PromiseToastPosition, string> = {
  "bottom-right": "inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-6 sm:right-6",
  "bottom-center": "inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2",
  "top-right": "inset-x-4 top-4 sm:inset-x-auto sm:top-6 sm:right-6",
};

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/**
 * Tab hidden: the countdown must not run while nobody can see it. Returns true while the
 * document is hidden.
 */
function useTabHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return hidden;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

/**
 * One toast that follows one async job. It opens on loading (a hairline sweeps its lower
 * edge), morphs in place to success or error, and on success offers Undo with a ring that
 * counts the window down. Hover or focus pauses the ring; a swipe or Esc dismisses.
 */
export function PromiseToast({
  job,
  runKey = 0,
  loadingTitle = "Archiving 12 threads…",
  loadingDescription = "Moving them out of your inbox",
  successTitle = "Archived 12 threads",
  successDescription = "Moved to Archive",
  errorTitle = "Couldn’t archive 12 threads",
  errorDescription = "Nothing was archived. Your inbox is unchanged.",
  undoLabel = "Undo",
  undoTitle = "Restored 12 threads",
  undoneDescription = "Put back where it was",
  undo = true,
  duration = 5,
  position = "bottom-right",
  strategy = "absolute",
  theme = "dark",
  onUndo,
  onDismiss,
}: PromiseToastProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const palette = PALETTE[theme];
  const hiddenTab = useTabHidden();

  const [status, setStatus] = useState<PromiseToastStatus>("loading");
  const [open, setOpen] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Direction of the last swipe (-1, 0 or 1): the exit flies that way. */
  const [flyDir, setFlyDir] = useState(0);

  // The undo window as a motion value (1 → 0). The ring and the countdown both read it.
  const life = useMotionValue(1);
  const ringOffset = useTransform(life, (v) => (1 - v) * RING_LENGTH);
  const dragX = useMotionValue(0);

  // Latest props, read from effects and timers so they never go stale.
  const jobRef = useRef(job);
  const onUndoRef = useRef(onUndo);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    jobRef.current = job;
    onUndoRef.current = onUndo;
    onDismissRef.current = onDismiss;
  });

  // Each run gets an id; a result from an older run is ignored, so a re-run never lands on a stale state.
  const attempt = useRef(0);
  const restoreTimer = useRef<number | undefined>(undefined);

  const paused = hovered || focused || hiddenTab;

  const close = useCallback((dir = 0) => {
    setFlyDir(dir);
    setOpen(false);
    onDismissRef.current?.();
  }, []);

  // Run the job on mount and whenever runKey changes. Starting it in a microtask means a
  // synchronous throw from job() settles as an error instead of crashing the tree.
  useEffect(() => {
    const id = ++attempt.current;
    setOpen(true);
    setStatus("loading");
    life.set(1);
    Promise.resolve()
      .then(() => jobRef.current?.())
      .then(
        () => {
          if (attempt.current === id) setStatus("success");
        },
        () => {
          if (attempt.current === id) setStatus("error");
        },
      );
  }, [runKey, life]);

  // The undo countdown: runs while visible and not paused, and resumes from wherever it stopped.
  useEffect(() => {
    if (status !== "success" || !undo || !open || paused) return;
    const run = animate(life, 0, { duration: life.get() * duration, ease: "linear", onComplete: () => close() });
    return () => run.stop();
  }, [status, undo, open, paused, duration, life, close]);

  useEffect(
    () => () => {
      attempt.current += 1;
      window.clearTimeout(restoreTimer.current);
    },
    [],
  );

  const undoNow = () => {
    if (status !== "success") return;
    onUndoRef.current?.();
    setStatus("undone");
    window.clearTimeout(restoreTimer.current);
    restoreTimer.current = window.setTimeout(() => close(), MOTION.undone * 1000);
  };

  // A long or fast drag dismisses in its direction; anything shorter springs back to rest.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { distance, velocity } = MOTION.swipe;
    const swiped = Math.abs(info.offset.x) > distance || Math.abs(info.velocity.x) > velocity;
    if (swiped) {
      close(Math.sign(info.offset.x || info.velocity.x));
      return;
    }
    animate(dragX, 0, { type: "spring", stiffness: 420, damping: 36 });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    close();
  };

  const copy = (() => {
    switch (status) {
      case "loading":
        return { title: loadingTitle, description: loadingDescription };
      case "success":
        // A no-break space keeps "5 s" together when the line wraps on a phone.
        return { title: successTitle, description: undo ? `${successDescription} · ${Math.round(duration)} s to undo` : successDescription };
      case "error":
        return { title: errorTitle, description: errorDescription };
      case "undone":
        return { title: undoTitle, description: undoneDescription };
    }
  })();

  const showUndo = status === "success" && undo;

  const cardVariants = {
    from: reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.enterRise, filter: `blur(${MOTION.enterBlur}px)` },
    rest: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: MOTION.enter, ease: EASE_OUT },
      transitionEnd: { filter: "none" },
    },
    leave: (dir: number) => {
      if (reduce) return { opacity: 0, transition: { duration: MOTION.fade } };
      if (dir !== 0) return { opacity: 0, x: dir * MOTION.swipe.fly, transition: { duration: MOTION.exit + 0.04, ease: EASE_IN } };
      return { opacity: 0, y: MOTION.exitRise, transition: { duration: MOTION.exit, ease: EASE_IN } };
    },
  };

  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.swapRise, filter: `blur(${MOTION.swapBlur}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduce
      ? { opacity: 0, transition: { duration: MOTION.fade } }
      : { opacity: 0, y: -MOTION.swapRise, filter: `blur(${MOTION.swapBlur}px)`, transition: { duration: MOTION.swapExit, ease: EASE_IN } },
    transition: { duration: MOTION.swap, ease: EASE_OUT },
  };

  return (
    <div className={`pointer-events-none z-30 ${strategy === "fixed" ? "fixed" : "absolute"} w-auto ${PLACE[position]}`}>
      <AnimatePresence custom={flyDir}>
        {open && (
          <motion.section
            key="toast"
            data-demo="toast"
            aria-labelledby={`${uid}-title`}
            variants={cardVariants}
            initial="from"
            animate="rest"
            exit="leave"
            custom={flyDir}
            drag="x"
            dragConstraints={{ left: -MOTION.swipe.fly, right: MOTION.swipe.fly }}
            dragElastic={0.35}
            dragMomentum={false}
            onDragEnd={onDragEnd}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
            }}
            onKeyDown={onKeyDown}
            style={{
              x: dragX,
              background: palette.card,
              boxShadow: `inset 0 0 0 1px ${palette.line}, inset 0 1px 0 rgba(255,255,255,0.04), ${palette.shadow}`,
              touchAction: "pan-y",
            } as CSSProperties}
            className="pointer-events-auto relative w-full select-none overflow-hidden rounded-[14px] sm:w-[392px]"
          >
            <div className="flex items-start gap-3 px-4 pb-4 pt-3.5">
              <span aria-hidden="true" className="relative mt-px grid h-[18px] w-[18px] shrink-0 place-items-center">
                {/* popLayout lets the new glyph and copy arrive while the old ones leave, so the card never goes blank mid-change. */}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={status}
                    className="grid place-items-center"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7, filter: "blur(2px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.7, transition: { duration: MOTION.swapExit } }}
                    transition={{ duration: MOTION.swap, ease: EASE_OUT }}
                  >
                    <StatusGlyph status={status} palette={palette} reduce={reduce} />
                  </motion.span>
                </AnimatePresence>
              </span>

              <div className="relative min-w-0 flex-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={status} {...swap}>
                    <p id={`${uid}-title`} className="text-[14px] font-medium leading-5 tracking-[-0.01em]" style={{ color: palette.ink }}>
                      {copy.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-[1.45] tabular-nums" style={{ color: palette.muted }}>
                      {copy.description}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <AnimatePresence>
                  {showUndo && (
                    <motion.span
                      key="undo"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.22, ease: EASE_OUT }}
                      className="relative mr-1 inline-grid place-items-center"
                      style={{ width: 76, height: 32 }}
                    >
                      <button
                        type="button"
                        data-demo="undo"
                        onClick={undoNow}
                        className={`relative z-10 grid h-8 w-[76px] place-items-center rounded-full text-[13px] font-medium tracking-[-0.01em] transition-[background-color,scale] duration-150 ease-out active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-current ${palette.controlClass} ${palette.hoverClass}`}
                        style={{ color: palette.ink, boxShadow: `inset 0 0 0 1px ${palette.line}` }}
                      >
                        {undoLabel}
                      </button>
                      {/* The countdown ring sits 5px outside the button and empties as the undo window closes. */}
                      <svg aria-hidden="true" width={86} height={42} viewBox="0 0 86 42" fill="none" className="pointer-events-none absolute -inset-[5px] z-0 overflow-visible" style={{ color: palette.ink }}>
                        <motion.rect
                          x={0.75}
                          y={0.75}
                          width={84.5}
                          height={40.5}
                          rx={20.25}
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
                          style={{ strokeDashoffset: ringOffset }}
                        />
                      </svg>
                    </motion.span>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={() => close()}
                  aria-label="Dismiss"
                  className={`grid size-7 place-items-center rounded-full transition-[background-color,scale] duration-150 ease-out active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${palette.hoverClass}`}
                  style={{ color: palette.muted }}
                >
                  <CloseGlyph />
                </button>
              </div>
            </div>

            {/* The hairline along the lower edge: a sweep while loading, then it settles into the outcome. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
              {status === "loading" &&
                (reduce ? (
                  <span className="absolute inset-y-0 left-[30%] w-[40%]" style={{ background: palette.track }} />
                ) : (
                  <motion.span
                    className="absolute inset-y-0 w-2/5"
                    style={{ background: `linear-gradient(90deg, transparent, ${palette.ink}, transparent)` }}
                    initial={{ left: "-40%" }}
                    animate={{ left: "100%" }}
                    transition={{ duration: MOTION.sweep, ease: "linear", repeat: Infinity }}
                  />
                ))}
              {(status === "success" || status === "error") && (
                <motion.span
                  className="absolute inset-0 origin-left"
                  style={{ background: status === "success" ? palette.ok : palette.bad }}
                  initial={{ scaleX: 0, opacity: 1 }}
                  animate={{ scaleX: 1, opacity: status === "success" ? 0 : 1 }}
                  transition={{
                    scaleX: { duration: reduce ? MOTION.fade : MOTION.resolve, ease: EASE_OUT },
                    opacity: { duration: MOTION.resolveFade, delay: 1.1 },
                  }}
                />
              )}
            </div>

            {/* Announced politely: the copy changes once per status, not per countdown tick. */}
            <span role="status" aria-live="polite" className="sr-only">
              {copy.title}. {copy.description}
            </span>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (drawn, 18-unit grid)                                          */
/* ------------------------------------------------------------------ */

function StatusGlyph({ status, palette, reduce }: { status: PromiseToastStatus; palette: Palette; reduce: boolean }) {
  if (status === "loading") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="animate-spin motion-reduce:animate-none" style={{ color: palette.muted, animationDuration: "1.2s" }}>
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
        <path d="M16 9a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "success") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ color: palette.ok }}>
        <motion.path
          d="M4.25 9.4l3.1 3.1 6.4-6.6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: MOTION.check, ease: EASE_OUT, delay: 0.08 }}
        />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ color: palette.bad }}>
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.6 6.6l4.8 4.8M11.4 6.6l-4.8 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ color: palette.ink }}>
      <path d="M7 5.25L4.25 8 7 10.75M4.25 8h6.25a3.5 3.5 0 0 1 0 7H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: an inbox where archiving raises the toast                      */
/* ------------------------------------------------------------------ */

type Trigger = "archive" | "bin";

/** How long the demo's job takes. Short enough that a control change has settled within a second. */
const JOB_MS = 700;

/** The demo's own stage. Greyscale: the toast is the only thing with a colour meaning. */
const STAGE = {
  dark: { backdrop: "#000000", card: "#0b0b0c", line: "rgba(255,255,255,0.08)", ink: "#f4f4f5", muted: "#8a8a93", faint: "#5b5b63", pill: "#f4f4f5", onPill: "#0b0b0c", chip: "#18181b", chipInk: "#a1a1aa" },
  light: { backdrop: "#f4f4f5", card: "#ffffff", line: "rgba(24,24,27,0.08)", ink: "#18181b", muted: "#71717a", faint: "#a1a1aa", pill: "#18181b", onPill: "#ffffff", chip: "#f4f4f5", chipInk: "#52525b" },
} as const;

const DEMO_MOTION = { rise: 12, blur: 8, block: 0.5, step: 0.07 } as const;

const THREADS = [
  { id: "priya", initials: "PS", from: "Priya Shah", subject: "Re: onboarding copy for Q4", time: "9:42" },
  { id: "build", initials: "DT", from: "Dev Team", subject: "Build #4821 passed on main", time: "9:18" },
  { id: "marcus", initials: "ML", from: "Marcus Lee", subject: "Lunch on Thursday?", time: "8:55" },
  { id: "amara", initials: "AO", from: "Amara Osei", subject: "Pricing page, second pass", time: "Yesterday" },
  { id: "invoice", initials: "NW", from: "Northwind", subject: "Invoice 2093 is ready", time: "Yesterday" },
] as const;

/** Copy for each job the toast can follow. The component's own defaults are the archive copy. */
const JOB_COPY: Record<Trigger, Partial<PromiseToastProps>> = {
  archive: {
    loadingTitle: "Archiving 12 threads…",
    loadingDescription: "Moving them out of your inbox",
    successTitle: "Archived 12 threads",
    successDescription: "Moved to Archive",
    errorTitle: "Couldn’t archive 12 threads",
    errorDescription: "Nothing was archived. Your inbox is unchanged.",
    undoTitle: "Restored 12 threads",
  },
  bin: {
    loadingTitle: "Moving 3 drafts to bin…",
    loadingDescription: "The bin keeps them for 30 days",
    successTitle: "Moved 3 drafts to bin",
    successDescription: "Kept for 30 days",
    errorTitle: "Couldn’t move 3 drafts",
    errorDescription: "Nothing was moved. Your drafts are where they were.",
    undoTitle: "Restored 3 drafts",
  },
};

export type PromiseToastDemoProps = Partial<PromiseToastProps> & {
  /** What the job settles with. Changing it replays the job. */
  outcome?: "success" | "error";
  /** The job the toast follows: archive the 12 threads, or move 3 drafts to the bin. */
  trigger?: Trigger;
};

/**
 * The demo: an inbox where "Archive 12 threads" starts the job. The toast appears on the
 * click, loads, lands, and its ring counts down until the cursor pauses it and presses Undo.
 * Overrides (the page's Customize panel) apply to the toast. Every control replays the job,
 * so each change shows at once.
 */
export default function PromiseToastDemo(overrides: PromiseToastDemoProps = {}) {
  const { outcome = "success", trigger: forcedTrigger, duration = 5, undo = true, position = "bottom-right", theme = "dark", ...rest } = overrides;
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const stageRef = useRef<HTMLElement>(null);
  const play = useInView(stageRef, { once: true, amount: 0.3 });
  const s = STAGE[theme];

  const [trigger, setTrigger] = useState<Trigger>(forcedTrigger ?? "archive");
  const [counter, setCounter] = useState(0);
  // The toast appears on the first click, or on the first control change, and then stays.
  const [armed, setArmed] = useState(false);
  const [archived, setArchived] = useState(false);
  const touched = Object.keys(overrides).length > 0;

  // The action control drives trigger, so its value is synced into the demo's own state.
  useEffect(() => {
    if (forcedTrigger) setTrigger(forcedTrigger);
  }, [forcedTrigger]);
  useEffect(() => {
    if (touched) setArmed(true);
  }, [touched]);

  const job = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        if (trigger === "archive") setArchived(false);
        window.setTimeout(() => {
          if (outcome === "error") {
            reject(new Error("offline"));
            return;
          }
          if (trigger === "archive") setArchived(true);
          resolve();
        }, JOB_MS);
      }),
    [outcome, trigger],
  );

  // Changing any control replays the job, so the toast always shows the new setting in motion.
  const runKey = [counter, outcome, trigger, duration, undo, position, theme].join("|");

  const sectionVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: DEMO_MOTION.block, ease: EASE_OUT, staggerChildren: DEMO_MOTION.step, delayChildren: 0.08 } },
  };
  const riseVariants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: DEMO_MOTION.rise, filter: `blur(${DEMO_MOTION.blur}px)` },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: DEMO_MOTION.block, ease: EASE_OUT }, transitionEnd: { filter: "none" } },
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-16 font-sans antialiased sm:px-8" style={{ background: s.backdrop, color: s.ink }}>
      <div className="@container w-full max-w-[560px]">
        <motion.section
          ref={stageRef}
          aria-labelledby={`${uid}-title`}
          variants={sectionVariants}
          initial="hidden"
          animate={play ? "show" : "hidden"}
          className="relative min-h-[440px] rounded-[18px] px-5 pb-32 pt-5 @md:px-6"
          style={{ background: s.card, boxShadow: `inset 0 0 0 1px ${s.line}, inset 0 1px 0 rgba(255,255,255,0.04), 0 40px 80px -40px rgba(0,0,0,0.9)` }}
        >
          <motion.header variants={riseVariants} className="flex items-center justify-between">
            <h2 id={`${uid}-title`} className="text-[14px] font-medium tracking-[-0.01em]">
              Inbox
            </h2>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: s.muted }}>
              {archived ? "12 archived" : "12 unread"}
            </span>
          </motion.header>

          <motion.div variants={riseVariants} className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[13px] leading-[1.5]" style={{ color: s.muted }}>
              Showing 5 of 12 threads.
            </p>
            <button
              type="button"
              data-demo="archive"
              onClick={() => {
                setTrigger("archive");
                setCounter((c) => c + 1);
                setArmed(true);
              }}
              className="inline-flex h-9 shrink-0 items-center rounded-[10px] px-3.5 text-[13px] font-medium transition-[opacity,scale] duration-150 ease-out hover:opacity-90 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              style={{ background: s.pill, color: s.onPill }}
            >
              Archive 12 threads
            </button>
          </motion.div>

          <motion.ul variants={riseVariants} className="mt-5">
            {THREADS.map((t) => (
              <motion.li key={t.id} variants={riseVariants} className="border-t py-3 first:border-t-0" style={{ borderColor: s.line }}>
                <motion.div animate={{ opacity: archived ? 0.3 : 1, x: archived ? -6 : 0 }} transition={{ duration: 0.4, ease: EASE_OUT }} className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[9px] font-mono text-[11px] font-medium" style={{ background: s.chip, color: s.chipInk }}>
                    {t.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{t.from}</span>
                    <span className="mt-0.5 block truncate text-[13px]" style={{ color: s.muted }}>
                      {t.subject}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: s.faint }}>
                    {t.time}
                  </span>
                </motion.div>
              </motion.li>
            ))}
          </motion.ul>

          {armed && (
            <PromiseToast
              {...JOB_COPY[trigger]}
              {...rest}
              job={job}
              runKey={runKey}
              duration={duration}
              undo={undo}
              position={position}
              theme={theme}
              strategy="absolute"
              onUndo={() => setArchived(false)}
            />
          )}
        </motion.section>

        <motion.p variants={riseVariants} initial="hidden" animate={play ? "show" : "hidden"} className="mt-4 text-center font-mono text-[11px]" style={{ color: s.muted }}>
          Hover the toast to pause the ring · Esc dismisses
        </motion.p>
      </div>
    </div>
  );
}
