"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { Check, LoaderCircle, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export type ToastType = "success" | "error" | "info" | "loading";

export type ToastAction = { label: string; onClick: () => void };

export type ToastData = {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  /** Milliseconds before auto-dismiss. Loading toasts never auto-dismiss. */
  duration: number;
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

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 5000;

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
    duration: opts.duration ?? (type === "error" ? 8000 : DEFAULT_DURATION),
    version: 0,
  };
  // Newest first. Anything past the cap is dropped from the back.
  emit([t, ...toasts].slice(0, MAX_TOASTS));
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
        duration: opts.duration ?? DEFAULT_DURATION,
      }),
    (e: unknown) =>
      update(id, {
        type: "error",
        title: typeof m.error === "function" ? m.error(e) : m.error,
        description: m.description?.error,
        duration: opts.duration ?? 8000,
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
  return useMemo(
    () => ({
      toasts: list,
      toast,
      success: toast.success,
      error: toast.error,
      info: toast.info,
      promise: toast.promise,
      dismiss,
    }),
    [list],
  );
}

/* ------------------------------------------------------------------ */
/* Toaster                                                             */
/* ------------------------------------------------------------------ */

export type ToasterProps = {
  /** "fixed" pins the stack to the viewport; "absolute" keeps it inside the nearest positioned parent. */
  strategy?: "fixed" | "absolute";
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  /** Accessible name of the region. */
  label?: string;
  /** Alt + this key moves focus to the newest toast. */
  hotkey?: string;
};

const GAP = 10;
const PEEK = 14;
const VISIBLE = 3;
const ease = [0.2, 0.8, 0.2, 1] as const;

export function Toaster({ strategy = "fixed", position = "bottom-right", label = "Notifications", hotkey = "t" }: ToasterProps) {
  const { toasts: list } = useToasts();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false); // tap-to-expand on touch
  const [hidden, setHidden] = useState(false);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const listRef = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();

  const expanded = (hovered || focused || pinned) && list.length > 1;
  const paused = hovered || focused || pinned || hidden;

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === hotkey.toLowerCase()) {
        e.preventDefault();
        listRef.current?.querySelector<HTMLElement>("[data-toast]")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

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

  const setHeight = useCallback((id: number, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  const h = (id: number) => heights[id] ?? 68;
  const frontH = list[0] ? h(list[0].id) : 0;
  const offsets: number[] = [];
  list.reduce((acc, t, i) => {
    offsets[i] = acc;
    return acc + h(t.id) + GAP;
  }, 0);
  const stackH = expanded
    ? list.reduce((acc, t) => acc + h(t.id), 0) + GAP * Math.max(0, list.length - 1)
    : frontH + PEEK * Math.min(Math.max(0, list.length - 1), VISIBLE - 1);

  const place =
    position === "bottom-center"
      ? "sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      : position === "bottom-left"
        ? "sm:left-6 sm:right-auto"
        : "sm:left-auto sm:right-6";

  return (
    <section
      aria-label={`${label} (Alt+${hotkey.toUpperCase()})`}
      className={`${strategy === "fixed" ? "fixed" : "absolute"} bottom-4 left-4 right-4 z-50 sm:bottom-6 sm:w-[360px] ${place}`}
    >
      <motion.ol
        ref={listRef}
        className="relative m-0 list-none p-0"
        animate={{ height: stackH }}
        transition={reduce ? { duration: 0 } : { duration: 0.35, ease }}
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
            <ToastItem
              key={t.id}
              toast={t}
              index={i}
              count={list.length}
              expanded={expanded}
              paused={paused}
              offset={offsets[i]}
              frontHeight={frontH}
              reduce={!!reduce}
              onHeight={setHeight}
            />
          ))}
        </AnimatePresence>
      </motion.ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One toast                                                           */
/* ------------------------------------------------------------------ */

const tone: Record<ToastType, { ring: string; icon: ReactNode; label: string }> = {
  success: {
    ring: "bg-[#3ddc97] text-[#06291a]",
    icon: <Check size={12} strokeWidth={3.2} aria-hidden="true" />,
    label: "Success",
  },
  error: {
    ring: "bg-[#ff6b5e] text-[#3a0904]",
    icon: (
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
        <path d="M6 2.6v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="6" cy="9.2" r="1.05" fill="currentColor" />
      </svg>
    ),
    label: "Error",
  },
  info: {
    ring: "bg-[#8ab8ff] text-[#071a3a]",
    icon: (
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
        <circle cx="6" cy="2.9" r="1.05" fill="currentColor" />
        <path d="M6 5.4v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
    label: "Info",
  },
  loading: {
    ring: "bg-transparent text-[#e4e4e7]",
    icon: <LoaderCircle size={16} strokeWidth={2.4} className="animate-spin" aria-hidden="true" />,
    label: "In progress",
  },
};

function ToastItem({
  toast: t,
  index,
  count,
  expanded,
  paused,
  offset,
  frontHeight,
  reduce,
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
  onHeight: (id: number, h: number) => void;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const x = useMotionValue(0);
  const fade = useTransform(x, [-220, 0, 220], [0, 1, 0]);
  const front = index === 0;
  const timed = t.type !== "loading" && Number.isFinite(t.duration);
  const stopped = paused || dragging;

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

  // Auto-dismiss, pausing on hover, focus, drag and hidden tabs.
  const remaining = useRef(t.duration);
  useEffect(() => {
    remaining.current = t.duration;
  }, [t.version, t.duration]);
  useEffect(() => {
    if (!timed || stopped) return;
    const started = performance.now();
    const id = setTimeout(() => dismiss(t.id), remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [timed, stopped, t.id, t.version]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragging(false);
    const out = Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 600;
    if (out) {
      const dir = Math.sign(info.offset.x || info.velocity.x) || 1;
      animate(x, dir * 420, { duration: 0.22, ease: "easeOut" }).then(() => dismiss(t.id));
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
    }
  };

  const collapsedScale = 1 - index * 0.05;
  const visible = index < VISIBLE;
  const target = expanded ? { y: -offset, scale: 1, opacity: 1 } : { y: -index * PEEK, scale: collapsedScale, opacity: visible ? 1 : 0 };
  // Cards behind the front one borrow its height while collapsed, so nothing peeks out underneath.
  const cardHeight = expanded || front ? height : frontHeight;

  const t1 = tone[t.type];

  return (
    <motion.li
      layout={false}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 56, scale: 1 }}
      animate={target}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, transition: { duration: 0.2, ease } }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
      style={{ zIndex: count - index, transformOrigin: "50% 0%" }}
      className={`absolute inset-x-0 bottom-0 ${!expanded && !front ? "pointer-events-none" : ""}`}
    >
      <motion.div
        data-toast
        tabIndex={0}
        role={t.type === "error" ? "alert" : "status"}
        aria-live={t.type === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        aria-label={`${t1.label}: ${t.title}${t.description ? `. ${t.description}` : ""}`}
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
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
        style={{ x, opacity: fade }}
        className="group relative cursor-grab touch-pan-y overflow-hidden rounded-[14px] bg-[#1c1c1f] text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_-12px_rgba(0,0,0,0.7),0_2px_6px_rgba(0,0,0,0.35)] outline-none focus-visible:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_0_0_2px_#0b0b0c,0_0_0_4px_#8ab8ff] active:cursor-grabbing"
      >
        <div
          ref={inner}
          className={`flex items-start gap-3 py-3.5 pl-4 pr-10 transition-opacity duration-200 ${!expanded && !front ? "opacity-0" : "opacity-100"}`}
        >
          <span className={`mt-[1px] flex size-[18px] shrink-0 items-center justify-center rounded-full ${t1.ring}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={t.type}
                initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reduce ? undefined : { scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.18, ease }}
                className="flex items-center justify-center"
              >
                {t1.icon}
              </motion.span>
            </AnimatePresence>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium leading-[1.35] tracking-[-0.005em] text-[#f4f4f5]">{t.title}</p>
            {t.description && <p className="mt-0.5 text-[13px] leading-[1.45] text-[#a1a1aa]">{t.description}</p>}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                onPointerDownCapture={(e) => e.stopPropagation()}
                className="mt-2.5 inline-flex h-8 items-center rounded-[8px] bg-[#f4f4f5] px-3 text-[13px] font-medium text-[#0b0b0c] outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-[#8ab8ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1f]"
              >
                {t.action.label}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => dismiss(t.id)}
          onPointerDownCapture={(e) => e.stopPropagation()}
          className={`absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-[8px] text-[#a1a1aa] outline-none transition-colors hover:bg-white/[0.06] hover:text-[#f4f4f5] focus-visible:ring-2 focus-visible:ring-[#8ab8ff] ${!expanded && !front ? "opacity-0" : ""}`}
        >
          <X size={14} strokeWidth={2.25} aria-hidden="true" />
        </button>
        {timed && (
          <span
            key={t.version}
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-px origin-left bg-white/25"
            style={{
              animation: `tm-toast-stack-timer ${t.duration}ms linear forwards`,
              animationPlayState: stopped ? "paused" : "running",
            }}
          />
        )}
      </motion.div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

export type ToastStackDemoTrigger = {
  kind: "success" | "error" | "info" | "promise" | "action";
  label: string;
  title: string;
  description?: string;
  /** Title once the promise resolves (promise only). */
  resolved?: string;
  actionLabel?: string;
};

export type ToastStackProps = {
  kicker?: string;
  title?: string;
  titleItalic?: string;
  intro?: string;
  triggers?: ToastStackDemoTrigger[];
  /** Fire a few toasts on mount so the stack is visible straight away. */
  seed?: boolean;
  documentTitle?: string;
};

const kindDot: Record<ToastStackDemoTrigger["kind"], string> = {
  success: "bg-[#3ddc97]",
  error: "bg-[#ff6b5e]",
  info: "bg-[#8ab8ff]",
  promise: "bg-[#e4e4e7]",
  action: "bg-[#f5c451]",
};

const defaultTriggers: ToastStackDemoTrigger[] = [
  { kind: "success", label: "Success", title: "Draft saved", description: "1,284 words, all of them yours." },
  { kind: "error", label: "Error", title: "Couldn’t reach the printer", description: "The proofs are safe. We’ll try again in a minute.", actionLabel: "Retry now" },
  { kind: "info", label: "Info", title: "Maya Okafor left a comment", description: "“Cut the second paragraph. Trust me.”" },
  { kind: "promise", label: "Promise", title: "Publishing to 4,120 readers…", resolved: "Published. Go and make a coffee." },
  { kind: "action", label: "With action", title: "Moved 3 drafts to the bin", description: "They’ll stay there for 30 days.", actionLabel: "Undo" },
];

export function ToastStack({
  kicker = "Quire / Notifications",
  title = "Toasts that",
  titleItalic = "know their place.",
  intro = "They stack like a hand of cards, fan out when you hover, wait while you read and leave when you swipe them away. Fire a few and see.",
  triggers = defaultTriggers,
  seed = true,
  documentTitle = "The Autumn Issue — draft 7",
}: ToastStackProps) {
  const { success, error, info, promise: runPromise, toasts: list } = useToasts();
  const reduce = useReducedMotion();

  const fire = useCallback(
    (tr: ToastStackDemoTrigger) => {
      switch (tr.kind) {
        case "success":
          return success(tr.title, { description: tr.description });
        case "error":
          return error(tr.title, {
            description: tr.description,
            action: tr.actionLabel ? { label: tr.actionLabel, onClick: () => success("Proofs sent to the printer") } : undefined,
          });
        case "info":
          return info(tr.title, { description: tr.description });
        case "promise":
          return runPromise(new Promise<void>((r) => setTimeout(r, 2200)), {
            loading: tr.title,
            success: tr.resolved ?? "Done",
            error: "That didn’t work",
          });
        case "action":
          return info(tr.title, {
            description: tr.description,
            action: { label: tr.actionLabel ?? "Undo", onClick: () => success("Restored 3 drafts") },
          });
      }
    },
    [success, error, info, runPromise],
  );

  useEffect(() => {
    if (!seed) return;
    const picks = [triggers.find((t) => t.kind === "info"), triggers.find((t) => t.kind === "action"), triggers.find((t) => t.kind === "success")].filter(
      (t): t is ToastStackDemoTrigger => !!t,
    );
    const ids = picks.map((p, i) => setTimeout(() => fire(p), reduce ? 0 : 250 + i * 320));
    return () => ids.forEach(clearTimeout);
  }, [seed, triggers, fire, reduce]);

  return (
    <section className="bg-[#0b0b0c] text-[#f4f4f5]">
      <style>{`@keyframes tm-toast-stack-timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
      <div className="mx-auto grid max-w-[76rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-20">
        {/* Copy + triggers */}
        <div className="lg:col-span-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#a1a1aa]">{kicker}</p>
          <h2 className="mt-6 font-display text-[clamp(2.6rem,1.6rem+3vw,4rem)] font-bold leading-[0.95] tracking-[-0.045em]">
            {title} <span className="font-serif font-normal italic tracking-[-0.02em] text-[#f5c451]">{titleItalic}</span>
          </h2>
          <p className="mt-6 max-w-[42ch] text-[16px] leading-[1.6] text-[#a1a1aa]">{intro}</p>

          <ul className="mt-10 border-t border-white/10">
            {triggers.map((tr, i) => (
              <li key={tr.label} className="border-b border-white/10">
                <button
                  type="button"
                  onClick={() => fire(tr)}
                  className="group flex w-full items-center gap-4 py-3.5 text-left outline-none focus-visible:bg-white/[0.04]"
                >
                  <span className="w-6 font-mono text-[11px] tabular-nums text-[#71717a]">{String(i + 1).padStart(2, "0")}</span>
                  <span className={`size-2 shrink-0 rounded-full ${kindDot[tr.kind]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-[#f4f4f5]">{tr.label}</span>
                    <span className="block truncate text-[13px] text-[#a1a1aa]">{tr.title}</span>
                  </span>
                  <span className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#d4d4d8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition-colors group-hover:bg-[#f4f4f5] group-hover:text-[#0b0b0c] group-focus-visible:bg-[#f4f4f5] group-focus-visible:text-[#0b0b0c]">
                    Fire
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-5 font-mono text-[11px] uppercase leading-[1.7] tracking-[0.12em] text-[#71717a]">
            Hover to fan out · Swipe to dismiss · Alt+T to focus
          </p>
        </div>

        {/* Faux editor, with the toaster living inside it */}
        <div className="lg:col-span-7">
          <div className="relative h-[560px] overflow-hidden rounded-[18px] bg-[#131315] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] lg:h-full lg:min-h-[600px]">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[#f5c451] font-display text-[13px] font-bold text-[#0b0b0c]">Q</span>
                <p className="truncate text-[13px] text-[#d4d4d8]">{documentTitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="hidden -space-x-0.5 sm:flex" aria-hidden="true">
                  {[
                    ["MO", "bg-[#8ab8ff] text-[#071a3a]"],
                    ["JR", "bg-[#3ddc97] text-[#06291a]"],
                  ].map(([n, c]) => (
                    <span key={n} className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-[#131315] ${c}`}>
                      {n}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#71717a]" aria-live="polite">
                  {list.length} {list.length === 1 ? "toast" : "toasts"}
                </span>
              </div>
            </div>
            <article className="px-6 pt-10 sm:px-10 lg:px-14" aria-hidden="true">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#71717a]">Food · 8 min read</p>
              <h3 className="mt-4 max-w-[16ch] font-serif text-[clamp(2rem,1.4rem+2vw,3rem)] leading-[1.02] tracking-[-0.01em] text-[#f4f4f5]">Notes from a slow kitchen</h3>
              <p className="mt-6 max-w-[52ch] text-[15px] leading-[1.7] text-[#a1a1aa]">
                The stock had been going since Tuesday. Nobody remembered starting it, and nobody was brave enough to stop. By Friday it had become
                a kind of household weather: always there, faintly reassuring, smelling of bay.
              </p>
              <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.7] text-[#71717a]">
                Slow cooking isn’t a technique so much as a temperament. You have to be willing to let something happen without you.
              </p>
            </article>
            <Toaster strategy="absolute" position="bottom-right" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default ToastStack;
