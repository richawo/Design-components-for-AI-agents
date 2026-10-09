"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type PasskeyStatus = "idle" | "awaiting" | "success" | "cancelled" | "timeout" | "unsupported" | "error";

export type PasskeyResult = {
  /** Shown in the success line, e.g. "Ada Lovelace". */
  name?: string;
};

export type AuthPasskeyProps = {
  /** Product name shown under the mark. */
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
};

/* ------------------------------------------------------------------ */
/* Fingerprint geometry                                                 */
/* ------------------------------------------------------------------ */

const VB = 120;
const CX = 60;
const CY = 58;
const CLIP_R = 52;

// Small deterministic noise so the ridges look drawn, not generated.
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Ridge = { d: string; i: number; dist: number };

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
  const count = 11;
  for (let i = 0; i < count; i++) {
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
      const step = 3;
      for (let t = s0; t <= s1 + 0.001; t += step) {
        const [x, y] = ridgePoint(r, Math.min(t, s1), cy);
        pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      const mid = (s0 + s1) / 2;
      const [mx, my] = ridgePoint(r, mid, cy);
      ridges.push({ d: `M${pts.join(" L")}`, i, dist: Math.hypot(mx - CX, my - CY) });
    }
  }
  return ridges;
}

const RIDGES = buildRidges();

/* ------------------------------------------------------------------ */
/* Copy per state                                                       */
/* ------------------------------------------------------------------ */

const ease = [0.22, 1, 0.36, 1] as const;
const MINT = "#8ff0c4";
const ROSE = "#ff8a8a";

function detectSupport() {
  if (typeof window === "undefined") return true;
  return typeof window.PublicKeyCredential === "function";
}

function isCancel(err: unknown) {
  const name = (err as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "AbortError";
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
}: AuthPasskeyProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [detected, setDetected] = useState(true);
  const [status, setStatus] = useState<PasskeyStatus>("idle");
  const [result, setResult] = useState<PasskeyResult>({});
  const [errorText, setErrorText] = useState("");
  const ctrl = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setDetected(detectSupport()), []);
  const canUse = supported ?? detected;
  const shown: PasskeyStatus = !canUse ? "unsupported" : status;

  useEffect(
    () => () => {
      ctrl.current?.abort();
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const start = useCallback(async () => {
    if (!canUse || status === "awaiting" || status === "success") return;
    const ac = new AbortController();
    ctrl.current = ac;
    setStatus("awaiting");
    let timedOut = false;
    timeoutRef.current = window.setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, timeoutMs);
    try {
      const run = onAuthenticate ?? ((signal: AbortSignal) => simulate(signal));
      const res = (await run(ac.signal)) ?? {};
      if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");
      setResult(res);
      setStatus("success");
      window.setTimeout(() => onSuccess?.(res), reduce ? 200 : 1400);
    } catch (err) {
      if (ctrl.current !== ac) return;
      if (timedOut) setStatus("timeout");
      else if (isCancel(err)) setStatus("cancelled");
      else {
        setErrorText(err instanceof Error && err.message ? err.message : "Your device answered, but we couldn’t verify it.");
        setStatus("error");
      }
    } finally {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    }
  }, [canUse, status, timeoutMs, onAuthenticate, onSuccess, reduce]);

  const cancel = () => {
    ctrl.current?.abort();
    setStatus("cancelled");
    buttonRef.current?.focus();
  };

  const copy = useMemo(() => {
    switch (shown) {
      case "awaiting":
        return { line: "Waiting for your device", sub: "Follow the prompt from your browser or phone." };
      case "success":
        return { line: result.name ? `Signed in as ${result.name}` : "You’re signed in", sub: "Opening your workspace…" };
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
  }, [shown, result.name, errorText, credentialHint]);

  const busy = shown === "awaiting";
  const done = shown === "success";
  const retry = shown === "cancelled" || shown === "timeout" || shown === "error";
  const unsupported = shown === "unsupported";

  return (
    <div className="@container w-full max-w-[400px] font-sans text-[#f4f4f5] antialiased">
      <motion.section
        aria-labelledby={`${uid}-title`}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.15 : 0.6, ease }}
        className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b0b0c] px-6 pb-6 pt-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_40px_80px_-32px_rgba(0,0,0,0.9)] @[360px]:px-9 @[360px]:pb-7 @[360px]:pt-10"
      >
        {/* Brand */}
        <div className="flex items-center justify-center gap-2">
          <BrandMark />
          <span className="text-[13px] font-medium tracking-[-0.01em] text-white/70">{brand}</span>
        </div>

        <h2 id={`${uid}-title`} className="mt-5 text-center font-display text-[clamp(1.6rem,1.3rem+1.2cqi,1.875rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
          {title}
        </h2>
        <p className="mx-auto mt-2.5 max-w-[32ch] text-balance text-center text-[14.5px] leading-[1.55] text-[#8b8b93]">{description}</p>

        {/* Glyph */}
        <div className="mt-8 flex justify-center">
          <FingerprintGlyph uid={uid} status={shown} reduce={reduce} />
        </div>

        {/* Status */}
        <div className="mt-6 min-h-[64px] text-center" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={shown + copy.sub}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
              transition={{ duration: 0.24, ease }}
            >
              <p className={`text-[14.5px] font-medium tracking-[-0.01em] ${shown === "error" ? "text-[#ffb4b4]" : done ? "text-[#c9f8e1]" : "text-[#ededef]"}`}>
                {copy.line}
                {busy && <AnimatedEllipsis reduce={reduce} />}
              </p>
              <p className={`mx-auto mt-1 max-w-[40ch] text-balance leading-[1.5] ${shown === "idle" ? "font-mono text-[11.5px] tracking-[0.01em] text-[#6c6c74]" : "text-[13px] text-[#8b8b93]"}`}>{copy.sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Primary action */}
        <div className="mt-6">
          <motion.button
            ref={buttonRef}
            type="button"
            onClick={unsupported ? onFallback : start}
            aria-busy={busy}
            aria-disabled={busy || done}
            whileTap={busy || done || reduce ? undefined : { scale: 0.975 }}
            transition={{ type: "spring", stiffness: 600, damping: 32 }}
            className={`relative flex h-12 w-full items-center justify-center overflow-hidden rounded-[14px] text-[14.5px] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white ${
              done
                ? "cursor-default bg-[#8ff0c4] text-[#05140d]"
                : busy
                  ? "cursor-progress bg-white/[0.07] text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  : "bg-[#f4f4f5] text-[#0b0b0c] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12),0_1px_0_rgba(255,255,255,0.1)] hover:bg-white"
            }`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={done ? "done" : busy ? "busy" : retry ? "retry" : unsupported ? "email" : "idle"}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.12 } }}
                transition={{ duration: 0.22, ease }}
                className="flex items-center gap-2"
              >
                {busy && <Spinner reduce={reduce} />}
                {done && <CheckIcon reduce={reduce} />}
                {done ? "Signed in" : busy ? "Waiting for device" : retry ? "Try again" : unsupported ? "Continue with email" : buttonLabel}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Secondary */}
        <div className="mt-3 flex h-11 items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.button
                key="cancel"
                type="button"
                onClick={cancel}
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
                onClick={onFallback}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18 }}
                className={`${linkCls} ${retry ? "text-white/85" : ""}`}
              >
                {fallbackLabel}
                <span aria-hidden="true" className="ml-1.5 inline-block transition-transform duration-150 group-hover:translate-x-0.5">
                  →
                </span>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.section>
    </div>
  );
}

const linkCls =
  "group inline-flex h-11 items-center rounded-lg px-3 text-[13.5px] text-[#8b8b93] transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white active:translate-y-px";

/* ------------------------------------------------------------------ */
/* The glyph                                                            */
/* ------------------------------------------------------------------ */

function FingerprintGlyph({ uid, status, reduce }: { uid: string; status: PasskeyStatus; reduce: boolean }) {
  const maxDist = useMemo(() => Math.max(...RIDGES.map((r) => r.dist)), []);
  const scanning = status === "awaiting";
  const success = status === "success";
  const failed = status === "error";
  const quiet = status === "unsupported";
  const settled = status === "cancelled" || status === "timeout";

  const baseColor = failed ? "rgba(255,138,138,0.42)" : quiet ? "rgba(255,255,255,0.12)" : settled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.26)";

  return (
    <div className="relative grid size-[148px] place-items-center @[360px]:size-[164px]">
      {/* Well */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-white/[0.07] bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.05),rgba(255,255,255,0)_62%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-24px_40px_-24px_rgba(0,0,0,0.8)]"
      />
      {/* Success bloom behind the well */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[-28px] rounded-full"
        style={{ background: `radial-gradient(circle, ${MINT}2e 0%, ${MINT}00 62%)` }}
        initial={false}
        animate={{ opacity: success ? 1 : 0, scale: success && !reduce ? 1 : 0.85 }}
        transition={{ duration: success ? 0.9 : 0.3, ease }}
      />
      <motion.svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="relative size-[118px] @[360px]:size-[130px]"
        role="img"
        aria-label={success ? "Passkey verified" : scanning ? "Waiting for passkey" : "Passkey"}
        animate={reduce ? undefined : settled ? { scale: [1, 0.97, 1] } : { scale: 1 }}
        transition={{ duration: 0.6, ease }}
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
              transition={scanning && !reduce ? { y: { duration: 2.6, ease: [0.65, 0, 0.35, 1], repeat: Infinity }, opacity: { duration: 0.25 } } : { duration: 0.2 }}
            />
          </mask>
          <mask id={`${uid}-fillmask`} maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}>
            <motion.circle
              cx={CX}
              cy={CY}
              fill={`url(#${uid}-fill)`}
              initial={false}
              animate={{ r: success ? 90 : 0 }}
              transition={success ? { duration: reduce ? 0 : 0.85, ease: [0.33, 1, 0.68, 1] } : { duration: 0 }}
            />
          </mask>
        </defs>

        <g mask={`url(#${uid}-pad)`} fill="none" strokeLinecap="round" strokeWidth={2}>
          {/* Base ridges: drawn in on entrance, from the core outward */}
          <g>
            {RIDGES.map((r, k) => (
              <motion.path
                key={k}
                d={r.d}
                stroke={baseColor}
                initial={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1, stroke: baseColor }}
                transition={{
                  pathLength: { duration: 0.9, ease, delay: 0.25 + (r.dist / maxDist) * 0.55 },
                  opacity: { duration: 0.2, delay: reduce ? 0 : 0.25 + (r.dist / maxDist) * 0.55 },
                  stroke: { duration: 0.3 },
                }}
              />
            ))}
          </g>
          {/* Lit by the scan band */}
          <g mask={`url(#${uid}-scanmask)`}>
            {RIDGES.map((r, k) => (
              <path key={k} d={r.d} stroke="#f4f7ff" />
            ))}
          </g>
          {/* Lit from the core outward on success */}
          <g mask={`url(#${uid}-fillmask)`}>
            {RIDGES.map((r, k) => (
              <path key={k} d={r.d} stroke={MINT} />
            ))}
          </g>
          {/* The scan line itself */}
          <motion.g
            initial={false}
            animate={scanning ? (reduce ? { y: 58, opacity: 0.6 } : { y: [21, 115, 21], opacity: 1 }) : { opacity: 0 }}
            transition={scanning && !reduce ? { y: { duration: 2.6, ease: [0.65, 0, 0.35, 1], repeat: Infinity }, opacity: { duration: 0.25 } } : { duration: 0.2 }}
          >
            <rect x="0" y="-3" width={VB} height="6" fill="#dfe8ff" opacity="0.12" />
            <rect x="0" y="-0.5" width={VB} height="1" fill="#f4f7ff" opacity="0.85" />
          </motion.g>
        </g>
      </motion.svg>

      {/* Check badge */}
      <AnimatePresence>
        {success && (
          <motion.div
            aria-hidden="true"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.15 } : { delay: 0.55, type: "spring", stiffness: 500, damping: 28 }}
            className="absolute bottom-[6px] right-[6px] grid size-10 place-items-center rounded-full bg-[#8ff0c4] text-[#05140d] shadow-[0_0_0_5px_#0b0b0c,0_8px_24px_-6px_rgba(143,240,196,0.55)] @[360px]:bottom-[8px] @[360px]:right-[8px]"
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5.5 12.5l4 4 9-9.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.72, duration: 0.36, ease }} />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error badge */}
      <AnimatePresence>
        {failed && (
          <motion.div
            aria-hidden="true"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute bottom-[6px] right-[6px] grid size-10 place-items-center rounded-full bg-[#2a1214] text-[#ff8a8a] shadow-[0_0_0_5px_#0b0b0c,inset_0_0_0_1px_rgba(255,138,138,0.35)] @[360px]:bottom-[8px] @[360px]:right-[8px]"
          >
            <svg viewBox="0 0 24 24" className="size-[20px]" fill="none" stroke={ROSE} strokeWidth={2.6} strokeLinecap="round">
              <path d="M12 6v7.5M12 18h.01" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small parts                                                          */
/* ------------------------------------------------------------------ */

function BrandMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <rect width="20" height="20" rx="6" fill="#f4f4f5" />
      <path d="M5 13.5c2.2-4.6 7.8-4.6 10 0" fill="none" stroke="#0b0b0c" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="7" r="1.6" fill="#0b0b0c" />
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
      <motion.path d="M3.5 8.5l3 3 6-6.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.1, ease }} />
    </svg>
  );
}

function AnimatedEllipsis({ reduce }: { reduce: boolean }) {
  if (reduce) return <span>…</span>;
  return (
    <span aria-hidden="true" className="inline-flex w-[1.1em]">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}>
          .
        </motion.span>
      ))}
    </span>
  );
}

function simulate(signal: AbortSignal, outcome: DemoOutcome = "success"): Promise<PasskeyResult> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(
      () => {
        if (outcome === "success") resolve({ name: "Ada Okafor" });
        else if (outcome === "cancel") reject(new DOMException("The operation either timed out or was not allowed.", "NotAllowedError"));
        else if (outcome === "error") reject(new Error("This passkey belongs to a different Fathom account."));
      },
      outcome === "success" ? 2400 : 1900,
    );
    signal.addEventListener("abort", () => {
      window.clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

type DemoOutcome = "success" | "cancel" | "timeout" | "error" | "unsupported";

const OUTCOMES: { id: DemoOutcome; label: string }[] = [
  { id: "success", label: "Success" },
  { id: "cancel", label: "Cancel" },
  { id: "timeout", label: "Timeout" },
  { id: "error", label: "Error" },
  { id: "unsupported", label: "Unsupported" },
];

export default function AuthPasskeyDemo() {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [outcome, setOutcome] = useState<DemoOutcome>("success");
  const [run, setRun] = useState(0);
  const [note, setNote] = useState("");

  const pick = (o: DemoOutcome) => {
    setOutcome(o);
    setRun((r) => r + 1);
    setNote("");
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-black px-4 py-14 font-sans">
      <AuthPasskey
        key={run}
        supported={outcome === "unsupported" ? false : undefined}
        timeoutMs={outcome === "timeout" ? 2600 : 60000}
        onAuthenticate={(signal) => simulate(signal, outcome)}
        onSuccess={() => setNote("onSuccess fired. A real app would redirect here.")}
        onFallback={() => setNote("onFallback fired. Show your email sign-in.")}
      />
      <div className="flex w-full max-w-[400px] flex-col items-center gap-3">
        <div role="radiogroup" aria-label="Demo outcome" className="flex max-w-full justify-center overflow-x-auto rounded-full border border-white/[0.07] p-1 [scrollbar-width:none]">
          {OUTCOMES.map((o) => {
            const on = o.id === outcome;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(o.id)}
                className={`relative h-8 shrink-0 rounded-full px-2.5 font-mono text-[11px] tracking-[0.02em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white active:translate-y-px ${on ? "text-white" : "text-white/45 hover:text-white/80"}`}
              >
                {on && <motion.span layoutId={`${uid}-pill`} className="absolute inset-0 rounded-full bg-white/[0.09]" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="relative">{o.label}</span>
              </button>
            );
          })}
        </div>
        <p className="h-4 font-mono text-[11px] text-white/35" aria-live="polite">
          {note || "Demo: pick how the device answers, then sign in."}
        </p>
      </div>
    </div>
  );
}
