"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, useVelocity } from "motion/react";

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
   * Either way a rejection nudges the thumb and is announced.
   */
  async?: boolean;
  /** Announced, and shown by a nudge of the thumb, when a change is refused. */
  errorMessage?: string;
  size?: SwitchSpringSize;
  /** Glyphs in the track: a check while on, a cross while off. */
  icons?: boolean;
  /** Which side of the track the label sits on. */
  labelSide?: SwitchSpringLabelSide;
  /** The fill while on. Leave out for the theme's ink. */
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

/** How far a refused change pulls the thumb toward the side it asked for, in px. */
const REFUSAL_NUDGE_PX = 3;

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
    paper: "#0b0b0c",
    thumbOff: "#f4f4f5",
    muted: "#8a8a93",
    thumbShadow: "0 1px 2px rgb(0 0 0 / 0.45), 0 0 0 0.5px rgb(255 255 255 / 0.08)",
  },
  light: {
    ink: "#18181b",
    paper: "#ffffff",
    thumbOff: "#ffffff",
    muted: "#71717a",
    thumbShadow: "0 1px 2px rgb(24 24 27 / 0.22), 0 0 0 0.5px rgb(24 24 27 / 0.06)",
  },
} as const;

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
function TrackGlyphs({ on, geometry, reduce }: { on: boolean; geometry: Geometry; reduce: boolean }) {
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
          style={{ stroke: "var(--sw-paper)" }}
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

  const geometry = SIZES[size];
  const palette = THEMES[theme];
  const travel = geometry.width - geometry.thumb - PAD * 2;
  const fill = accent ?? palette.ink;

  /* Thumb motion. The position is a spring; the stretch is read from its speed. */
  const x = useMotionValue(on ? travel : 0);
  const velocity = useVelocity(x);
  const live = useRef({ travel, reduce });
  useLayoutEffect(() => {
    live.current = { travel, reduce };
  }, [travel, reduce]);

  const stretch = useTransform(velocity, (v) => {
    const { travel: distance, reduce: still } = live.current;
    if (still || distance === 0) return 0;
    return Math.min(Math.abs(v) / (distance * PEAK_SPEED_PER_TRAVEL), 1) * STRETCH_MAX;
  });
  const scaleX = useTransform(stretch, (s) => 1 + s);
  const scaleY = useTransform(stretch, (s) => 1 - s * 0.5);
  // Stretch from the trailing edge so the leading edge is the part that reaches ahead.
  const originX = useTransform(velocity, (v) => (v >= 0 ? 0 : 1));

  /* Refusal. The nudge is kept apart from the position so it never fights the spring. */
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
    // Reduced motion keeps the meaning as an opacity dip; the pull is a transform.
    if (reduce) animate(dim, [1, 0.5, 1], { duration: 0.15, ease: EASE_OUT });
    else animate(nudge, [0, next ? REFUSAL_NUDGE_PX : -REFUSAL_NUDGE_PX, 0], SPRING_UI);
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

  // The track's colour comes from these variables, never inline, so the hover steps can win.
  const vars = {
    "--sw-ink": palette.ink,
    "--sw-paper": palette.paper,
    "--sw-thumb-off": palette.thumbOff,
    "--sw-muted": palette.muted,
    "--sw-thumb-shadow": palette.thumbShadow,
    "--sw-fill": fill,
    // Steps 12% toward the surface, so the hover reads on white and near-white fills alike.
    "--sw-fill-hover": `color-mix(in srgb, ${fill} 88%, ${palette.paper})`,
    "--sw-track": `color-mix(in srgb, ${palette.ink} 12%, transparent)`,
    "--sw-track-hover": `color-mix(in srgb, ${palette.ink} 18%, transparent)`,
    "--sw-track-ring": `color-mix(in srgb, ${palette.ink} 16%, transparent)`,
    "--sw-glyph-off": `color-mix(in srgb, ${palette.ink} 45%, transparent)`,
    "--sw-bg": on ? "var(--sw-fill)" : "var(--sw-track)",
    "--sw-bg-hover": on ? "var(--sw-fill-hover)" : "var(--sw-track-hover)",
  } as CSSProperties;

  // Hover and press reach the track from anywhere on the row, so the label text gives feedback too.
  const interactive = disabled
    ? ""
    : "group-hover/switch:bg-(--sw-bg-hover) group-active/switch:scale-[0.97]";

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
      className={`relative shrink-0 rounded-full bg-(--sw-bg) transition-[background-color,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sw-ink) disabled:cursor-not-allowed ${
        on ? "" : "ring-1 ring-inset ring-(--sw-track-ring)"
      } ${interactive}`}
    >
      {icons ? <TrackGlyphs on={on} geometry={geometry} reduce={reduce} /> : null}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute grid place-items-center rounded-full transition-colors duration-150 ease-out"
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
          backgroundColor: on ? "var(--sw-paper)" : "var(--sw-thumb-off)",
          color: on ? "var(--sw-ink)" : "var(--sw-paper)",
          boxShadow: "var(--sw-thumb-shadow)",
        }}
      >
        {pending ? <Spinner size={geometry.thumb - 7} /> : null}
      </motion.span>
    </button>
  );

  const text = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span id={`${id}-label`} className={`${geometry.text} font-medium tracking-[-0.01em] text-(--sw-ink)`}>
        {label}
      </span>
      {description ? (
        <span id={`${id}-desc`} className={`${geometry.desc} leading-[1.45] text-(--sw-muted)`}>
          {description}
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

  return (
    <div className={`@container w-full ${className}`} style={vars}>
      <label
        htmlFor={id}
        data-side={labelSide}
        className={`group/switch flex items-center ${geometry.row} ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
      >
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
 * The demo owns each switch's state, so the controlled and handler props stay with it.
 * Every other prop reaches the featured (async) row.
 */
type DemoOverrides = Partial<Omit<SwitchSpringProps, "checked" | "defaultChecked" | "onCheckedChange">>;

export default function SwitchSpringDemo({
  size = "md",
  icons = true,
  labelSide = "left",
  accent = DARK_INK,
  theme = "dark",
  async: holdsChange = true,
  disabled = false,
  ...featured
}: DemoOverrides = {}) {
  const reduce = !!useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, amount: 0.3 });
  const [flags, setFlags] = useState<boolean[]>(() => DEMO_ROWS.map((row) => row.defaultOn));
  const setFlag = (index: number, value: boolean) => setFlags((prev) => prev.map((f, i) => (i === index ? value : f)));
  const onCount = flags.filter(Boolean).length;
  const shownCount = useCountUp(inView ? onCount : 0, reduce);
  // The default swatch is the theme's own ink, so it is passed as no accent at all.
  const shownAccent = accent === DARK_INK ? undefined : accent;

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
              className="border-t border-(--stage-line) py-4 first:border-t-0"
            >
              <div data-demo={row.target}>
                <SwitchSpring
                  label={row.label}
                  description={row.description}
                  defaultChecked={row.defaultOn}
                  onCheckedChange={
                    row.async
                      ? (next) =>
                          wait(DEMO_HOLD_MS).then(() => {
                            // Turning sync off is refused here, so the refusal beat can be seen without a control.
                            if (!next) throw new Error("Sync can't be paused right now.");
                            setFlag(i, next);
                          })
                      : (next) => setFlag(i, next)
                  }
                  async={row.async ? holdsChange : false}
                  size={size}
                  icons={icons}
                  labelSide={labelSide}
                  accent={shownAccent}
                  theme={theme}
                  disabled={disabled}
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
