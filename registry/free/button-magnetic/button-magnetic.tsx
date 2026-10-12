"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionStyle } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type MagneticCtaProps = {
  /** The action's label. A few words, in sentence case. Long labels wrap rather than overflow. */
  label?: string;
  /** Shows an arrow after the label. The arrow sits on a nearer depth than the label. */
  arrow?: boolean;
  /** The furthest the button leans toward the pointer, in px. Capped at 8. */
  strength?: number;
  /** Distance from the button's edge, in px, at which the pull begins. The pull builds as the pointer closes in. */
  radius?: number;
  /** The fill, as a hex colour. Defaults to #e9e9eb on a dark surface and #0a0a0b (ink) on a light one. */
  accent?: string;
  /** The surface the button sits on. It sets the default fill, the shadow and the focus ring. */
  theme?: "dark" | "light";
  onClick?: () => void;
  disabled?: boolean;
  /** Extra classes on the root, for layout such as margin or alignment beside other controls. */
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const MAX_STRENGTH = 8;
/**
 * The fill each surface gets when no accent is set. Dark keeps the near-white the Fill control shows.
 * Light takes ink: a near-white slab on a near-white page reads as a grey mistake, not a primary action.
 */
const DEFAULT_FILL = { dark: "#e9e9eb", light: "#0a0a0b" } as const;
/** The page surface each theme sits on. Used to pick a focus ring that stays visible. */
const SURFACE = { dark: "#0b0b0c", light: "#f4f4f2" } as const;
/** The opposite of each surface: the ink a focus ring falls back to when the fill would vanish into the page. */
const CONTRAST_INK = { dark: "#f4f4f5", light: "#0a0a0b" } as const;
const LABEL_ON_LIGHT = "#0a0a0b";
const LABEL_ON_DARK = "#ffffff";
/** The drop shadow for each surface. The dark one is deep so a near-white fill lifts; the light one is shallow so ink sits flat. */
const DROP_SHADOW = {
  dark: "0 1px 2px rgba(0,0,0,0.4), 0 12px 24px -12px rgba(0,0,0,0.6)",
  light: "0 1px 2px rgba(0,0,0,0.12), 0 10px 20px -12px rgba(0,0,0,0.28)",
} as const;

/** spring.soft: the lean settles like a magnet, it never snaps. */
const SOFT = { type: "spring", stiffness: 180, damping: 22 } as const;
/** spring.ui: snappy with no bounce, for press and hover. */
const UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** A pointer this close to the centre gives no lean, so a resting cursor doesn't make the button flutter. */
const SETTLE_PX = 48;
/**
 * Each layer's travel as a share of the lean, added to the surface's 1.0. The label nets 0.8 and the arrow
 * nets 1.1, so their gap moves by 0.3 of the lean: at the 8px cap that is 2.4px, never enough to touch the label.
 */
const LABEL_DEPTH = -0.2;
const ARROW_DEPTH = 0.1;
const PRESS_SCALE = 0.97;
/** Reduced motion has no scale, so a press dips the opacity instead. */
const PRESS_DIP = 0.9;
/** The arrow's hover nudge, in px. */
const NUDGE_PX = 2;
/** The spotlight's radius, about 1.6 times the 56px button height. It is sized from the button, not from the reach. */
const SPOT_RADIUS_PX = 90;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** WCAG relative luminance of a hex colour, 0 (black) to 1 (white). */
function luminance(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1 to 21. */
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The label ink with the higher contrast on this fill, so the text reads on any accent. */
const inkOn = (fill: string) => (contrast(fill, LABEL_ON_LIGHT) >= contrast(fill, LABEL_ON_DARK) ? LABEL_ON_LIGHT : LABEL_ON_DARK);

/**
 * How strong the white spotlight is on a fill. It scales with the fill's brightness, so a mid-tone such as
 * ember takes a faint veil instead of a hotspot, and a near-white fill takes the strongest lift it can carry.
 */
const spotlightAlpha = (fill: string) => clamp(0.14 + 0.4 * luminance(fill), 0.14, 0.42);

/**
 * A translate that moves a layer `depth` times the lean. The lean lives in CSS variables that
 * motion springs write on the root, so each layer follows the pointer without a React render.
 */
const depthOffset = (depth: number) =>
  `calc(var(--mb-lx, 0) * var(--mb-strength, 0) * ${depth}px) calc(var(--mb-ly, 0) * var(--mb-strength, 0) * ${depth}px)`;

const isActivationKey = (key: string) => key === " " || key === "Enter";

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function MagneticCta({
  label = "Start building",
  arrow = true,
  strength = 6,
  radius = 200,
  accent,
  theme = "dark",
  onClick,
  disabled = false,
  className = "",
}: MagneticCtaProps) {
  const reduce = useReducedMotion() ?? false;
  const fill = accent ?? DEFAULT_FILL[theme];
  const ink = inkOn(fill);
  // A light fill lifts toward white under the pointer; a dark one gets a faint veil of light.
  const lit = ink === LABEL_ON_LIGHT;
  const spotlight = `rgba(255,255,255,${spotlightAlpha(fill)})`;
  // A hairline keeps a light fill's edge visible on a light page, and catches light on a dark one.
  const rim = lit ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
  // The top highlight is brighter on a dark surface, where it has to separate the fill from the page.
  const highlight = theme === "dark" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)";
  const surfaceShadow = `inset 0 1px 0 ${highlight}, inset 0 0 0 1px ${rim}, ${DROP_SHADOW[theme]}`;
  // The focus ring is the fill when it stands out from the page, otherwise the opposite ink.
  const ring = contrast(fill, SURFACE[theme]) >= contrast(CONTRAST_INK[theme], SURFACE[theme]) ? fill : CONTRAST_INK[theme];
  const lean = clamp(strength, 0, MAX_STRENGTH);
  const field = Math.max(1, radius);

  const anchorRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Normalised pull on each axis (-1 to 1), eased by springs so the lean settles rather than snaps.
  const pullX = useMotionValue(0);
  const pullY = useMotionValue(0);
  const leanX = useSpring(pullX, SOFT);
  const leanY = useSpring(pullY, SOFT);

  const hover = useMotionValue(0);
  const hoverSpring = useSpring(hover, UI);
  const pressed = useMotionValue(0);
  const pressSpring = useSpring(pressed, UI);
  const pressScale = useTransform(pressSpring, [0, 1], [1, PRESS_SCALE]);
  const pressDip = useTransform(pressSpring, [0, 1], [1, PRESS_DIP]);
  const nudge = useTransform(hoverSpring, [0, 1], [0, NUDGE_PX]);

  // Where the pointer sits inside the button, for the spotlight, in px from the button's corner.
  const spotX = useMotionValue(0);
  const spotY = useMotionValue(0);

  useEffect(() => {
    // The lean is the only movement this component makes, so reduced motion and disabled skip it.
    if (reduce || disabled) {
      pullX.set(0);
      pullY.set(0);
      return;
    }
    // The pointer is read from the window, not the button: the lean starts before the pointer arrives.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // a finger is not a cursor
      const anchor = anchorRef.current;
      if (!anchor) return;
      // The anchor is the untransformed rest position, so the lean never shifts its own reference point.
      const box = anchor.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      const d = Math.hypot(dx, dy);
      // Reach is measured from the button's edge, not its centre: the pull is already strong when the
      // pointer is 40px outside, so the lean is visible before the cursor touches the button.
      const gapX = Math.max(0, Math.abs(dx) - box.width / 2);
      const gapY = Math.max(0, Math.abs(dy) - box.height / 2);
      const nearness = 1 - clamp(Math.hypot(gapX, gapY) / field, 0, 1);
      const pull = (1 - (1 - nearness) ** 2) * clamp(d / SETTLE_PX, 0, 1); // ease-out toward the pointer
      const unit = d < 1 ? 0 : pull / d;
      pullX.set(dx * unit);
      pullY.set(dy * unit);
    };
    // Leaving the page (no related target) lets the button go.
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      pullX.set(0);
      pullY.set(0);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onOut);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
    };
  }, [field, reduce, disabled, pullX, pullY]);

  // A disabled button must not keep a hover or press it picked up before it was disabled.
  useEffect(() => {
    if (!disabled) return;
    hover.set(0);
    pressed.set(0);
  }, [disabled, hover, pressed]);

  const placeSpot = (clientX: number, clientY: number) => {
    const button = buttonRef.current;
    if (!button) return;
    const box = button.getBoundingClientRect();
    // Reduced motion parks the spotlight in the middle instead of following the pointer.
    spotX.set(reduce ? box.width / 2 : clientX - box.left);
    spotY.set(reduce ? box.height / 2 : clientY - box.top);
  };

  const release = () => pressed.set(0);

  return (
    <motion.span
      className={`relative inline-flex max-w-full align-middle ${className}`}
      style={
        {
          "--mb-lx": leanX,
          "--mb-ly": leanY,
          "--mb-strength": String(lean),
          "--mb-accent": fill,
          "--mb-ink": ink,
          "--mb-ring": ring,
          "--mb-spot": spotlight,
          "--mb-sx": spotX,
          "--mb-sy": spotY,
        } as MotionStyle
      }
    >
      <span ref={anchorRef} className="relative inline-flex max-w-full">
        <span className="inline-flex max-w-full" style={{ translate: depthOffset(1) }}>
          <motion.button
            ref={buttonRef}
            type="button"
            data-demo="magnetic-cta"
            disabled={disabled}
            onClick={onClick}
            onPointerEnter={(e) => {
              if (disabled) return;
              hover.set(1);
              placeSpot(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!reduce && !disabled) placeSpot(e.clientX, e.clientY);
            }}
            onPointerLeave={() => {
              hover.set(0);
              release();
            }}
            onPointerDown={(e) => {
              if (e.button === 0 && !disabled) pressed.set(1);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onKeyDown={(e) => {
              if (!disabled && isActivationKey(e.key) && !e.repeat) pressed.set(1);
            }}
            onKeyUp={(e) => {
              if (isActivationKey(e.key)) release();
            }}
            onBlur={release}
            style={{
              scale: reduce ? 1 : pressScale,
              opacity: disabled ? 0.4 : reduce ? pressDip : 1,
              background: "var(--mb-accent)",
              color: "var(--mb-ink)",
              boxShadow: surfaceShadow,
            }}
            className="relative inline-flex min-h-14 max-w-full cursor-pointer items-center rounded-[14px] px-7 py-4 font-sans text-[15px] leading-tight font-medium tracking-[-0.01em] touch-manipulation select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-solid focus-visible:outline-(--mb-ring) disabled:cursor-not-allowed"
          >
            {/* The spotlight is a soft radial light that follows the pointer across the fill. */}
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{
                opacity: hoverSpring,
                background: `radial-gradient(circle ${SPOT_RADIUS_PX}px at calc(var(--mb-sx) * 1px) calc(var(--mb-sy) * 1px), var(--mb-spot), transparent 70%)`,
              }}
            />
            <span className="relative inline-flex min-w-0 items-center gap-2.5">
              <span className="min-w-0 text-balance" style={{ translate: depthOffset(LABEL_DEPTH) }}>
                {label}
              </span>
              {arrow && (
                <span className="inline-flex shrink-0" style={{ translate: depthOffset(ARROW_DEPTH) }}>
                  <motion.span className="inline-flex" style={{ x: reduce ? 0 : nudge }}>
                    <ArrowIcon />
                  </motion.span>
                </span>
              )}
            </span>
          </motion.button>
        </span>
      </span>
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* Icon (drawn on a 16-unit grid, 1.6px stroke)                         */
/* ------------------------------------------------------------------ */

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2.75 8h9.5M8.75 4.5 12.25 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

const STAGE = {
  dark: { bg: "#0b0b0c", caption: "#8a8a93" },
  light: { bg: "#f4f4f2", caption: "#6b6b73" },
} as const;

/** A quiet stage with the one button and a line of instruction. The stage is not part of the component's API. */
export default function MagneticCtaDemo(overrides: Partial<MagneticCtaProps> = {}) {
  const theme = overrides.theme ?? "dark";
  const stage = STAGE[theme];
  const reduce = useReducedMotion() ?? false;
  return (
    <div className="flex min-h-[560px] w-full items-center justify-center px-6 py-16" style={{ background: stage.bg }}>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: reduce ? 0.15 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-w-full flex-col items-center gap-6 text-center"
      >
        <MagneticCta label="Start building" {...overrides} />
        <p className="max-w-[34ch] text-balance font-sans text-[13px] leading-[1.5] tracking-[-0.005em]" style={{ color: stage.caption }}>
          Move toward the button. It leans in, then settles back when you leave.
        </p>
      </motion.div>
    </div>
  );
}
