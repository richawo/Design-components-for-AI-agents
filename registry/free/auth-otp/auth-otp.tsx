"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type RefObject,
} from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion, type AnimationPlaybackControls } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** What `onVerify` resolves with. Throwing shows a connection error and keeps the code. */
export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; attemptsLeft?: number; message?: string }
  | { ok: false; reason: "expired"; message?: string }
  | { ok: false; reason: "locked"; message?: string };

export type AuthOtpProps = {
  /** Number of digits. Cells split into two groups at the midpoint. */
  length?: number;
  channel?: "email" | "sms";
  /** Where the code went. Shown in full; mask it yourself if you need to. */
  destination?: string;
  title?: string;
  description?: string;
  /** Seconds before "Resend" unlocks, after mount and after every resend. */
  resendAfter?: number;
  /** Fine print under the resend row. */
  footnote?: string;
  /** Called with the full code as soon as the last digit lands (or on Enter). */
  onVerify?: (code: string) => Promise<OtpVerifyResult | void>;
  onResend?: () => Promise<void>;
  /** Inline edit: resolve once a new code has been sent to the new address. */
  onChangeDestination?: (value: string) => Promise<void>;
  /** If set, "Edit" calls this instead of opening the inline editor (e.g. to route back a step). */
  onEdit?: () => void;
  /** Called after the success animation settles. */
  onVerified?: () => void;
  autoFocus?: boolean;
  /** The one accent: the active-cell ring, the caret and the emphasised Resend. Defaults to the theme’s ink. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

type Phase = "idle" | "verifying" | "sweep" | "merge" | "done" | "error" | "locked";
type Msg = { tone: "muted" | "error" | "ok"; text: string } | null;
type Merge = { dx: number[]; cw: number; ch: number };
type ResendState = "idle" | "sending" | "sent";

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#0a0a0b",
    tile: "#141416",
    cell: "rgba(255,255,255,0.02)",
    cellFilled: "rgba(255,255,255,0.04)",
    hover: "rgba(255,255,255,0.05)",
    line: "rgba(255,255,255,0.09)",
    lineStrong: "rgba(255,255,255,0.16)",
    ink: "#ededef",
    muted: "#a0a0a8",
    faint: "#7d7d86",
    error: "#ff6b5e",
    errorInk: "#ff8f84",
    ok: "#3ddc97",
    okInk: "#c9f7e1",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06), 0 32px 80px -32px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    tile: "#f4f4f5",
    cell: "rgba(24,24,27,0.02)",
    cellFilled: "rgba(24,24,27,0.035)",
    hover: "rgba(24,24,27,0.05)",
    line: "rgba(24,24,27,0.13)",
    lineStrong: "rgba(24,24,27,0.24)",
    ink: "#18181b",
    muted: "#52525b",
    faint: "#71717a",
    error: "#dc2626",
    errorInk: "#b91c1c",
    ok: "#16a34a",
    okInk: "#15803d",
    shadow: "0 0 0 1px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -32px rgba(24,24,27,0.28)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = "#000000";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  card: 0.6,
  cardRise: 16,
  cardBlur: 10,
  rise: 10,
  blur: 6,
  block: 0.45,
  first: 0.12,
  stagger: 0.05,
  cell: 0.035, // between cells as the row lands
  digit: 0.3, // a digit settling into its cell
  ripple: 0.045, // paste: between digits
  shakeStep: 0.045, // wrong code: between cells
  sweep: 0.34, // success light crossing one cell
  sweepStep: 0.055,
  close: 0.26, // cells sliding into one bar
  pill: 0.46, // bar → Verified pill
  swap: 0.22,
  roll: 0.32,
  fade: 0.15,
} as const;

/** Success sequence, ms: sweep starts → every cell swept → bar closed → onVerified. */
const SUCCESS_MS = { sweepStart: 120, sweepTail: 260, close: 340, hold: 700 } as const;
const REDUCED_VERIFIED_MS = 300;
/** Wrong code: how long the shaken digits stay before they clear. ms. */
const ERROR_HOLD_MS = 380;
const REDUCED_ERROR_HOLD_MS = 600;
/** “Sent” holds before Resend counts down again. ms. */
const RESENT_HOLD_MS = 1400;
const TICK_MS = 250;
const PILL = { width: 188, height: 48 } as const;
const CELL_RADIUS = 12;

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--otp-ink)]";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isPhone = (v: string) => v.replace(/\D/g, "").length >= 7;
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Black or white, whichever reads on the accent. */
function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

/** Palette → `--otp-*` variables (camelCase keys become kebab-case). */
function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--otp-accent": accent, "--otp-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--otp-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = v;
  return vars as CSSProperties;
}

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean, rise: number = MOTION.rise, blur: number = MOTION.blur, duration: number = MOTION.block) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: rise, filter: `blur(${blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration, ease: EASE_OUT, delay },
  };
}

function swapProps(reduce: boolean, offset = 6) {
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: offset, filter: "blur(2px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -offset, filter: "blur(2px)", transition: { duration: MOTION.swap * 0.66, ease: EASE_IN } },
      };
}

function errorText(res: Exclude<OtpVerifyResult, { ok: true }>) {
  if (res.message) return res.message;
  if (res.reason === "expired") return "That code has expired. Send yourself a fresh one.";
  if (res.reason === "locked") return "Too many wrong codes. Request a new one to keep going.";
  if (res.attemptsLeft === undefined) return "That code didn’t match. Try again.";
  return res.attemptsLeft === 1 ? "That code didn’t match. One try left." : `That code didn’t match. ${res.attemptsLeft} tries left.`;
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** setTimeout and requestAnimationFrame that can’t outlive the component. */
function useScheduler() {
  const timeouts = useRef(new Set<ReturnType<typeof setTimeout>>());
  const frames = useRef(new Set<number>());
  useEffect(() => {
    const t = timeouts.current;
    const f = frames.current;
    return () => {
      t.forEach(clearTimeout);
      f.forEach(cancelAnimationFrame);
      t.clear();
      f.clear();
    };
  }, []);
  return useMemo(() => {
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timeouts.current.delete(id);
        fn();
      }, ms);
      timeouts.current.add(id);
    };
    const frame = (fn: () => void) => {
      const id = requestAnimationFrame(() => {
        frames.current.delete(id);
        fn();
      });
      frames.current.add(id);
    };
    return { later, frame, wait: (ms: number) => new Promise<void>((resolve) => later(resolve, ms)) };
  }, []);
}

/** Seconds left before Resend unlocks; counts from mount and re-renders once a second while running. */
function useCooldown(initialSeconds: number) {
  const [until, setUntil] = useState(() => Date.now() + initialSeconds * 1000);
  const [left, setLeft] = useState(initialSeconds);
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setUntil(0);
    };
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [until]);
  const start = useCallback((seconds: number) => {
    setUntil(seconds > 0 ? Date.now() + seconds * 1000 : 0);
    setLeft(Math.max(0, Math.ceil(seconds)));
  }, []);
  return { left, start };
}

/**
 * The code field: one real input under the cells, plus everything that makes it feel like
 * six boxes. The native selection always covers exactly one cell (the filled cell you’re on,
 * or the first empty one), paste merges at the cursor, and each changed cell gets a stamp so
 * retyping the same digit still rolls in.
 */
function useOtpField({
  length,
  inert,
  reduce,
  frame,
  cellRefs,
  onCommit,
  onEnter,
}: {
  length: number;
  inert: boolean;
  reduce: boolean;
  frame: (fn: () => void) => void;
  cellRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  onCommit: (next: string) => void;
  onEnter: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [stamps, setStamps] = useState<number[]>(() => Array(length).fill(0));
  // Per-cell entrance delay for a paste/autofill ripple; null when digits arrive one at a time.
  const [delays, setDelays] = useState<number[] | null>(null);
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const [focused, setFocused] = useState(false);
  const [nudge, setNudge] = useState(0);
  const valueRef = useRef("");
  const pendingSel = useRef<number | null>(null);
  const handlers = useRef({ onCommit, onEnter });
  useEffect(() => {
    handlers.current = { onCommit, onEnter };
  });

  const set = useCallback(
    (next: string, caret: number, rippleFrom: number | null) => {
      const prev = valueRef.current;
      valueRef.current = next;
      setValue(next);
      setStamps((st) => st.map((s, i) => ((prev[i] ?? "") !== (next[i] ?? "") ? s + 1 : s)));
      setDelays(rippleFrom === null || reduce ? null : Array.from({ length }, (_, i) => Math.max(0, i - rippleFrom) * MOTION.ripple));
      pendingSel.current = caret;
    },
    [length, reduce],
  );

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || pendingSel.current === null || document.activeElement !== el) return;
    const p = Math.min(pendingSel.current, length);
    pendingSel.current = null;
    if (p < value.length) el.setSelectionRange(p, p + 1);
    else el.setSelectionRange(value.length, value.length);
    setSel([el.selectionStart ?? 0, el.selectionEnd ?? 0]);
  }, [value, length]);

  const selectCell = useCallback((el: HTMLInputElement, i: number) => {
    // Read the live DOM value: this also runs from frame callbacks that may hold a stale render.
    const len = el.value.length;
    const p = Math.max(0, Math.min(i, len, length - 1));
    if (p < len) el.setSelectionRange(p, p + 1);
    else el.setSelectionRange(p, p);
    setSel([el.selectionStart ?? 0, el.selectionEnd ?? 0]);
  }, [length]);

  const syncSel = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const len = el.value.length;
    let s = el.selectionStart ?? 0;
    let e = el.selectionEnd ?? 0;
    if (s === e && s < len) {
      el.setSelectionRange(s, s + 1);
      e = s + 1;
    }
    if (s > len) s = e = len;
    setSel([s, e]);
  }, []);

  const commit = (next: string, caret: number, rippleFrom: number | null) => {
    set(next, caret, rippleFrom);
    handlers.current.onCommit(next);
  };

  const active = Math.min(sel[0], length - 1);

  const onChange = (raw: string) => {
    if (inert) return;
    const digits = raw.replace(/\D/g, "").slice(0, length);
    if (digits === value) {
      if (raw !== value) setNudge((n) => n + 1); // typed a letter
      return;
    }
    const caret = inputRef.current?.selectionStart ?? digits.length;
    const grew = digits.length - value.length;
    commit(digits, Math.min(caret, digits.length), grew > 1 ? 0 : null);
  };

  const onPaste = (e: ReactClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (inert) return;
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) {
      setNudge((n) => n + 1);
      return;
    }
    if (pasted.length >= length) {
      commit(pasted.slice(0, length), length, 0);
      return;
    }
    const [s, en] = sel;
    const next = (value.slice(0, s) + pasted + value.slice(Math.max(en, s))).slice(0, length);
    commit(next, Math.min(s + pasted.length, next.length), s);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const el = inputRef.current;
    if (!el) return;
    const go = (i: number) => {
      e.preventDefault();
      selectCell(el, i);
    };
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(active - 1);
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") go(sel[0] >= value.length ? sel[0] : active + 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(value.length);
    else if (e.key === "Enter") {
      e.preventDefault();
      handlers.current.onEnter(value);
    } else if (e.key === "Backspace" && !inert) {
      // Filled cell: clear it and stay. Empty cell: step back and clear that one.
      e.preventDefault();
      const [s, en] = sel;
      if (en - s > 1) commit(value.slice(0, s) + value.slice(en), s, null);
      else if (s < value.length) commit(value.slice(0, s) + value.slice(s + 1), s, null);
      else if (s > 0) commit(value.slice(0, s - 1) + value.slice(s), s - 1, null);
    } else if (e.key === "Delete" && !inert) {
      e.preventDefault();
      const [s] = sel;
      if (s < value.length) commit(value.slice(0, s) + value.slice(s + 1), s, null);
    }
  };

  // Clicking a cell puts you on it (never past the first empty cell). The browser moves the
  // caret after pointerup, so the correction waits a frame.
  const onPointerUp = (clientX: number) => {
    const el = inputRef.current;
    if (!el || inert) return;
    const rects = cellRefs.current.map((c) => c?.getBoundingClientRect());
    let idx = rects.findIndex((r) => r && clientX <= r.right + 4);
    if (idx < 0) idx = length - 1;
    frame(() => selectCell(el, idx));
  };

  return {
    inputRef,
    value,
    stamps,
    delays,
    sel,
    focused,
    nudge,
    active,
    reset: () => set("", 0, null),
    focus: () => inputRef.current?.focus({ preventScroll: true }),
    inputProps: {
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      onPaste,
      onKeyDown,
      onSelect: syncSel,
      onFocus: () => {
        setFocused(true);
        frame(syncSel);
      },
      onBlur: () => setFocused(false),
      onPointerUp: (e: { clientX: number }) => onPointerUp(e.clientX),
    },
  };
}

/** Imperative keyframe animations (shakes, nudges, ripples) that are stopped if the component unmounts. */
function useImperative() {
  const running = useRef(new Set<AnimationPlaybackControls>());
  useEffect(() => {
    const set = running.current;
    return () => set.forEach((a) => a.stop());
  }, []);
  return useCallback((run: () => AnimationPlaybackControls) => {
    const a = run();
    running.current.add(a);
    a.finished.then(() => running.current.delete(a)).catch(() => running.current.delete(a));
  }, []);
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function AuthOtp({
  length = 6,
  channel = "email",
  destination: destinationProp = "ines.moreau@halyard.app",
  title,
  description = "Enter the 6-digit code we just sent to",
  resendAfter = 30,
  footnote = "Codes last 10 minutes. Not there? Check spam — it’s shy.",
  onVerify,
  onResend,
  onChangeDestination,
  onEdit,
  onVerified,
  autoFocus = true,
  accent,
  theme = "dark",
  className = "",
}: AuthOtpProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLDivElement>(null);
  const play = useInView(root, { once: true, amount: 0.3 });
  const palette = PALETTE[theme];
  const { later, frame } = useScheduler();
  const runAnimation = useImperative();
  const alive = useRef(true);
  const verifying = useRef(false);
  const resending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const [destination, setDestination] = useState(destinationProp);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<Msg>(null);
  const [resendState, setResendState] = useState<ResendState>("idle");
  const [editing, setEditing] = useState(false);
  const [merge, setMerge] = useState<Merge | null>(null);
  const cooldown = useCooldown(resendAfter);

  const rowRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  const locked = phase === "locked";
  const busy = phase === "verifying" || phase === "sweep" || phase === "merge" || phase === "done";
  const inert = busy || locked || editing || phase === "error" || !onVerify;

  const verify = async (code: string) => {
    if (!onVerify || verifying.current || inert) return;
    verifying.current = true;
    setPhase("verifying");
    setMsg({ tone: "muted", text: "Checking your code…" });
    field.inputRef.current?.blur();
    let res: OtpVerifyResult | void;
    try {
      res = await onVerify(code);
    } catch {
      if (!alive.current) return;
      setPhase("idle");
      setMsg({ tone: "error", text: "We couldn’t reach the server. Your code is still here. Press Enter to try again." });
      field.focus();
      return;
    } finally {
      verifying.current = false;
    }
    if (!alive.current) return;
    if (!res || res.ok) return succeed();
    setMsg({ tone: "error", text: errorText(res) });
    if (res.reason === "locked") {
      setPhase("locked");
      field.reset();
      cooldown.start(0);
      return;
    }
    // Wrong or expired: shake in sequence, tint, then clear.
    setPhase("error");
    if (res.reason === "expired") cooldown.start(0);
    if (!reduce)
      cellRefs.current.forEach((c, i) => {
        if (c) runAnimation(() => animate(c, { x: [0, -6, 5, -3, 2, 0] }, { duration: 0.4, delay: i * MOTION.shakeStep, ease: "easeOut" }));
      });
    later(
      () => {
        setPhase("idle");
        field.reset();
        field.focus();
      },
      reduce ? REDUCED_ERROR_HOLD_MS : ERROR_HOLD_MS + length * MOTION.shakeStep * 1000 + 400,
    );
  };

  const succeed = () => {
    setMsg({ tone: "ok", text: "Code verified." });
    if (reduce) {
      setPhase("done");
      later(() => onVerified?.(), REDUCED_VERIFIED_MS);
      return;
    }
    // Measure the cells so they can slide into one contiguous bar.
    const row = rowRef.current;
    const cells = cellRefs.current.slice(0, length);
    if (row && cells.every(Boolean)) {
      const cw = cells[0]!.offsetWidth;
      const barLeft = (row.offsetWidth - cw * length) / 2;
      setMerge({ dx: cells.map((c, i) => barLeft + i * cw - c!.offsetLeft), cw, ch: cells[0]!.offsetHeight });
    }
    setPhase("sweep");
    const swept = SUCCESS_MS.sweepStart + length * MOTION.sweepStep * 1000 + SUCCESS_MS.sweepTail;
    later(() => setPhase("merge"), swept);
    later(() => setPhase("done"), swept + SUCCESS_MS.close);
    later(() => onVerified?.(), swept + SUCCESS_MS.close + SUCCESS_MS.hold);
  };

  const field = useOtpField({
    length,
    inert,
    reduce,
    frame,
    cellRefs,
    onCommit: (next) => {
      if (msg?.tone === "error" && phase !== "locked") setMsg(null);
      if (next.length === length) void verify(next);
    },
    onEnter: (value) => {
      if (value.length === length && !busy) void verify(value);
    },
  });

  useEffect(() => {
    if (autoFocus) field.inputRef.current?.focus({ preventScroll: true });
    // Mount only: focusing again on re-render would steal focus back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    if (!onResend || resending.current || cooldown.left > 0 || resendState !== "idle" || busy) return;
    resending.current = true;
    setResendState("sending");
    try {
      await onResend();
      if (!alive.current) return;
      setResendState("sent");
      if (phase === "locked" || phase === "error") setPhase("idle");
      field.reset();
      setMsg({ tone: "muted", text: `New code sent to ${destination}. The old one no longer works.` });
      field.focus();
      later(() => {
        setResendState("idle");
        cooldown.start(resendAfter);
      }, RESENT_HOLD_MS);
    } catch {
      if (!alive.current) return;
      setResendState("idle");
      setMsg({ tone: "error", text: "Couldn’t send a new code just now. Give it a few seconds and try again." });
    } finally {
      resending.current = false;
    }
  };

  const saveDestination = async (next: string) => {
    if (!onChangeDestination) throw new Error("We couldn't update where your code is sent. Try again.");
    await onChangeDestination(next);
    if (!alive.current) return;
    setDestination(next);
    setEditing(false);
    setPhase("idle");
    field.reset();
    cooldown.start(resendAfter);
    setMsg({ tone: "muted", text: `Code sent to ${next}.` });
    frame(field.focus);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (field.value.length === length && !busy) void verify(field.value);
  };

  // Reading order: glyph, heading, destination, cells (each cell its own beat), status, resend row, footnote.
  const at = (n: number) => MOTION.first + n * MOTION.stagger;
  const afterCells = at(3) + length * MOTION.cell;

  return (
    <div
      ref={root}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full max-w-[400px] font-sans text-[var(--otp-ink)] antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      <style>{`
        @keyframes auth-otp-blink { 0%, 45% { opacity: 1 } 55%, 100% { opacity: 0 } }
        @keyframes auth-otp-spin { to { transform: rotate(360deg) } }
      `}</style>
      <motion.div
        {...enter(play, 0, reduce, MOTION.cardRise, MOTION.cardBlur, MOTION.card)}
        className="relative rounded-[20px] bg-[var(--otp-surface)] px-5 pb-6 pt-7 shadow-[var(--otp-shadow)] @[22rem]:px-6 @sm:px-8 @sm:pb-8 @sm:pt-9"
      >
        <motion.div {...enter(play, at(0), reduce)}>
          <ChannelGlyph channel={channel} />
        </motion.div>
        <motion.h1 {...enter(play, at(1), reduce)} className="mt-6 text-[clamp(1.375rem,1.2rem+0.6cqi,1.5rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
          {title ?? (channel === "email" ? "Check your inbox" : "Check your phone")}
        </motion.h1>

        <motion.div {...enter(play, at(2), reduce)}>
          <DestinationLine
            id={`${uid}-desc`}
            channel={channel}
            lead={description.replace(/\b6\b/, String(length))}
            destination={destination}
            editing={editing}
            canEdit={!busy && (!!onEdit || !!onChangeDestination)}
            onEdit={() => (onEdit ? onEdit() : setEditing(true))}
            onCancel={() => {
              setEditing(false);
              frame(field.focus);
            }}
            onSave={saveDestination}
            reduce={reduce}
          />
        </motion.div>

        <form onSubmit={submit} className="mt-7" noValidate>
          <label htmlFor={`${uid}-code`} className="sr-only">
            {length}-digit verification code
          </label>
          <CodeRow
            uid={uid}
            length={length}
            field={field}
            phase={phase}
            inert={inert}
            dimmed={editing}
            merge={merge}
            rowRef={rowRef}
            cellRefs={cellRefs}
            play={play}
            delay={at(3)}
            runAnimation={runAnimation}
            reduce={reduce}
          />
          <motion.div {...enter(play, afterCells, reduce)}>
            <StatusLine id={`${uid}-msg`} msg={onVerify ? msg : { tone: "muted", text: "Verification is unavailable right now." }} spinning={phase === "verifying"} reduce={reduce} />
          </motion.div>
        </form>

        <motion.div
          {...enter(play, afterCells + MOTION.stagger, reduce)}
          className={`mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-[var(--otp-line)] pt-4 transition-opacity duration-300 ${busy ? "opacity-40" : ""}`}
        >
          <span className="text-[13.5px] text-[var(--otp-muted)]">Didn’t get it?</span>
          <ResendButton left={onResend ? cooldown.left : 0} state={resendState} disabled={busy || !onResend} emphasise={locked} onClick={() => void resend()} reduce={reduce} />
        </motion.div>
        {footnote && (
          <motion.p {...enter(play, afterCells + MOTION.stagger * 2, reduce)} className="mt-2 text-pretty text-[12.5px] leading-[1.5] text-[var(--otp-faint)]">
            {footnote}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Code row: the real input over six visual cells, plus the success pill */
/* ------------------------------------------------------------------ */

type OtpField = ReturnType<typeof useOtpField>;

function CodeRow({
  uid,
  length,
  field,
  phase,
  inert,
  dimmed,
  merge,
  rowRef,
  cellRefs,
  play,
  delay,
  runAnimation,
  reduce,
}: {
  uid: string;
  length: number;
  field: OtpField;
  phase: Phase;
  inert: boolean;
  dimmed: boolean;
  merge: Merge | null;
  rowRef: RefObject<HTMLDivElement | null>;
  cellRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  play: boolean;
  delay: number;
  runAnimation: (run: () => AnimationPlaybackControls) => void;
  reduce: boolean;
}) {
  const half = Math.ceil(length / 2);
  const showCaret = field.focused && !inert && field.value.length < length && field.sel[0] === field.sel[1];
  return (
    <div ref={rowRef} data-demo="code" className={`relative flex h-[var(--otp-h)] items-center transition-opacity duration-200 [--otp-h:52px] @sm:[--otp-h:56px] ${dimmed ? "opacity-40" : ""}`}>
      <div className="flex w-full items-center">
        {Array.from({ length }, (_, i) => (
          <motion.div
            key={i}
            {...enter(play, delay + i * MOTION.cell, reduce, 12, MOTION.blur)}
            className={`flex min-w-0 flex-1 ${i === half ? "ml-4 @sm:ml-5" : i > 0 ? "ml-2" : ""}`}
          >
            <Cell
              index={i}
              length={length}
              digit={field.value[i] ?? ""}
              stamp={field.stamps[i]}
              delay={field.delays ? field.delays[i] : null}
              active={field.focused && !inert && i === field.active}
              caret={showCaret && i === field.active}
              filled={i < field.value.length}
              phase={phase}
              nudge={field.nudge}
              merge={merge}
              runAnimation={runAnimation}
              reduce={reduce}
              layoutId={`${uid}-active`}
              refCb={(el) => {
                cellRefs.current[i] = el;
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* The real input: one field, transparent, laid over the cells. */}
      <input
        ref={field.inputRef}
        id={`${uid}-code`}
        name="one-time-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        readOnly={inert}
        aria-invalid={phase === "error" || undefined}
        aria-describedby={`${uid}-desc ${uid}-msg`}
        spellCheck={false}
        autoCorrect="off"
        {...field.inputProps}
        className={`absolute inset-0 h-full w-full bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent ${inert ? "pointer-events-none" : "cursor-text"}`}
        style={{ fontSize: 16, letterSpacing: "-0.5em" }}
      />

      <AnimatePresence>{phase === "done" && <VerifiedPill key="pill" merge={merge} length={length} reduce={reduce} />}</AnimatePresence>
    </div>
  );
}

/** The closed bar becomes a pill: same size first, then it eases to 188×48 and the check draws. */
function VerifiedPill({ merge, length, reduce }: { merge: Merge | null; length: number; reduce: boolean }) {
  const from = reduce || !merge ? null : { width: merge.cw * length, height: merge.ch, borderRadius: CELL_RADIUS };
  return (
    <motion.div
      initial={from ? { ...from, opacity: 1 } : { opacity: 0 }}
      animate={{ width: PILL.width, height: PILL.height, borderRadius: PILL.height / 2, opacity: 1 }}
      transition={{ duration: reduce ? MOTION.fade : MOTION.pill, ease: EASE_IN_OUT }}
      className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 overflow-hidden bg-[color-mix(in_srgb,var(--otp-ok)_12%,var(--otp-surface))] text-[var(--otp-ok)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--otp-ok)_45%,transparent),0_0_0_4px_color-mix(in_srgb,var(--otp-ok)_6%,transparent)]"
      style={from ? undefined : { width: PILL.width, height: PILL.height, borderRadius: PILL.height / 2 }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <motion.path
          d="M4 9.4 L7.4 12.6 L14 5.6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.36, delay: 0.3, ease: EASE_OUT }}
        />
      </svg>
      <motion.span
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: -4, filter: "blur(2px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.3, delay: reduce ? 0 : 0.38, ease: EASE_OUT }}
        className="whitespace-nowrap text-[14.5px] font-medium"
      >
        Verified
      </motion.span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Cell                                                                 */
/* ------------------------------------------------------------------ */

function Cell({
  index,
  length,
  digit,
  stamp,
  delay,
  active,
  caret,
  filled,
  phase,
  nudge,
  merge,
  runAnimation,
  reduce,
  layoutId,
  refCb,
}: {
  index: number;
  length: number;
  digit: string;
  stamp: number;
  delay: number | null;
  active: boolean;
  caret: boolean;
  filled: boolean;
  phase: Phase;
  nudge: number;
  merge: Merge | null;
  runAnimation: (run: () => AnimationPlaybackControls) => void;
  reduce: boolean;
  layoutId: string;
  refCb: (el: HTMLDivElement | null) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const error = phase === "error";
  const good = phase === "sweep" || phase === "merge" || phase === "done";
  const fused = phase === "merge" || phase === "done";
  const merging = fused && !!merge && !reduce;
  const first = index === 0;
  const last = index === length - 1;

  // Typed a letter: a 3px “nope” on the active cell only.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    const el = ref.current;
    if (!nudge || reduce || !el || !activeRef.current) return;
    runAnimation(() => animate(el, { x: [0, -3, 3, 0] }, { duration: 0.22, ease: "easeOut" }));
  }, [nudge, reduce, runAnimation]);

  // Paste ripple: each cell lifts as its digit lands.
  useEffect(() => {
    const el = ref.current;
    if (!stamp || reduce || !el || !digit || delay === null) return;
    runAnimation(() => animate(el, { y: [0, -4, 0] }, { duration: 0.36, delay, ease: EASE_OUT }));
  }, [stamp, delay, digit, reduce, runAnimation]);

  const ring = error
    ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--otp-error)_70%,transparent)] bg-[color-mix(in_srgb,var(--otp-error)_6%,transparent)]"
    : good
      ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--otp-ok)_50%,transparent)] bg-[color-mix(in_srgb,var(--otp-ok)_7%,transparent)]"
      : filled
        ? "shadow-[inset_0_0_0_1px_var(--otp-line-strong)] bg-[var(--otp-cell-filled)]"
        : "shadow-[inset_0_0_0_1px_var(--otp-line)] bg-[var(--otp-cell)]";
  const corner = (outer: boolean) => (merging && !outer ? 0 : CELL_RADIUS);

  return (
    <motion.div
      ref={(el) => {
        ref.current = el;
        refCb(el);
      }}
      aria-hidden="true"
      className={`relative flex h-[var(--otp-h)] w-full items-center justify-center overflow-hidden transition-[background-color,box-shadow,opacity] duration-200 ${ring} ${
        phase === "verifying" ? "opacity-60" : phase === "locked" ? "opacity-40" : ""
      }`}
      initial={false}
      animate={{
        x: merging ? merge.dx[index] : 0,
        borderTopLeftRadius: corner(first),
        borderBottomLeftRadius: corner(first),
        borderTopRightRadius: corner(last),
        borderBottomRightRadius: corner(last),
        opacity: phase === "done" ? 0 : 1,
      }}
      transition={{ duration: MOTION.close, ease: EASE_IN_OUT, opacity: { duration: phase === "done" ? 0.12 : 0.2 } }}
      style={{ borderRadius: CELL_RADIUS }}
    >
      {/* Active-cell ring glides between cells */}
      {active && (
        <motion.span
          layoutId={layoutId}
          transition={reduce ? { duration: 0 } : SPRING_UI}
          className="pointer-events-none absolute inset-0 rounded-[12px] shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--otp-accent)_80%,transparent)]"
        />
      )}

      {/* Success sweep: one band of light crossing each cell in turn */}
      {phase === "sweep" && !reduce && (
        <motion.span
          className="pointer-events-none absolute inset-y-0 w-[80%]"
          style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--otp-ok) 38%, transparent), transparent)" }}
          initial={{ x: "-130%" }}
          animate={{ x: "160%" }}
          transition={{ duration: MOTION.sweep, delay: SUCCESS_MS.sweepStart / 1000 + index * MOTION.sweepStep, ease: "linear" }}
        />
      )}

      <span className="relative flex h-full w-full items-center justify-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          {digit && (
            <motion.span
              key={`${stamp}-${digit}`}
              // Each digit settles: up from below, a touch small, out of a blur.
              initial={reduce ? { opacity: 0 } : { y: "60%", scale: 0.86, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: "0%", scale: 1, opacity: fused ? 0 : 1, filter: fused ? "blur(3px)" : "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { y: "-70%", opacity: 0, filter: "blur(3px)", transition: { duration: 0.2, delay: error ? index * 0.03 : 0, ease: EASE_IN } }
              }
              transition={{ duration: MOTION.digit, delay: delay ?? 0, ease: EASE_OUT }}
              className={`font-mono text-[clamp(1.25rem,1.05rem+1cqi,1.5rem)] font-medium tabular-nums transition-colors duration-200 ${
                error ? "text-[var(--otp-error-ink)]" : good ? "text-[var(--otp-ok-ink)]" : "text-[var(--otp-ink)]"
              }`}
            >
              {digit}
            </motion.span>
          )}
        </AnimatePresence>
        {caret && (
          <span
            className="absolute left-1/2 top-1/2 h-[22px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--otp-accent)] motion-safe:animate-[auth-otp-blink_1.06s_steps(1,end)_infinite]"
            style={{ animation: reduce ? "none" : undefined }}
          />
        )}
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Destination, status and resend                                       */
/* ------------------------------------------------------------------ */

function DestinationLine({
  id,
  channel,
  lead,
  destination,
  editing,
  canEdit,
  onEdit,
  onCancel,
  onSave,
  reduce,
}: {
  id: string;
  channel: "email" | "sms";
  lead: string;
  destination: string;
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (v: string) => Promise<void>;
  reduce: boolean;
}) {
  return (
    <motion.div id={id} layout={!reduce} transition={{ layout: { duration: 0.32, ease: EASE_OUT } }} className="mt-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {editing ? (
          <DestinationEditor key="edit" channel={channel} initial={destination} onCancel={onCancel} onSave={onSave} reduce={reduce} />
        ) : (
          <motion.p key="show" {...swapProps(reduce, 4)} transition={{ duration: MOTION.swap, ease: EASE_OUT }} className="text-pretty text-[14.5px] leading-[1.55] text-[var(--otp-muted)]">
            {lead}{" "}
            <span className="inline-flex max-w-full items-baseline gap-1 align-baseline">
              <span className="min-w-0 break-all font-medium text-[var(--otp-ink)]">{destination}</span>
              {canEdit && (
                <button
                  type="button"
                  data-demo="edit"
                  onClick={onEdit}
                  aria-label={`Edit ${channel === "email" ? "email address" : "phone number"}`}
                  className={`group/edit relative -my-2 inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-[13.5px] text-[var(--otp-muted)] transition-[color,transform] duration-150 hover:text-[var(--otp-ink)] active:scale-[0.97] ${focusRing}`}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-150 group-hover/edit:-rotate-12">
                    <path d="M10.6 2.9 L13.1 5.4 L5.6 12.9 L2.6 13.4 L3.1 10.4 Z" />
                  </svg>
                  Edit
                </button>
              )}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusLine({ id, msg, spinning, reduce }: { id: string; msg: Msg; spinning: boolean; reduce: boolean }) {
  const tone = msg?.tone ?? "hint";
  const color = { error: "text-[var(--otp-error-ink)]", ok: "text-[var(--otp-ok)]", muted: "text-[var(--otp-muted)]", hint: "text-[var(--otp-faint)]" }[tone];
  return (
    <div id={id} role={msg?.tone === "error" ? "alert" : "status"} aria-atomic="true" className="mt-4 min-h-[42px]">
      <span className="sr-only">{msg?.text ?? "Paste the whole code into any box."}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={msg?.text ?? "hint"}
          aria-hidden="true"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)", transition: { duration: 0.14 } }}
          transition={{ duration: MOTION.swap + 0.02, ease: EASE_OUT }}
          className={`flex items-start gap-2 text-[13.5px] leading-[1.5] ${color}`}
        >
          {spinning && (
            <span className="mt-[3px] flex shrink-0">
              <Spinner />
            </span>
          )}
          <span className="min-w-0">{msg?.text ?? "Paste the whole code into any box."}</span>
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function ResendButton({
  left,
  state,
  disabled,
  emphasise,
  onClick,
  reduce,
}: {
  left: number;
  state: ResendState;
  disabled: boolean;
  /** After a lockout, Resend is the only way forward, so it becomes a solid accent button. */
  emphasise: boolean;
  onClick: () => void;
  reduce: boolean;
}) {
  const ready = left <= 0 && state === "idle";
  const key = state !== "idle" ? state : ready ? "ready" : "wait";
  return (
    <button
      type="button"
      data-demo="resend"
      onClick={onClick}
      disabled={!ready || disabled}
      aria-live="polite"
      className={`group/resend relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-[10px] px-3 text-[13.5px] font-medium transition-[background-color,color,transform] duration-150 enabled:hover:bg-[var(--otp-hover)] enabled:active:scale-[0.97] disabled:cursor-not-allowed ${focusRing} ${
        ready && emphasise ? "!bg-[var(--otp-accent)] text-[var(--otp-on-accent)]" : `-mr-2 ${ready ? "text-[var(--otp-ink)]" : "text-[var(--otp-muted)]"}`
      } ${disabled && ready ? "opacity-40" : ""}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={key} {...swapProps(reduce)} transition={{ duration: MOTION.swap, ease: EASE_OUT }} className="flex items-center gap-2 whitespace-nowrap">
          {key === "wait" && (
            <>
              Resend in <RollingText value={fmtClock(left)} reduce={reduce} />
            </>
          )}
          {key === "ready" && (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-200 group-hover/resend:-rotate-45">
                <path d="M13.2 8 A5.2 5.2 0 1 1 11.6 4.2" />
                <path d="M11.9 1.6 V4.6 H8.9" />
              </svg>
              Resend code
            </>
          )}
          {key === "sending" && (
            <>
              <Spinner /> Sending…
            </>
          )}
          {key === "sent" && (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[var(--otp-ok)]">
                <motion.path
                  d="M3.5 8.4 L6.6 11.3 L12.5 4.8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                />
              </svg>
              Sent
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function DestinationEditor({
  channel,
  initial,
  onCancel,
  onSave,
  reduce,
}: {
  channel: "email" | "sms";
  initial: string;
  onCancel: () => void;
  onSave: (v: string) => Promise<void>;
  reduce: boolean;
}) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const runAnimation = useImperative();

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const s = v.trim();
    if (channel === "email" ? !isEmail(s) : !isPhone(s)) {
      setErr(channel === "email" ? "That doesn’t look like an email address." : "That doesn’t look like a phone number.");
      const shell = shellRef.current;
      if (!reduce && shell) runAnimation(() => animate(shell, { x: [0, -6, 5, -3, 0] }, { duration: 0.36 }));
      ref.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave(s);
    } catch {
      setSaving(false);
      setErr("Couldn’t send to that address. Try again in a moment.");
    }
  };

  return (
    <motion.form onSubmit={save} noValidate onKeyDown={(e) => e.key === "Escape" && onCancel()} {...swapProps(reduce, 4)} transition={{ duration: MOTION.swap, ease: EASE_OUT }}>
      <label htmlFor={id} className="block text-[14.5px] leading-[1.55] text-[var(--otp-muted)]">
        Where should we send the code?
      </label>
      <div className="mt-3 flex gap-2">
        <div
          ref={shellRef}
          className={`flex min-w-0 flex-1 rounded-[11px] transition-shadow duration-150 ${
            err
              ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--otp-error)_60%,transparent)]"
              : "shadow-[inset_0_0_0_1px_var(--otp-line-strong)] focus-within:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--otp-ink)_60%,transparent),0_0_0_4px_var(--otp-hover)]"
          }`}
        >
          <input
            ref={ref}
            id={id}
            type={channel === "email" ? "email" : "tel"}
            inputMode={channel === "email" ? "email" : "tel"}
            autoComplete={channel === "email" ? "email" : "tel"}
            autoCapitalize="none"
            spellCheck={false}
            value={v}
            readOnly={saving}
            aria-invalid={!!err || undefined}
            aria-describedby={err ? `${id}-err` : undefined}
            onChange={(e) => {
              setV(e.target.value);
              setErr(null);
            }}
            className="h-11 w-full min-w-0 rounded-[11px] bg-[var(--otp-cell-filled)] px-3.5 text-[16px] text-[var(--otp-ink)] outline-none selection:bg-[color-mix(in_srgb,var(--otp-ink)_22%,transparent)] @sm:text-[15px]"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className={`group/send relative flex h-11 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[var(--otp-accent)] text-[14px] font-medium text-[var(--otp-on-accent)] transition-transform duration-150 active:scale-[0.97] disabled:cursor-wait ${focusRing}`}
        >
          <span aria-hidden="true" className="absolute inset-0 bg-current opacity-0 transition-opacity duration-150 group-hover/send:opacity-[0.07]" />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={saving ? "saving" : "label"} {...swapProps(reduce)} transition={{ duration: 0.18, ease: EASE_OUT }} className="relative flex">
              {saving ? <Spinner /> : "Send"}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <div className="mt-2 flex min-h-8 items-center justify-between gap-3">
        <p id={`${id}-err`} role="alert" className="min-w-0 text-[13px] leading-[1.45] text-[var(--otp-error-ink)]">
          {err}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className={`-mr-1.5 inline-flex h-8 shrink-0 items-center rounded-md px-1.5 text-[13px] text-[var(--otp-muted)] transition-[color,transform] duration-150 hover:text-[var(--otp-ink)] active:scale-[0.97] ${focusRing}`}
        >
          Cancel
        </button>
      </div>
    </motion.form>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                          */
/* ------------------------------------------------------------------ */

/** Each changed character rolls down into place; unchanged characters stay put. */
function RollingText({ value, reduce }: { value: string; reduce: boolean }) {
  return (
    <span className="inline-flex tabular-nums" aria-label={value}>
      {value.split("").map((ch, i) => (
        <span key={i} aria-hidden="true" className="relative inline-flex h-[1.5em] overflow-hidden leading-[1.5em]" style={{ width: /\d/.test(ch) ? "1ch" : undefined }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              initial={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0, filter: "blur(1.5px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { y: "70%", opacity: 0, filter: "blur(1.5px)" }}
              transition={{ duration: MOTION.roll, ease: EASE_OUT }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ animation: "auth-otp-spin 0.7s linear infinite" }}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.75" />
      <path d="M8 1.75 A6.25 6.25 0 0 1 14.25 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ChannelGlyph({ channel }: { channel: "email" | "sms" }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-[11px] bg-[var(--otp-tile)] text-[var(--otp-ink)] shadow-[inset_0_0_0_1px_var(--otp-line),inset_0_1px_0_var(--otp-hover)]" aria-hidden="true">
      {channel === "email" ? (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <rect x="2.75" y="4.75" width="14.5" height="10.5" rx="2.25" />
          <path d="M3.5 6 L10 10.75 L16.5 6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="5.25" y="2.25" width="9.5" height="15.5" rx="2.25" />
          <path d="M8.75 14.75 H11.25" />
        </svg>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

const DEMO_DIGITS = "3141592653589793";
const DEMO_LATENCY_MS = 550;
const DEMO_MAX_MISSES = 3;
const DEMO_COPIED_MS = 1800;
/** After “Verified”, the demo deals a fresh card so a replay always has a live field. */
const DEMO_RESET_MS = 2000;

export default function AuthOtpDemo(overrides: Partial<AuthOtpProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const misses = useRef(0);
  const [run, setRun] = useState(0);
  const runRef = useRef(0);
  const [verified, setVerified] = useState(false);
  const [copied, setCopied] = useState(false);
  const { later, wait } = useScheduler();

  const light = overrides.theme === "light";
  const digits = Math.max(2, Math.min(overrides.length ?? 6, DEMO_DIGITS.length));
  const code = DEMO_DIGITS.slice(0, digits);
  const expiredCode = "0".repeat(digits);

  const onVerify = async (entered: string): Promise<OtpVerifyResult> => {
    await wait(DEMO_LATENCY_MS);
    if (entered === code) {
      misses.current = 0;
      return { ok: true };
    }
    if (entered === expiredCode) return { ok: false, reason: "expired" };
    misses.current += 1;
    if (misses.current >= DEMO_MAX_MISSES) {
      misses.current = 0;
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid", attemptsLeft: DEMO_MAX_MISSES - misses.current };
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      later(() => setCopied(false), DEMO_COPIED_MS);
    } catch {
      setCopied(false);
    }
  };

  const reset = () => {
    misses.current = 0;
    setVerified(false);
    runRef.current += 1;
    setRun(runRef.current);
  };

  const chip = light
    ? "inline-flex h-9 items-center rounded-full px-3.5 uppercase text-[#3f3f46] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.22)] transition-[background-color,transform] duration-150 hover:bg-black/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181b] active:scale-[0.97]"
    : "inline-flex h-9 items-center rounded-full px-3.5 uppercase text-[#cfcfd4] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition-[background-color,transform] duration-150 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ededef] active:scale-[0.97]";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:py-16" style={{ background: light ? "#e9e9ec" : STAGE }}>
      <AuthOtp
        key={run}
        onVerify={onVerify}
        onVerified={() => {
          setVerified(true);
          const mine = runRef.current;
          // Skip if “Reset demo” already dealt a newer card.
          later(() => {
            if (runRef.current === mine) reset();
          }, DEMO_RESET_MS);
        }}
        onResend={() => wait(900)}
        onChangeDestination={() => wait(900)}
        {...overrides}
        accent={overrides.accent && overrides.accent.toLowerCase() !== "#ededef" ? overrides.accent : undefined}
      />
      <motion.div {...enter(true, 0.75, reduce)} className={`mt-6 flex min-h-11 max-w-[400px] items-center justify-center gap-3 text-center font-mono text-[11px] uppercase tracking-[0.12em] ${light ? "text-[#52525b]" : "text-[#7d7d86]"}`}>
        {verified ? (
          <button type="button" onClick={reset} className={chip}>
            Reset demo
          </button>
        ) : (
          <>
            <span>
              Demo code <span className={`tracking-[0.2em] ${light ? "text-[#18181b]" : "text-[#cfcfd4]"}`}>{code}</span>
            </span>
            <button type="button" onClick={() => void copy()} className={chip}>
              {copied ? "Copied · now paste" : "Copy"}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
