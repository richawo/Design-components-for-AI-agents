"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { LoaderCircle, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Store: a module-level list read with useSyncExternalStore            */
/* ------------------------------------------------------------------ */

export type ToastType = "success" | "error" | "info" | "loading";

export type ToastAction = { label: string; onClick: () => void };

export type ToastData = {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  /** Milliseconds before auto-dismiss. Loading toasts never auto-dismiss. Honoured when `explicit`; otherwise the Toaster’s `duration` applies. */
  duration: number;
  /** True when the caller passed its own `duration`, which then beats the Toaster’s. */
  explicit?: boolean;
  /** Bumped whenever the toast changes, which restarts its timer. */
  version: number;
};

export type ToastOptions = {
  description?: string;
  action?: ToastAction;
  duration?: number;
};

type PromiseMessages<T> = {
  loading: string;
  success: string | ((value: T) => string);
  error: string | ((err: unknown) => string);
  description?: { loading?: string; success?: string; error?: string };
};

const LIMITS = { max: 5, duration: 5000, errorDuration: 8000 } as const;
/** Errors stay up this much longer than the Toaster’s `duration`. */
const ERROR_LINGER = LIMITS.errorDuration / LIMITS.duration;

let toasts: ToastData[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(next: ToastData[]) {
  toasts = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getSnapshot = () => toasts;
const getServerSnapshot = (): ToastData[] => [];

function push(type: ToastType, title: string, opts: ToastOptions = {}) {
  const id = nextId++;
  const t: ToastData = {
    id,
    type,
    title,
    description: opts.description,
    action: opts.action,
    duration: opts.duration ?? (type === "error" ? LIMITS.errorDuration : LIMITS.duration),
    explicit: opts.duration !== undefined,
    version: 0,
  };
  // Newest first. Anything past the cap is dropped from the back.
  emit([t, ...toasts].slice(0, LIMITS.max));
  return id;
}

function update(id: number, patch: Partial<Omit<ToastData, "id" | "version">>) {
  emit(toasts.map((t) => (t.id === id ? { ...t, ...patch, version: t.version + 1 } : t)));
}

function dismiss(id?: number) {
  emit(id === undefined ? [] : toasts.filter((t) => t.id !== id));
}

function promise<T>(p: Promise<T>, m: PromiseMessages<T>, opts: ToastOptions = {}) {
  const id = push("loading", m.loading, { ...opts, description: m.description?.loading });
  p.then(
    (v) =>
      update(id, {
        type: "success",
        title: typeof m.success === "function" ? m.success(v) : m.success,
        description: m.description?.success,
        duration: opts.duration ?? LIMITS.duration,
      }),
    (e: unknown) =>
      update(id, {
        type: "error",
        title: typeof m.error === "function" ? m.error(e) : m.error,
        description: m.description?.error,
        duration: opts.duration ?? LIMITS.errorDuration,
      }),
  );
  return p;
}

/** Fire toasts from anywhere, including outside React. */
export const toast = Object.assign((title: string, opts?: ToastOptions) => push("info", title, opts), {
  success: (title: string, opts?: ToastOptions) => push("success", title, opts),
  error: (title: string, opts?: ToastOptions) => push("error", title, opts),
  info: (title: string, opts?: ToastOptions) => push("info", title, opts),
  promise,
  dismiss,
});

/** The live list of toasts plus the functions that create and dismiss them. */
export function useToasts() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => ({ toasts: list, toast, success: toast.success, error: toast.error, info: toast.info, promise: toast.promise, dismiss }), [list]);
}

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    card: "#1c1c1f",
    line: "rgba(255,255,255,0.08)",
    sheen: "rgba(255,255,255,0.06)",
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    timer: "rgba(255,255,255,0.25)",
    hover: "rgba(255,255,255,0.06)",
    info: "#48484f",
    onInfo: "#f4f4f5",
    success: "#3ddc97",
    onSuccess: "#06291a",
    error: "#ff6b5e",
    onError: "#3a0904",
    shadow: "0 16px 40px -12px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.35)",
  },
  light: {
    card: "#ffffff",
    line: "rgba(24,24,27,0.08)",
    sheen: "rgba(255,255,255,0)",
    ink: "#18181b",
    muted: "#52525b",
    timer: "rgba(24,24,27,0.22)",
    hover: "rgba(24,24,27,0.05)",
    info: "#e4e4e7",
    onInfo: "#3f3f46",
    success: "#16a34a",
    onSuccess: "#ffffff",
    error: "#dc2626",
    onError: "#ffffff",
    shadow: "0 16px 40px -16px rgba(24,24,27,0.24), 0 2px 6px rgba(24,24,27,0.06)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
/** Cards settle like a hand being dealt: quick, no overshoot. */
const SPRING_STACK = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } as const;
const SPRING_HOME = { type: "spring", stiffness: 500, damping: 35 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  enterFrom: 56, // px below the stack a new toast rises from
  inner: 0.06, // icon, title, description, action follow the card in, this far apart
  innerRise: 6, // px
  innerBlur: 4, // px
  innerDuration: 0.34,
  timerAfter: 0.35, // the countdown line starts once the card has landed
  check: 0.32,
  exit: 0.2,
  height: 0.35,
  fade: 0.15, // reduced motion
} as const;

const STACK = { gap: 10, peek: 14, visible: 3, shrink: 0.05, fallbackHeight: 68 } as const;
const SWIPE = { distance: 90, velocity: 600, fadeAt: 220, flyTo: 420, flyFor: 0.22 } as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--ts-accent": accent, "--ts-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--ts-${k}`] = v;
  return vars as CSSProperties;
}

/** Entrance for an inner block: rises out of a light blur. Reduced motion: a short fade. */
function rise(delay: number, reduce: boolean, distance: number = MOTION.innerRise, blur: number = MOTION.innerBlur, duration: number = MOTION.innerDuration) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: distance, filter: `blur(${blur}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } },
    transition: { duration, ease: EASE_OUT, delay },
  };
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ts-ink)]";

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** Alt + key focuses the newest toast. */
function useFocusHotkey(hotkey: string, listRef: RefObject<HTMLOListElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === hotkey.toLowerCase()) {
        e.preventDefault();
        listRef.current?.querySelector<HTMLElement>("[data-toast]")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, listRef]);
}

function useTabHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return hidden;
}

/**
 * A toast’s remaining life as a motion value (1 → 0). It drives the countdown line and
 * dismisses the toast when it runs out. Pausing stops the tween; resuming continues from
 * wherever it stopped. Each update (a promise settling) refills it.
 */
function useLifetime(t: ToastData, running: boolean, duration: number) {
  const life = useMotionValue(1);
  const fresh = useRef(true);

  useEffect(() => {
    life.set(1);
    fresh.current = true;
  }, [t.version, life]);

  useEffect(() => {
    if (!running) return;
    const delay = fresh.current ? MOTION.timerAfter : 0;
    fresh.current = false;
    const run = animate(life, 0, { duration: (life.get() * duration) / 1000, ease: "linear", delay, onComplete: () => dismiss(t.id) });
    return () => run.stop();
  }, [running, t.id, t.version, duration, life]);

  return life;
}

/* ------------------------------------------------------------------ */
/* Toaster                                                              */
/* ------------------------------------------------------------------ */

export type ToasterProps = {
  /** "fixed" pins the stack to the viewport; "absolute" keeps it inside the nearest positioned parent. */
  strategy?: "fixed" | "absolute";
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  /** Accessible name of the region. */
  label?: string;
  /** Alt + this key moves focus to the newest toast. */
  hotkey?: string;
  /** The one accent: the action button. Defaults to the theme’s ink. */
  accent?: string;
  theme?: "dark" | "light";
  /** Milliseconds a toast stays before it dismisses itself, unless it was created with its own `duration`. Errors stay 1.6 times as long. */
  duration?: number;
  /** How many cards peek out behind the front one while the stack is collapsed (1 to 5). */
  visible?: number;
};

const PLACE = {
  "bottom-center": "sm:left-1/2 sm:right-auto sm:-translate-x-1/2",
  "bottom-left": "sm:left-6 sm:right-auto",
  "bottom-right": "sm:left-auto sm:right-6",
} as const;

export function Toaster({ strategy = "fixed", position = "bottom-right", label = "Notifications", hotkey = "t", accent, theme = "dark", duration = LIMITS.duration, visible: visibleProp = STACK.visible }: ToasterProps) {
  const { toasts: list } = useToasts();
  const reduce = useReducedMotion() ?? false;
  const listRef = useRef<HTMLOListElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false); // tap-to-expand on touch
  const [heights, setHeights] = useState<Record<number, number>>({});
  const hidden = useTabHidden();
  const palette = PALETTE[theme];
  const visible = Math.min(LIMITS.max, Math.max(1, Math.round(visibleProp)));

  useFocusHotkey(hotkey, listRef);

  const expanded = (hovered || focused || pinned) && list.length > 1;
  const paused = hovered || focused || pinned || hidden;

  // Collapse a tap-expanded stack when the user taps elsewhere or it empties.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pinned]);
  useEffect(() => {
    if (list.length < 2) setPinned(false);
  }, [list.length]);
  // A focused toast that unmounts (dismissed by click or key) never fires blur, which would leave the stack fanned out and paused.
  useEffect(() => {
    if (focused && !listRef.current?.contains(document.activeElement)) setFocused(false);
  }, [list, focused]);

  const setHeight = useCallback((id: number, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  const h = (id: number) => heights[id] ?? STACK.fallbackHeight;
  const frontH = list[0] ? h(list[0].id) : 0;
  const offsets = list.map((_, i) => list.slice(0, i).reduce((acc, t) => acc + h(t.id) + STACK.gap, 0));
  const stackH = expanded
    ? list.reduce((acc, t) => acc + h(t.id), 0) + STACK.gap * Math.max(0, list.length - 1)
    : frontH + STACK.peek * Math.min(Math.max(0, list.length - 1), visible - 1);

  return (
    <section
      aria-label={`${label} (Alt+${hotkey.toUpperCase()})`}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`${strategy === "fixed" ? "fixed" : "absolute"} bottom-4 left-4 right-4 z-50 font-sans antialiased sm:bottom-6 sm:w-[360px] ${PLACE[position]}`}
    >
      <motion.ol
        ref={listRef}
        data-demo="stack"
        className="relative m-0 list-none p-0"
        animate={{ height: stackH }}
        transition={reduce ? { duration: 0 } : { duration: MOTION.height, ease: EASE_OUT }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== "mouse" && !expanded && list.length > 1) setPinned(true);
        }}
      >
        <AnimatePresence initial={false}>
          {list.map((t, i) => (
            <ToastItem key={t.id} toast={t} index={i} count={list.length} expanded={expanded} paused={paused} offset={offsets[i]} frontHeight={frontH} reduce={reduce} visible={visible} duration={duration} onHeight={setHeight} />
          ))}
        </AnimatePresence>
      </motion.ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One toast                                                            */
/* ------------------------------------------------------------------ */

const TONE: Record<ToastType, { disc: string; label: string }> = {
  success: { disc: "bg-[var(--ts-success)] text-[var(--ts-onSuccess)]", label: "Success" },
  error: { disc: "bg-[var(--ts-error)] text-[var(--ts-onError)]", label: "Error" },
  info: { disc: "bg-[var(--ts-info)] text-[var(--ts-onInfo)]", label: "Info" },
  loading: { disc: "bg-transparent text-[var(--ts-muted)]", label: "In progress" },
};

function ToastGlyph({ type, reduce }: { type: ToastType; reduce: boolean }) {
  if (type === "loading") return <LoaderCircle size={16} strokeWidth={2.4} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  if (type === "success")
    return (
      <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden="true">
        <motion.path
          d="M2.6 6.3l2.2 2.2 4.6-4.9"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: MOTION.check, ease: EASE_OUT, delay: MOTION.inner * 2 }}
        />
      </svg>
    );
  // “!” for errors, “i” for info: the same two strokes, flipped.
  const bang = type === "error";
  return (
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
      <path d={bang ? "M6 2.6v4" : "M6 5.4v4"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="6" cy={bang ? 9.2 : 2.9} r="1.05" fill="currentColor" />
    </svg>
  );
}

function ToastItem({
  toast: t,
  index,
  count,
  expanded,
  paused,
  offset,
  frontHeight,
  reduce,
  visible,
  duration,
  onHeight,
}: {
  toast: ToastData;
  index: number;
  count: number;
  expanded: boolean;
  paused: boolean;
  offset: number;
  frontHeight: number;
  reduce: boolean;
  visible: number;
  duration: number;
  onHeight: (id: number, h: number) => void;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const x = useMotionValue(0);
  const fade = useTransform(x, [-SWIPE.fadeAt, 0, SWIPE.fadeAt], [0, 1, 0]);
  const front = index === 0;
  const tucked = !expanded && !front; // behind the front card: only its top sliver shows
  const lifespan = t.explicit ? t.duration : t.type === "error" ? duration * ERROR_LINGER : duration;
  const timed = t.type !== "loading" && Number.isFinite(lifespan);
  const life = useLifetime(t, timed && !paused && !dragging, lifespan);

  // Measure the natural height so the stack can lay itself out.
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const hh = Math.round(el.offsetHeight);
      setHeight(hh);
      onHeight(t.id, hh);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [t.id, onHeight]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragging(false);
    const out = Math.abs(info.offset.x) > SWIPE.distance || Math.abs(info.velocity.x) > SWIPE.velocity;
    if (out) {
      const dir = Math.sign(info.offset.x || info.velocity.x) || 1;
      animate(x, dir * SWIPE.flyTo, { duration: SWIPE.flyFor, ease: EASE_OUT }).then(() => dismiss(t.id));
    } else {
      animate(x, 0, SPRING_HOME);
    }
  };

  const target = expanded
    ? { y: -offset, scale: 1, opacity: 1 }
    : { y: -index * STACK.peek, scale: 1 - index * STACK.shrink, opacity: index < visible ? 1 : 0 };
  // Cards behind the front one borrow its height while collapsed, so nothing peeks out underneath.
  const cardHeight = expanded || front ? height : frontHeight;
  const tone = TONE[t.type];
  // Text swaps (a promise settling) cross-fade with a small offset and blur.
  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 6, filter: "blur(3px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, exit: { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.14, ease: EASE_IN } } };

  return (
    <motion.li
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.enterFrom, scale: 1 }}
      animate={target}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, transition: { duration: MOTION.exit, ease: EASE_IN } }}
      transition={reduce ? { duration: MOTION.fade } : SPRING_STACK}
      style={{ zIndex: count - index, transformOrigin: "50% 0%" }}
      className={`absolute inset-x-0 bottom-0 ${tucked ? "pointer-events-none" : ""}`}
    >
      <motion.div
        data-toast
        data-demo={`toast-${index}`}
        tabIndex={0}
        role={t.type === "error" ? "alert" : "status"}
        aria-live={t.type === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        aria-label={`${tone.label}: ${t.title}${t.description ? `. ${t.description}` : ""}`}
        drag={reduce ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.85}
        dragSnapToOrigin={false}
        onDragStart={() => setDragging(true)}
        onDragEnd={onDragEnd}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            dismiss(t.id);
          }
        }}
        animate={cardHeight ? { height: cardHeight } : undefined}
        transition={reduce ? { duration: 0 } : SPRING_STACK}
        style={{ x, opacity: fade }}
        className={`group relative cursor-grab touch-pan-y overflow-hidden rounded-[14px] bg-[var(--ts-card)] text-left shadow-[inset_0_0_0_1px_var(--ts-line),inset_0_1px_0_var(--ts-sheen),var(--ts-shadow)] active:cursor-grabbing ${focusRing}`}
      >
        <div ref={inner} className={`flex items-start gap-3 py-3.5 pl-4 pr-10 transition-opacity duration-200 ${tucked ? "opacity-0" : "opacity-100"}`}>
          <motion.span
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: MOTION.fade } : { ...SPRING_HOME, delay: MOTION.inner }}
            className={`mt-[1px] flex size-[18px] shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${tone.disc}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={t.type}
                initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className="flex items-center justify-center"
              >
                <ToastGlyph type={t.type} reduce={reduce} />
              </motion.span>
            </AnimatePresence>
          </motion.span>
          <div className="min-w-0 flex-1">
            <motion.div {...rise(MOTION.inner, reduce)} className="relative">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p key={t.title} {...swap} transition={{ duration: 0.24, ease: EASE_OUT }} className="text-[14px] font-medium leading-[1.35] tracking-[-0.005em] text-[var(--ts-ink)]">
                  {t.title}
                </motion.p>
              </AnimatePresence>
            </motion.div>
            {t.description && (
              <motion.p {...rise(MOTION.inner * 2, reduce)} className="mt-0.5 text-[13px] leading-[1.45] text-[var(--ts-muted)]">
                {t.description}
              </motion.p>
            )}
            {t.action && (
              <motion.div {...rise(MOTION.inner * 3, reduce)}>
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className={`mt-2.5 inline-flex h-8 items-center rounded-[8px] bg-[var(--ts-accent)] px-3 text-[13px] font-medium text-[var(--ts-on-accent)] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] ${focusRing}`}
                >
                  {t.action.label}
                </button>
              </motion.div>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          data-demo={`dismiss-${index}`}
          onClick={() => dismiss(t.id)}
          onPointerDownCapture={(e) => e.stopPropagation()}
          className={`absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-[8px] text-[var(--ts-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--ts-hover)] hover:text-[var(--ts-ink)] active:scale-[0.97] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ts-ink)] ${tucked ? "opacity-0" : ""}`}
        >
          <X size={14} strokeWidth={2.25} aria-hidden="true" />
        </button>
        {timed && <motion.span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px origin-left bg-[var(--ts-timer)]" style={{ scaleX: life }} />}
      </motion.div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: a draft’s actions, each answered by a toast                    */
/* ------------------------------------------------------------------ */

/** The demo’s quiet backdrop and card; not part of the component. */
const STAGE = {
  dark: { backdrop: "#0a0a0b", card: "#111113", line: "#232327", rule: "#1c1c1f", ink: "#f4f4f5", muted: "#a1a1aa", faint: "#8a8a93", hover: "rgba(255,255,255,0.03)", hint: "#d4d4d8", shadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 32px 64px -32px rgba(0,0,0,0.9)" },
  light: { backdrop: "#f4f4f5", card: "#ffffff", line: "#e4e4e7", rule: "#ececee", ink: "#18181b", muted: "#52525b", faint: "#71717a", hover: "rgba(24,24,27,0.04)", hint: "#3f3f46", shadow: "0 32px 64px -36px rgba(24,24,27,0.28), 0 1px 2px rgba(24,24,27,0.05)" },
} as const;
const DEMO_MOTION = { block: 0.5, step: 0.06, buttonsAt: 0.24, hintAt: 0.5, count: 0.9, seedAt: 0.3, seedStep: 0.16, redealAfter: 1.2 } as const;
/** The first accent swatch is the dark theme's ink; picking it means "theme ink", so it never paints a white button on a white card. */
const THEME_INK_SWATCH = "#f4f4f5";
/** Toasts in the demo linger long enough to be played with. The `duration` control tunes it. */
const DEMO_DURATION = 12000;
const WORDS = 1284;

type DemoAction = { id: string; label: string; hint: string; fire: () => void };

function demoActions(): DemoAction[] {
  return [
    { id: "save", label: "Save draft", hint: "Success", fire: () => toast.success("Draft saved", { description: "1,284 words, all of them yours." }) },
    {
      id: "publish",
      label: "Publish",
      hint: "Promise",
      fire: () => void toast.promise(new Promise<void>((r) => setTimeout(r, 1300)), { loading: "Publishing to 4,120 readers…", success: "Published. Go and make a coffee.", error: "That didn’t work" }),
    },
    {
      id: "proofs",
      label: "Send proofs",
      hint: "Error",
      fire: () =>
        toast.error("Couldn’t reach the printer", {
          description: "The proofs are safe. We’ll try again in a minute.",
          action: { label: "Retry now", onClick: () => toast.success("Proofs sent to the printer") },
        }),
    },
    {
      id: "bin",
      label: "Move to bin",
      hint: "Undo",
      fire: () => toast.info("Moved 3 drafts to the bin", { description: "They’ll stay there for 30 days.", action: { label: "Undo", onClick: () => toast.success("Restored 3 drafts") } }),
    },
  ];
}

function demoEnter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: 12, filter: "blur(8px)" },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: DEMO_MOTION.block, ease: EASE_OUT, delay },
  };
}

/** The word count ticks up from zero as the card lands; a motion value, so no re-render per frame. */
function WordCount({ play, reduce }: { play: boolean; reduce: boolean }) {
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => Math.round(v).toLocaleString("en-GB"));
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      value.set(WORDS);
      return;
    }
    const run = animate(value, WORDS, { duration: DEMO_MOTION.count, ease: EASE_OUT, delay: DEMO_MOTION.step * 2 });
    return () => run.stop();
  }, [play, reduce, value]);
  return (
    <>
      <motion.span aria-hidden="true" className="tabular-nums">
        {text}
      </motion.span>
      <span className="sr-only">{WORDS.toLocaleString("en-GB")}</span>
    </>
  );
}

export default function ToastStackDemo(overrides: Partial<ToasterProps> = {}) {
  const stage = STAGE[overrides.theme ?? "dark"];
  const accent = overrides.accent && overrides.accent.toLowerCase() !== THEME_INK_SWATCH ? overrides.accent : undefined;
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const card = useRef<HTMLElement>(null);
  const play = useInView(card, { once: true, amount: 0.3 });
  const actions = useMemo(demoActions, []);
  const { toasts: live } = useToasts();
  const empty = live.length === 0;
  // Each deal is a round; a new round deals the same hand again.
  const [round, setRound] = useState(0);

  // Five toasts arrive from 0.3s, as the card lands, so the stack is there to play with.
  useEffect(() => {
    if (!play) return;
    // The action-bearing toast lands last so its button is in front, where the accent control shows.
    // It skips the description so the resting stack stays short and the hint line stays clear.
    const seed = [
      () => toast.info("Maya Okafor left a comment", { description: "“Cut the second paragraph. Trust me.”" }),
      () => toast.success("Cover image uploaded", { description: "Autumn-cover.jpg, 2.4 MB." }),
      actions[0].fire,
      () => toast.info("Autosave is on", { description: "Every 30 seconds." }),
      () => toast.info("Moved 3 drafts to the bin", { action: { label: "Undo", onClick: () => toast.success("Restored 3 drafts") } }),
    ];
    const timers = seed.map((fire, i) => setTimeout(fire, reduce ? 0 : (DEMO_MOTION.seedAt + i * DEMO_MOTION.seedStep) * 1000));
    return () => {
      timers.forEach(clearTimeout);
      toast.dismiss();
    };
  }, [play, reduce, actions, round]);

  // Keep the stack alive: once it has been empty a moment, deal again; if a control changes while it is empty, deal at once.
  const overrideKey = JSON.stringify(overrides);
  const lastKey = useRef(overrideKey);
  useEffect(() => {
    const changed = lastKey.current !== overrideKey;
    lastKey.current = overrideKey;
    if (!play || !empty) return;
    const timer = setTimeout(() => setRound((r) => r + 1), changed ? 0 : DEMO_MOTION.redealAfter * 1000);
    return () => clearTimeout(timer);
  }, [play, empty, overrideKey]);

  return (
    <div className="@container flex min-h-dvh w-full flex-col items-center justify-center px-4 pb-48 pt-12 font-sans sm:pb-12 antialiased sm:px-8" style={{ background: stage.backdrop, color: stage.ink, ["--st-hover" as string]: stage.hover, ["--st-hint" as string]: stage.hint, ["--st-ink" as string]: stage.ink }}>
      <motion.section
        ref={card}
        aria-labelledby={`${uid}-title`}
        {...demoEnter(play, 0, reduce)}
        className="w-full max-w-[460px] overflow-hidden rounded-[16px] border"
        style={{ background: stage.card, borderColor: stage.line, boxShadow: stage.shadow }}
      >
        <header className="px-5 pb-5 pt-5">
          <motion.p {...demoEnter(play, DEMO_MOTION.step, reduce)} className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: stage.faint }}>
            Quire · Draft 7
          </motion.p>
          <motion.h2 {...demoEnter(play, DEMO_MOTION.step * 2, reduce)} id={`${uid}-title`} className="mt-2 font-display text-[22px] font-semibold leading-tight tracking-[-0.03em]">
            The Autumn Issue
          </motion.h2>
          <motion.p {...demoEnter(play, DEMO_MOTION.step * 3, reduce)} className="mt-1 text-[13px]" style={{ color: stage.muted }}>
            <WordCount play={play} reduce={reduce} /> words · edited 2 minutes ago
          </motion.p>
        </header>
        <ul className="grid grid-cols-2 gap-px border-t" style={{ borderColor: stage.line, background: stage.rule }}>
          {actions.map((a, i) => (
            <motion.li key={a.id} {...demoEnter(play, DEMO_MOTION.buttonsAt + i * DEMO_MOTION.step, reduce)} style={{ background: stage.card }}>
              <button
                type="button"
                data-demo={a.id}
                onClick={a.fire}
                className="group flex h-16 w-full flex-col items-start justify-center px-5 text-left transition-[background-color,transform] duration-150 hover:bg-[var(--st-hover)] active:scale-[0.98] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--st-ink)]"
              >
                <span className="text-[14px] font-medium">{a.label}</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors duration-150 group-hover:text-[var(--st-hint)]" style={{ color: stage.faint }}>
                  {a.hint}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      </motion.section>
      <motion.p {...demoEnter(play, DEMO_MOTION.hintAt, reduce)} className="mt-5 text-center font-mono text-[11px] uppercase leading-[1.7] tracking-[0.12em]" style={{ color: stage.faint }}>
        Hover the stack to fan out · Swipe to dismiss<span className="hidden @lg:inline"> · Alt+T</span>
      </motion.p>
      <Toaster duration={DEMO_DURATION} {...overrides} accent={accent} />
    </div>
  );
}
