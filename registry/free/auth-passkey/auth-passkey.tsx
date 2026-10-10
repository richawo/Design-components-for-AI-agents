"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type PasskeyStatus = "idle" | "awaiting" | "success" | "cancelled" | "timeout" | "unsupported" | "error";

export type PasskeyResult = {
  /** Shown in the success line, e.g. "Ada Lovelace". */
  name?: string;
};

export type AuthPasskeyProps = {
  /** Product name shown beside the mark. */
  brand?: string;
  title?: string;
  description?: string;
  /** Where the passkey lives, shown quietly under the glyph while idle. */
  credentialHint?: string;
  buttonLabel?: string;
  fallbackLabel?: string;
  /**
   * Runs the WebAuthn ceremony. Resolve to sign in; reject with a DOMException named
   * "NotAllowedError" or "AbortError" for a cancel, anything else for an error.
   * Listen to `signal` so Cancel and the timeout can abort it.
   */
  onAuthenticate?: (signal: AbortSignal) => Promise<PasskeyResult | void>;
  /** Called after the success animation settles. */
  onSuccess?: (result: PasskeyResult) => void;
  /** "Use email instead". */
  onFallback?: () => void;
  /** Force support on or off. Leave undefined to feature-detect `PublicKeyCredential`. */
  supported?: boolean;
  /** Give up waiting for the device after this long. */
  timeoutMs?: number;
  /** The one accent: the primary button. Defaults to the theme’s ink. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#0b0b0c",
    line: "rgba(255,255,255,0.08)",
    hover: "rgba(255,255,255,0.07)",
    ink: "#f4f4f5",
    brand: "rgba(244,244,245,0.72)",
    muted: "#8b8b93",
    faint: "#7a7a83",
    wellLight: "rgba(255,255,255,0.05)",
    ridge: "rgba(255,255,255,0.26)",
    ridgeSettled: "rgba(255,255,255,0.2)",
    ridgeQuiet: "rgba(255,255,255,0.12)",
    scan: "#f4f4f5",
    success: "#8ff0c4",
    successInk: "#c9f8e1",
    onSuccess: "#05140d",
    error: "#ff8a8a",
    errorInk: "#ffb4b4",
    errorWash: "#2a1214",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 80px -32px rgba(0,0,0,0.9)",
    wellShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -24px 40px -24px rgba(0,0,0,0.8)",
  },
  light: {
    surface: "#ffffff",
    line: "rgba(24,24,27,0.09)",
    hover: "rgba(24,24,27,0.06)",
    ink: "#18181b",
    brand: "rgba(24,24,27,0.72)",
    muted: "#5f5f68",
    faint: "#71717a",
    wellLight: "rgba(24,24,27,0.03)",
    ridge: "rgba(24,24,27,0.28)",
    ridgeSettled: "rgba(24,24,27,0.2)",
    ridgeQuiet: "rgba(24,24,27,0.12)",
    scan: "#18181b",
    success: "#16a34a",
    successInk: "#15803d",
    onSuccess: "#ffffff",
    error: "#dc2626",
    errorInk: "#b91c1c",
    errorWash: "#fef2f2",
    shadow: "0 0 0 1px rgba(24,24,27,0.04), 0 1px 2px rgba(24,24,27,0.04), 0 40px 80px -36px rgba(24,24,27,0.3)",
    wellShadow: "inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -24px 40px -24px rgba(24,24,27,0.12)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = "#000000";
const STAGE_LIGHT = "#f1f1f3";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
const SPRING_BADGE = { type: "spring", stiffness: 500, damping: 28 } as const;

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
  ridge: 0.7, // each ridge stroking in
  ridgeSpread: 0.4, // core → outermost ridge start offset
  scan: 2.6, // one scan pass, down and back (the component’s one ambient loop)
  fill: 0.85, // success light spreading from the core
  ring: 0.7, // success ring drawing round the well
  badge: 0.55, // badge after the fill starts
  swap: 0.22,
  fade: 0.15,
} as const;

/** How long success holds before `onSuccess` fires. ms. */
const SUCCESS_HOLD_MS = 1400;
const SUCCESS_HOLD_REDUCED_MS = 200;

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--pk-ink)]";

/* ------------------------------------------------------------------ */
/* Fingerprint geometry                                                 */
/* ------------------------------------------------------------------ */

const VB = 120;
const CX = 60;
const CY = 58;
const CLIP_R = 52;
const RIDGE_COUNT = 11;

// Small deterministic noise so the ridges look drawn, not generated.
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Ridge = { d: string; dist: number };

function ridgePoint(r: number, tDeg: number, cy: number) {
  const t = (tDeg * Math.PI) / 180;
  const a = Math.abs(tDeg);
  if (a <= 90) return [CX + r * Math.sin(t), cy - r * 1.18 * Math.cos(t)] as const;
  // Below the equator the loop becomes two legs that run down, drifting a little
  // to the left the way a loop pattern flows off one side of the finger.
  const u = (a - 90) / 90;
  const s = Math.sign(tDeg);
  return [CX + s * r * (1 - 0.06 * u) - u * u * 7, cy + u * 50] as const;
}

function buildRidges(): Ridge[] {
  const ridges: Ridge[] = [];
  for (let i = 0; i < RIDGE_COUNT; i++) {
    const r = 3.4 + i * 4.75;
    const cy = CY - 4 + i * 0.5;
    // The core loop is short; outer ridges run off the bottom of the pad.
    const reachL = i === 0 ? 118 : i === 1 ? 150 : 180 - rand(i + 21) * 22;
    const reachR = i === 0 ? 118 : i === 1 ? 156 : 180 - rand(i + 31) * 22;
    // Each ridge breaks once or twice, at a seeded angle, like a real print.
    const breaks: [number, number][] = [];
    if (i >= 2) {
      const at = -75 + rand(i) * 150;
      breaks.push([at, at + 9 + rand(i + 9) * 9]);
    }
    if (i >= 4 && rand(i + 3) > 0.3) {
      const side = rand(i + 5) > 0.5 ? 1 : -1;
      const at = side * (110 + rand(i + 7) * 45);
      breaks.push(side > 0 ? [at, at + 11] : [at - 11, at]);
    }
    let segs: [number, number][] = [[-reachL, reachR]];
    for (const [b0, b1] of breaks) {
      segs = segs.flatMap(([s0, s1]) => (b1 <= s0 || b0 >= s1 ? [[s0, s1]] : ([[s0, b0], [b1, s1]] as [number, number][]).filter(([a, b]) => b - a > 6)));
    }
    for (const [s0, s1] of segs) {
      const pts: string[] = [];
      for (let t = s0; t <= s1 + 0.001; t += 3) {
        const [x, y] = ridgePoint(r, Math.min(t, s1), cy);
        pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      const [mx, my] = ridgePoint(r, (s0 + s1) / 2, cy);
      ridges.push({ d: `M${pts.join(" L")}`, dist: Math.hypot(mx - CX, my - CY) });
    }
  }
  return ridges;
}

const RIDGES = buildRidges();
const MAX_DIST = Math.max(...RIDGES.map((r) => r.dist));

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function detectSupport() {
  if (typeof window === "undefined") return true;
  return typeof window.PublicKeyCredential === "function";
}

function isCancel(err: unknown) {
  const name = (err as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "AbortError";
}

/** Black or white, whichever reads on the accent. */
function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

/** Palette → `--pk-*` variables (camelCase keys become kebab-case). */
function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--pk-accent": accent, "--pk-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--pk-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = v;
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

function copyFor(status: PasskeyStatus, name: string | undefined, errorText: string, credentialHint: string) {
  switch (status) {
    case "awaiting":
      return { line: "Waiting for your device…", sub: "Follow the prompt from your browser or phone." };
    case "success":
      return { line: name ? `Signed in as ${name}` : "You’re signed in", sub: "Opening your workspace…" };
    case "cancelled":
      return { line: "No problem, nothing was shared", sub: "Try again whenever you’re ready, or sign in with email." };
    case "timeout":
      return { line: "The prompt timed out", sub: "Your device didn’t answer in time. Nothing was shared." };
    case "unsupported":
      return { line: "Passkeys aren’t available here", sub: "This browser can’t use passkeys yet. Email works just as well." };
    case "error":
      return { line: "That didn’t go through", sub: errorText };
    default:
      return { line: "Ready when you are", sub: credentialHint };
  }
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** setTimeout that can’t outlive the component: everything pending is cleared on unmount. */
function useTimeouts() {
  const pending = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const set = pending.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);
  return useMemo(
    () => ({
      later(fn: () => void, ms: number) {
        const id = setTimeout(() => {
          pending.current.delete(id);
          fn();
        }, ms);
        pending.current.add(id);
        return () => {
          clearTimeout(id);
          pending.current.delete(id);
        };
      },
    }),
    [],
  );
}

/**
 * The WebAuthn round-trip as a small state machine: one AbortController per attempt,
 * a timeout that aborts it, and Cancel. Unmounting aborts whatever is in flight.
 */
function usePasskeyCeremony({
  canUse,
  timeoutMs,
  onAuthenticate,
  onSuccess,
  reduce,
}: {
  canUse: boolean;
  timeoutMs: number;
  onAuthenticate: (signal: AbortSignal) => Promise<PasskeyResult | void>;
  onSuccess?: (result: PasskeyResult) => void;
  reduce: boolean;
}) {
  const [status, setStatus] = useState<PasskeyStatus>("idle");
  const [result, setResult] = useState<PasskeyResult>({});
  const [errorText, setErrorText] = useState("");
  const ctrl = useRef<AbortController | null>(null);
  const { later } = useTimeouts();

  useEffect(() => () => ctrl.current?.abort(), []);

  const start = useCallback(async () => {
    if (!canUse || status === "awaiting" || status === "success") return;
    const ac = new AbortController();
    ctrl.current = ac;
    setStatus("awaiting");
    let timedOut = false;
    const clearTimer = later(() => {
      timedOut = true;
      ac.abort();
    }, timeoutMs);
    try {
      const res = (await onAuthenticate(ac.signal)) ?? {};
      if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");
      setResult(res);
      setStatus("success");
      later(() => onSuccess?.(res), reduce ? SUCCESS_HOLD_REDUCED_MS : SUCCESS_HOLD_MS);
    } catch (err) {
      if (ctrl.current !== ac) return;
      if (timedOut) setStatus("timeout");
      else if (isCancel(err)) setStatus("cancelled");
      else {
        setErrorText(err instanceof Error && err.message ? err.message : "Your device answered, but we couldn’t verify it.");
        setStatus("error");
      }
    } finally {
      clearTimer();
    }
  }, [canUse, status, timeoutMs, onAuthenticate, onSuccess, reduce, later]);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    setStatus("cancelled");
  }, []);

  return { status, result, errorText, start, cancel };
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function AuthPasskey({
  brand = "Fathom",
  title = "Welcome back",
  description = "Sign in with the passkey saved on this device. Nothing to type, nothing to remember.",
  credentialHint = "iCloud Keychain · last used Tuesday",
  buttonLabel = "Sign in with passkey",
  fallbackLabel = "Use email instead",
  onAuthenticate,
  onSuccess,
  onFallback,
  supported,
  timeoutMs = 60000,
  accent,
  theme = "dark",
  className = "",
}: AuthPasskeyProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLDivElement>(null);
  const play = useInView(root, { once: true, amount: 0.3 });
  const palette = PALETTE[theme];
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [detected, setDetected] = useState(true);
  useEffect(() => setDetected(detectSupport()), []);
  const canUse = supported ?? detected;

  const ceremony = usePasskeyCeremony({ canUse, timeoutMs, onAuthenticate: onAuthenticate ?? simulate, onSuccess, reduce });
  const shown: PasskeyStatus = canUse ? ceremony.status : "unsupported";
  const copy = copyFor(shown, ceremony.result.name, ceremony.errorText, credentialHint);

  const busy = shown === "awaiting";
  const done = shown === "success";
  const retry = shown === "cancelled" || shown === "timeout" || shown === "error";
  const unsupported = shown === "unsupported";
  const at = (n: number) => MOTION.first + n * MOTION.stagger;

  return (
    <div
      ref={root}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full max-w-[400px] font-sans text-[var(--pk-ink)] antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      <motion.section
        aria-labelledby={`${uid}-title`}
        {...enter(play, 0, reduce, MOTION.cardRise, MOTION.cardBlur, MOTION.card)}
        className="relative overflow-hidden rounded-[28px] border border-[var(--pk-line)] bg-[var(--pk-surface)] px-6 pb-6 pt-8 shadow-[var(--pk-shadow)] @[360px]:px-9 @[360px]:pb-7 @[360px]:pt-10"
      >
        <motion.div {...enter(play, at(0), reduce)} className="flex items-center justify-center gap-2">
          <BrandMark />
          <span className="text-[13px] font-medium tracking-[-0.01em] text-[var(--pk-brand)]">{brand}</span>
        </motion.div>

        <motion.h2
          id={`${uid}-title`}
          {...enter(play, at(1), reduce)}
          className="mt-5 text-center font-display text-[clamp(1.6rem,1.3rem+1.2cqi,1.875rem)] font-semibold leading-[1.05] tracking-[-0.035em]"
        >
          {title}
        </motion.h2>
        <motion.p {...enter(play, at(2), reduce)} className="mx-auto mt-2.5 max-w-[32ch] text-balance text-center text-[14.5px] leading-[1.55] text-[var(--pk-muted)]">
          {description}
        </motion.p>

        <motion.div {...enter(play, at(3), reduce)} className="mt-8 flex justify-center">
          <FingerprintGlyph uid={uid} status={shown} play={play} drawFrom={at(3)} reduce={reduce} />
        </motion.div>

        <motion.div {...enter(play, at(4), reduce)} className="mt-6 min-h-[64px] text-center" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={shown + copy.sub}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.14, ease: EASE_IN } }}
              transition={{ duration: MOTION.swap + 0.02, ease: EASE_OUT }}
            >
              <p className={`text-[14.5px] font-medium tracking-[-0.01em] ${shown === "error" ? "text-[var(--pk-error-ink)]" : done ? "text-[var(--pk-success-ink)]" : "text-[var(--pk-ink)]"}`}>
                {copy.line}
              </p>
              <p
                className={`mx-auto mt-1 max-w-[40ch] text-balance leading-[1.5] ${
                  shown === "idle" ? "font-mono text-[11.5px] tracking-[0.01em] text-[var(--pk-faint)]" : "text-[13px] text-[var(--pk-muted)]"
                }`}
              >
                {copy.sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div {...enter(play, at(5), reduce)} className="mt-6">
          <PrimaryButton
            buttonRef={buttonRef}
            state={done ? "done" : busy ? "busy" : retry ? "retry" : unsupported ? "email" : "idle"}
            label={buttonLabel}
            onClick={unsupported ? onFallback : () => void ceremony.start()}
            reduce={reduce}
          />
        </motion.div>

        <motion.div {...enter(play, at(6), reduce)} className="mt-3 flex h-11 items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.button
                key="cancel"
                type="button"
                data-demo="passkey-cancel"
                onClick={() => {
                  ceremony.cancel();
                  buttonRef.current?.focus();
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18 }}
                className={linkCls}
              >
                Cancel
              </motion.button>
            ) : !unsupported && !done ? (
              <motion.button
                key="fallback"
                type="button"
                data-demo="passkey-fallback"
                onClick={onFallback}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18 }}
                className={`${linkCls} ${retry ? "text-[var(--pk-ink)]" : ""}`}
              >
                {fallbackLabel}
                <span aria-hidden="true" className="ml-1.5 inline-block transition-transform duration-150 group-hover:translate-x-0.5">
                  →
                </span>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </motion.section>
    </div>
  );
}

const linkCls = `group inline-flex h-11 items-center rounded-lg px-3 text-[13.5px] text-[var(--pk-muted)] transition-colors duration-150 hover:text-[var(--pk-ink)] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--pk-ink)]`;

/* ------------------------------------------------------------------ */
/* Primary button: same box through every state                         */
/* ------------------------------------------------------------------ */

type ButtonState = "idle" | "busy" | "done" | "retry" | "email";

function PrimaryButton({
  buttonRef,
  state,
  label,
  onClick,
  reduce,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  state: ButtonState;
  label: string;
  onClick?: () => void;
  reduce: boolean;
}) {
  const busy = state === "busy";
  const done = state === "done";
  const text = { idle: label, busy: "Waiting for device", done: "Signed in", retry: "Try again", email: "Continue with email" }[state];
  return (
    <motion.button
      ref={buttonRef}
      type="button"
      data-demo="passkey-button"
      onClick={busy || done ? undefined : onClick}
      aria-busy={busy}
      aria-disabled={busy || done}
      whileTap={busy || done || reduce ? undefined : { scale: 0.975 }}
      className={`group/btn relative flex h-12 w-full items-center justify-center overflow-hidden rounded-[14px] text-[14.5px] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow] duration-200 ${focusRing} ${
        busy
          ? "cursor-progress bg-[var(--pk-hover)] text-[var(--pk-brand)] shadow-[inset_0_0_0_1px_var(--pk-line)]"
          : `bg-[var(--pk-accent)] text-[var(--pk-on-accent)] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.3)] ${done ? "cursor-default" : ""}`
      }`}
    >
      {/* Hover: a wash of the label colour, so it darkens a light accent and lightens a dark one. */}
      {!busy && !done && <span aria-hidden="true" className="absolute inset-0 bg-current opacity-0 transition-opacity duration-150 group-hover/btn:opacity-[0.07]" />}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.12, ease: EASE_IN } }}
          transition={{ duration: MOTION.swap, ease: EASE_OUT }}
          className="relative flex items-center gap-2"
        >
          {busy && <Spinner reduce={reduce} />}
          {done && <CheckIcon reduce={reduce} />}
          {text}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* The glyph                                                            */
/* ------------------------------------------------------------------ */

function FingerprintGlyph({ uid, status, play, drawFrom, reduce }: { uid: string; status: PasskeyStatus; play: boolean; drawFrom: number; reduce: boolean }) {
  const scanning = status === "awaiting";
  const success = status === "success";
  const failed = status === "error";
  const settled = status === "cancelled" || status === "timeout";
  const ridgeColor = failed
    ? "color-mix(in srgb, var(--pk-error) 45%, transparent)"
    : status === "unsupported"
      ? "var(--pk-ridge-quiet)"
      : settled
        ? "var(--pk-ridge-settled)"
        : "var(--pk-ridge)";
  const scanLoop = { duration: MOTION.scan, ease: EASE_IN_OUT, repeat: Infinity };

  return (
    <div className="relative grid size-[148px] place-items-center @[360px]:size-[164px]">
      {/* Well */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-[var(--pk-line)] shadow-[var(--pk-well-shadow)]"
        style={{ background: "radial-gradient(circle at 50% 38%, var(--pk-well-light), transparent 62%)" }}
      />
      {/* Success: a ring draws round the well, in step with the light filling the print */}
      <svg aria-hidden="true" viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[5px] -rotate-90">
        <motion.circle
          cx="50"
          cy="50"
          r="49"
          fill="none"
          strokeWidth="0.9"
          strokeLinecap="round"
          style={{ stroke: "var(--pk-success)" }}
          initial={false}
          animate={success ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={success ? { duration: reduce ? 0 : MOTION.ring, ease: EASE_OUT, opacity: { duration: 0.1 } } : { duration: 0.2 }}
        />
      </svg>
      <motion.svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="relative size-[118px] @[360px]:size-[130px]"
        role="img"
        aria-label={success ? "Passkey verified" : scanning ? "Waiting for passkey" : "Passkey"}
        animate={reduce ? undefined : settled ? { scale: [1, 0.97, 1] } : { scale: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <defs>
          <radialGradient id={`${uid}-edge`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.72" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`${uid}-pad`} maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}>
            <circle cx={CX} cy={CX} r={CLIP_R} fill={`url(#${uid}-edge)`} />
          </mask>
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}-fill`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.82" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`${uid}-scanmask`} maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}>
            <motion.rect
              x="0"
              width={VB}
              height="34"
              fill={`url(#${uid}-band)`}
              initial={false}
              animate={scanning ? (reduce ? { y: 41, opacity: 0.8 } : { y: [4, 98, 4], opacity: 1 }) : { opacity: 0 }}
              transition={scanning && !reduce ? { y: scanLoop, opacity: { duration: 0.25 } } : { duration: 0.2 }}
            />
          </mask>
          <mask id={`${uid}-fillmask`} maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}>
            <motion.circle
              cx={CX}
              cy={CY}
              fill={`url(#${uid}-fill)`}
              initial={false}
              animate={{ r: success ? 90 : 0 }}
              transition={success ? { duration: reduce ? 0 : MOTION.fill, ease: [0.33, 1, 0.68, 1] } : { duration: 0 }}
            />
          </mask>
        </defs>

        <g mask={`url(#${uid}-pad)`} fill="none" strokeLinecap="round" strokeWidth={2}>
          {/* Base ridges: stroke in from the core outward once the glyph block lands */}
          <g>
            {RIDGES.map((r, k) => {
              const delay = drawFrom + 0.05 + (r.dist / MAX_DIST) * MOTION.ridgeSpread;
              return (
                <motion.path
                  key={k}
                  d={r.d}
                  className="transition-[stroke] duration-300"
                  style={{ stroke: ridgeColor }}
                  initial={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
                  animate={play ? { pathLength: 1, opacity: 1 } : undefined}
                  transition={{
                    pathLength: { duration: MOTION.ridge, ease: EASE_OUT, delay },
                    opacity: { duration: 0.2, delay: reduce ? 0 : delay },
                  }}
                />
              );
            })}
          </g>
          {/* Lit by the scan band */}
          <g mask={`url(#${uid}-scanmask)`} style={{ stroke: "var(--pk-scan)" }}>
            {RIDGES.map((r, k) => (
              <path key={k} d={r.d} />
            ))}
          </g>
          {/* Lit from the core outward on success */}
          <g mask={`url(#${uid}-fillmask)`} style={{ stroke: "var(--pk-success)" }}>
            {RIDGES.map((r, k) => (
              <path key={k} d={r.d} />
            ))}
          </g>
          {/* The scan line itself */}
          <motion.g
            initial={false}
            animate={scanning ? (reduce ? { y: 58, opacity: 0.6 } : { y: [21, 115, 21], opacity: 1 }) : { opacity: 0 }}
            transition={scanning && !reduce ? { y: scanLoop, opacity: { duration: 0.25 } } : { duration: 0.2 }}
            style={{ fill: "var(--pk-scan)" }}
          >
            <rect x="0" y="-3" width={VB} height="6" opacity="0.1" />
            <rect x="0" y="-0.5" width={VB} height="1" opacity="0.85" />
          </motion.g>
        </g>
      </motion.svg>

      <AnimatePresence>
        {success && (
          <Badge key="ok" reduce={reduce} delay={MOTION.badge} className="bg-[var(--pk-success)] text-[var(--pk-on-success)]">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5.5 12.5l4 4 9-9.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: MOTION.badge + 0.17, duration: 0.36, ease: EASE_OUT }} />
            </svg>
          </Badge>
        )}
        {failed && (
          <Badge key="err" reduce={reduce} delay={0} className="bg-[var(--pk-error-wash)] text-[var(--pk-error)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--pk-error)_35%,transparent)]">
            <svg viewBox="0 0 24 24" className="size-[20px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
              <path d="M12 6v7.5M12 18h.01" />
            </svg>
          </Badge>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Corner badge on the well; a 5px surface-coloured ring cuts it out of the edge. */
function Badge({ reduce, delay, className, children }: { reduce: boolean; delay: number; className: string; children: ReactNode }) {
  return (
    <motion.div
      aria-hidden="true"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={reduce ? { duration: MOTION.fade } : { ...SPRING_BADGE, delay }}
      className={`absolute bottom-[6px] right-[6px] grid size-10 place-items-center rounded-full shadow-[0_0_0_5px_var(--pk-surface)] @[360px]:bottom-[8px] @[360px]:right-[8px] ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Small parts                                                          */
/* ------------------------------------------------------------------ */

function BrandMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <rect width="20" height="20" rx="6" style={{ fill: "var(--pk-ink)" }} />
      <path d="M5 13.5c2.2-4.6 7.8-4.6 10 0" fill="none" strokeWidth="1.8" strokeLinecap="round" style={{ stroke: "var(--pk-surface)" }} />
      <circle cx="10" cy="7" r="1.6" style={{ fill: "var(--pk-surface)" }} />
    </svg>
  );
}

function Spinner({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 ${reduce ? "" : "animate-spin"}`} aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.75" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path d="M3.5 8.5l3 3 6-6.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.1, ease: EASE_OUT }} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

type DemoOutcome = "success" | "cancel" | "timeout" | "error" | "unsupported";

const DEMO_SUCCESS_MS = 2400;
const DEMO_FAIL_MS = 1900;
const DEMO_TIMEOUT_MS = 2600;

/** A stand-in for `navigator.credentials.get`: answers after a beat, and honours the abort signal. */
function simulate(signal: AbortSignal, outcome: DemoOutcome = "success"): Promise<PasskeyResult> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => {
        if (outcome === "success") resolve({ name: "Ada Okafor" });
        else if (outcome === "cancel") reject(new DOMException("The operation either timed out or was not allowed.", "NotAllowedError"));
        else if (outcome === "error") reject(new Error("This passkey belongs to a different Fathom account."));
        // "timeout" never answers; the component’s own timer aborts it.
      },
      outcome === "success" ? DEMO_SUCCESS_MS : DEMO_FAIL_MS,
    );
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

const OUTCOMES: { id: DemoOutcome; label: string }[] = [
  { id: "success", label: "Success" },
  { id: "cancel", label: "Cancel" },
  { id: "timeout", label: "Timeout" },
  { id: "error", label: "Error" },
  { id: "unsupported", label: "Unsupported" },
];

export default function AuthPasskeyDemo(overrides: Partial<AuthPasskeyProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [outcome, setOutcome] = useState<DemoOutcome>("success");
  const [run, setRun] = useState(0);
  const [note, setNote] = useState("");
  const light = overrides.theme === "light";

  const pick = (o: DemoOutcome) => {
    setOutcome(o);
    setRun((r) => r + 1);
    setNote("");
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-14 font-sans" style={{ background: light ? STAGE_LIGHT : STAGE }}>
      <AuthPasskey
        key={run}
        supported={outcome === "unsupported" ? false : undefined}
        timeoutMs={outcome === "timeout" ? DEMO_TIMEOUT_MS : 60000}
        onAuthenticate={(signal) => simulate(signal, outcome)}
        onSuccess={() => setNote("onSuccess fired. A real app would redirect here.")}
        onFallback={() => setNote("onFallback fired. Show your email sign-in.")}
        {...overrides}
      />
      <motion.div {...enter(true, 0.6, reduce)} className="flex w-full max-w-[400px] flex-col items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Demo outcome"
          className={`flex max-w-full justify-center overflow-x-auto rounded-full border p-1 [scrollbar-width:none] ${light ? "border-black/[0.09]" : "border-white/[0.07]"}`}
        >
          {OUTCOMES.map((o) => {
            const on = o.id === outcome;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(o.id)}
                className={`relative h-8 shrink-0 rounded-full px-2.5 font-mono text-[11px] tracking-[0.02em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 active:translate-y-px ${
                  light
                    ? `focus-visible:outline-black ${on ? "text-black" : "text-black/55 hover:text-black/85"}`
                    : `focus-visible:outline-white ${on ? "text-white" : "text-white/50 hover:text-white/80"}`
                }`}
              >
                {on && <motion.span layoutId={`${uid}-pill`} className={`absolute inset-0 rounded-full ${light ? "bg-black/[0.07]" : "bg-white/[0.09]"}`} transition={reduce ? { duration: 0 } : SPRING_UI} />}
                <span className="relative">{o.label}</span>
              </button>
            );
          })}
        </div>
        <p className={`h-4 font-mono text-[11px] ${light ? "text-black/55" : "text-white/45"}`} aria-live="polite">
          {note || "Demo: pick how the device answers, then sign in."}
        </p>
      </motion.div>
    </div>
  );
}
