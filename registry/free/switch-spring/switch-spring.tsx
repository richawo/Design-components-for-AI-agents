"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, useVelocity } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SwitchSpringSize = "sm" | "md" | "lg";
export type SwitchSpringLabelSide = "left" | "right";
export type SwitchSpringTheme = "dark" | "light";

export type SwitchSpringProps = {
  /** The switch's name. Read by screen readers and set beside the track. */
  label?: string;
  /** One quiet line under the label, in the muted ink. */
  description?: string;
  /**
   * Controlled state. The switch only moves when this changes, so update it from
   * `onCheckedChange` once the change has landed.
   */
  checked?: boolean;
  /** Starting state when uncontrolled. */
  defaultChecked?: boolean;
  /**
   * Runs when the person flips the switch. Return a promise to wait on the change:
   * if it rejects, the switch stays where it was.
   */
  onCheckedChange?: (checked: boolean) => void | Promise<unknown>;
  /**
   * Holds the thumb in a spinner until the promise from `onCheckedChange` settles,
   * then lands it. Off, the thumb moves at once and a rejection rolls it back.
   * Either way a rejection shakes the thumb, swaps the description for the message
   * in red, and announces it.
   */
  async?: boolean;
  /** The line shown in red, and announced, when a change is refused. */
  errorMessage?: string;
  size?: SwitchSpringSize;
  /** Glyphs in the track: a check on the side the thumb has left, a cross on the side it is heading to. */
  icons?: boolean;
  /** Which side of the track the label sits on. */
  labelSide?: SwitchSpringLabelSide;
  /** The fill while on, and the colour the thumb and glyphs take against it. Leave out for the theme's ink. */
  accent?: string;
  theme?: SwitchSpringTheme;
  disabled?: boolean;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

/** spring.ui from the library's motion tokens: snappy, no bounce. */
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Space between the thumb and the track edge, in px. */
const PAD = 2;

/** A refused change shakes the thumb in two beats toward the side it asked for, in px. */
const REFUSAL_SHAKE = [4, -2] as const;

/** How long a refusal line replaces the description, in ms. */
const REFUSAL_HOLD_MS = 3500;

/** The thumb swaps to its on colour across the middle of its travel, where the stretch peaks. */
const SWAP_FROM = 0.44;
const SWAP_TO = 0.56;

/** Accents lighter than this relative luminance take a near-black thumb. Darker accents take white. */
const LIGHT_ACCENT = 0.6;

const WHITE = "#ffffff";
const NEAR_BLACK = "#0b0b0c";

/** The dark theme's ink, which the demo maps to the theme's own ink so it stays legible on light surfaces. */
const DARK_INK = "#f4f4f5";

/** The thumb's widest stretch at full speed, as a fraction of its width. */
const STRETCH_MAX = 0.14;
/**
 * Peak speed of the spring, in travel distances per second. A spring.ui move
 * peaks near 0.37 * its natural frequency (about 8.3 per second), so a move at
 * full speed reads as 1 and anything slower stretches proportionally less.
 */
const PEAK_SPEED_PER_TRAVEL = 8;

/*
 * The row gap and the description tighten inside a container narrower than
 * 20rem (@xs), which is where a settings list sits on a phone.
 */
const SIZES = {
  sm: { width: 32, height: 18, thumb: 14, glyph: 8, text: "text-[13px]", desc: "text-[12px]", row: "gap-3 @max-xs:gap-2" },
  md: {
    width: 40,
    height: 22,
    thumb: 18,
    glyph: 9,
    text: "text-[14px]",
    desc: "text-[12.5px] @max-xs:text-[12px]",
    row: "gap-3.5 @max-xs:gap-2.5",
  },
  lg: {
    width: 52,
    height: 30,
    thumb: 24,
    glyph: 11,
    text: "text-[16px]",
    desc: "text-[13.5px] @max-xs:text-[12px]",
    row: "gap-4 @max-xs:gap-3",
  },
} as const;

const THEMES = {
  dark: {
    ink: DARK_INK,
    paper: NEAR_BLACK,
    thumbOff: "#f4f4f5",
    muted: "#8a8a93",
    error: "#f87171",
    thumbShadow: "0 1px 2px rgb(0 0 0 / 0.45), 0 0 0 0.5px rgb(0 0 0 / 0.35)",
  },
  light: {
    ink: "#18181b",
    paper: WHITE,
    thumbOff: WHITE,
    muted: "#71717a",
    error: "#dc2626",
    thumbShadow: "0 1px 2px rgb(24 24 27 / 0.22), 0 0 0 0.5px rgb(24 24 27 / 0.12)",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

type RGB = readonly [number, number, number];

/** Reads a #rgb or #rrggbb colour. Anything else, such as a named colour, returns null. */
function parseHex(hex: string): RGB | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1];
  const value = Number.parseInt(digits, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** WCAG relative luminance: 0 for black, 1 for white. */
function luminance([r, g, b]: RGB): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG contrast ratio between two colours. */
function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The glyph or spinner colour that reads best on a fill: white or near-black, whichever contrasts more. */
function readableOn(fill: string): string {
  const rgb = parseHex(fill);
  if (!rgb) return NEAR_BLACK;
  return contrast(rgb, [255, 255, 255]) >= contrast(rgb, [11, 11, 12]) ? WHITE : NEAR_BLACK;
}

/** The on-thumb colour. Without an accent it is the theme's paper; with one it follows the accent's lightness. */
function thumbOnFor(accent: string | undefined, paper: string): string {
  if (!accent) return paper;
  const rgb = parseHex(accent);
  return rgb && luminance(rgb) > LIGHT_ACCENT ? NEAR_BLACK : WHITE;
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Spinner({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width={size} height={size} className="animate-spin motion-reduce:animate-none">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="22 12" />
    </svg>
  );
}

type Geometry = (typeof SIZES)[SwitchSpringSize];

/** A check on the side the thumb has left and a cross on the side it is heading to: each sits where the thumb is not. */
function TrackGlyphs({ on, geometry, reduce, check }: { on: boolean; geometry: Geometry; reduce: boolean; check: string }) {
  const glyphAt = (centreX: number): CSSProperties => ({
    position: "absolute",
    left: centreX - geometry.glyph / 2,
    top: (geometry.height - geometry.glyph) / 2,
    width: geometry.glyph,
    height: geometry.glyph,
  });
  // The thumb covers one glyph whichever way it sits, so only the free side shows.
  const transition = { duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: reduce ? 0 : on ? 0.08 : 0 };
  return (
    <>
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className="pointer-events-none"
        style={glyphAt((geometry.width - geometry.thumb) / 2)}
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={transition}
      >
        <motion.path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: check }}
          initial={false}
          animate={{ pathLength: on ? 1 : 0 }}
          transition={transition}
        />
      </motion.svg>
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className="pointer-events-none"
        style={glyphAt((geometry.width + geometry.thumb) / 2)}
        initial={false}
        animate={{ opacity: on ? 0 : 1 }}
        transition={transition}
      >
        <motion.path
          d="M5 5 11 11M11 5 5 11"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ stroke: "var(--sw-glyph-off)" }}
          initial={false}
          animate={{ pathLength: on ? 0 : 1 }}
          transition={transition}
        />
      </motion.svg>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The switch                                                          */
/* ------------------------------------------------------------------ */

export function SwitchSpring({
  label = "Email digests",
  description,
  checked,
  defaultChecked = false,
  onCheckedChange,
  async: waitsForChange = false,
  errorMessage,
  size = "md",
  icons = false,
  labelSide = "left",
  accent,
  theme = "dark",
  disabled = false,
  className = "",
}: SwitchSpringProps) {
  const id = useId();
  const reduce = !!useReducedMotion();
  const mounted = useRef(false);
  const isControlled = checked !== undefined;
  const [on, setOn] = useState(checked ?? defaultChecked);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (checked !== undefined) setOn(checked);
  }, [checked]);

  // A refusal replaces the description for a few seconds, then the description returns.
  useEffect(() => {
    if (refusal === null) return;
    const timer = window.setTimeout(() => setRefusal(null), REFUSAL_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [refusal]);

  const geometry = SIZES[size];
  const palette = THEMES[theme];
  const travel = geometry.width - geometry.thumb - PAD * 2;
  const fill = accent || palette.ink;
  const thumbOn = thumbOnFor(accent, palette.paper);
  const thumbOff = palette.thumbOff;
  // The spinner and the check take the colour that reads on whatever they sit on.
  const spinnerInk = readableOn(on ? thumbOn : thumbOff);
  const checkInk = readableOn(fill);

  /* Thumb motion. The position is a spring; the stretch is read from its speed. */
  const x = useMotionValue(on ? travel : 0);
  const velocity = useVelocity(x);
  const live = useRef({ travel, reduce });
  useLayoutEffect(() => {
    live.current = { travel, reduce };
  }, [travel, reduce]);

  /*
   * The fill and the on-thumb colour follow the thumb's position, not `on`, so they
   * travel with the spring. The fill is the wake behind the thumb: it grows from
   * nothing at the off end to the whole track at the on end. The on-thumb colour
   * swaps across the middle of the travel, so the thumb is never grey on grey.
   */
  const fillRef = useRef<HTMLSpanElement>(null);
  const onLayerRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const paint = (position: number) => {
      const progress = clamp(position / travel, 0, 1);
      const wake = progress * geometry.width;
      if (fillRef.current) {
        fillRef.current.style.width = `${wake}px`;
        // A rounded span only a few px wide renders as a bar, so the wake fades in over its first track-height.
        fillRef.current.style.opacity = String(clamp(wake / geometry.height, 0, 1));
      }
      if (onLayerRef.current) {
        onLayerRef.current.style.opacity = String(clamp((progress - SWAP_FROM) / (SWAP_TO - SWAP_FROM), 0, 1));
      }
    };
    paint(x.get());
    return x.on("change", paint);
  }, [x, travel, geometry.width]);

  const stretch = useTransform(velocity, (v) => {
    const { travel: distance, reduce: still } = live.current;
    if (still || distance === 0) return 0;
    return Math.min(Math.abs(v) / (distance * PEAK_SPEED_PER_TRAVEL), 1) * STRETCH_MAX;
  });
  const scaleX = useTransform(stretch, (s) => 1 + s);
  const scaleY = useTransform(stretch, (s) => 1 - s * 0.5);
  // Stretch from the trailing edge so the leading edge is the part that reaches ahead.
  const originX = useTransform(velocity, (v) => (v >= 0 ? 0 : 1));

  /* Refusal. The shake is kept apart from the position so it never fights the spring. */
  const nudge = useMotionValue(0);
  const thumbX = useTransform([x, nudge], ([base, pull]: number[]) => base + pull);
  const dim = useMotionValue(1);

  useEffect(() => {
    const target = on ? travel : 0;
    if (reduce) {
      x.set(target);
      return;
    }
    const spring = animate(x, target, SPRING_UI);
    return () => spring.stop();
  }, [on, travel, reduce, x]);

  const refuse = (next: boolean) => {
    if (!mounted.current) return;
    setRefusal(errorMessage ?? `Couldn't turn ${next ? "on" : "off"} ${label}. Try again.`);
    // Reduced motion keeps the meaning as an opacity dip; the shake is a transform.
    if (reduce) {
      animate(dim, [1, 0.5, 1], { duration: 0.15, ease: EASE_OUT });
      return;
    }
    const side = next ? 1 : -1;
    animate(nudge, [0, side * REFUSAL_SHAKE[0], side * REFUSAL_SHAKE[1], 0], SPRING_UI);
  };

  const request = (next: boolean) => {
    if (disabled || pending) return;
    setRefusal(null);
    if (!onCheckedChange) {
      if (!isControlled) setOn(next);
      return;
    }
    const outcome = Promise.resolve(onCheckedChange(next)).then(
      () => true,
      () => false,
    );
    if (!waitsForChange) {
      if (!isControlled) setOn(next);
      outcome.then((landed) => {
        if (landed || !mounted.current) return;
        if (!isControlled) setOn(!next);
        refuse(next);
      });
      return;
    }
    setPending(true);
    outcome.then((landed) => {
      if (!mounted.current) return;
      setPending(false);
      if (landed) {
        if (!isControlled) setOn(next);
      } else {
        refuse(next);
      }
    });
  };

  const describedBy = [description ? `${id}-desc` : null, waitsForChange ? `${id}-async` : null].filter(Boolean).join(" ");

  // Colours that CSS can own live in variables on the root. The thumb's colours are
  // set directly on its elements, so the spring can swap them mid-travel.
  const vars = {
    "--sw-ink": palette.ink,
    "--sw-muted": palette.muted,
    "--sw-error": palette.error,
    "--sw-thumb-shadow": palette.thumbShadow,
    "--sw-fill": fill,
    // Steps 12% toward the surface, so the hover reads on white and near-white fills alike.
    "--sw-fill-hover": `color-mix(in srgb, ${fill} 88%, ${palette.paper})`,
    "--sw-track": `color-mix(in srgb, ${palette.ink} 12%, transparent)`,
    "--sw-track-hover": `color-mix(in srgb, ${palette.ink} 18%, transparent)`,
    "--sw-track-ring": `color-mix(in srgb, ${palette.ink} 16%, transparent)`,
    "--sw-glyph-off": `color-mix(in srgb, ${palette.ink} 45%, transparent)`,
  } as CSSProperties;

  // Hover and press reach the track from anywhere on the row, so the label text gives feedback too.
  // A pending or disabled switch takes no interaction styling, because its clicks are ignored.
  const idle = !disabled && !pending;
  const hoverTrack = idle ? "group-hover/switch:bg-(--sw-track-hover)" : "";
  const hoverFill = idle ? "group-hover/switch:bg-(--sw-fill-hover)" : "";
  const pressed = idle ? "group-active/switch:scale-[0.97]" : "";

  // A refusal swaps the description for the message: a 4-8px offset with a 2-4px blur, or opacity alone under reduced motion.
  const soft = reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(3px)" };
  const settled = reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" };
  const crossfade = { duration: reduce ? 0.15 : 0.18, ease: EASE_OUT };

  const track = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={`${id}-label`}
      aria-describedby={describedBy || undefined}
      aria-busy={pending || undefined}
      disabled={disabled}
      onClick={() => request(!on)}
      style={{ width: geometry.width, height: geometry.height }}
      className={`relative shrink-0 rounded-full bg-(--sw-track) ring-1 ring-inset ring-(--sw-track-ring) transition-[background-color,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sw-ink) disabled:cursor-not-allowed ${hoverTrack} ${pressed}`}
    >
      {/* The wake: grows with the thumb from nothing (off) to the whole track (on). */}
      <span
        ref={fillRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 rounded-full bg-(--sw-fill) transition-colors duration-150 ease-out ${hoverFill}`}
      />
      {icons ? <TrackGlyphs on={on} geometry={geometry} reduce={reduce} check={checkInk} /> : null}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute grid place-items-center rounded-full"
        style={{
          left: PAD,
          top: (geometry.height - geometry.thumb) / 2,
          width: geometry.thumb,
          height: geometry.thumb,
          x: thumbX,
          scaleX,
          scaleY,
          originX,
          opacity: dim,
          backgroundColor: thumbOff,
          color: spinnerInk,
          boxShadow: "var(--sw-thumb-shadow)",
        }}
      >
        <span ref={onLayerRef} aria-hidden="true" className="absolute inset-0 rounded-full" style={{ backgroundColor: thumbOn }} />
        <span className="relative grid place-items-center">{pending ? <Spinner size={geometry.thumb - 7} /> : null}</span>
      </motion.span>
    </button>
  );

  const showSecondLine = Boolean(description) || refusal !== null;

  const text = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span id={`${id}-label`} className={`${geometry.text} font-medium tracking-[-0.01em] text-(--sw-ink)`}>
        {label}
      </span>
      {showSecondLine ? (
        <span className="grid">
          {description ? (
            <motion.span
              id={`${id}-desc`}
              style={{ gridArea: "1 / 1" }}
              initial={false}
              animate={refusal !== null ? soft : settled}
              transition={crossfade}
              className={`${geometry.desc} leading-[1.45] text-(--sw-muted)`}
            >
              {description}
            </motion.span>
          ) : null}
          <AnimatePresence initial={false}>
            {refusal !== null ? (
              <motion.span
                key="refusal"
                aria-hidden="true"
                style={{ gridArea: "1 / 1" }}
                initial={soft}
                animate={settled}
                exit={soft}
                transition={crossfade}
                className={`${geometry.desc} leading-[1.45] font-medium text-(--sw-error)`}
              >
                {refusal}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      ) : null}
      {waitsForChange ? (
        <span id={`${id}-async`} className="sr-only">
          Confirms with the server before it switches.
        </span>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {refusal}
      </span>
    </span>
  );

  const cursor = disabled ? "cursor-not-allowed opacity-40" : pending ? "cursor-progress" : "cursor-pointer";

  return (
    <div className={`@container w-full ${className}`} style={vars}>
      <label htmlFor={id} className={`group/switch flex items-center ${geometry.row} ${cursor}`}>
        {labelSide === "right" ? (
          <>
            {track}
            {text}
          </>
        ) : (
          <>
            {text}
            {track}
          </>
        )}
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: a settings list, flipped by the cursor                        */
/* ------------------------------------------------------------------ */

/** How long the async row holds its thumb in the demo before it lands. */
const DEMO_HOLD_MS = 800;

/** The message for the first attempt to pause sync. The retry succeeds, so a visitor can see both beats. */
const SYNC_REFUSAL = "Couldn't pause sync. Try again.";

const DEMO_ROWS = [
  {
    key: "updates",
    target: "switch-updates",
    label: "Product updates",
    description: "One note a month, when something you use changes.",
    async: false,
    defaultOn: false,
  },
  {
    key: "digest",
    target: "switch-digest",
    label: "Weekly digest",
    description: "Mondays at 8:00, summarising what changed in your notes.",
    async: false,
    defaultOn: true,
  },
  {
    key: "sync",
    target: "switch-sync",
    label: "Sync to devices",
    description: "Pushes changes to your other devices.",
    async: true,
    defaultOn: false,
  },
] as const;

type DemoRow = (typeof DEMO_ROWS)[number];

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

/** Tweens a count from its current value, so switching on reads as a tally, not a jump. */
function useCountUp(target: number, reduce: boolean) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (current.current === target) return;
    const counter = animate(current.current, target, {
      duration: reduce ? 0 : 0.5,
      ease: EASE_OUT,
      onUpdate: (v) => {
        current.current = v;
        setShown(Math.round(v));
      },
    });
    return () => counter.stop();
  }, [target, reduce]);
  return shown;
}

/**
 * The demo owns each switch's state, so `checked`, `defaultChecked` and `onCheckedChange`
 * are taken out of the overrides: the demo's own handlers drive the rows. Every other
 * prop reaches the featured (async) row.
 */
export default function SwitchSpringDemo({
  checked: _checked,
  defaultChecked: _defaultChecked,
  onCheckedChange: _onCheckedChange,
  size = "md",
  icons = true,
  labelSide = "left",
  accent = DARK_INK,
  theme = "dark",
  async: holdsChange = true,
  disabled = false,
  ...featured
}: Partial<SwitchSpringProps> = {}) {
  const reduce = !!useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, amount: 0.3 });
  const [flags, setFlags] = useState<boolean[]>(() => DEMO_ROWS.map((row) => row.defaultOn));
  // The first attempt to pause sync is refused, so a visitor sees the refusal and can retry.
  const syncRefusals = useRef(0);
  const setFlag = (index: number, value: boolean) => setFlags((prev) => prev.map((f, i) => (i === index ? value : f)));
  const onCount = flags.filter(Boolean).length;
  const shownCount = useCountUp(inView ? onCount : 0, reduce);
  // The default swatch is the theme's own ink, so it is passed as no accent at all.
  const shownAccent = accent === DARK_INK ? undefined : accent;

  const flipFor = (index: number, row: DemoRow) => (next: boolean): void | Promise<void> => {
    if (!row.async) {
      setFlag(index, next);
      return;
    }
    // The count follows the switch: at once when the switch flips at once, on landing when it holds.
    if (!holdsChange) setFlag(index, next);
    return wait(DEMO_HOLD_MS)
      .then(() => {
        if (!next && syncRefusals.current === 0) {
          syncRefusals.current += 1;
          throw new Error("Sync can't be paused right now.");
        }
        setFlag(index, next);
      })
      .catch((error: unknown) => {
        if (!holdsChange) setFlag(index, !next);
        throw error;
      });
  };

  const stage = theme === "dark" ? STAGE_DARK : STAGE_LIGHT;
  const rise = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 12, filter: "blur(8px)" }, shown: { opacity: 1, y: 0, filter: "blur(0px)" } };
  const landing = inView ? "shown" : "hidden";

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-(--stage-bg) p-6 sm:p-10" style={stage}>
      <motion.div
        ref={cardRef}
        variants={rise}
        initial="hidden"
        animate={landing}
        transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT }}
        className="w-full max-w-[440px] rounded-[18px] bg-(--stage-card) p-5 ring-1 ring-inset ring-(--stage-ring) shadow-(--stage-shadow)"
      >
        <motion.div
          variants={rise}
          initial="hidden"
          animate={landing}
          transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : 0.06 }}
          className="flex items-baseline justify-between pb-2 font-mono text-[11px] tracking-[0.12em] text-(--stage-muted) uppercase"
        >
          <span>Notifications</span>
          <span>
            <span className="tabular-nums">{shownCount}</span> of {DEMO_ROWS.length} on
          </span>
        </motion.div>

        <ul aria-label="Notifications" className="list-none">
          {DEMO_ROWS.map((row, i) => (
            <motion.li
              key={row.key}
              variants={rise}
              initial="hidden"
              animate={landing}
              transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : 0.16 + i * 0.06 }}
              className="border-t border-(--stage-line) py-4 first:border-t-0 last:pb-0"
            >
              <div data-demo={row.target}>
                <SwitchSpring
                  label={row.label}
                  description={row.description}
                  defaultChecked={row.defaultOn}
                  onCheckedChange={flipFor(i, row)}
                  async={row.async ? holdsChange : false}
                  errorMessage={row.async ? SYNC_REFUSAL : undefined}
                  size={size}
                  icons={icons}
                  labelSide={labelSide}
                  accent={shownAccent}
                  theme={theme}
                  disabled={row.async ? disabled : false}
                  {...(row.async ? featured : {})}
                />
              </div>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

const STAGE_DARK = {
  "--stage-bg": "#09090b",
  "--stage-card": "#111113",
  "--stage-ring": "rgb(255 255 255 / 0.08)",
  "--stage-line": "rgb(255 255 255 / 0.07)",
  "--stage-muted": "#8a8a93",
  "--stage-shadow": "0 24px 60px -28px rgb(0 0 0 / 0.7)",
} as CSSProperties;

const STAGE_LIGHT = {
  "--stage-bg": "#f4f4f5",
  "--stage-card": "#ffffff",
  "--stage-ring": "rgb(24 24 27 / 0.08)",
  "--stage-line": "rgb(24 24 27 / 0.08)",
  "--stage-muted": "#71717a",
  "--stage-shadow": "0 24px 60px -28px rgb(24 24 27 / 0.25)",
} as CSSProperties;
