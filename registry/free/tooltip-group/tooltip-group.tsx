"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { Bold, Code, Italic, Link2, MessageSquarePlus, Strikethrough, Underline, type LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type TooltipSide = "top" | "right" | "bottom" | "left";

/** How a tooltip came to open: after the rest delay, instantly from a warm neighbour, on keyboard focus, on a long press, or pinned for a preview. */
export type TooltipOpenReason = "delay" | "skip" | "focus" | "press" | "pinned";

export type TooltipTimingEvent =
  | { type: "wait"; id: string; delay: number }
  | { type: "cancel"; id: string }
  | { type: "open"; id: string; label: string; via: TooltipOpenReason; side: TooltipSide; flipped: boolean }
  | { type: "close"; id: string };

export type TooltipGroupProps = {
  /** Triggers wrapped in `<Tooltip>`, plus anything else. The group is also the collision boundary. */
  children?: ReactNode;
  /** How long the pointer must rest on a cold trigger before its tooltip opens, in ms. */
  delay?: number;
  /** After a tooltip closes, how long the group stays warm, so the next one opens instantly. In ms. */
  skipDelay?: number;
  /** Preferred side. A tooltip that would leave the group flips to the opposite side. */
  side?: TooltipSide;
  /** Draw an arrow that tracks the centre of its trigger. */
  arrow?: boolean;
  /** Show keyboard shortcuts as keycaps. */
  shortcuts?: boolean;
  /** Space between the trigger and the tooltip (on top of the arrow), in px. */
  offset?: number;
  /** Closest a tooltip may sit to the group's edge before it shifts or flips, in px. */
  collisionPadding?: number;
  /** Tooltip id to show once on mount, as if hovered. The first pointer or focus in the group takes over. */
  defaultActive?: string | null;
  /** The surface the group sits on, so the tooltip's shadow and hairline keep their contrast. */
  theme?: "dark" | "light";
  /** Every timing decision as it happens: waiting, opened (and why), cancelled, closed. */
  onTimingEvent?: (event: TooltipTimingEvent) => void;
  className?: string;
  style?: CSSProperties;
};

export type TooltipProps = {
  /** Stable id, used by `defaultActive`. Defaults to a generated one. */
  id?: string;
  /** What the trigger does, in two or three words. */
  label: string;
  /** Keys as printed on the keycaps, e.g. ["⌘", "B"]. */
  shortcut?: string[];
  /** One element (usually a button). It receives aria-describedby while its tooltip is open. */
  children: ReactElement<{ "aria-describedby"?: string; "aria-keyshortcuts"?: string }>;
};

type Entry = { label: string; shortcut?: string[]; el: HTMLElement };
type Box = { x: number; y: number; w: number; h: number };
type Placement = { side: TooltipSide; x: number; y: number; ax: number; ay: number };

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

const TIMING = {
  enter: 0.18, // a fresh tooltip arriving
  exit: 0.07, // closing reads as instant, with one frame of fade so it doesn't pop
  fade: 0.12, // reduced motion
  nudge: 4, // a fresh tooltip slides this far away from its trigger as it arrives
  rejoinMs: 120, // crossing a separator between neighbours still glides instead of re-entering
  pinLeadMs: 300, // a pinned tooltip waits for the delay plus this, so it lands after its surface
  longPressMs: 450, // touch has no hover: a long press shows the tooltip
  touchLingerMs: 1400,
} as const;

/** The arrow: a 14px wide triangle, 6px deep, drawn in a 14×14 box centred on the tooltip's edge. */
const ARROW = { size: 14, depth: 6, inset: 10 } as const;

const OPPOSITE: Record<TooltipSide, TooltipSide> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const ARROW_TURN: Record<TooltipSide, number> = { top: 0, bottom: 180, left: -90, right: 90 };
const ORIGIN: Record<TooltipSide, string> = { top: "50% 100%", bottom: "50% 0%", left: "100% 50%", right: "0% 50%" };

const SURFACE = {
  dark: {
    bg: "#1c1c1f",
    line: "rgba(255,255,255,0.1)",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 32px -12px rgba(0,0,0,0.95), 0 3px 8px -3px rgba(0,0,0,0.7)",
  },
  light: {
    bg: "#18181b",
    line: "rgba(255,255,255,0.06)",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px -12px rgba(24,24,27,0.5), 0 2px 6px -2px rgba(24,24,27,0.3)",
  },
} as const;

/** Printed key → the name aria-keyshortcuts expects. */
const KEY_NAMES: Record<string, string> = { "⌘": "Meta", "⇧": "Shift", "⌥": "Alt", "⌃": "Control", "↵": "Enter", "⌫": "Backspace" };

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* ------------------------------------------------------------------ */
/* Geometry                                                             */
/* ------------------------------------------------------------------ */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(v, hi));
}

/** The trigger's box in the group's padding-box coordinates (where an absolute child is positioned). */
function relativeBox(el: HTMLElement, root: HTMLElement): Box {
  const r = root.getBoundingClientRect();
  const a = el.getBoundingClientRect();
  return { x: a.left - r.left - root.clientLeft, y: a.top - r.top - root.clientTop, w: a.width, h: a.height };
}

/**
 * Preferred side if it fits inside the group, else the opposite side if that fits, else the preferred side anyway.
 * The cross axis shifts to stay inside, and the arrow keeps pointing at the trigger's centre.
 */
function place(anchor: Box, tip: { w: number; h: number }, bounds: { w: number; h: number }, want: TooltipSide, gap: number, pad: number): Placement {
  const fits = (s: TooltipSide) => {
    if (s === "top") return anchor.y - gap - tip.h >= pad;
    if (s === "bottom") return anchor.y + anchor.h + gap + tip.h <= bounds.h - pad;
    if (s === "left") return anchor.x - gap - tip.w >= pad;
    return anchor.x + anchor.w + gap + tip.w <= bounds.w - pad;
  };
  const side = fits(want) ? want : fits(OPPOSITE[want]) ? OPPOSITE[want] : want;
  const cx = anchor.x + anchor.w / 2;
  const cy = anchor.y + anchor.h / 2;

  if (side === "top" || side === "bottom") {
    const x = Math.max(pad, Math.min(cx - tip.w / 2, bounds.w - pad - tip.w));
    const y = side === "top" ? anchor.y - gap - tip.h : anchor.y + anchor.h + gap;
    const ax = clamp(cx - x, ARROW.inset, tip.w - ARROW.inset);
    return { side, x, y, ax, ay: side === "top" ? tip.h - 1 : 1 };
  }
  const y = Math.max(pad, Math.min(cy - tip.h / 2, bounds.h - pad - tip.h));
  const x = side === "left" ? anchor.x - gap - tip.w : anchor.x + anchor.w + gap;
  const ay = clamp(cy - y, ARROW.inset, tip.h - ARROW.inset);
  return { side, x, y, ax: side === "left" ? tip.w - 1 : 1, ay };
}

/* ------------------------------------------------------------------ */
/* Context                                                              */
/* ------------------------------------------------------------------ */

type GroupContextValue = {
  tipId: string;
  active: string | null;
  register: (id: string, entry: Entry) => void;
  unregister: (id: string) => void;
};

const GroupContext = createContext<GroupContextValue | null>(null);

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useIsoLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

function triggerOf(node: EventTarget | null, root: HTMLElement | null): string | null {
  if (!(node instanceof Element) || !root) return null;
  const el = node.closest<HTMLElement>("[data-tg-trigger]");
  return el && root.contains(el) ? el.dataset.tgTrigger ?? null : null;
}

/* ------------------------------------------------------------------ */
/* Tooltip (one trigger)                                                */
/* ------------------------------------------------------------------ */

/** Wraps one trigger. Hover timing, placement and the floating surface all belong to the group. */
export function Tooltip({ id: idProp, label, shortcut, children }: TooltipProps) {
  const ctx = useContext(GroupContext);
  const auto = useId();
  const id = idProp ?? auto;
  const ref = useRef<HTMLSpanElement>(null);
  const keysKey = shortcut ? shortcut.join("\u0000") : "";
  const keys = useMemo(() => (keysKey ? keysKey.split("\u0000") : undefined), [keysKey]);
  const register = ctx?.register;
  const unregister = ctx?.unregister;

  useIsoLayoutEffect(() => {
    if (!register || !unregister || !ref.current) return;
    register(id, { label, shortcut: keys, el: ref.current });
    return () => unregister(id);
  }, [register, unregister, id, label, keys]);

  if (!isValidElement(children)) return null;
  const extra = {
    "aria-describedby": ctx && ctx.active === id ? ctx.tipId : children.props["aria-describedby"],
    "aria-keyshortcuts": keys ? keys.map((k) => KEY_NAMES[k] ?? k).join("+") : children.props["aria-keyshortcuts"],
  };
  return (
    <span ref={ref} data-tg-trigger={id} className="inline-flex">
      {cloneElement(children, extra)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* TooltipGroup                                                         */
/* ------------------------------------------------------------------ */

export function TooltipGroup({
  children,
  delay = 400,
  skipDelay = 300,
  side = "top",
  arrow = true,
  shortcuts = true,
  offset = 6,
  collisionPadding = 8,
  defaultActive = null,
  theme = "dark",
  onTimingEvent,
  className = "",
  style,
}: TooltipGroupProps) {
  const reduce = useReducedMotion() ?? false;
  const tipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const entries = useRef(new Map<string, Entry>());
  const [version, setVersion] = useState(0);
  const [active, setActiveState] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(defaultActive);
  const [placed, setPlaced] = useState<{ side: TooltipSide; dir: number }>({ side, dir: 0 });
  const [layoutTick, setLayoutTick] = useState(0);

  const delayRef = useLatest(delay);
  const skipRef = useLatest(skipDelay);
  const emitRef = useLatest(onTimingEvent);

  // Timing state lives in one ref: it changes on every pointer event and must never cause a render by itself.
  const s = useRef({
    active: null as string | null,
    pending: null as string | null,
    timer: 0,
    press: 0,
    linger: 0,
    closedAt: -Infinity,
    suppress: null as string | null,
    pinned: false,
    swallowClick: false,
    via: "delay" as TooltipOpenReason,
  }).current;

  // One set of motion values places the surface; nothing about position goes through React state.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const w = useMotionValue(0);
  const h = useMotionValue(0);
  const ax = useMotionValue(0);
  const ay = useMotionValue(0);
  const arrowLeft = useTransform(ax, (v) => v - ARROW.size / 2);
  const arrowTop = useTransform(ay, (v) => v - ARROW.size / 2);
  const lastShown = useRef<{ id: string; side: TooltipSide; cx: number } | null>(null);
  const prevActive = useRef<string | null>(null);

  const register = useCallback((id: string, entry: Entry) => {
    entries.current.set(id, entry);
    setVersion((v) => v + 1);
  }, []);
  const unregister = useCallback((id: string) => {
    entries.current.delete(id);
    setVersion((v) => v + 1);
  }, []);

  const emit = useCallback((e: TooltipTimingEvent) => emitRef.current?.(e), [emitRef]);

  const setActive = useCallback(
    (id: string | null) => {
      s.active = id;
      setActiveState(id);
      if (id) setShownId(id);
    },
    [s],
  );

  const stopWaiting = useCallback(() => {
    window.clearTimeout(s.timer);
    window.clearTimeout(s.linger);
    const was = s.pending;
    s.pending = null;
    return was;
  }, [s]);

  const open = useCallback(
    (id: string, via: TooltipOpenReason) => {
      stopWaiting();
      s.via = via;
      if (s.active !== id) setActive(id);
    },
    [s, setActive, stopWaiting],
  );

  /** Closing is always instant. It leaves the group warm, so a neighbour opens without the wait. */
  const close = useCallback(
    (warm = true) => {
      const waiting = stopWaiting();
      if (s.active) {
        const id = s.active;
        s.closedAt = warm ? performance.now() : -Infinity;
        setActive(null);
        emit({ type: "close", id });
      } else if (waiting) emit({ type: "cancel", id: waiting });
    },
    [emit, s, setActive, stopWaiting],
  );

  /** A pinned preview tooltip gives way to the first real interaction, and leaves the group cold. */
  const unpin = useCallback(() => {
    if (!s.pinned) return;
    s.pinned = false;
    close(false);
  }, [close, s]);

  /** The heart of the timing model: what to do when the pointer arrives over `id` (or over nothing). */
  const target = useCallback(
    (id: string | null) => {
      unpin();
      if (id === null) {
        s.suppress = null;
        close();
        return;
      }
      if (id === s.suppress) return; // pressed, and still over it
      s.suppress = null;
      if (id === s.active || id === s.pending) return;
      const warm = s.active !== null || performance.now() - s.closedAt < skipRef.current;
      if (warm) return open(id, "skip");
      if (delayRef.current <= 0) return open(id, "delay");
      stopWaiting();
      s.pending = id;
      emit({ type: "wait", id, delay: delayRef.current });
      s.timer = window.setTimeout(() => open(id, "delay"), delayRef.current);
    },
    [close, delayRef, emit, open, s, skipRef, stopWaiting, unpin],
  );

  // A pinned tooltip opens as a hover would, a beat after the surface has landed.
  useEffect(() => {
    if (!defaultActive) return;
    s.pinned = true;
    const t = window.setTimeout(() => {
      if (s.pinned && entries.current.has(defaultActive)) open(defaultActive, "pinned");
    }, delayRef.current + TIMING.pinLeadMs);
    return () => window.clearTimeout(t);
    // Mount only: it is a starting state, not a controlled one.
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(s.timer);
      window.clearTimeout(s.press);
      window.clearTimeout(s.linger);
    },
    [s],
  );

  // Escape closes, wherever focus is, and keeps that tooltip shut until the pointer moves on.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      s.suppress = s.active;
      s.pinned = false;
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close, s]);

  // Re-place an open tooltip when the group resizes (the trigger may have moved under it).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => s.active && setLayoutTick((t) => t + 1));
    ro.observe(root);
    return () => ro.disconnect();
  }, [s]);

  // Placement: measure the content, choose a side, then glide (neighbour) or arrive (fresh).
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const box = measureRef.current;
    const entry = active ? entries.current.get(active) : undefined;
    if (!active || !root || !box || !entry) {
      prevActive.current = null;
      return;
    }
    const anchor = relativeBox(entry.el, root);
    const size = { w: box.offsetWidth, h: box.offsetHeight };
    const gap = offset + (arrow ? ARROW.depth : 0);
    const p = place(anchor, size, { w: root.clientWidth, h: root.clientHeight }, side, gap, collisionPadding);
    const cx = anchor.x + anchor.w / 2;

    const prev = lastShown.current;
    const continuing = prev !== null && (prevActive.current !== null || performance.now() - s.closedAt < TIMING.rejoinMs);
    const dir = continuing && prev ? Math.sign(cx - prev.cx) : 0;
    setPlaced({ side: p.side, dir });

    if (reduce || !continuing) {
      w.set(size.w);
      h.set(size.h);
      ax.set(p.ax);
      ay.set(p.ay);
      x.set(p.x);
      y.set(p.y);
      if (!reduce) {
        // Arrive from a few px nearer the trigger.
        const n = TIMING.nudge;
        const [dx, dy] = p.side === "top" ? [0, n] : p.side === "bottom" ? [0, -n] : p.side === "left" ? [n, 0] : [-n, 0];
        x.set(p.x + dx);
        y.set(p.y + dy);
        animate(x, p.x, { duration: TIMING.enter, ease: EASE_OUT });
        animate(y, p.y, { duration: TIMING.enter, ease: EASE_OUT });
      }
    } else {
      // A neighbour in the same group: the one surface travels, resizes and re-aims its arrow.
      animate(x, p.x, SPRING_UI);
      animate(y, p.y, SPRING_UI);
      animate(w, size.w, SPRING_UI);
      animate(h, size.h, SPRING_UI);
      if (prev && prev.side !== p.side) {
        ax.set(p.ax);
        ay.set(p.ay);
      } else {
        animate(ax, p.ax, SPRING_UI);
        animate(ay, p.ay, SPRING_UI);
      }
    }

    if (!prev || prev.id !== active || prev.side !== p.side || prevActive.current === null) {
      emit({ type: "open", id: active, label: entry.label, via: s.via, side: p.side, flipped: p.side !== side });
    }
    lastShown.current = { id: active, side: p.side, cx };
    prevActive.current = active;
  }, [active, version, side, arrow, shortcuts, offset, collisionPadding, layoutTick, reduce]);

  const shown = shownId ? entries.current.get(shownId) : undefined;
  const palette = SURFACE[theme];
  const isOpen = active !== null;
  const ctx = useMemo<GroupContextValue>(() => ({ tipId, active, register, unregister }), [tipId, active, register, unregister]);

  return (
    <GroupContext.Provider value={ctx}>
      <div
        ref={rootRef}
        data-theme={theme}
        className={`relative isolate ${className}`}
        style={{ ...style, "--tg-bg": palette.bg, "--tg-line": palette.line } as CSSProperties}
        onPointerOver={(e) => {
          if (e.pointerType === "touch") return;
          target(triggerOf(e.target, rootRef.current));
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "touch") return;
          unpin();
          s.suppress = null;
          close();
        }}
        onPointerDown={(e) => {
          const id = triggerOf(e.target, rootRef.current);
          if (!id) return;
          if (e.pointerType === "touch") {
            window.clearTimeout(s.press);
            s.press = window.setTimeout(() => {
              unpin();
              s.swallowClick = true;
              open(id, "press");
            }, TIMING.longPressMs);
            return;
          }
          // A click is the user acting, not asking: the tooltip gets out of the way.
          unpin();
          close();
          s.suppress = id;
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== "touch") return;
          window.clearTimeout(s.press);
          if (s.via === "press" && s.active) s.linger = window.setTimeout(() => close(), TIMING.touchLingerMs);
        }}
        onPointerCancel={() => window.clearTimeout(s.press)}
        onClickCapture={(e) => {
          if (!s.swallowClick) return;
          s.swallowClick = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        onFocus={(e) => {
          const id = triggerOf(e.target, rootRef.current);
          if (!id || id === s.suppress) return;
          let keyboard = false;
          try {
            keyboard = (e.target as Element).matches(":focus-visible");
          } catch {
            keyboard = false;
          }
          if (!keyboard) return;
          s.pinned = false;
          open(id, "focus");
        }}
        onBlur={(e) => {
          if (triggerOf(e.relatedTarget, rootRef.current)) return;
          if (s.via === "focus" && s.active) close();
        }}
      >
        {children}

        {/* The one floating surface. Always mounted, so it can travel between triggers instead of re-entering. */}
        <motion.div
          role="tooltip"
          id={tipId}
          aria-hidden={!isOpen}
          data-side={placed.side}
          initial={{ opacity: 0, visibility: "hidden" }}
          animate={
            isOpen
              ? { opacity: 1, scale: 1, filter: "blur(0px)", visibility: "visible" }
              : { opacity: 0, scale: reduce ? 1 : 0.97, filter: reduce ? "blur(0px)" : "blur(2px)", transitionEnd: { visibility: "hidden" } }
          }
          transition={isOpen ? { duration: reduce ? TIMING.fade : TIMING.enter, ease: EASE_OUT } : { duration: TIMING.exit, ease: EASE_IN }}
          style={{ x, y, transformOrigin: ORIGIN[placed.side] }}
          className="pointer-events-none absolute left-0 top-0 z-30"
        >
          <motion.div
            className="relative overflow-hidden rounded-[8px] bg-[var(--tg-bg)] text-[#f4f4f5]"
            style={{ width: w, height: h, boxShadow: palette.shadow }}
          >
            <AnimatePresence initial={false} custom={placed.dir}>
              {shown && (
                <motion.span
                  key={shownId}
                  custom={placed.dir}
                  variants={contentVariants(reduce)}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <TipContent label={shown.label} keys={shortcuts ? shown.shortcut : undefined} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
          {arrow && <Arrow side={placed.side} left={arrowLeft} top={arrowTop} />}
        </motion.div>

        {/* Measures the next content before it is shown, so the surface can grow to it rather than snap. */}
        <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 -z-10 w-max">
          {shown && <TipContent label={shown.label} keys={shortcuts ? shown.shortcut : undefined} />}
        </span>
      </div>
    </GroupContext.Provider>
  );
}

function contentVariants(reduce: boolean) {
  return {
    enter: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: dir * 6, filter: "blur(3px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: reduce ? TIMING.fade : 0.2, ease: EASE_OUT } },
    exit: (dir: number) => (reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, x: dir * -6, filter: "blur(3px)", transition: { duration: 0.12, ease: EASE_IN } }),
  };
}

function TipContent({ label, keys }: { label: string; keys?: string[] }) {
  return (
    <span className="flex h-7 items-center gap-2 whitespace-nowrap pl-2.5 pr-[5px] font-sans text-[12.5px] font-medium leading-none tracking-[-0.005em]" style={keys?.length ? undefined : { paddingRight: 10 }}>
      {label}
      {keys && keys.length > 0 && (
        <span className="flex items-center gap-[3px]">
          {keys.map((k, i) => (
            <kbd
              key={`${k}-${i}`}
              className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-white/[0.07] px-1 font-mono text-[10.5px] font-medium leading-none text-[#a1a1aa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_-1px_0_rgba(0,0,0,0.45)]"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </span>
  );
}

function Arrow({ side, left, top }: { side: TooltipSide; left: MotionValue<number>; top: MotionValue<number> }) {
  return (
    <motion.span aria-hidden="true" className="absolute block" style={{ left, top, width: ARROW.size, height: ARROW.size, rotate: ARROW_TURN[side] }}>
      <svg width={ARROW.size} height={ARROW.size} viewBox="0 0 14 14" fill="none" className="block">
        <path d="M0 7h14l-5.6 5.5a2 2 0 0 1-2.8 0Z" fill="var(--tg-bg)" />
        <path d="M0.4 7.4l5.2 5.1a2 2 0 0 0 2.8 0l5.2-5.1" stroke="var(--tg-line)" strokeWidth="1" />
      </svg>
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: an editor toolbar, with the timing read out underneath         */
/* ------------------------------------------------------------------ */

type Mark = "bold" | "italic" | "underline" | "strike" | "code" | "link" | "comment";
type Tool = { id: Mark; label: string; keys: string[]; icon: LucideIcon };

const TOOLS: Tool[][] = [
  [
    { id: "bold", label: "Bold", keys: ["⌘", "B"], icon: Bold },
    { id: "italic", label: "Italic", keys: ["⌘", "I"], icon: Italic },
    { id: "underline", label: "Underline", keys: ["⌘", "U"], icon: Underline },
    { id: "strike", label: "Strikethrough", keys: ["⌘", "⇧", "X"], icon: Strikethrough },
    { id: "code", label: "Inline code", keys: ["⌘", "E"], icon: Code },
  ],
  [
    { id: "link", label: "Add link", keys: ["⌘", "K"], icon: Link2 },
    { id: "comment", label: "Comment", keys: ["⌘", "⌥", "M"], icon: MessageSquarePlus },
  ],
];
const FLAT_TOOLS = TOOLS.flat();

/** The demo's stage and card; not part of the component. */
const STAGE = {
  dark: { backdrop: "#050505", card: "#0c0c0e", ring: "rgba(255,255,255,0.08)", rule: "rgba(255,255,255,0.07)", ink: "#f4f4f5", body: "#a1a1aa", muted: "#8a8a93", hover: "rgba(255,255,255,0.06)", pressed: "rgba(255,255,255,0.1)", select: "rgba(255,255,255,0.11)", track: "rgba(255,255,255,0.1)", shadow: "0 40px 80px -40px rgba(0,0,0,0.9)" },
  light: { backdrop: "#efeeea", card: "#ffffff", ring: "rgba(0,0,0,0.08)", rule: "rgba(0,0,0,0.07)", ink: "#18181b", body: "#52525b", muted: "#62626b", hover: "rgba(0,0,0,0.05)", pressed: "rgba(0,0,0,0.08)", select: "rgba(24,24,27,0.09)", track: "rgba(0,0,0,0.1)", shadow: "0 30px 60px -36px rgba(24,24,27,0.35)" },
} as const;

const DEMO_MOTION = { rise: 12, blur: 8, block: 0.5, step: 0.06, idleAfterMs: 1100 } as const;

const DOC = {
  crumb: "Drafts / Lisbon offsite",
  edited: "Edited 4 min ago",
  title: "What we decided in Lisbon",
  intro: "Three days, one whiteboard and a surprising amount of agreement. The short version: we stop shipping features nobody asked for and fix the ones people use every day.",
  before: "Ship offline mode ",
  selected: "before the pricing change",
  after: ", not after. Marta owns the rollout and Dev writes the migration guide.",
};

function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: TIMING.fade } };
  return {
    initial: { opacity: 0, y: DEMO_MOTION.rise, filter: `blur(${DEMO_MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: DEMO_MOTION.block, ease: EASE_OUT, delay },
  };
}

/**
 * The demo: a document with a formatting toolbar. Overrides (the page's Customize panel)
 * apply to the TooltipGroup, and the stage follows its theme.
 */
export default function TooltipGroupDemo({ theme = "dark", ...overrides }: Partial<TooltipGroupProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const t = STAGE[theme];
  const cardRef = useRef<HTMLDivElement>(null);
  const play = useInView(cardRef, { once: true, amount: 0.3 });
  const [marks, setMarks] = useState<Set<Mark>>(() => new Set<Mark>(["italic"]));
  const [event, setEvent] = useState<TooltipTimingEvent | null>(null);
  const delay = overrides.delay ?? 400;
  const words = useMemo(() => `${DOC.title} ${DOC.intro} ${DOC.before}${DOC.selected}${DOC.after}`.split(/\s+/).filter(Boolean).length, []);

  const toggle = (m: Mark) =>
    setMarks((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  const selection = [
    marks.has("bold") ? "font-semibold" : "",
    marks.has("italic") ? "italic" : "",
    marks.has("code") ? "font-mono text-[0.88em]" : "",
    [marks.has("underline") || marks.has("link") ? "underline" : "", marks.has("strike") ? "line-through" : ""].filter(Boolean).join(" "),
    marks.has("link") ? "decoration-[1.5px] underline-offset-[3px]" : "decoration-1 underline-offset-[3px]",
  ].join(" ");

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-16 font-sans antialiased sm:px-8" style={{ background: t.backdrop, color: t.ink }}>
      <div className="@container w-full max-w-[640px]">
        <motion.div ref={cardRef} {...enter(play, 0, reduce)}>
          <TooltipGroup
            defaultActive="link"
            theme={theme}
            onTimingEvent={setEvent}
            className="rounded-[18px]"
            style={{ background: t.card, boxShadow: `inset 0 0 0 1px ${t.ring}, inset 0 1px 0 ${theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)"}, ${t.shadow}` }}
            {...overrides}
          >
            <article className="px-5 pb-11 pt-5 @md:px-8 @md:pb-12 @md:pt-6">
              <motion.header {...enter(play, DEMO_MOTION.step, reduce)} className="flex items-center justify-between gap-4 font-mono text-[11px]" style={{ color: t.muted }}>
                <span className="truncate">{DOC.crumb}</span>
                <span className="shrink-0">{DOC.edited}</span>
              </motion.header>
              <motion.h2 {...enter(play, DEMO_MOTION.step * 2, reduce)} className="mt-7 font-display text-[clamp(1.5rem,5cqi,2rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
                {DOC.title}
              </motion.h2>
              <motion.p {...enter(play, DEMO_MOTION.step * 3, reduce)} className="mt-4 max-w-[60ch] text-[15px] leading-[1.65]" style={{ color: t.body }}>
                {DOC.intro}
              </motion.p>
              <motion.p {...enter(play, DEMO_MOTION.step * 4, reduce)} className="mt-3 max-w-[60ch] text-[15px] leading-[1.65]" style={{ color: t.body }}>
                {DOC.before}
                <span className={`rounded-[3px] px-0.5 transition-[background-color,color] duration-150 ${selection}`} style={{ background: marks.has("comment") ? t.pressed : t.select, color: t.ink }}>
                  {DOC.selected}
                </span>
                {DOC.after}
              </motion.p>
            </article>
            <motion.div {...enter(play, DEMO_MOTION.step * 5, reduce)} className="flex items-center justify-between gap-3 border-t px-2 py-2 @md:px-3" style={{ borderColor: t.rule }}>
              <FormattingToolbar marks={marks} onToggle={toggle} palette={t} />
              <span className="hidden shrink-0 pr-2 font-mono text-[11px] tabular-nums @md:block" style={{ color: t.muted }}>
                {words} words
              </span>
            </motion.div>
          </TooltipGroup>
        </motion.div>
        <motion.div {...enter(play, DEMO_MOTION.step * 7, reduce)}>
          <TimingReadout event={event} delay={delay} palette={t} reduce={reduce} />
        </motion.div>
      </div>
    </div>
  );
}

type Palette = (typeof STAGE)[keyof typeof STAGE];

/** A toolbar with roving focus: Tab lands once, arrows move between tools, and each tool's tooltip follows the focus. */
function FormattingToolbar({ marks, onToggle, palette: t }: { marks: Set<Mark>; onToggle: (m: Mark) => void; palette: Palette }) {
  const [focusAt, setFocusAt] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = FLAT_TOOLS.length - 1;
    const next = e.key === "ArrowRight" ? (focusAt === last ? 0 : focusAt + 1) : e.key === "ArrowLeft" ? (focusAt === 0 ? last : focusAt - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    setFocusAt(next);
    refs.current[next]?.focus();
  };

  let index = -1;
  return (
    <div role="toolbar" aria-label="Formatting" onKeyDown={onKeyDown} className="flex min-w-0 flex-wrap items-center">
      {TOOLS.map((cluster, c) => (
        <div key={c} className="flex items-center">
          {c > 0 && <span aria-hidden="true" className="mx-1.5 h-5 w-px" style={{ background: t.rule }} />}
          {cluster.map((tool) => {
            index += 1;
            const i = index;
            const on = marks.has(tool.id);
            const Icon = tool.icon;
            return (
              <Tooltip key={tool.id} id={tool.id} label={tool.label} shortcut={tool.keys}>
                <button
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="button"
                  data-demo={`tool-${tool.id}`}
                  aria-label={tool.label}
                  aria-pressed={on}
                  tabIndex={i === focusAt ? 0 : -1}
                  onFocus={() => setFocusAt(i)}
                  onClick={() => onToggle(tool.id)}
                  className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 grid size-10 place-items-center rounded-[9px] transition-[background-color,color,scale] duration-150 ease-out hover:bg-[var(--tb-hover)] hover:text-[var(--tb-ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--tb-ink)] active:scale-[0.97] active:duration-75 aria-pressed:bg-[var(--tb-pressed)] aria-pressed:text-[var(--tb-ink)]"
                  style={{ color: t.body, "--tb-hover": t.hover, "--tb-pressed": t.pressed, "--tb-ink": t.ink } as CSSProperties}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The stage's timing readout: the rest delay charges a hairline, and every decision is named as it happens. */
function TimingReadout({ event, delay, palette: t, reduce }: { event: TooltipTimingEvent | null; delay: number; palette: Palette; reduce: boolean }) {
  const elapsed = useMotionValue(0);
  const fill = useTransform(elapsed, (v) => (delay > 0 ? Math.min(1, v / delay) : 1));
  const ms = useTransform(elapsed, (v) => `${Math.round(v)} ms`);
  const [idle, setIdle] = useState(true);

  useEffect(() => {
    if (!event) return;
    setIdle(false);
    if (event.type === "wait") {
      elapsed.set(0);
      const run = animate(elapsed, event.delay, { duration: event.delay / 1000, ease: "linear" });
      return () => run.stop();
    }
    if (event.type === "open") {
      elapsed.set(delay);
      return;
    }
    // Closed or cancelled: the hairline drains, then the readout settles back to its prompt.
    const run = animate(elapsed, 0, { duration: reduce ? 0.12 : 0.3, ease: EASE_OUT });
    const settle = window.setTimeout(() => setIdle(true), DEMO_MOTION.idleAfterMs);
    return () => {
      run.stop();
      window.clearTimeout(settle);
    };
  }, [event, delay, elapsed, reduce]);

  const line = describe(event, idle, delay);

  return (
    <div className="mt-4 flex items-center justify-between gap-4 px-1 font-mono text-[11px]" style={{ color: t.muted }}>
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="relative h-px w-14 shrink-0 overflow-hidden" style={{ background: t.track }}>
          <motion.span className="absolute inset-0 origin-left" style={{ scaleX: fill, background: t.ink }} />
        </span>
        <span className="relative min-w-0">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={line.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.12, ease: EASE_IN } }}
              transition={{ duration: reduce ? TIMING.fade : 0.2, ease: EASE_OUT }}
              className="block truncate"
            >
              {line.lead && <span style={{ color: t.ink }}>{line.lead} </span>}
              {line.text}
              {line.counting && (
                <motion.span aria-hidden="true" className="ml-1 tabular-nums" style={{ color: t.ink }}>
                  {ms}
                </motion.span>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      <span className="hidden shrink-0 tabular-nums @md:block">
        open {delay} · neighbours 0 · close 0 ms
      </span>
    </div>
  );
}

function describe(event: TooltipTimingEvent | null, idle: boolean, delay: number): { key: string; lead?: string; text: string; counting?: boolean } {
  if (!event || idle) return { key: `idle-${delay}`, text: `Rest on a tool for ${delay} ms` };
  if (event.type === "wait") return { key: `wait-${event.id}`, text: "Waiting", counting: true };
  if (event.type === "open") {
    const flip = event.flipped ? ` · flipped ${event.side}` : "";
    const why =
      event.via === "skip"
        ? "skipped the wait"
        : event.via === "focus"
          ? "opened on focus"
          : event.via === "press"
            ? "opened on long press"
            : event.via === "pinned"
              ? "pinned for the preview"
              : `opened after ${delay} ms`;
    return { key: `open-${event.id}-${event.side}-${event.via}`, lead: event.label, text: `${why}${flip}` };
  }
  if (event.type === "cancel") return { key: `cancel-${event.id}`, text: "Moved on before the wait ended" };
  return { key: `close-${event.id}`, text: "Closed instantly" };
}
