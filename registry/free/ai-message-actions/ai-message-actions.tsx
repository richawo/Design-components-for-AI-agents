"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** One version (branch) of the assistant’s reply. */
export type ReplyVersion = {
  id: string;
  /** The reply, one string per paragraph. Copy joins them with a blank line. */
  paragraphs: string[];
  /** Quiet mono line at the end of the row: model and time to answer. */
  meta?: string;
};

export type FeedbackReason = { id: string; label: string };

export type MessageFeedback = {
  versionId: string;
  value: "up" | "down" | null;
  reasons: string[];
  note: string;
};

export type AiMessageActionsProps = {
  /** Every version of the reply so far, oldest first. Each Regenerate adds one. */
  versions?: ReplyVersion[];
  /** Which version shows first (0-based). Defaults to the newest. */
  defaultVersion?: number;
  /** The assistant’s name, shown above the reply and in the reason popover. */
  author?: string;
  /** Produces a new version. Without it, the Regenerate button is hidden. Reject to show the error line. */
  onRegenerate?: () => Promise<ReplyVersion> | ReplyVersion;
  /** Called with the plain text after it’s written to the clipboard. */
  onCopy?: (text: string) => void;
  /** Called whenever a rating is set, cleared, or sent with reasons. */
  onFeedback?: (feedback: MessageFeedback) => void;
  /** Called when the visible version changes (0-based). */
  onVersionChange?: (index: number) => void;
  /** Show thumbs up and down, with a reason popover on thumbs down. */
  feedback?: boolean;
  /** Choices offered in the thumbs-down popover. */
  reasons?: FeedbackReason[];
  /** Keep the actions on screen. Off, they appear on hover or focus (always on touch screens). */
  alwaysVisible?: boolean;
  /** Button and label scale for the action row. */
  size?: "sm" | "md";
  /** The one accent: a chosen rating, picked reasons and the Send button. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    ink: "#f4f4f5",
    body: "#c9c9cf",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    hover: "rgba(255,255,255,0.07)",
    press: "rgba(255,255,255,0.11)",
    rule: "rgba(255,255,255,0.08)",
    pop: "#141416",
    popLine: "#27272a",
    chip: "#1a1a1d",
    field: "#0d0d0f",
    tipBg: "#f4f4f5",
    tipInk: "#0b0b0c",
    onAccent: "#0b0b0c",
    popShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px -16px rgba(0,0,0,0.85)",
  },
  light: {
    ink: "#18181b",
    body: "#3f3f46",
    muted: "#52525b",
    faint: "#6b6b73",
    hover: "rgba(24,24,27,0.06)",
    press: "rgba(24,24,27,0.1)",
    rule: "rgba(24,24,27,0.09)",
    pop: "#ffffff",
    popLine: "#e4e4e7",
    chip: "#f4f4f5",
    field: "#fafafa",
    tipBg: "#18181b",
    tipInk: "#fafafa",
    onAccent: "#18181b",
    popShadow: "0 1px 2px rgba(24,24,27,0.05), 0 24px 48px -20px rgba(24,24,27,0.28)",
  },
} as const;

const DEFAULT_ACCENT = "#ff9a6b";

const SIZES = {
  sm: { button: "size-7 rounded-[7px]", icon: 14, count: "text-[11.5px]", gap: "gap-0.5" },
  md: { button: "size-8 rounded-[8px]", icon: 16, count: "text-[12.5px]", gap: "gap-1" },
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for timing. Milliseconds. */
const TIMING = {
  tooltipDelay: 420,
  tooltipWarm: 320, // after one tooltip closes, neighbours open instantly for this long
  copiedFor: 1600,
  statusFor: 2600, // a feedback or error note in the meta slot
  wordStep: 16, // a regenerated reply inks in word by word
  wordCap: 900, // however long the reply, the last word lands by then
  revealStep: 28, // action buttons fade in left to right on hover
} as const;

const DEFAULT_REASONS: FeedbackReason[] = [
  { id: "inaccurate", label: "Not accurate" },
  { id: "brief", label: "Missed the brief" },
  { id: "long", label: "Too long" },
  { id: "tone", label: "Wrong tone" },
];

/** A chosen rating: filled in the accent, outlined a step darker so it holds 3:1 on either surface. */
const RATED_STYLE: CSSProperties = { fill: "var(--ma-accent)", stroke: "color-mix(in srgb, var(--ma-accent) 62%, var(--ma-ink))" };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ma-ink)]";

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** setTimeout that is cleared on unmount and when the same key fires again. */
function useTimers() {
  const timers = useRef(new Map<string, number>());
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);
  return useCallback((key: string, fn: () => void, ms: number) => {
    const map = timers.current;
    window.clearTimeout(map.get(key));
    map.set(key, window.setTimeout(fn, ms));
  }, []);
}

/** The content box height of an element, so a wrapper can tween to it when versions differ in length. */
function useMeasuredHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height] as const;
}

/**
 * One tooltip at a time across the row. Opening waits a beat; moving to a neighbour while
 * one was just open is instant, the way native toolbars behave.
 */
function useTooltips() {
  const [open, setOpen] = useState<string | null>(null);
  const warmUntil = useRef(0);
  const later = useTimers();
  const show = useCallback(
    (id: string, now = false) => {
      if (now || performance.now() < warmUntil.current) {
        later("tip", () => undefined, 0);
        setOpen(id);
      } else later("tip", () => setOpen(id), TIMING.tooltipDelay);
    },
    [later],
  );
  const hide = useCallback(() => {
    later("tip", () => undefined, 0);
    setOpen((cur) => {
      if (cur) warmUntil.current = performance.now() + TIMING.tooltipWarm;
      return null;
    });
  }, [later]);
  return { open, show, hide };
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */

/**
 * Copy drawn as two sheets that retract while a check draws in through the same box,
 * so the icon reads as one shape changing its mind rather than a swap.
 */
function CopyMorphIcon({ copied, size, reduce }: { copied: boolean; size: number; reduce: boolean }) {
  const t = reduce ? { duration: 0.12 } : { duration: 0.22, ease: EASE_IN_OUT };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path d="M10.5 4.6V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h.6" initial={false} animate={{ pathLength: copied ? 0 : 1, opacity: copied ? 0 : 1 }} transition={t} />
      <motion.rect x={5.5} y={5.5} width={8} height={8} rx={1.6} initial={false} animate={{ pathLength: copied ? 0 : 1, opacity: copied ? 0 : 1 }} transition={t} />
      <motion.path
        d="M3.4 8.6l2.9 2.9 6.3-6.9"
        strokeWidth={1.6}
        initial={false}
        animate={{ pathLength: copied ? 1 : 0, opacity: copied ? 1 : 0 }}
        transition={reduce ? { duration: 0.12 } : { duration: copied ? 0.3 : 0.14, delay: copied ? 0.08 : 0, ease: EASE_OUT }}
      />
    </svg>
  );
}

/** A circular arrow that turns while a new version is being written. */
function RegenerateIcon({ spinning, size, reduce }: { spinning: boolean; size: number; reduce: boolean }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      animate={spinning && !reduce ? { rotate: -360 } : { rotate: 0 }}
      transition={spinning && !reduce ? { duration: 0.9, ease: "linear", repeat: Infinity } : { duration: 0 }}
    >
      <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.78" />
      <path d="M2.6 2.6v2.9h2.9" />
    </motion.svg>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

type IconButtonProps = {
  id: string;
  label: string;
  /** What the tooltip says; defaults to the label. */
  tip?: string;
  size: "sm" | "md";
  tips: ReturnType<typeof useTooltips>;
  onClick: () => void;
  children: ReactNode;
  /** Fades in with the row on hover, unless this button carries state worth keeping on screen. */
  hidden: boolean;
  /** Its place in the row, for the left-to-right reveal. */
  order: number;
  pressed?: boolean;
  expanded?: boolean;
  busy?: boolean;
  disabled?: boolean;
  demo?: string;
  buttonRef?: Ref<HTMLButtonElement>;
};

function IconButton({ id, label, tip, size, tips, onClick, children, hidden, order, pressed, expanded, busy, disabled, demo, buttonRef }: IconButtonProps) {
  return (
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        data-tb=""
        data-demo={demo}
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-haspopup={expanded === undefined ? undefined : "dialog"}
        aria-busy={busy || undefined}
        disabled={disabled}
        onClick={onClick}
        onPointerEnter={(e) => e.pointerType === "mouse" && tips.show(id)}
        onPointerLeave={tips.hide}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && tips.show(id, true)}
        onBlur={tips.hide}
        style={{ "--ma-d": `${order * TIMING.revealStep}ms` } as CSSProperties}
        className={`relative flex shrink-0 items-center justify-center ${SIZES[size].button} text-[var(--ma-muted)] transition-[background-color,color,opacity,translate,scale] duration-150 ease-out hover:bg-[var(--ma-hover)] hover:text-[var(--ma-ink)] active:scale-[0.94] active:bg-[var(--ma-press)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--ma-muted)] [@media(pointer:coarse)]:size-11 ${
          hidden ? "ma-reveal" : ""
        } ${focusRing}`}
      >
        {children}
      </button>
      <AnimatePresence>
        {tips.open === id && (
          <motion.span
            role="presentation"
            aria-hidden="true"
            initial={{ opacity: 0, y: 3, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%", transition: { duration: 0.14, ease: EASE_OUT } }}
            exit={{ opacity: 0, x: "-50%", transition: { duration: 0 } }}
            className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 whitespace-nowrap rounded-[6px] bg-[var(--ma-tip-bg)] px-2 py-1 font-sans text-[11.5px] font-medium tracking-[-0.005em] text-[var(--ma-tip-ink)] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]"
          >
            {tip ?? label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** “2 / 3” with numerals that roll in the direction you moved. Tabular, fixed width, never reflows. */
function VersionCount({ index, total, dir, sizeClass, reduce }: { index: number; total: number; dir: number; sizeClass: string; reduce: boolean }) {
  const digits = String(Math.max(total, index + 1)).length;
  const roll = (value: number, key: string) => (
    <span className="relative inline-flex justify-center overflow-hidden" style={{ width: `${digits}ch` }}>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.span
          key={`${key}-${value}`}
          custom={dir}
          variants={{
            enter: (d: number) => (reduce ? { opacity: 0 } : { y: d >= 0 ? "70%" : "-70%", opacity: 0, filter: "blur(2px)" }),
            show: { y: "0%", opacity: 1, filter: "blur(0px)", transition: { duration: reduce ? 0.12 : 0.24, ease: EASE_OUT } },
            leave: (d: number) => (reduce ? { opacity: 0, transition: { duration: 0.08 } } : { y: d >= 0 ? "-70%" : "70%", opacity: 0, filter: "blur(2px)", transition: { duration: 0.16, ease: EASE_IN } }),
          }}
          initial="enter"
          animate="show"
          exit="leave"
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
  return (
    <span className={`inline-flex select-none items-center gap-[0.35em] px-0.5 font-mono tabular-nums text-[var(--ma-muted)] ${sizeClass}`} aria-hidden="true">
      {roll(index + 1, "i")}
      <span className="text-[var(--ma-faint)]">/</span>
      {roll(total, "t")}
    </span>
  );
}

/** A paragraph that inks in word by word, used once for a version that was just written. */
function InkedParagraph({ text, start, step }: { text: string; start: number; step: number }) {
  const words = text.split(" ");
  return (
    <p>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.32, ease: EASE_OUT, delay: (start + i) * step }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </p>
  );
}

type ReasonPopoverProps = {
  author: string;
  reasons: FeedbackReason[];
  reduce: boolean;
  onSend: (reasons: string[], note: string) => void;
  onClose: (returnFocus: boolean) => void;
};

/** The thumbs-down follow-up: optional reasons and a note, never required to dismiss. */
function ReasonPopover({ author, reasons, reduce, onSend, onClose }: ReasonPopoverProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, []);

  // A click anywhere else closes it, without stealing focus back from wherever the click went.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = panel.current;
      if (el && !el.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("[data-ma-down]")) onClose(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose(true);
      return;
    }
    if (e.key !== "Tab") return;
    // Keep Tab inside the panel while it’s open.
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>("button, textarea") ?? []);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: reduce ? 0.12 : 0.22, ease: EASE_OUT } }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.14, ease: EASE_IN } }}
      style={{ transformOrigin: "20% 100%" }}
      className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-[min(340px,100%)] rounded-[14px] border border-[var(--ma-pop-line)] bg-[var(--ma-pop)] p-3.5 shadow-[var(--ma-pop-shadow)]"
    >
      <p id={titleId} className="text-[13.5px] font-medium tracking-[-0.01em] text-[var(--ma-ink)]">
        What missed the mark?
      </p>
      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--ma-faint)]">Optional. It goes to the team that tunes {author}.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {reasons.map((r) => {
          const on = picked.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={on}
              data-demo={`reason-${r.id}`}
              onClick={() => toggle(r.id)}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] transition-[background-color,border-color,color,translate] duration-150 active:translate-y-px [@media(pointer:coarse)]:h-10 ${focusRing} ${
                on
                  ? "border-[color-mix(in_srgb,var(--ma-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--ma-accent)_14%,transparent)] text-[var(--ma-ink)]"
                  : "border-[var(--ma-pop-line)] bg-[var(--ma-chip)] text-[var(--ma-muted)] hover:text-[var(--ma-ink)]"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <label className="sr-only" htmlFor={`${titleId}-note`}>
        Anything else
      </label>
      <textarea
        id={`${titleId}-note`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Anything else? (optional)"
        className="mt-3 block w-full resize-none rounded-[10px] border border-[var(--ma-pop-line)] bg-[var(--ma-field)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--ma-ink)] placeholder:text-[var(--ma-faint)] focus-visible:border-[var(--ma-faint)] focus-visible:outline-none"
      />
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onClose(true)}
          className={`h-8 rounded-[8px] px-3 text-[12.5px] text-[var(--ma-muted)] transition-[background-color,color,scale] duration-150 hover:bg-[var(--ma-hover)] hover:text-[var(--ma-ink)] active:scale-[0.97] [@media(pointer:coarse)]:h-11 ${focusRing}`}
        >
          Skip
        </button>
        <button
          type="button"
          data-demo="reason-send"
          onClick={() => onSend(picked, note.trim())}
          className={`h-8 rounded-[8px] bg-[var(--ma-accent)] px-3.5 text-[12.5px] font-medium text-[var(--ma-on-accent)] transition-[filter,scale] duration-150 hover:brightness-110 active:scale-[0.97] [@media(pointer:coarse)]:h-11 ${focusRing}`}
        >
          Send feedback
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_VERSIONS: ReplyVersion[] = [
  {
    id: "v1",
    meta: "Wren 2 · 4.1s",
    paragraphs: [
      "Tern 4.2 makes offline edits safe to merge. Changes you make on a plane now sync the moment you land, and conflicting edits open side by side instead of overwriting each other.",
      "Also in this release: search across archived projects, a desktop install that’s 30% smaller, and a keyboard shortcut for every item in the command bar.",
    ],
  },
  {
    id: "v2",
    meta: "Wren 2 · 3.2s",
    paragraphs: [
      "Offline edits finally merge cleanly. In Tern 4.2, work you do without a connection syncs as soon as you’re back, and when two edits collide you see both, side by side.",
      "Smaller things: archived projects are searchable, the desktop app is 30% lighter, and every command has a shortcut.",
    ],
  },
];

export function AiMessageActions({
  versions: initialVersions = DEFAULT_VERSIONS,
  defaultVersion,
  author = "Wren",
  onRegenerate,
  onCopy,
  onFeedback,
  onVersionChange,
  feedback = true,
  reasons = DEFAULT_REASONS,
  alwaysVisible = false,
  size = "md",
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: AiMessageActionsProps) {
  const reduce = useReducedMotion() ?? false;
  const p = PALETTE[theme];
  const s = SIZES[size];
  const later = useTimers();
  const tips = useTooltips();

  const [versions, setVersions] = useState<ReplyVersion[]>(initialVersions.length ? initialVersions : DEFAULT_VERSIONS);
  const [index, setIndex] = useState(() => Math.min(Math.max(defaultVersion ?? versions.length - 1, 0), versions.length - 1));
  const [dir, setDir] = useState(1);
  const [pending, setPending] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({});
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [bump, setBump] = useState(0); // replays the thumbs-up pop
  const [intro, setIntro] = useState(true); // paragraphs rise in on first view only

  const root = useRef<HTMLElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const seen = useInView(root, { once: true, amount: 0.3 });
  const [bodyRef, bodyHeight] = useMeasuredHeight<HTMLDivElement>();

  const current = versions[index];
  const rating = ratings[current.id] ?? null;
  const total = versions.length;

  const announce = (text: string) => {
    setAnnouncement(text);
    later("announce", () => setAnnouncement(""), 1500);
  };
  const flash = (text: string) => {
    setStatus(text);
    later("status", () => setStatus(null), TIMING.statusFor);
  };

  const go = (next: number) => {
    if (next < 0 || next >= total || next === index || pending) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
    setIntro(false);
    setFreshId(null);
    setPopoverOpen(false);
    onVersionChange?.(next);
    announce(`Version ${next + 1} of ${total}`);
  };

  const copy = () => {
    const text = current.paragraphs.join("\n\n");
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    onCopy?.(text);
    setCopied(true);
    tips.show("copy", true);
    announce("Copied to clipboard");
    later(
      "copied",
      () => {
        setCopied(false);
        tips.hide();
      },
      TIMING.copiedFor,
    );
  };

  const regenerate = async () => {
    if (!onRegenerate || pending) return;
    setPending(true);
    setPopoverOpen(false);
    announce(`Writing version ${total + 1}`);
    try {
      const next = await onRegenerate();
      setVersions((v) => [...v, next]);
      setDir(1);
      setIndex(total);
      setIntro(false);
      setFreshId(next.id);
      onVersionChange?.(total);
      announce(`Version ${total + 1} of ${total + 1} ready`);
    } catch {
      flash("Couldn’t regenerate. Try again.");
      announce("Couldn’t regenerate");
    } finally {
      setPending(false);
    }
  };

  const rate = (value: "up" | "down" | null, extra: { reasons?: string[]; note?: string } = {}) => {
    setRatings((r) => {
      const nextMap = { ...r };
      if (value) nextMap[current.id] = value;
      else delete nextMap[current.id];
      return nextMap;
    });
    onFeedback?.({ versionId: current.id, value, reasons: extra.reasons ?? [], note: extra.note ?? "" });
  };

  const thumbUp = () => {
    setPopoverOpen(false);
    if (rating === "up") {
      rate(null);
      announce("Rating removed");
      return;
    }
    rate("up");
    setBump((b) => b + 1);
    announce("Marked as helpful");
  };

  const thumbDown = () => {
    if (popoverOpen) {
      setPopoverOpen(false);
      return;
    }
    if (rating === "down") {
      rate(null);
      announce("Rating removed");
      return;
    }
    rate("down");
    setPopoverOpen(true);
  };

  const closePopover = useCallback((returnFocus: boolean) => {
    setPopoverOpen(false);
    if (returnFocus) downRef.current?.focus({ preventScroll: true });
  }, []);

  const sendReasons = (picked: string[], note: string) => {
    rate("down", { reasons: picked, note });
    closePopover(true);
    flash("Thanks. That helps.");
    announce("Feedback sent");
  };

  // Arrow keys walk the row like a toolbar; Tab still stops on each button.
  const onToolbarKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-tb]:not(:disabled)"));
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    e.preventDefault();
    const to = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[to].focus();
  };

  const fresh = freshId === current.id && !reduce;
  const wordCount = current.paragraphs.reduce((n, para) => n + para.split(" ").length, 0);
  const step = Math.min(TIMING.wordStep, TIMING.wordCap / Math.max(wordCount, 1)) / 1000;

  const vars = {
    "--ma-ink": p.ink,
    "--ma-body": p.body,
    "--ma-muted": p.muted,
    "--ma-faint": p.faint,
    "--ma-hover": p.hover,
    "--ma-press": p.press,
    "--ma-rule": p.rule,
    "--ma-pop": p.pop,
    "--ma-pop-line": p.popLine,
    "--ma-pop-shadow": p.popShadow,
    "--ma-chip": p.chip,
    "--ma-field": p.field,
    "--ma-tip-bg": p.tipBg,
    "--ma-tip-ink": p.tipInk,
    "--ma-on-accent": p.onAccent,
    "--ma-accent": accent,
  } as CSSProperties;

  let order = 0;
  const icon = s.icon;

  return (
    <article
      ref={root}
      aria-label={`${author}’s reply, version ${index + 1} of ${total}`}
      data-demo="reply"
      data-always={alwaysVisible ? "" : undefined}
      style={vars}
      className={`ma-root @container relative font-sans ${className}`}
    >
      {/* The hover reveal is plain CSS so it answers within a frame and survives the demo player’s :hover copy. */}
      <style>{`
        .ma-reveal { opacity: 0; translate: 0 2px; transition-delay: 0ms; }
        @media (hover: hover) {
          .ma-root:hover .ma-reveal { opacity: 1; translate: 0 0; transition-delay: var(--ma-d); }
        }
        .ma-root:focus-within .ma-reveal, .ma-root[data-always] .ma-reveal { opacity: 1; translate: 0 0; }
        @media (hover: none) { .ma-reveal { opacity: 1; translate: 0 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ma-reveal { translate: 0 0; }
          .ma-root:hover .ma-reveal { transition-delay: 0ms; }
        }
      `}</style>

      <motion.header
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
        animate={seen ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
        transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT }}
        className="mb-2.5 flex items-center gap-2"
      >
        <span aria-hidden="true" className="grid size-5 place-items-center rounded-[6px] bg-[var(--ma-ink)] font-mono text-[10.5px] font-semibold text-[var(--ma-pop)]">
          {author.slice(0, 1)}
        </span>
        <span className="text-[13px] font-medium tracking-[-0.01em] text-[var(--ma-ink)]">{author}</span>
      </motion.header>

      {/* Height tweens between versions of different lengths instead of snapping. */}
      <motion.div animate={{ height: bodyHeight }} transition={reduce ? { duration: 0 } : { duration: 0.34, ease: EASE_OUT }} className="relative overflow-hidden">
        <div ref={bodyRef}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={current.id}
              custom={dir}
              variants={{
                enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 8, filter: "blur(3px)" }),
                show: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: reduce ? 0.12 : 0.26, ease: EASE_OUT } },
                leave: (d: number) => (reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, x: d * -6, filter: "blur(3px)", transition: { duration: 0.15, ease: EASE_IN } }),
              }}
              initial="enter"
              animate="show"
              exit="leave"
              aria-busy={pending || undefined}
              className="space-y-3 text-[15.5px] leading-[1.65] text-[var(--ma-body)] [text-wrap:pretty]"
            >
              <motion.div
                animate={pending ? { opacity: 0.32, filter: reduce ? "blur(0px)" : "blur(1.5px)" } : { opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: reduce ? 0.12 : 0.3, ease: EASE_OUT }}
                className="space-y-3"
              >
                {current.paragraphs.map((para, i) => {
                  const before = current.paragraphs.slice(0, i).reduce((n, x) => n + x.split(" ").length, 0);
                  return fresh ? (
                    <InkedParagraph key={i} text={para} start={before} step={step} />
                  ) : (
                    <motion.p
                      key={i}
                      initial={!intro ? false : reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
                      animate={seen ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
                      transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : 0.08 + i * 0.06 }}
                    >
                      {para}
                    </motion.p>
                  );
                })}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={seen ? { opacity: 1 } : undefined}
        transition={{ duration: reduce ? 0.15 : 0.4, ease: EASE_OUT, delay: reduce ? 0 : 0.28 }}
        className="relative mt-3"
      >
        <div role="toolbar" aria-label="Message actions" onKeyDown={onToolbarKey} className={`-ml-1.5 flex min-h-8 items-center ${s.gap} [@media(pointer:coarse)]:min-h-11`}>
          <AnimatePresence initial={false}>
            {total > 1 && (
              <motion.div
                key="branches"
                initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, width: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }}
                transition={SPRING_UI}
                className="flex shrink-0 items-center overflow-hidden"
              >
                <IconButton id="prev" label="Previous version" size={size} tips={tips} hidden={false} order={order++} disabled={index === 0 || pending} onClick={() => go(index - 1)} demo="prev">
                  <ChevronLeft size={icon} strokeWidth={1.6} aria-hidden="true" />
                </IconButton>
                <VersionCount index={index} total={total} dir={dir} sizeClass={s.count} reduce={reduce} />
                <IconButton id="next" label="Next version" size={size} tips={tips} hidden={false} order={order++} disabled={index === total - 1 || pending} onClick={() => go(index + 1)} demo="next">
                  <ChevronRight size={icon} strokeWidth={1.6} aria-hidden="true" />
                </IconButton>
                {/* The divider only earns its place once something sits to its right. */}
                <span aria-hidden="true" className={`mx-1.5 h-4 w-px bg-[var(--ma-rule)] transition-[opacity,translate] duration-150 ${copied || pending || rating || popoverOpen ? "" : "ma-reveal"}`} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`flex items-center ${s.gap}`}>
            <IconButton id="copy" label={copied ? "Copied" : "Copy reply"} tip={copied ? "Copied" : "Copy"} size={size} tips={tips} hidden={!copied} order={order++} onClick={copy} demo="copy">
              <CopyMorphIcon copied={copied} size={icon} reduce={reduce} />
            </IconButton>
            {onRegenerate && (
              <IconButton
                id="regenerate"
                label={pending ? "Writing a new version" : "Regenerate"}
                tip={pending ? "Writing…" : "Regenerate"}
                size={size}
                tips={tips}
                hidden={!pending}
                order={order++}
                busy={pending}
                onClick={regenerate}
                demo="regenerate"
              >
                <RegenerateIcon spinning={pending} size={icon} reduce={reduce} />
              </IconButton>
            )}
            {feedback && (
              <>
                <IconButton id="up" label="Good response" size={size} tips={tips} hidden={rating !== "up"} order={order++} pressed={rating === "up"} onClick={thumbUp} demo="thumbs-up">
                  <motion.span
                    key={bump}
                    className="inline-flex"
                    initial={{ scale: 1, rotate: 0 }}
                    animate={bump && !reduce ? { scale: [1, 1.22, 1], rotate: [0, -10, 0] } : undefined}
                    transition={{ duration: 0.34, ease: EASE_OUT }}
                  >
                    <ThumbsUp
                      size={icon}
                      strokeWidth={1.6}
                      aria-hidden="true"
                      style={rating === "up" ? RATED_STYLE : undefined}
                      className="transition-[fill] duration-150"
                    />
                  </motion.span>
                </IconButton>
                <span data-ma-down="" className="inline-flex">
                  <IconButton
                    id="down"
                    label="Bad response"
                    size={size}
                    tips={tips}
                    hidden={rating !== "down" && !popoverOpen}
                    order={order++}
                    pressed={rating === "down"}
                    expanded={popoverOpen}
                    onClick={thumbDown}
                    demo="thumbs-down"
                    buttonRef={downRef}
                  >
                    <ThumbsDown
                      size={icon}
                      strokeWidth={1.6}
                      aria-hidden="true"
                      style={rating === "down" ? RATED_STYLE : undefined}
                      className="transition-[fill] duration-150"
                    />
                  </IconButton>
                </span>
              </>
            )}
          </div>

          {/* The meta slot doubles as a quiet status line: “Writing version 3…”, a thank-you, an error. */}
          <span className={`ml-auto hidden min-w-0 pl-3 text-right font-mono tabular-nums text-[var(--ma-faint)] @[26rem]:inline-flex ${s.count}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={pending ? "pending" : (status ?? current.id)}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: reduce ? 0.12 : 0.22, ease: EASE_OUT } }}
                exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_IN } }}
                className="truncate"
              >
                {pending ? `Writing version ${total + 1}…` : (status ?? current.meta ?? "")}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <AnimatePresence>
          {popoverOpen && feedback && <ReasonPopover key="reasons" author={author} reasons={reasons} reduce={reduce} onSend={sendReasons} onClose={closePopover} />}
        </AnimatePresence>
      </motion.div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

/** The demo’s quiet backdrop; not part of the component. It follows the theme. */
const STAGE = {
  dark: { bg: "#000000", panel: "#0b0b0c", ring: "rgba(255,255,255,0.07)", bubble: "#1c1c1f", bubbleInk: "#ededef", label: "#8a8a93" },
  light: { bg: "#e9e9ec", panel: "#ffffff", ring: "rgba(24,24,27,0.08)", bubble: "#f1f1f3", bubbleInk: "#18181b", label: "#6b6b73" },
} as const;

/** Every take the demo can show; the first `branches` exist up front and Regenerate deals the rest in order. */
const DEMO_POOL: ReplyVersion[] = [
  ...DEFAULT_VERSIONS,
  {
    id: "v3",
    meta: "Wren 2 · 2.8s",
    paragraphs: [
      "Tern 4.2 is about trust. Edit offline, reconnect, and your work is there: synced, with any conflicts laid out side by side for you to choose.",
      "Plus searchable archives, a desktop app that’s 30% smaller, and a shortcut for everything in the command bar.",
    ],
  },
  {
    id: "v4",
    meta: "Wren 2 · 1.9s",
    paragraphs: ["Offline edits now sync and merge safely, with conflicts shown side by side. Also new: searchable archives, a 30% smaller desktop app and shortcuts for every command."],
  },
  {
    id: "v5",
    meta: "Wren 2 · 3.6s",
    paragraphs: [
      "Here’s a tighter take. Tern 4.2 keeps your offline work: it syncs when you reconnect and puts any conflicts next to each other so nothing is lost.",
      "Archives are searchable, the desktop app is 30% smaller, and every command has a shortcut.",
    ],
  },
];

/** How long the demo pretends to think before a new take arrives. */
const DEMO_THINK_MS = 650;

export type AiMessageActionsDemoProps = Partial<AiMessageActionsProps> & {
  /** Demo only. How many versions exist before the first Regenerate (1–4). */
  branches?: number;
};

export default function AiMessageActionsDemo({ branches = 2, ...overrides }: AiMessageActionsDemoProps = {}) {
  const theme = overrides.theme ?? "dark";
  const st = STAGE[theme];
  const reduce = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const seen = useInView(stage, { once: true, amount: 0.3 });
  const count = Math.min(Math.max(Math.round(branches), 1), 4);
  const dealt = useRef(count);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // A new branch count remounts the reply, so the deck starts again after its last version.
  useEffect(() => {
    dealt.current = count;
  }, [count]);

  const regenerate = () =>
    new Promise<ReplyVersion>((resolve) => {
      const n = dealt.current++;
      const take = DEMO_POOL[n % DEMO_POOL.length];
      // Past the pool, takes repeat with fresh ids so each is still its own version.
      const next = n < DEMO_POOL.length ? take : { ...take, id: `${take.id}-${n}` };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => resolve(next), DEMO_THINK_MS);
    });

  return (
    <div ref={stage} className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8" style={{ background: st.bg }}>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(8px)" }}
        animate={seen ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
        transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT }}
        className="w-full max-w-[640px] rounded-[20px] px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8"
        style={{ background: st.panel, boxShadow: `inset 0 0 0 1px ${st.ring}, 0 40px 80px -48px rgba(0,0,0,${theme === "dark" ? 0.9 : 0.3})` }}
      >
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={seen ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
          transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : 0.06 }}
          className="mb-8 flex flex-col items-end gap-1.5"
        >
          <p className="max-w-[85%] rounded-[18px] rounded-br-[6px] px-4 py-2.5 text-[14.5px] leading-[1.55]" style={{ background: st.bubble, color: st.bubbleInk }}>
            Write the release note for Tern 4.2. Under 80 words, no hype.
          </p>
          <span className="font-mono text-[11px]" style={{ color: st.label }}>
            You · 09:41
          </span>
        </motion.div>
        <AiMessageActions key={count} versions={DEMO_POOL.slice(0, count)} onRegenerate={regenerate} {...overrides} />
      </motion.div>
    </div>
  );
}
