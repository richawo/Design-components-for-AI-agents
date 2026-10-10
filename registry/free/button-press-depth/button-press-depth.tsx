"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type PressDepthVariant = "primary" | "secondary" | "ghost" | "destructive";
export type PressDepthSize = "sm" | "md" | "lg";
export type PressDepthState = "idle" | "loading" | "success" | "disabled";
export type PressDepthTheme = "dark" | "light";
type Pose = "rest" | "hover" | "press";

export type PressDepthButtonProps = {
  /** Resting label. */
  label?: string;
  /** Optional text beside the spinner while onPress is pending. Without it, the spinner replaces the label in the same box. */
  loadingLabel?: string;
  /** Optional text beside the check once onPress settles. Without it, the check replaces the label in the same box. */
  successLabel?: string;
  /** Announced through the status region when a returned promise rejects. */
  errorLabel?: string;
  variant?: PressDepthVariant;
  size?: PressDepthSize;
  /** Drive the state from outside. Leave it out and a returned promise from onPress drives loading and success itself. */
  state?: PressDepthState;
  /** Shows the built-in arrow after the label. */
  icon?: boolean;
  /** Any glyph before the label. */
  leadingIcon?: ReactNode;
  /** Any glyph after the label. Overrides `icon`; pass null to hide it. */
  trailingIcon?: ReactNode;
  /** The one accent. It fills the primary button, and its base edge and label colour are derived from it. */
  accent?: string;
  /** The surface the button sits on, so its neutrals keep their contrast. */
  theme?: PressDepthTheme;
  /** Uncontrolled only: how long success holds before the button returns to idle. */
  successMs?: number;
  /**
   * Runs on press. Only a returned promise shows loading, then success. A rejected promise
   * returns to idle and announces `errorLabel`. A plain or synchronous onPress leaves the button idle.
   */
  onPress?: () => void | Promise<unknown>;
  type?: "button" | "submit";
  /** Applied to the outer wrapper, not the button. */
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

/** The depth is a 2px base edge the face sinks into on press. Every value is one place to tune. */
const PRESS_TRAVEL = 2; // px the face sinks into its base edge
const LIFT = 1; // px the face rises on hover, so the base shows a little more
const SUCCESS_HOLD_MS = 1600;
/** Monochrome by default: a near-white primary on dark, so the accent is a choice the user makes, not a framework blue. */
const DEFAULT_ACCENT = "#f4f4f5";
const DEFAULT_ERROR_LABEL = "Didn’t save";
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const DEMO_TIMING = { saveMs: 1100, holdMs: 1600 } as const;
/** The built-in arrow nudges toward the action on hover, a 1–2px step as the spec asks. */
const ARROW_NUDGE = 1.5;

/** Neutrals per theme. Colour only appears on the primary accent and the destructive fill. */
const NEUTRAL = {
  dark: {
    ink: "#f4f4f5",
    secondary: "#1f1f24",
    secondaryEdge: "#060607",
    secondaryHl: "rgba(255,255,255,0.08)",
    danger: "#d6393f",
    dangerEdge: "#7f1d22",
    ghostHover: "rgba(255,255,255,0.07)",
    ghostPress: "rgba(255,255,255,0.12)",
    shade: "white",
  },
  light: {
    ink: "#18181b",
    secondary: "#ffffff",
    secondaryEdge: "#c4c5cc",
    secondaryHl: "rgba(255,255,255,0.95)",
    danger: "#dc2626",
    dangerEdge: "#8f1717",
    ghostHover: "rgba(24,24,27,0.06)",
    ghostPress: "rgba(24,24,27,0.1)",
    shade: "black",
  },
} as const;

/** `hit` grows the tappable area to 44px on the two sizes that are shorter than that, without changing the drawn face. */
const SIZES = {
  sm: { box: "h-8 px-3 text-[13px]", gap: "gap-1.5", radius: 8, glyph: 14, hit: "before:absolute before:-inset-1.5 before:content-['']" },
  md: { box: "h-10 px-4 text-[14px]", gap: "gap-2", radius: 10, glyph: 16, hit: "before:absolute before:-inset-0.5 before:content-['']" },
  lg: { box: "h-12 px-[22px] text-[15px]", gap: "gap-2.5", radius: 12, glyph: 18, hit: "" },
} as const;

type Tokens = {
  fill: string;
  /** The base edge. Null for ghost, which has no depth. */
  edge: string | null;
  text: string;
  /** Inset top highlight that gives the face its lip. */
  hl: string;
  hover: string;
  press: string;
  ring: string;
};

function hexLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whichever label colour has the higher WCAG contrast on this fill. */
function inkOn(fill: string): string {
  const lum = hexLuminance(fill);
  if (lum === null) return "#ffffff";
  const onWhite = 1.05 / (lum + 0.05);
  const onBlack = (lum + 0.05) / 0.0533; // #0a0a0b sits at about 0.0033 relative luminance
  return onWhite >= onBlack ? "#ffffff" : "#0a0a0b";
}

function raised(fill: string, edge: string, text: string, hl: string, ring: string, shade: string): Tokens {
  return {
    fill,
    edge,
    text,
    hl,
    hover: `color-mix(in oklab, ${fill} 88%, ${shade})`,
    press: `color-mix(in oklab, ${fill} 90%, black)`,
    ring,
  };
}

function tokensFor(variant: PressDepthVariant, theme: PressDepthTheme, accent: string): Tokens {
  const n = NEUTRAL[theme];
  switch (variant) {
    case "primary":
      return raised(accent, `color-mix(in oklab, ${accent} 62%, black)`, inkOn(accent), "rgba(255,255,255,0.24)", accent, n.shade);
    case "destructive":
      return raised(n.danger, n.dangerEdge, "#ffffff", "rgba(255,255,255,0.22)", n.danger, n.shade);
    case "secondary":
      return raised(n.secondary, n.secondaryEdge, n.ink, n.secondaryHl, n.ink, n.shade);
    case "ghost":
      return { fill: "transparent", edge: null, text: n.ink, hl: "transparent", hover: n.ghostHover, press: n.ghostPress, ring: n.ink };
  }
}

const FACE =
  "relative inline-grid items-center justify-items-center whitespace-nowrap select-none font-sans font-medium tracking-[-0.01em] touch-manipulation [-webkit-tap-highlight-color:transparent] transition-[transform,background-color,box-shadow] duration-[120ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed motion-reduce:duration-150";

// Tailwind v4 spells "no blur" as blur-none (blur-0 does not exist), so the reduced-motion override really applies.
const SLOT =
  "col-start-1 row-start-1 inline-flex items-center justify-center transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-y-0 motion-reduce:blur-none motion-reduce:transition-opacity motion-reduce:duration-150";
const SLOT_ON = "opacity-100 translate-y-0 blur-none";
const SLOT_OFF = "pointer-events-none opacity-0 translate-y-[4px] blur-[2px]";

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** setTimeout that is cleared on unmount, so a late callback never lands on a dead component, and on demand via clear. */
function useTimers() {
  const ids = useRef<number[]>([]);
  useEffect(() => {
    const pending = ids;
    return () => {
      pending.current.forEach(window.clearTimeout);
      pending.current = [];
    };
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);
  const clear = useCallback(() => {
    ids.current.forEach(window.clearTimeout);
    ids.current = [];
  }, []);
  return { later, clear };
}

/** Only a real promise counts as work in flight; a plain return value does not. */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === "object" || typeof value === "function") && value !== null && typeof (value as { then?: unknown }).then === "function";
}

/* ------------------------------------------------------------------ */
/* Glyphs                                                               */
/* ------------------------------------------------------------------ */

function ArrowGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}

/** A partial ring reads as work in progress; a full circle would read as a stalled download. */
function SpinnerGlyph({ size, reduce }: { size: number; reduce: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true" className="animate-spin motion-reduce:animate-none">
      <circle cx={8} cy={8} r={6} strokeDasharray={reduce ? "18 20" : "28 10"} />
    </svg>
  );
}

/** The check draws itself in when success lands, via pathLength, so it stays interruptible. */
function CheckGlyph({ size, active, reduce }: { size: number; active: boolean; reduce: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 5"
        initial={false}
        animate={{ pathLength: active ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.34, ease: EASE_OUT, delay: 0.12 }}
      />
    </svg>
  );
}

/** A 16-unit eye, a leading glyph the demo shows so the left slot's optical alignment is visible by default. */
function EyeGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
      <circle cx={8} cy={8} r={2} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function PressDepthButton({
  label = "Save changes",
  loadingLabel,
  successLabel,
  errorLabel = DEFAULT_ERROR_LABEL,
  variant = "primary",
  size = "md",
  state,
  icon = false,
  leadingIcon = null,
  trailingIcon,
  accent = DEFAULT_ACCENT,
  theme = "dark",
  successMs = SUCCESS_HOLD_MS,
  onPress,
  type = "button",
  className = "",
}: PressDepthButtonProps) {
  const reduce = useReducedMotion() ?? false;
  const dim = SIZES[size];
  const tokens = tokensFor(variant, theme, accent);
  const isDepthed = tokens.edge !== null;
  const { later } = useTimers();
  const [internal, setInternal] = useState<PressDepthState>("idle");
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  const current: PressDepthState = state ?? internal;
  const interactive = current === "idle";
  // Hover and press are set from pointer and key handlers, not CSS :hover, so they also show in scripted demos.
  const pose: Pose = !interactive ? "rest" : pressed ? "press" : hover ? "hover" : "rest";

  const travel = (() => {
    if (reduce) return 0; // reduced motion keeps the press as a colour change, without the movement
    if (pose === "press") return isDepthed ? PRESS_TRAVEL : 1;
    if (pose === "hover") return isDepthed ? -LIFT : 0;
    return 0;
  })();
  const background = pose === "press" ? tokens.press : pose === "hover" ? tokens.hover : tokens.fill;
  // Only a hovered, idle button nudges its trailing glyph; reduced motion keeps it still.
  const arrowNudge = !reduce && pose === "hover" ? ARROW_NUDGE : 0;

  const face: CSSProperties = {
    backgroundColor: background,
    color: tokens.text,
    boxShadow: `inset 0 1px 0 ${tokens.hl}`,
    transform: `translateY(${travel}px)`,
    borderRadius: dim.radius,
    outlineColor: tokens.ring,
  };
  // The base is fixed to the bottom 2px of the wrapper while the face moves over it: resting it shows the edge, pressing covers it.
  const base: CSSProperties = {
    backgroundColor: tokens.edge ?? undefined,
    borderRadius: dim.radius,
    opacity: reduce && pose === "press" ? 0 : 1,
    transition: "opacity 160ms cubic-bezier(0.22,1,0.36,1)",
  };

  const handleClick = () => {
    if (current !== "idle") return;
    if (state !== undefined) {
      void onPress?.();
      return;
    }
    setFailed(false);
    const result = onPress?.();
    // A plain or synchronous onPress does no work in flight, so the button stays idle: no spinner, no check.
    if (!isThenable(result)) return;
    setInternal("loading");
    result.then(
      () => {
        setInternal("success");
        later(() => setInternal("idle"), successMs);
      },
      () => {
        setFailed(true);
        setInternal("idle");
      },
    );
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (interactive && !e.repeat && (e.key === " " || e.key === "Enter")) setPressed(true);
  };
  const release = () => setPressed(false);
  const trailing = trailingIcon !== undefined ? trailingIcon : icon ? <ArrowGlyph size={dim.glyph} /> : null;
  const idleOn = current === "idle" || current === "disabled";

  // Without loadingLabel or successLabel the slot is aria-hidden, so the button needs a name of its own in those states.
  const accessibleName =
    current === "loading" && !loadingLabel ? `${label}, in progress` : current === "success" && !successLabel ? `${label}, done` : undefined;
  const announce = current === "success" ? (successLabel ?? "Done") : failed ? errorLabel : "";

  return (
    <span
      className={`relative inline-grid align-middle transition-opacity duration-200 data-[state=disabled]:opacity-40 ${isDepthed ? "pb-[2px]" : ""} ${className}`}
      data-state={current}
    >
      {tokens.edge !== null && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-0" style={base} />}
      <button
        type={type}
        disabled={current === "disabled"}
        aria-busy={current === "loading" || undefined}
        aria-label={accessibleName}
        onClick={handleClick}
        onPointerEnter={(e: ReactPointerEvent<HTMLButtonElement>) => {
          // Tracked in every state; the pose only shows the lift while the button is idle.
          if (e.pointerType !== "touch") setHover(true);
        }}
        onPointerLeave={() => {
          setHover(false);
          release();
        }}
        onPointerDown={() => {
          if (interactive) setPressed(true);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={handleKeyDown}
        onKeyUp={release}
        onBlur={release}
        data-pose={pose}
        className={`${FACE} ${dim.box} ${dim.hit}`}
        style={face}
      >
        <span className={`${SLOT} ${dim.gap} ${idleOn ? SLOT_ON : SLOT_OFF}`} aria-hidden={!idleOn || undefined}>
          {leadingIcon ? <span aria-hidden="true" className="inline-flex shrink-0">{leadingIcon}</span> : null}
          <span>{label}</span>
          {trailing ? (
            <span
              aria-hidden="true"
              className="inline-flex shrink-0 transition-transform duration-[120ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(${arrowNudge}px)` }}
            >
              {trailing}
            </span>
          ) : null}
        </span>
        <span className={`${SLOT} ${dim.gap} ${current === "loading" ? SLOT_ON : SLOT_OFF}`} aria-hidden={current !== "loading" || undefined}>
          <SpinnerGlyph size={dim.glyph} reduce={reduce} />
          {loadingLabel ? <span>{loadingLabel}</span> : null}
        </span>
        <span className={`${SLOT} ${dim.gap} ${current === "success" ? SLOT_ON : SLOT_OFF}`} aria-hidden={current !== "success" || undefined}>
          <CheckGlyph size={dim.glyph} active={current === "success"} reduce={reduce} />
          {successLabel ? <span>{successLabel}</span> : null}
        </span>
      </button>
      <span role="status" className="sr-only">
        {announce}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

const STAGE = {
  backdrop: "#0a0a0b",
  card: "#111113",
  ring: "rgba(255,255,255,0.08)",
  rule: "rgba(255,255,255,0.07)",
  ink: "#f4f4f5",
  muted: "#8a8a93",
} as const;

const SETTINGS = [
  ["Domain", "northwind.studio"],
  ["Visibility", "Team only"],
  ["Retention", "30 days"],
] as const;

function enter(play: boolean, delay: number, reduce: boolean) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(8px)" },
    animate: play ? (reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }) : undefined,
    transition: { duration: reduce ? 0.15 : 0.5, delay: reduce ? 0 : delay, ease: EASE_OUT },
  };
}

export default function PressDepthButtonDemo({ state: forced, ...overrides }: Partial<PressDepthButtonProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const cardRef = useRef<HTMLElement>(null);
  const play = useInView(cardRef, { once: true, amount: 0.3 });
  const { later, clear } = useTimers();
  const [saveState, setSaveState] = useState<PressDepthState>("idle");
  const [saved, setSaved] = useState(false);

  // A state picked in the Customize panel is held until another is picked, so the preview shows it
  // for as long as the visitor wants to inspect it. Picking one cancels any save still in flight, and
  // clearing the pick (Replay does this) returns the demo to rest so the Save button is clickable again.
  useEffect(() => {
    clear();
    if (forced === undefined) {
      setSaveState("idle");
      setSaved(false);
      return;
    }
    setSaveState(forced);
    setSaved(forced === "success");
  }, [forced, clear]);

  // The save the demo's own press runs: loading, then success that holds, then back to idle.
  const save = () => {
    setSaved(false);
    setSaveState("loading");
    later(() => {
      setSaveState("success");
      setSaved(true);
      later(() => setSaveState("idle"), DEMO_TIMING.holdMs);
    }, DEMO_TIMING.saveMs);
  };

  const status = saveState === "loading" ? "Saving…" : saved ? "All changes saved" : "Unsaved changes";

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-16 font-sans antialiased sm:px-8" style={{ background: STAGE.backdrop, color: STAGE.ink }}>
      <div className="@container w-full max-w-[520px]">
        <motion.section
          ref={cardRef}
          aria-labelledby={`${uid}-title`}
          {...enter(play, 0, reduce)}
          className="rounded-[16px] p-5 @md:p-6"
          style={{ background: STAGE.card, boxShadow: `inset 0 0 0 1px ${STAGE.ring}, inset 0 1px 0 rgba(255,255,255,0.04), 0 40px 80px -40px rgba(0,0,0,0.9)` }}
        >
          <motion.header {...enter(play, 0.06, reduce)} className="flex items-baseline justify-between gap-4">
            <h2 id={`${uid}-title`} className="text-[15px] font-medium tracking-[-0.01em]">
              Project settings
            </h2>
            <span className="relative font-mono text-[11px] tabular-nums" style={{ color: STAGE.muted }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={status}
                  className="inline-block"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
                  transition={{ duration: reduce ? 0.15 : 0.2, ease: EASE_OUT }}
                >
                  {status}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.header>

          <motion.dl {...enter(play, 0.16, reduce)} className="mt-4">
            {SETTINGS.map(([term, value]) => (
              <div key={term} className="flex items-baseline justify-between gap-4 border-t py-3 first:border-t-0" style={{ borderColor: STAGE.rule }}>
                <dt className="text-[13px]" style={{ color: STAGE.muted }}>
                  {term}
                </dt>
                <dd className="font-mono text-[13px]">{value}</dd>
              </div>
            ))}
          </motion.dl>

          <motion.div {...enter(play, 0.3, reduce)} className="mt-3 flex flex-wrap items-center gap-3 border-t pt-6" style={{ borderColor: STAGE.rule }}>
            <div data-demo="save" className="inline-flex">
              <PressDepthButton label="Save changes" state={saveState} onPress={save} {...overrides} />
            </div>
            <PressDepthButton variant="secondary" label="Preview" leadingIcon={<EyeGlyph />} />
            <div data-demo="discard" className="inline-flex">
              <PressDepthButton variant="ghost" label="Discard" />
            </div>
          </motion.div>
        </motion.section>
        <motion.p {...enter(play, 0.42, reduce)} className="mt-4 text-center font-mono text-[11px]" style={{ color: STAGE.muted }}>
          Tab to focus · Space or Enter to press
        </motion.p>
      </div>
    </div>
  );
}
