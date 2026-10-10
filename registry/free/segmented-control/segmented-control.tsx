"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Calendar, CalendarClock, CalendarDays, CalendarRange, History, Sun } from "lucide-react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SegmentedControlOption = {
  /** Stable key for the segment. It doubles as the demo target, so keep it unique on the page. */
  value: string;
  label: string;
  /** A glyph before the label. Shown only while `icons` is on. */
  icon?: ReactNode;
  /** A quiet number after the label. Shown only while `counts` is on. */
  count?: number;
  disabled?: boolean;
};

export type SegmentedControlSize = "sm" | "md";
export type SegmentedControlWidth = "equal" | "content";
export type SegmentedControlTheme = "dark" | "light";

export type SegmentedControlProps = {
  /** Accessible name of the group, read by screen readers. */
  label?: string;
  /** The segments. Leave out to use the built-in periods, chosen by `segments`. */
  options?: SegmentedControlOption[];
  /** How many built-in periods to show, from 2 to 6. Ignored when `options` is given. */
  segments?: number;
  /** Controlled selection. Update it from `onValueChange`. */
  value?: string;
  /** Starting selection when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string, option: SegmentedControlOption) => void;
  /**
   * Equal segments share the track's width. Content sizes each segment to its label and,
   * when the track is too narrow, scrolls it sideways behind soft edges.
   */
  width?: SegmentedControlWidth;
  /** Glyphs before the labels. */
  icons?: boolean;
  /** Counts after the labels. */
  counts?: boolean;
  size?: SegmentedControlSize;
  theme?: SegmentedControlTheme;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

/** spring.ui from the library's motion tokens: the pill travels with no bounce. */
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** Width of the fade that signals more segments past an edge, in px. */
const FADE_WIDTH = 28;
/**
 * Clearance kept between a scrolled-to segment and the track edge, in px. It clears the fade
 * plus a little air, so an edge fade never covers the selected segment or its focus ring.
 */
const EDGE_CLEARANCE = FADE_WIDTH + 4;

const SIZES = {
  sm: { height: 30, track: 10, text: "text-[13px]", count: "text-[12px]", icon: 13, gap: 5 },
  md: { height: 36, track: 11, text: "text-[14px]", count: "text-[13px]", icon: 15, gap: 6 },
} as const;

const THEMES = {
  dark: {
    track: "#19191c",
    ring: "rgb(255 255 255 / 0.07)",
    pill: "#2c2c31",
    pillShadow:
      "inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.08), 0 1px 2px rgb(0 0 0 / 0.5), 0 6px 14px -6px rgb(0 0 0 / 0.7)",
    hover: "rgb(255 255 255 / 0.04)",
    ink: "#f4f4f5",
    muted: "#8a8a93",
  },
  light: {
    track: "#f1f1f3",
    ring: "rgb(24 24 27 / 0.07)",
    pill: "#ffffff",
    pillShadow:
      "inset 0 0 0 1px rgb(24 24 27 / 0.05), inset 0 1px 0 #ffffff, 0 1px 2px rgb(24 24 27 / 0.1), 0 6px 14px -8px rgb(24 24 27 / 0.28)",
    hover: "rgb(24 24 27 / 0.04)",
    ink: "#18181b",
    muted: "#64646e",
  },
} as const;

/** Where the pill sits, in the track's content coordinates, so scrolling the track never moves it off its segment. */
type PillBox = { x: number; width: number };

/* ------------------------------------------------------------------ */
/* Built-in periods                                                    */
/* ------------------------------------------------------------------ */

const PERIODS: SegmentedControlOption[] = [
  { value: "day", label: "Day", icon: <Sun />, count: 3 },
  { value: "week", label: "Week", icon: <CalendarDays />, count: 17 },
  { value: "month", label: "Month", icon: <Calendar />, count: 64 },
  { value: "quarter", label: "Quarter", icon: <CalendarRange />, count: 188 },
  { value: "year", label: "Year", icon: <CalendarClock />, count: 741 },
  { value: "all", label: "All time", icon: <History />, count: 2314 },
];

/**
 * Which periods each segment count shows. Every set keeps Week and Year so a
 * count change never strands the demo's targets, and each reads in time order.
 */
const PERIOD_SETS: Record<2 | 3 | 4 | 5 | 6, readonly string[]> = {
  2: ["week", "year"],
  3: ["week", "month", "year"],
  4: ["day", "week", "month", "year"],
  5: ["day", "week", "month", "quarter", "year"],
  6: ["day", "week", "month", "quarter", "year", "all"],
};

const NUMBER = new Intl.NumberFormat("en-US");

function periodsFor(segments: number): SegmentedControlOption[] {
  const count = Number.isFinite(segments) ? Math.min(6, Math.max(2, Math.round(segments))) : 3;
  const keep = PERIOD_SETS[count as 2 | 3 | 4 | 5 | 6];
  return PERIODS.filter((period) => keep.includes(period.value));
}

/** The next enabled index from `from` in `direction`, wrapping at the ends the way native radios do. */
function nextEnabled(options: SegmentedControlOption[], from: number, direction: 1 | -1): number {
  const total = options.length;
  for (let step = 1; step <= total; step++) {
    const index = (((from + direction * step) % total) + total) % total;
    if (!options[index].disabled) return index;
  }
  return from;
}

/* ------------------------------------------------------------------ */
/* The control                                                         */
/* ------------------------------------------------------------------ */

export function SegmentedControl({
  label = "Period",
  options,
  segments = 3,
  value,
  defaultValue,
  onValueChange,
  width = "equal",
  icons = true,
  counts = false,
  size = "md",
  theme = "dark",
  className = "",
}: SegmentedControlProps) {
  const reduce = !!useReducedMotion();
  const items = options ?? periodsFor(segments);
  const [internal, setInternal] = useState<string | undefined>(defaultValue ?? items[0]?.value);

  const current = value ?? internal;
  const firstEnabled = items.findIndex((option) => !option.disabled);
  const matched = items.findIndex((option) => option.value === current && !option.disabled);
  // A selection that is not in the current set falls back to the first enabled segment. When every
  // segment is disabled there is no selection: the track still renders, locked, with no pill.
  const selectedIndex = matched >= 0 ? matched : firstEnabled;

  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const scroller = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [pill, setPill] = useState<PillBox | null>(null);
  const scrolls = width === "content";

  const readEdges = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const start = box.scrollLeft > 1;
    const end = box.scrollLeft + box.clientWidth < box.scrollWidth - 1;
    setEdges((previous) => (previous.start === start && previous.end === end ? previous : { start, end }));
  }, []);

  // One pill, beneath every label. It is measured from the selected segment, so a label is never
  // painted over by a pill that is passing it, and it follows the track's own scroll for free.
  const measurePill = useCallback(() => {
    const button = buttons.current[selectedIndex];
    if (!button) {
      setPill(null);
      return;
    }
    const next = { x: button.offsetLeft, width: button.offsetWidth };
    setPill((previous) => (previous && previous.x === next.x && previous.width === next.width ? previous : next));
  }, [selectedIndex]);

  // Brings the selected segment inside the visible track, clear of both edge fades. A pick scrolls
  // smoothly; a resize snaps, so the selection stays in view while the box is still changing size.
  const reveal = useCallback(
    (behavior: ScrollBehavior) => {
      const box = scroller.current;
      const button = buttons.current[selectedIndex];
      if (!scrolls || !box || !button) return;
      const left = button.offsetLeft;
      const right = left + button.offsetWidth;
      const view = box.clientWidth;
      let target: number | null = null;
      if (left < box.scrollLeft + EDGE_CLEARANCE) target = left - EDGE_CLEARANCE;
      else if (right > box.scrollLeft + view - EDGE_CLEARANCE) target = right - view + EDGE_CLEARANCE;
      if (target !== null) box.scrollTo({ left: Math.max(0, target), behavior });
    },
    [scrolls, selectedIndex],
  );

  // Labels, icons and counts change the track's width without a scroll, so the fades, the pill and
  // the selection all re-read on every resize of the track or its content.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    if (!box || !inner) return;
    const observer = new ResizeObserver(() => {
      readEdges();
      measurePill();
      reveal("auto");
    });
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [readEdges, measurePill, reveal]);

  // Measured before paint, so the pill is never seen at a stale position.
  useLayoutEffect(() => {
    measurePill();
  }, [measurePill, options, segments, icons, counts, size, scrolls]);

  useEffect(() => {
    reveal(reduce ? "auto" : "smooth");
  }, [reveal, reduce]);

  const choose = (index: number) => {
    const option = items[index];
    if (!option || option.disabled || index === selectedIndex) return;
    if (value === undefined) setInternal(option.value);
    onValueChange?.(option.value, option);
  };

  // Radio-group keys: arrows move and select, Home and End jump to the ends. Focus follows the selection.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabled = items.flatMap((option, i) => (option.disabled ? [] : [i]));
    let target: number | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        target = nextEnabled(items, index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        target = nextEnabled(items, index, -1);
        break;
      case "Home":
        target = enabled[0];
        break;
      case "End":
        target = enabled[enabled.length - 1];
        break;
      default:
        return;
    }
    if (target === undefined) return;
    event.preventDefault();
    choose(target);
    buttons.current[target]?.focus();
  };

  if (items.length === 0) return null;

  const palette = THEMES[theme];
  const geometry = SIZES[size];
  const pillTransition = reduce ? { duration: 0 } : SPRING_UI;

  const vars = {
    "--sg-track": palette.track,
    "--sg-ring": palette.ring,
    "--sg-pill": palette.pill,
    "--sg-pill-shadow": palette.pillShadow,
    "--sg-hover": palette.hover,
    "--sg-ink": palette.ink,
    "--sg-muted": palette.muted,
  } as CSSProperties;

  return (
    <div className={`@container w-full ${className}`} style={vars}>
      <div
        role="radiogroup"
        aria-label={label}
        className={`relative flex max-w-full p-[3px] ${scrolls ? "w-fit" : "w-full"}`}
        style={{
          borderRadius: geometry.track,
          backgroundColor: "var(--sg-track)",
          boxShadow: `inset 0 0 0 1px ${palette.ring}`,
        }}
      >
        <div
          ref={scroller}
          onScroll={readEdges}
          className={`relative flex min-w-0 flex-1 ${scrolls ? "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "overflow-hidden"}`}
        >
          <div ref={content} className={`relative flex ${scrolls ? "w-max" : "w-full"}`}>
            {pill ? (
              <motion.span
                aria-hidden="true"
                initial={false}
                animate={{ x: pill.x, width: pill.width }}
                transition={pillTransition}
                className="pointer-events-none absolute inset-y-0 left-0"
                style={{
                  borderRadius: geometry.track - 3,
                  backgroundColor: "var(--sg-pill)",
                  boxShadow: "var(--sg-pill-shadow)",
                }}
              />
            ) : null}
            {items.map((option, index) => {
              const active = index === selectedIndex;
              return (
                <button
                  key={option.value}
                  ref={(node) => {
                    buttons.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  disabled={option.disabled}
                  data-demo={option.value}
                  onClick={() => choose(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  style={{ height: geometry.height, borderRadius: geometry.track - 3 }}
                  className={`group relative flex items-center justify-center px-2.5 font-medium tracking-[-0.01em] whitespace-nowrap transition-[color] duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-[3px] focus-visible:outline-(--sg-ink) enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 @[22rem]:px-3.5 ${geometry.text} ${
                    scrolls ? "shrink-0" : "min-w-0 flex-1 basis-0"
                  } ${active ? "text-(--sg-ink)" : "text-(--sg-muted) enabled:hover:bg-(--sg-hover) enabled:hover:text-(--sg-ink)"}`}
                >
                  {/* The press lives on the label, not the segment, so the pill beneath never changes stacking. */}
                  <span
                    className="flex min-w-0 items-center transition-transform duration-[90ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-active:scale-[0.97]"
                    style={{ gap: geometry.gap }}
                  >
                    {icons ? (
                      <span
                        aria-hidden="true"
                        className={`grid shrink-0 place-items-center [&>svg]:size-full [&>svg]:stroke-[1.75] ${
                          scrolls ? "" : "@max-[22rem]:hidden"
                        }`}
                        style={{ width: geometry.icon, height: geometry.icon }}
                      >
                        {option.icon}
                      </span>
                    ) : null}
                    <span className={scrolls ? "" : "truncate"}>{option.label}</span>
                    {counts && option.count !== undefined ? (
                      <span className={`tabular-nums text-(--sg-muted) ${geometry.count}`}>{NUMBER.format(option.count)}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {scrolls ? (
          <>
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-0 z-10 transition-opacity duration-200 ease-out ${edges.start ? "opacity-100" : "opacity-0"}`}
              style={{ width: FADE_WIDTH, background: "linear-gradient(to right, var(--sg-track), transparent)" }}
            />
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 right-0 z-10 transition-opacity duration-200 ease-out ${edges.end ? "opacity-100" : "opacity-0"}`}
              style={{ width: FADE_WIDTH, background: "linear-gradient(to left, var(--sg-track), transparent)" }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: one control, narrowed into a column so its overflow shows     */
/* ------------------------------------------------------------------ */

/** The width the demo narrows its column to, in px. Narrow enough that the three periods overflow. */
const NARROW_WIDTH = 232;

const STAGE_DARK = {
  "--stage-bg": "#09090b",
  "--stage-card": "#111113",
  "--stage-ring": "rgb(255 255 255 / 0.08)",
  "--stage-line": "rgb(255 255 255 / 0.07)",
  "--stage-muted": "#8a8a93",
  "--stage-ink": "#f4f4f5",
  "--stage-shadow": "0 24px 60px -28px rgb(0 0 0 / 0.7)",
} as CSSProperties;

const STAGE_LIGHT = {
  "--stage-bg": "#f4f4f5",
  "--stage-card": "#ffffff",
  "--stage-ring": "rgb(24 24 27 / 0.08)",
  "--stage-line": "rgb(24 24 27 / 0.08)",
  "--stage-muted": "#71717a",
  "--stage-ink": "#18181b",
  "--stage-shadow": "0 24px 60px -28px rgb(24 24 27 / 0.25)",
} as CSSProperties;

/** Tweens a count from its current value, so a change reads as a tally rather than a jump. */
function useCountUp(target: number, reduce: boolean) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (current.current === target) return;
    const counter = animate(current.current, target, {
      duration: reduce ? 0 : 0.5,
      ease: EASE_OUT,
      onUpdate: (next) => {
        current.current = next;
        setShown(Math.round(next));
      },
    });
    return () => counter.stop();
  }, [target, reduce]);
  return shown;
}

export default function SegmentedControlDemo({
  segments = 3,
  width = "equal",
  icons = true,
  counts = true,
  size = "md",
  theme = "dark",
  ...overrides
}: Partial<SegmentedControlProps> = {}) {
  const reduce = !!useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, amount: 0.3 });
  const [picked, setPicked] = useState("month");
  const [narrow, setNarrow] = useState(false);

  // The readout follows the control's own fallback, so it never names a period the track is not showing.
  const sets = periodsFor(segments);
  const active = sets.find((period) => period.value === picked) ?? sets[0];
  const shownCount = useCountUp(inView ? (active.count ?? 0) : 0, reduce);

  const stage = theme === "dark" ? STAGE_DARK : STAGE_LIGHT;
  const rise = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 12, filter: "blur(8px)" }, shown: { opacity: 1, y: 0, filter: "blur(0px)" } };
  const landing = inView ? "shown" : "hidden";
  const enter = (delay: number) => ({ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : delay });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--stage-bg) p-6 sm:p-10" style={stage}>
      <motion.div
        ref={cardRef}
        variants={rise}
        initial="hidden"
        animate={landing}
        transition={enter(0)}
        className="w-full max-w-[440px] rounded-[18px] bg-(--stage-card) p-5 ring-1 ring-inset ring-(--stage-ring) shadow-(--stage-shadow)"
      >
        <motion.div
          variants={rise}
          initial="hidden"
          animate={landing}
          transition={enter(0.06)}
          className="flex items-baseline justify-between gap-4 pb-4 font-mono text-[11px] tracking-[0.12em] text-(--stage-muted) uppercase"
        >
          <span>Dictation volume</span>
          <span>
            {active.label} · <span className="tabular-nums">{NUMBER.format(shownCount)}</span>
          </span>
        </motion.div>

        <motion.div variants={rise} initial="hidden" animate={landing} transition={enter(0.16)}>
          {/* The column narrows under the control. Its width switches to content, so the overflow shows. */}
          <motion.div
            initial={false}
            animate={{ width: narrow ? NARROW_WIDTH : "100%" }}
            transition={{ duration: reduce ? 0 : 0.42, ease: EASE_IN_OUT }}
            className="max-w-full"
          >
            <SegmentedControl
              label="Period"
              segments={segments}
              width={narrow ? "content" : width}
              icons={icons}
              counts={counts}
              size={size}
              theme={theme}
              value={active.value}
              onValueChange={(next) => setPicked(next)}
              {...overrides}
            />
          </motion.div>
        </motion.div>

        <motion.div
          variants={rise}
          initial="hidden"
          animate={landing}
          transition={enter(0.26)}
          className="mt-5 flex border-t border-(--stage-line) pt-4"
        >
          <button
            type="button"
            data-demo="narrow"
            aria-pressed={narrow}
            onClick={() => setNarrow((on) => !on)}
            className="-ml-2 rounded-md px-2 py-1 font-mono text-[11px] tracking-[0.12em] text-(--stage-muted) uppercase transition-[color,transform] duration-150 ease-out hover:text-(--stage-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--stage-ink) active:scale-[0.97] aria-pressed:text-(--stage-ink)"
          >
            Narrow column
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
