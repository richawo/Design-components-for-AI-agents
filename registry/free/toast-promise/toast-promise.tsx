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
  /** The async work. Resolve for success, reject for error. Runs on mount, whenever runKey changes, and on Retry. */
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
  /** Label of the quiet button on error. It only appears when onRetry is set. */
  retryLabel?: string;
  undoLabel?: string;
  /** Title once Undo has been pressed. */
  undoTitle?: string;
  undoneDescription?: string;
  /** Offer Undo on success. A ring around the button counts the window down. */
  undo?: boolean;
  /** The success window in seconds (2 to 10). The toast leaves when it ends, with Undo or without it. */
  duration?: number;
  position?: PromiseToastPosition;
  /** "absolute" fills the nearest positioned parent; "fixed" pins to the viewport. */
  strategy?: "absolute" | "fixed";
  theme?: "dark" | "light";
  onUndo?: () => void;
  /** Runs when Retry is pressed, just before the job runs again. */
  onRetry?: () => void;
  /** Runs when the toast leaves: the window ended, it was swiped or dismissed, or Esc was pressed. */
  onDismiss?: () => void;
  /**
   * Runs on every status change of the current run (never for a superseded one), so the host can
   * mirror the outcome, e.g. fade the archived rows only once the toast itself says "Archived".
   */
  onStatusChange?: (status: PromiseToastStatus) => void;
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

/**
 * Where the card sits inside its layer. The layer is the whole parent (or the viewport), so
 * the insets follow the container: the card's own wrapper adds 16px, or 24px once the
 * container is 448px wide (@md).
 */
const PLACE: Record<PromiseToastPosition, string> = {
  "bottom-right": "items-end justify-end",
  "bottom-center": "items-end justify-center",
  "top-right": "items-start justify-end",
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
 * edge), morphs in place to success or error, and on success counts down its window: with
 * Undo on, a ring around the button drains. Hover or focus pauses the countdown; a swipe or
 * Esc dismisses. An error stays until it is dismissed or retried.
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
  retryLabel = "Try again",
  undoLabel = "Undo",
  undoTitle = "Restored 12 threads",
  undoneDescription = "Put back where it was",
  undo = true,
  duration = 5,
  position = "bottom-right",
  strategy = "absolute",
  theme = "dark",
  onUndo,
  onRetry,
  onDismiss,
  onStatusChange,
}: PromiseToastProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const palette = PALETTE[theme];
  const hiddenTab = useTabHidden();

  const [status, setStatus] = useState<PromiseToastStatus>("loading");
  const [open, setOpen] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Bumped by Retry, so the job runs again without a new runKey. */
  const [attemptKey, setAttemptKey] = useState(0);
  /** Direction of the last swipe (-1, 0 or 1): the exit flies that way. */
  const [flyDir, setFlyDir] = useState(0);
  /** What the live region says. Filled a frame after each status change, so the change is announced. */
  const [announcement, setAnnouncement] = useState("");

  // The success window as a motion value (1 → 0). The ring and the timer both read it.
  const life = useMotionValue(1);
  const ringOffset = useTransform(life, (v) => (1 - v) * RING_LENGTH);
  const dragX = useMotionValue(0);

  // Latest props, read from effects and timers so they never go stale.
  const jobRef = useRef(job);
  const onUndoRef = useRef(onUndo);
  const onRetryRef = useRef(onRetry);
  const onDismissRef = useRef(onDismiss);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    jobRef.current = job;
    onUndoRef.current = onUndo;
    onRetryRef.current = onRetry;
    onDismissRef.current = onDismiss;
    onStatusChangeRef.current = onStatusChange;
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);

  // Each run gets an id; a result from an older run is ignored, so a re-run never lands on a stale state.
  const attempt = useRef(0);
  const restoreTimer = useRef<number | undefined>(undefined);

  const paused = hovered || focused || hiddenTab;

  // Hover and focus are cleared with the card. It unmounts without a pointerleave or blur, so a flag
  // left behind would freeze the next toast's countdown for good.
  const close = useCallback((dir = 0) => {
    setFlyDir(dir);
    setOpen(false);
    setHovered(false);
    setFocused(false);
    onDismissRef.current?.();
  }, []);

  // Run the job on mount, whenever runKey changes, and on Retry. Starting it in a microtask means a
  // synchronous throw from job() settles as an error instead of crashing the tree.
  useEffect(() => {
    const id = ++attempt.current;
    setOpen(true);
    // Read the live pointer and focus: the card may mount under a pointer that never entered it.
    const card = cardRef.current;
    setHovered(card?.matches(":hover") ?? false);
    setFocused(card?.contains(document.activeElement) ?? false);
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
  }, [runKey, attemptKey, life]);

  // Status only ever changes for the current run (stale results are dropped above), so this reports truth.
  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  // The success window: `life` runs 1 → 0 over `duration` and the toast leaves when it empties.
  // It runs with or without Undo, so a success toast never stays on screen for good. Undo only
  // decides whether the ring is drawn around the button.
  useEffect(() => {
    if (status !== "success" || !open || paused) return;
    const run = animate(life, 0, { duration: life.get() * duration, ease: "linear", onComplete: () => close() });
    return () => run.stop();
  }, [status, open, paused, duration, life, close]);

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
    // Undo unmounts as the status changes. Move focus to Dismiss so keyboard users are not dropped to the page.
    dismissRef.current?.focus({ preventScroll: true });
    window.clearTimeout(restoreTimer.current);
    restoreTimer.current = window.setTimeout(() => close(), MOTION.undone * 1000);
  };

  const retry = () => {
    if (status !== "error") return;
    onRetryRef.current?.();
    setAttemptKey((k) => k + 1);
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

  // The window is its own nowrap span after a plain space, so a narrow card breaks before the dot,
  // never inside "Moved to Archive" and never inside "5 s to undo".
  const windowText = `· ${Math.round(duration)} s to undo`;
  const copy = (() => {
    switch (status) {
      case "loading":
        return { title: loadingTitle, description: loadingDescription, spoken: loadingDescription };
      case "success":
        return undo
          ? {
              title: successTitle,
              description: (
                <>
                  {successDescription} <span className="whitespace-nowrap">{windowText}</span>
                </>
              ),
              spoken: `${successDescription}, ${Math.round(duration)} seconds to undo`,
            }
          : { title: successTitle, description: successDescription, spoken: successDescription };
      case "error":
        return { title: errorTitle, description: errorDescription, spoken: errorDescription };
      case "undone":
        return { title: undoTitle, description: undoneDescription, spoken: undoneDescription };
    }
  })();

  // Filled on the next frame, so the region is already in the DOM when the words arrive.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnnouncement(`${copy.title}. ${copy.spoken}`));
    return () => window.cancelAnimationFrame(frame);
  }, [copy.title, copy.spoken]);

  const showUndo = status === "success" && undo;
  const showRetry = status === "error" && onRetry !== undefined;
  const hasAction = showUndo || showRetry;

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
    <div className={`pointer-events-none z-30 @container ${strategy === "fixed" ? "fixed" : "absolute"} inset-0`}>
      <div className={`flex h-full w-full p-4 @md:p-6 ${PLACE[position]}`}>
        <AnimatePresence custom={flyDir}>
          {open && (
            <motion.div
              key="toast"
              ref={cardRef}
              role="group"
              data-demo="toast"
              aria-labelledby={`${uid}-title`}
              variants={cardVariants}
              initial="from"
              animate="rest"
              exit="leave"
              custom={flyDir}
              drag="x"
              /* Zero constraints: the card resists from the first pixel (the 0.35 rubber band), not only past a limit. */
              dragConstraints={{ left: 0, right: 0 }}
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
              }}
              className="pointer-events-auto relative w-full max-w-[392px] select-none overflow-hidden rounded-[14px]"
            >
              {/*
                One grid, two arrangements, chosen by the layer's width (a container query, not the viewport).
                Narrow (under 448px): glyph, copy and Dismiss share the first row; Undo or Try again drops to a
                second row under the copy, so the copy keeps the card's full width. From @md the card is 392px
                and the action moves inline between the copy and Dismiss.
              */}
              <div className="grid grid-cols-[18px_minmax(0,1fr)_28px] items-start gap-x-3 px-4 pb-4 pt-3.5 @md:grid-cols-[18px_minmax(0,1fr)_auto_28px]">
                <span aria-hidden="true" className="relative col-start-1 row-start-1 mt-px grid h-[18px] w-[18px] place-items-center">
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

                <div className="relative col-start-2 row-start-1 min-w-0">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div key={status} {...swap}>
                      <p id={`${uid}-title`} className="text-balance text-[14px] font-medium leading-5 tracking-[-0.01em]" style={{ color: palette.ink }}>
                        {copy.title}
                      </p>
                      <p className="mt-0.5 text-pretty text-[13px] leading-[1.45] tabular-nums" style={{ color: palette.muted }}>
                        {copy.description}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/*
                  The action slot. Its row opens and closes with a grid-template-rows transition (0fr to 1fr), so
                  in the narrow layout the card grows and shrinks smoothly instead of jumping by a row. The card's
                  own overflow clips the button while its row is still opening.
                */}
                <div
                  className={`col-start-2 row-start-2 grid justify-items-start transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none @md:col-start-3 @md:row-start-1 ${hasAction ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="min-h-0">
                    <AnimatePresence initial={false}>
                      {showUndo && (
                        <motion.div
                          key="undo"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
                          transition={{ duration: 0.22, ease: EASE_OUT }}
                          className="origin-left pt-3 @md:origin-center @md:pt-0"
                        >
                          <span className="relative grid place-items-center" style={{ width: 76, height: 32 }}>
                            {/*
                              The hit area reaches 44px tall (the ::before) while the pill stays 32px. The focus ring is
                              drawn inside the pill, so the countdown ring stays the only ring around it.
                            */}
                            <button
                              type="button"
                              data-demo="undo"
                              onClick={undoNow}
                              className={`relative z-10 grid h-8 w-[76px] place-items-center rounded-full text-[13px] font-medium tracking-[-0.01em] transition-[background-color,scale] duration-150 ease-out before:absolute before:-inset-[6px] before:content-[''] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-current ${palette.controlClass} ${palette.hoverClass}`}
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
                          </span>
                        </motion.div>
                      )}
                      {showRetry && (
                        <motion.div
                          key="retry"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.12 } }}
                          transition={{ duration: 0.22, ease: EASE_OUT }}
                          className="pt-3 @md:pt-0"
                        >
                          {/*
                            A quiet text button with no fill: the retry is a second chance, not the main action. Muted at
                            rest, ink on hover. In the narrow layout its padding hangs left so the label lines up with the copy.
                          */}
                          <button
                            type="button"
                            data-demo="retry"
                            onClick={retry}
                            className={`relative -ml-2.5 grid h-8 place-items-center rounded-full px-2.5 text-[13px] font-medium tracking-[-0.01em] text-(color:--tp-rest) transition-[background-color,color,scale] duration-150 ease-out before:absolute before:-inset-x-1 before:-inset-y-[6px] before:content-[''] hover:text-(color:--tp-hover) active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current @md:ml-0 ${palette.hoverClass}`}
                            style={{ "--tp-rest": palette.muted, "--tp-hover": palette.ink } as CSSProperties}
                          >
                            {retryLabel}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* The visible circle is 28px; its hit area reaches 44px. Centred on the title line, or on the pill once inline. */}
                <button
                  ref={dismissRef}
                  type="button"
                  onClick={() => close()}
                  aria-label="Dismiss"
                  className={`relative col-start-3 row-start-1 -mt-1 grid size-7 place-items-center rounded-full before:absolute before:-inset-2 before:content-[''] transition-[background-color,scale] duration-150 ease-out active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current @md:col-start-4 @md:mt-0.5 ${palette.hoverClass}`}
                  style={{ color: palette.muted }}
                >
                  <CloseGlyph />
                </button>
              </div>

              {/* The hairline along the lower edge: a sweep while loading, then it settles into the outcome. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
                {status === "loading" &&
                  (reduce ? (
                    // A faint full-width track, not a segment: a centred segment reads as a progress bar at an invented value.
                    <span className="absolute inset-0" style={{ background: palette.track }} />
                  ) : (
                    // A transform, not `left`: the loop runs on the compositor. x is a share of the segment's own
                    // width (40% of the track), so -100% starts it just off the left edge and 250% ends it just off the right.
                    <motion.span
                      className="absolute inset-y-0 left-0 w-2/5"
                      style={{ background: `linear-gradient(90deg, transparent, ${palette.ink}, transparent)` }}
                      initial={{ x: "-100%" }}
                      animate={{ x: "250%" }}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Mounted with the layer, not with the card, so the region exists before anything is announced. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
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
/* Demo: an inbox where archiving or snoozing raises the toast          */
/* ------------------------------------------------------------------ */

type Trigger = "archive" | "snooze";

/** The job's length once a control has changed: short, so each change settles within a second. */
const CONTROL_JOB_MS = 700;
/** A click's job: long enough to watch the loading sweep before the toast lands. */
const DEMO_JOB_MS = 1500;

/** The demo's own stage. Greyscale: the toast is the only thing with a colour meaning. */
const STAGE = {
  dark: { backdrop: "#000000", card: "#0b0b0c", shadow: "0 40px 80px -40px rgba(0,0,0,0.9)", line: "rgba(255,255,255,0.08)", ink: "#f4f4f5", muted: "#8a8a93", faint: "#5b5b63", pill: "#f4f4f5", onPill: "#0b0b0c", chip: "#18181b", chipInk: "#a1a1aa" },
  light: { backdrop: "#f4f4f5", card: "#ffffff", shadow: "0 32px 64px -32px rgba(24,24,27,0.12)", line: "rgba(24,24,27,0.08)", ink: "#18181b", muted: "#71717a", faint: "#a1a1aa", pill: "#18181b", onPill: "#ffffff", chip: "#f4f4f5", chipInk: "#52525b" },
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
  snooze: {
    loadingTitle: "Snoozing 5 threads…",
    loadingDescription: "They come back to your inbox on Monday",
    successTitle: "Snoozed 5 threads",
    successDescription: "Back on Monday at 9:00",
    errorTitle: "Couldn’t snooze 5 threads",
    errorDescription: "Nothing was snoozed. Your inbox is unchanged.",
    undoTitle: "Restored 5 threads",
  },
};

/** The header count once a job has moved threads out of the inbox. */
const MOVED_COUNT: Record<Trigger, string> = { archive: "12 archived", snooze: "5 snoozed" };

export type PromiseToastDemoProps = Partial<PromiseToastProps> & {
  /** What the job settles with. Changing it replays the job. */
  outcome?: "success" | "error";
  /** The job the toast follows: archive the 12 threads, or snooze the 5 shown. */
  trigger?: Trigger;
};

/**
 * The demo: an inbox where "Archive 12 threads" or "Snooze 5 threads" starts the job. Nothing runs
 * until something asks for it, the way a real toast works: a click raises the toast, it loads,
 * lands, and its ring counts down until the cursor pauses it and presses Undo. Overrides (the
 * page's Customize panel) apply to the toast, and every control replays the job so each change
 * shows at once.
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
  // The toast mounts on the first click or control change, never on its own.
  const [armed, setArmed] = useState(false);
  // The run Retry was pressed on. A retry succeeds only for that run, so any new run fails again.
  const [recoveredKey, setRecoveredKey] = useState<string | null>(null);
  // Which job's threads are out of the inbox. Derived from the toast's own status (onStatusChange), which only
  // ever reports the current run, so a superseded job can never fade the rows under an error.
  const [moved, setMoved] = useState<Trigger | null>(null);
  const touched = Object.keys(overrides).length > 0;

  // The action control drives trigger, so its value is synced into the demo's own state.
  useEffect(() => {
    if (forcedTrigger) setTrigger(forcedTrigger);
  }, [forcedTrigger]);
  useEffect(() => {
    if (touched) setArmed(true);
  }, [touched]);

  const jobMs = touched ? CONTROL_JOB_MS : DEMO_JOB_MS;

  // Changing any control replays the job, so the toast always shows the new setting in motion.
  const runKey = [counter, outcome, trigger, duration, undo, position, theme].join("|");

  // One timer at a time: a new run (or Retry) clears the last one, so a superseded job never settles at all.
  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // The fake request has no side effects; the stage reacts to what the toast reports, not to this timer.
  const job = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          if (outcome === "error" && recoveredKey !== runKey) reject(new Error("offline"));
          else resolve();
        }, jobMs);
      }),
    [outcome, jobMs, recoveredKey, runKey],
  );

  const start = (next: Trigger) => {
    setTrigger(next);
    setCounter((c) => c + 1);
    setArmed(true);
  };

  const sectionVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: DEMO_MOTION.block, ease: EASE_OUT, staggerChildren: DEMO_MOTION.step, delayChildren: 0.08 } },
  };
  const riseVariants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: DEMO_MOTION.rise, filter: `blur(${DEMO_MOTION.blur}px)` },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: DEMO_MOTION.block, ease: EASE_OUT }, transitionEnd: { filter: "none" } },
  };

  // A top toast sits over the header, so the stage opens a gap above it; a bottom one sits over the last rows, so the
  // stage leaves room below. Under @md the toast stacks its action on a second row, so the gap is taller.
  const stagePad = position === "top-right" ? "pt-44 pb-5 @md:pt-32" : "pt-5 pb-44 @md:pb-32";
  const buttonClass =
    "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[10px] px-3.5 text-[13px] font-medium transition-[opacity,scale] duration-150 ease-out hover:opacity-90 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-[clamp(1rem,4vw,2rem)] py-16 font-sans antialiased" style={{ background: s.backdrop, color: s.ink }}>
      <div className="@container w-full max-w-[560px]">
        <motion.section
          ref={stageRef}
          aria-labelledby={`${uid}-title`}
          variants={sectionVariants}
          initial="hidden"
          animate={play ? "show" : "hidden"}
          className={`relative min-h-[440px] rounded-[18px] px-5 @md:px-6 ${stagePad}`}
          style={{ background: s.card, boxShadow: `inset 0 0 0 1px ${s.line}, inset 0 1px 0 rgba(255,255,255,0.04), ${s.shadow}` }}
        >
          <motion.header variants={riseVariants} className="flex items-center justify-between">
            <h2 id={`${uid}-title`} className="text-[14px] font-medium tracking-[-0.01em]">
              Inbox
            </h2>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: s.muted }}>
              {moved ? MOVED_COUNT[moved] : "12 unread"}
            </span>
          </motion.header>

          <motion.div variants={riseVariants} className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
            <p className="text-[13px] leading-[1.5]" style={{ color: s.muted }}>
              Showing 5 of 12 threads.
            </p>
            {/* Full width under the line on narrow stages: two equal buttons, or one per row below 320px of stage. */}
            <div className="grid w-full grid-cols-1 gap-2 @xs:grid-cols-2 @md:flex @md:w-auto">
              <button type="button" data-demo="snooze" onClick={() => start("snooze")} className={buttonClass} style={{ background: s.chip, color: s.ink }}>
                Snooze 5 threads
              </button>
              <button type="button" data-demo="archive" onClick={() => start("archive")} className={buttonClass} style={{ background: s.pill, color: s.onPill }}>
                Archive 12 threads
              </button>
            </div>
          </motion.div>

          <motion.ul variants={riseVariants} className="mt-5">
            {THREADS.map((t) => (
              <motion.li key={t.id} variants={riseVariants} className="border-t py-3 first:border-t-0" style={{ borderColor: s.line }}>
                <motion.div animate={{ opacity: moved ? 0.3 : 1, x: moved && !reduce ? -6 : 0 }} transition={{ duration: reduce ? 0.15 : 0.4, ease: EASE_OUT }} className="flex items-center gap-3">
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
              onRetry={() => {
                setRecoveredKey(runKey);
                rest.onRetry?.();
              }}
              onStatusChange={(status) => {
                setMoved(status === "success" ? trigger : null);
                rest.onStatusChange?.(status);
              }}
            />
          )}
        </motion.section>
      </div>
    </div>
  );
}
